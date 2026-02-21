/**
 * ================================================================
 * KAVACH — IoT Chemical Container Tracking System
 * ESP32 DevKit v4 — Wokwi Simulation
 *
 * Pin Layout (matches diagram.json):
 *   RFID MFRC522: SDA=5, SCK=18, MOSI=23, MISO=19, RST=4
 *   MPU6050:      SDA=21, SCL=22
 *   LDR:          AO=32
 *   Button:       34 (seal break simulator)
 *   LED (Red):    26
 *   Buzzer:       25
 * ================================================================
 */

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <MPU6050.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "mbedtls/md.h"

// ================================================================
// ===== CONFIGURATION =====
// ================================================================

// WiFi — Wokwi uses "Wokwi-GUEST" with no password
#define WIFI_SSID              "Wokwi-GUEST"
#define WIFI_PASS              ""
#define WIFI_RETRY_INTERVAL_MS  10000UL

// Device & Container Provisioning — FILL THESE FROM MANUFACTURER DASHBOARD
#define CONTAINER_NUMBER       "YOUR-CONTAINER-ID"
#define SECRET_KEY             "your-secret-key-from-backend-dashboard"

// API — Paste your Ngrok URL here
#define API_ENDPOINT           "https://danny-colonisable-unostensively.ngrok-free.dev/iot/sync"
#define API_TIMEOUT_MS         5000
#define API_MAX_RETRIES        3
#define API_RETRY_BACKOFF_MS   2000UL
#define EVENT_QUEUE_SIZE       20

// ===== PIN DEFINITIONS (match diagram.json) =====
// RFID MFRC522
#define RFID_SS_PIN            5
#define RFID_RST_PIN           4
// SPI pins are default: SCK=18, MOSI=23, MISO=19

// MPU6050
#define MPU_SDA_PIN            21
#define MPU_SCL_PIN            22

// Sensors & Actuators
#define LDR_PIN                32
#define BUTTON_PIN             34
#define LED_PIN                26
#define BUZZER_PIN             25

// Tamper thresholds
#define SEAL_LOW_MS            1000UL
#define LDR_THRESHOLD          2500
#define LDR_SUSTAINED_MS       3000UL
#define LDR_AVG_SAMPLES        10

// Gyro reporting
#define GYRO_REPORT_INTERVAL_MS  60000UL
#define GYRO_VIBRATION_THRESHOLD 1.5f

// RFID scan interval
#define RFID_SCAN_INTERVAL_MS  2000UL

// ================================================================
// ===== GLOBAL STATE =====
// ================================================================

// System
enum SystemState { SYS_INIT, SYS_WIFI_CONNECTING, SYS_RUNNING, SYS_WIFI_RECONNECTING };
static SystemState sysState        = SYS_INIT;
static unsigned long wifiRetryTime = 0;
static bool          isOnline      = false;

// RFID
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
static unsigned long rfid_lastScan = 0;
static String lastRfidUid          = "";

// LDR moving average
static int           ldr_samples[LDR_AVG_SAMPLES] = {0};
static int           ldr_sampleIdx      = 0;
static bool          ldr_aboveThreshold = false;
static unsigned long ldr_thresholdStart = 0;
static bool          ldr_alerted        = false;

// Metal strip / Button (seal)
static bool          seal_lastState     = true;
static unsigned long seal_lowStart      = 0;
static bool          seal_alerted       = false;

// Gyro
static MPU6050       mpu;
static float         gyro_prevMag       = 0.0f;
static unsigned long gyro_lastReport    = 0;

// Persistent anomaly flags (until sync)
static bool isSealBroken     = false;
static bool isLightDetected  = false;
static bool isAbnormalMotion = false;

// ================================================================
// ===== NETWORK QUEUE =====
// ================================================================

static char          api_queue[EVENT_QUEUE_SIZE][512];
static char          sig_queue[EVENT_QUEUE_SIZE][65];
static int           api_qHead       = 0;
static int           api_qTail       = 0;
static int           api_qCount      = 0;
static int           api_retryCount  = 0;
static unsigned long api_retryTime   = 0;

// ================================================================
// ===== SECURITY — HMAC-SHA256 =====
// ================================================================

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

static void enqueueEvent(bool seal, bool light, bool motion) {
  if (api_qCount >= EVENT_QUEUE_SIZE) {
    Serial.println(F("[API] Queue full — dropping oldest event."));
    api_qHead = (api_qHead + 1) % EVENT_QUEUE_SIZE;
    api_qCount--;
  }

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
// ===== RFID FUNCTIONS =====
// ================================================================

static void handleRFID() {
  unsigned long now = millis();
  if ((now - rfid_lastScan) < RFID_SCAN_INTERVAL_MS) return;
  rfid_lastScan = now;

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  if (uid != lastRfidUid) {
    lastRfidUid = uid;
    Serial.printf("[RFID] Card detected! UID: %s\n", uid.c_str());

    // Flash LED to acknowledge scan
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
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
      Serial.println("[LDR] Light tamper triggered!");
    }
  } else {
    ldr_aboveThreshold = false;
    ldr_alerted = false;
  }

  // 2. Button Press (simulates Seal Broken in Wokwi)
  bool buttonPressed = (digitalRead(BUTTON_PIN) == LOW);
  if (buttonPressed) {
    if (!seal_lastState) {
      seal_lowStart = now;
      seal_alerted = false;
    }
    if (!seal_alerted && (now - seal_lowStart) >= SEAL_LOW_MS) {
      isSealBroken = true;
      triggerTamperState(isSealBroken, isLightDetected, isAbnormalMotion);
      seal_alerted = true;
      Serial.println("[SEAL] Seal broken tamper triggered!");
    }
  } else {
    seal_alerted = false;
    seal_lowStart = 0;
  }
  seal_lastState = buttonPressed;
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

  // Periodic heartbeat telemetry
  unsigned long now = millis();
  if ((now - gyro_lastReport) > GYRO_REPORT_INTERVAL_MS) {
    gyro_lastReport = now;
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    enqueueEvent(isSealBroken, isLightDetected, isAbnormalMotion);
    Serial.println("[Heartbeat] Sending periodic telemetry.");
  }
}

// ================================================================
// ===== HARDWARE INIT & WIFI =====
// ================================================================

static void initHardware() {
  Serial.begin(115200);
  delay(200);
  Serial.println(F("\n========================================"));
  Serial.println(F("  KAVACH Container Tracker — Booting..."));
  Serial.println(F("========================================"));

  // GPIO setup
  pinMode(LDR_PIN, INPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // SPI & RFID
  SPI.begin(18, 19, 23, RFID_SS_PIN); // SCK, MISO, MOSI, SS
  rfid.PCD_Init();
  delay(100);
  if (rfid.PCD_PerformSelfTest()) {
    Serial.println(F("[RFID] MFRC522 initialized OK."));
  } else {
    Serial.println(F("[RFID] MFRC522 init FAILED — check wiring!"));
  }
  rfid.PCD_Init(); // Re-init after self-test clears registers

  // I2C & MPU6050
  Wire.begin(MPU_SDA_PIN, MPU_SCL_PIN);
  mpu.initialize();
  if (mpu.testConnection()) {
    Serial.println(F("[IMU]  MPU6050 connected OK."));
  } else {
    Serial.println(F("[IMU]  MPU6050 connection FAILED!"));
  }

  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  sysState = SYS_WIFI_CONNECTING;
  Serial.println(F("[WiFi] Connecting to Wokwi-GUEST..."));
}

static void handleWiFi() {
  bool connected = (WiFi.status() == WL_CONNECTED);
  switch (sysState) {
    case SYS_WIFI_CONNECTING:
      if (connected) {
        Serial.printf("[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        isOnline = true;
        sysState = SYS_RUNNING;
      } else if (millis() > 20000UL) {
        Serial.println(F("[WiFi] Timeout — running offline, will retry."));
        isOnline = false;
        sysState = SYS_RUNNING;
      }
      break;
    case SYS_RUNNING:
      if (!connected) {
        Serial.println(F("[WiFi] Disconnected — reconnecting..."));
        isOnline = false;
        sysState = SYS_WIFI_RECONNECTING;
        wifiRetryTime = millis();
        WiFi.reconnect();
      }
      break;
    case SYS_WIFI_RECONNECTING:
      if (connected) {
        Serial.println(F("[WiFi] Reconnected!"));
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

// ================================================================
// ===== SETUP & LOOP =====
// ================================================================

void setup() {
  initHardware();
  enqueueEvent(false, false, false); // Boot-clear heartbeat
}

void loop() {
  handleWiFi();
  handleRFID();
  handleTamper();
  handleGyro();
  sendToBackend();
}
