# Deploying the Tracking System to Render.com

Deploying to Render is the best choice because it supports persistent WebSockets out of the box. You will deploy your system as two separate Render **Web Services**: one for the Node.js API and one for the React Frontend.

Before deploying, there is ONE critical architectural change: **The Blockchain.** You cannot use your local Hardhat node (`localhost:8545`) in the cloud. You must deploy your smart contract to a public testnet (like Sepolia).

---

## Phase 1: Moving the Blockchain to a Public Testnet (Sepolia)

1. Get a free **Alchemy** or **Infura** account to get an Ethereum RPC URL for the "Sepolia" network.
2. Get some free Sepolia Testnet ETH from a faucet (e.g., Alchemy Sepolia Faucet) to your MetaMask wallet.
3. Open `hardhat/hardhat.config.js` and add the new network:
   ```javascript
   module.exports = {
     solidity: "0.8.20",
     networks: {
       hardhat: { chainId: 31337 },
       sepolia: {
         url: "YOUR_ALCHEMY_SEPOLIA_HTTP_URL",
         accounts: ["YOUR_METAMASK_PRIVATE_KEY"] // Keep this secret!
       }
     }
   };
   ```
4. Run the deploy script targeting Sepolia:
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```
5. In `backend/src/services/blockchain.js`, update the provider and wallet to use environment variables instead of hardcoded local keys:
   ```javascript
   const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
   const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
   ```

---

## Phase 2: Deploying the Node.js Backend

Your backend code is actually almost 100% ready for Render because `server.js` already uses `process.env.PORT`!

1. **Commit and Push**: Ensure all changes (including the `blockchain.js` change above) are pushed to your GitHub repository.
2. Go to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** and select **Web Service**.
4. Connect your GitHub account and select your `kavach` repository.
5. **Configure the Web Service**:
   - **Name**: `kavach-api`
   - **Root Directory**: `container-tracking/backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `node server.js`
6. **Environment Variables**: Scroll down and add these:
   - `DATABASE_URL`: `Your Neon Postgres URL`
   - `JWT_SECRET`: `your_secure_jwt_secret`
   - `RPC_URL`: `Your Alchemy Sepolia HTTP URL`
   - `PRIVATE_KEY`: `Your MetaMask Private Key`
7. Click **Create Web Service**. Record the live `https://kavach-api.onrender.com` URL once it finishes.

---

## Phase 3: Deploying the React Frontend

The frontend needs to know where the live backend is so it doesn't try to connect to `localhost:5000`.

1. In your frontend code, you must change all instances of `http://localhost:5000` to your new live backend URL (e.g. `https://kavach-api.onrender.com`).
   - You need to update this in `App.jsx`, `SocketContext.jsx`, `AuthContext.jsx`, and all the pages (`Login`, `ManufacturerDashboard`, etc.).
   - *Best Practice:* Use a `.env` file in Vite (`VITE_API_URL=https://...`) and reference it via `import.meta.env.VITE_API_URL`.
2. Push these URL changes to GitHub.
3. Go back to the **Render Dashboard**.
4. Click **New +** and select **Static Site**.
5. Select your `kavach` repository again.
6. **Configure the Static Site**:
   - **Name**: `kavach-frontend`
   - **Root Directory**: `container-tracking/frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `container-tracking/frontend/dist`
7. Click **Create Static Site**.

Your application is now globally live! Be sure to update the `API_ENDPOINT` in your `esp32_tracker.ino` file to the new live API endpoint as well!
