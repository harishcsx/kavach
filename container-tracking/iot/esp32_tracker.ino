/**
 * ================================================================
 * IoT Chemical Container Tracking System
 * ESP32 DevKit v4 — Single File Implementation
 *
 * Modified for new /iot/sync endpoint (No GPS/Location, HMAC Payload)
 * ================================================================
 */

#include <SPI.h>
#include <Wire.h>
#include <MPU6050.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include "mbedtls/md.h"

// ================================================================
// ===== CONFIGURATION =====
// ================================================================

// WiFi
#define WIFI_SSID              "Wokwi-GUEST"
#define WIFI_PASS              ""
#define WIFI_RETRY_INTERVAL_MS  10000UL

// Device & Container Provisioning
// MUST MATCH BACKEND DB GENERATED DATA
#define CONTAINER_NUMBER       "YOUR-CONTAINER-ID"
#define SECRET_KEY             "your-secret-key-from-backend-dashboard"

// API - Replace with your backend's IP and port
#define API_ENDPOINT           "http://192.168.1.XXX:5000/iot/sync"
#define API_TIMEOUT_MS         5000
#define API_MAX_RETRIES        3
#define API_RETRY_BACKOFF_MS   2000UL
#define EVENT_QUEUE_SIZE       20

// Pin definitions
#define MPU_SDA_PIN            21
#define MPU_SCL_PIN            22
#define BUTTON_PIN             34
#define LDR_PIN                32
#define METAL_STRIP_PIN        33
#define LED_PIN                26
#define BUZZER_PIN             25

// Tamper thresholds
#define BUTTON_HOLD_MS         2000UL
#define SEAL_LOW_MS            1000UL
#define LDR_THRESHOLD          2500
#define LDR_SUSTAINED_MS       3000UL
#define LDR_AVG_SAMPLES        10

// Gyro reporting
#define GYRO_REPORT_INTERVAL_MS  60000UL
#define GYRO_VIBRATION_THRESHOLD 1.5f

// ================================================================
// ===== GLOBAL STATE =====
// ================================================================

// System
enum SystemState { SYS_INIT, SYS_WIFI_CONNECTING, SYS_RUNNING, SYS_WIFI_RECONNECTING };
static SystemState sysState        = SYS_INIT;
static unsigned long wifiRetryTime = 0;
static bool          isOnline      = false;

// ================================================================
// ===== SENSOR & TAMPER STATE =====
// ================================================================

// LDR moving average
static int           ldr_samples[LDR_AVG_SAMPLES] = {0};
static int           ldr_sampleIdx      = 0;
static bool          ldr_aboveThreshold = false;
static unsigned long ldr_thresholdStart = 0;
static bool          ldr_alerted        = false;

// Metal strip (seal)
static bool          seal_lastState     = true;
static unsigned long seal_lowStart      = 0;
static bool          seal_alerted       = false;

// Gyro
static MPU6050       mpu;
static float         gyro_prevMag       = 0.0f;
static unsigned long gyro_lastReport    = 0;

// Track persistent anomalies until sync
static bool isSealBroken     = false;
static bool isLightDetected  = false;
static bool isAbnormalMotion = false;

// ================================================================
// ===== NETWORK SECTION =====
// ================================================================

static char          api_queue[EVENT_QUEUE_SIZE][512];
static char          sig_queue[EVENT_QUEUE_SIZE][65]; // Store signatures corresponding to payload
static int           api_qHead       = 0;
static int           api_qTail       = 0;
static int           api_qCount      = 0;
static int           api_retryCount  = 0;
static unsigned long api_retryTime   = 0;

// ================================================================
// ===== SECURITY UTILITIES =====
// ================================================================

/**
 * Generates an HMAC-SHA256 signature of the EXACT JSON payload.
 * Output written into hexOut (must be >= 65 bytes).
 */
static void generateSignature(const char* payload, char* hexOut) {
  uint8_t hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const uint8_t*)SECRET_KEY, strlen(SECRET_KEY));
  mbedtls_md_hmac_update(&ctx, (const uint8_t*)payload, strlen(payload));
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  for (int i = 0; i < 32; i++) {
    snprintf(hexOut + (i * 2), 3, "%02x", hmacResult[i]);
  }
  hexOut[64] = '\0';
}

// ================================================================
// ===== NETWORK FUNCTIONS =====
// ================================================================

/**
 * Enqueues a formatted JSON payload and its HMAC signature for sending.
 */
static void enqueueEvent(bool seal, bool light, bool motion) {
  if (api_qCount >= EVENT_QUEUE_SIZE) {
    Serial.println(F("[API] Queue full — dropping oldest event."));
    api_qHead = (api_qHead + 1) % EVENT_QUEUE_SIZE;
    api_qCount--;
  }

  // Construct EXACT JSON that backend stringify matches to ensure signature validity
  char json[256];
  snprintf(json, sizeof(json),
    "{\"containerNumber\":\"%s\",\"sealBroken\":%s,\"lightDetected\":%s,\"abnormalMotion\":%s}",
    CONTAINER_NUMBER,
    seal ? "true" : "false",
    light ? "true" : "false",
    motion ? "true" : "false"
  );

  char signature[65];
  generateSignature(json, signature);

  strncpy(api_queue[api_qTail], json, 511);
  api_queue[api_qTail][511] = '\0';
  
  strncpy(sig_queue[api_qTail], signature, 64);
  sig_queue[api_qTail][64] = '\0';

  api_qTail = (api_qTail + 1) % EVENT_QUEUE_SIZE;
  api_qCount++;
  Serial.printf("[API] Queued (T:%d). Payload: %s\n", api_qCount, json);
}

/**
 * Performs a single HTTP POST attempt with custom signature header.
 */
static bool doHttpPost(const char* json, const char* signature) {
  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-signature", signature);
  http.setTimeout(API_TIMEOUT_MS);

  int code = http.POST((String)json);
  http.end();

  if (code > 0) {
    Serial.printf("[API] HTTP %d\n", code);
    return (code >= 200 && code < 300);
  }
  Serial.printf("[API] Error: %d\n", code);
  return false;
}

/**
 * Non-blocking API send loop.
 */
static void sendToBackend() {
  if (!isOnline || api_qCount == 0) return;

  unsigned long now = millis();
  unsigned long backoff = API_RETRY_BACKOFF_MS * (unsigned long)api_retryCount;
  if (api_retryCount > 0 && (now - api_retryTime) < backoff) return;

  Serial.printf("[API] Sending (attempt %d/%d)...\n", api_retryCount + 1, API_MAX_RETRIES);

  bool ok = doHttpPost(api_queue[api_qHead], sig_queue[api_qHead]);

  if (ok) {
    api_qHead = (api_qHead + 1) % EVENT_QUEUE_SIZE;
    api_qCount--;
    api_retryCount = 0;
    
    // Reset anomaly flags once successfully synced
    isSealBroken = false;
    isLightDetected = false;
    isAbnormalMotion = false;
    
    Serial.printf("[API] Sent OK. Remaining: %d\n", api_qCount);
  } else {
    api_retryCount++;
    api_retryTime = millis();
    if (api_retryCount >= API_MAX_RETRIES) {
      Serial.println(F("[API] Max retries — dropping event."));
      api_qHead = (api_qHead + 1) % EVENT_QUEUE_SIZE;
      api_qCount--;
      api_retryCount = 0;
    }
  }
}

// ================================================================
// ===== TAMPER FUNCTIONS =====
// ================================================================

static void triggerTamperState(bool seal, bool light, bool motion) {
  digitalWrite(LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  enqueueEvent(seal, light, motion);
}

static int ldrAverage() {
  long sum = 0;
  for (int i = 0; i < LDR_AVG_SAMPLES; i++) sum += ldr_samples[i];
  return (int)(sum / LDR_AVG_SAMPLES);
}

static void handleTamper() {
  unsigned long now = millis();

  // 1. LDR (Light Detected Inside Container)
  ldr_samples[ldr_sampleIdx] = analogRead(LDR_PIN);
  ldr_sampleIdx = (ldr_sampleIdx + 1) % LDR_AVG_SAMPLES;
  int avg = ldrAverage();
  
  if (avg > LDR_THRESHOLD) {
    if (!ldr_aboveThreshold) {
      ldr_aboveThreshold = true;
      ldr_thresholdStart = now;
      ldr_alerted = false;
    }
    if (!ldr_alerted && (now - ldr_thresholdStart) >= LDR_SUSTAINED_MS) {
      isLightDetected = true;
      triggerTamperState(isSealBroken, isLightDetected, isAbnormalMotion);
      ldr_alerted = true;
    }
  } else {
    ldr_aboveThreshold = false;
    ldr_alerted = false;
  }

  // 2. Metal Strip (Seal Broken)
  bool sealNow = (digitalRead(METAL_STRIP_PIN) == LOW);
  if (sealNow) {
    if (!seal_lastState) {
      seal_lowStart = now;
      seal_alerted = false;
    }
    if (!seal_alerted && (now - seal_lowStart) >= SEAL_LOW_MS) {
      isSealBroken = true;
      triggerTamperState(isSealBroken, isLightDetected, isAbnormalMotion);
      seal_alerted = true;
    }
  } else {
    seal_alerted = false;
    seal_lowStart = 0;
  }
  seal_lastState = sealNow;
}

// ================================================================
// ===== GYRO FUNCTIONS =====
// ================================================================

static void handleGyro() {
  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

  float axg = ax / 16384.0f;
  float ayg = ay / 16384.0f;
  float azg = az / 16384.0f;
  float mag = sqrtf(axg * axg + ayg * ayg + azg * azg);

  if (fabsf(mag - gyro_prevMag) > GYRO_VIBRATION_THRESHOLD) {
    if (!isAbnormalMotion) {
      isAbnormalMotion = true;
      triggerTamperState(isSealBroken, isLightDetected, isAbnormalMotion);
      Serial.println("[Gyro] Abnormal motion triggered!");
    }
  }
  gyro_prevMag = mag;

  // Periodic normal telemetry heartbeat
  unsigned long now = millis();
  if ((now - gyro_lastReport) > GYRO_REPORT_INTERVAL_MS) {
     gyro_lastReport = now;
     digitalWrite(LED_PIN, LOW); // Turn off indicators if sending regular safe heartbeat
     digitalWrite(BUZZER_PIN, LOW);
     enqueueEvent(isSealBroken, isLightDetected, isAbnormalMotion);
  }
}

// ================================================================
// ===== HARDWARE INIT & WIFI =====
// ================================================================

static void initHardware() {
  Serial.begin(115200);
  delay(200);
  Serial.println(F("\n[BOOT] Safe Chemical Container Tracker Starting..."));

  pinMode(LDR_PIN, INPUT);
  pinMode(METAL_STRIP_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Wire.begin(MPU_SDA_PIN, MPU_SCL_PIN);
  mpu.initialize();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  sysState = SYS_WIFI_CONNECTING;
}

static void handleWiFi() {
  bool connected = (WiFi.status() == WL_CONNECTED);
  switch (sysState) {
    case SYS_WIFI_CONNECTING:
      if (connected) {
        Serial.printf("[WiFi] Connected. IP: %s\n", WiFi.localIP().toString().c_str());
        isOnline = true;
        sysState = SYS_RUNNING;
      } else if (millis() > 20000UL) {
        isOnline = false;
        sysState = SYS_RUNNING;
      }
      break;
    case SYS_RUNNING:
      if (!connected) {
        isOnline = false;
        sysState = SYS_WIFI_RECONNECTING;
        wifiRetryTime = millis();
        WiFi.reconnect();
      }
      break;
    case SYS_WIFI_RECONNECTING:
      if (connected) {
        isOnline = true;
        sysState = SYS_RUNNING;
      } else if ((millis() - wifiRetryTime) >= WIFI_RETRY_INTERVAL_MS) {
        wifiRetryTime = millis();
        WiFi.reconnect();
      }
      break;
    default:
      break;
  }
}

void setup() {
  initHardware();
  enqueueEvent(false, false, false); // Send initial boot clear state
}

void loop() {
  handleWiFi();
  handleTamper();
  handleGyro();
  sendToBackend();
}
