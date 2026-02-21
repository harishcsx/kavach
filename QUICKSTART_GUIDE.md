# Quickstart Guide: Running the Kavach System Locally + Wokwi

Follow these steps to clone the repository, run the application on your computer (localhost), and simulate the ESP32 IoT device using Wokwi.

## Prerequisites
1. **Node.js** (v20+ recommended)
2. **Git**
3. **Ngrok** (Free account, required to expose your local API to Wokwi)
4. A free **NeonDB (PostgreSQL)** URL (or local Postgres).

---

## Step 1: Clone the Repository
Open your terminal and clone the project:
```bash
git clone https://github.com/harishcsx/kavach.git
cd kavach/container-tracking
```

---

## Step 2: Start the Blockchain (Hardhat)
You need to run a local blockchain network to log events.

**Terminal 1:**
```bash
cd hardhat
npm install
npx hardhat node
```
*(Leave this terminal running!)*

**Terminal 2:**
```bash
cd hardhat
npx hardhat run scripts/deploy.js --network localhost
```
*(This deploys the smart contract. The address is automatically saved for the backend).*

---

## Step 3: Start the Backend API
Because `.env` files are not pushed to GitHub, you MUST create one manually.

**Terminal 3:**
```bash
cd backend
npm install
```

Create a file named `.env` inside the `backend/` folder and paste this:
```env
DATABASE_URL="postgresql://<your-username>:<your-password>@<your-neon-url>/<dbname>?sslmode=require"
PORT=5000
JWT_SECRET="super-secret-key-123"
```
*(Replace `DATABASE_URL` with a real Postgres connection string).*

Push the database schema and start the server:
```bash
npx prisma generate
npx prisma db push --accept-data-loss
npm run dev
```
*(Your backend is now running on `http://localhost:5000`)*

---

## Step 4: Start the Frontend UI

**Terminal 4:**
```bash
cd frontend
npm install
npm run dev
```
*(Your frontend is now running on `http://localhost:5173`. Open it in your browser, log in, go to the Manufacturer Dashboard, and register a new container. Save the generated `Container Number` and `Secret Key` for the IoT simulation!)*

---

## Step 5: Expose Backend using Ngrok
Wokwi runs in the cloud and cannot connect directly to your laptop's `localhost`. We use Ngrok to create a secure tunnel.

**Terminal 5:**
```bash
ngrok http 5000
```
*Ngrok will output a 'Forwarding' URL that looks like this: `https://1234-abcd.ngrok-free.app`. Copy this URL.*

---

## Step 6: Start the Wokwi IoT Simulation
The IoT device connects to your Backend using Wi-Fi to sync tamper data.

1. Open a browser and go to [wokwi.com](https://wokwi.com) (or use the Wokwi VS Code extension).
2. Start a new "ESP32" project and replace the empty files with the ones from the `iot/` folder in this repository (`esp32_tracker.ino`, `diagram.json`, `wokwi.toml`).
3. Open `esp32_tracker.ino` in Wokwi and update these 3 lines at the top:

```cpp
// 1. Enter the Container ID you generated on the Frontend Dashboard
#define CONTAINER_NUMBER       "YOUR-CONTAINER-ID"

// 2. Enter the Secret Key generated on the Frontend Dashboard
#define SECRET_KEY             "your-secret-key-from-backend-dashboard"

// 3. Paste the Ngrok URL you copied in Step 5 (make sure to append /iot/sync !)
#define API_ENDPOINT           "https://1234-abcd.ngrok-free.app/iot/sync"
```

### Run it!
1. Click the **Play / Start Simulation** button in Wokwi.
2. The ESP32 will connect to `Wokwi-GUEST` Wi-Fi, authenticate using the `SECRET_KEY`, and send data to your local backend via Ngrok!
3. Open the **Enforcement Monitor** tab in your React frontend (`http://localhost:5173/enforcement`).
4. On Wokwi, interact with the simulation:
   - Click the LDR (Photoresistor) and increase the light level.
   - Click the Slide Switch to "break" the metal seal.
5. Watch the glowing red tamper alerts appear instantly on your frontend!
