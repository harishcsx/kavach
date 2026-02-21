# Tamper-Proof Dual-Use Chemical Container Tracking System

A full-stack application that verifies physical integrity and traceability of regulated chemical containers from manufacturer to destination using IoT sensors and blockchain logging locally.

## Prerequisites
- Node.js (v20+ recommended)
- PostgreSQL (or NeonDB as configured)
- MetaMask or any Web3 Wallet (optional, to view local network)

## Setup Instructions

### 1. Smart Contract & Hardhat Node
```bash
cd hardhat
npm install
npx hardhat node
```
*Leave the node running in this terminal.*

In a new terminal, deploy the contract:
```bash
cd hardhat
npx hardhat run scripts/deploy.js --network localhost
```
*This script automatically saves the deployed contract address to the backend config.*

### 2. Backend API
```bash
cd backend
npm install
npx prisma db push
```

Start the Express and Socket.IO server:
```bash
npm run dev
```

### 3. Frontend App
```bash
cd frontend
npm install
npm run dev
```

## Demo Flow
1. **Login** (`http://localhost:5173/login`)
   - Simulate login with any email/password.
2. **Manufacture & Dispatch**
   - Head to the Manufacturer Dashboard.
   - Register a new container (System generates an IoT secret key).
   - Dispatch the container.
   - Generate a Delivery Permit Token.
3. **Simulate IoT Telemetry (Postman/Curl)**
   - To `/iot/sync` endpoint, post payload signed with HMAC-SHA256(secretKey).
   - Inject `sealBroken: true` to trigger tamper events.
4. **Enforcement Dashboard**
   - Opens `/enforcement` to see live WebSocket alerts of tampered containers.
5. **Receiver Verification**
   - Opens `/receiver`. Step 1: Input the Delivery Permit Token (Activate).
   - Step 2: Input the container ID and RFID tag (Scan).
6. **Blockchain Proof**
   - Container Detail page (`/container/:id`) shows the immutable Event Ledger with transaction hashes.
