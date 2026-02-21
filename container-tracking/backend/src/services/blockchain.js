const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// We use local hardhat network
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

// Default Hardhat account #0 private key
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Load contract ABI & Address
const contractJsonPath = path.join(__dirname, "../../../hardhat/artifacts/contracts/ContainerTracking.sol/ContainerTracking.json");
const contractAddressPath = path.join(__dirname, "../config/contractAddress.json");

let contract;

try {
    const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
    const contractAddressData = JSON.parse(fs.readFileSync(contractAddressPath, 'utf8'));
    contract = new ethers.Contract(contractAddressData.address, contractJson.abi, wallet);
} catch (error) {
    console.warn("Contract not deployed yet or missing artifacts. Run hardhat deploy.");
}

const logManufactured = async (containerId, batch, manufacturerId) => {
    if (!contract) return null;
    const tx = await contract.logManufactured(containerId, batch, manufacturerId);
    await tx.wait();
    return tx.hash;
};

const logDispatched = async (containerId) => {
    if (!contract) return null;
    const tx = await contract.logDispatched(containerId);
    await tx.wait();
    return tx.hash;
};

const logTamper = async (containerId, reason) => {
    if (!contract) return null;
    const tx = await contract.logTamper(containerId, reason);
    await tx.wait();
    return tx.hash;
};

const logDelivered = async (containerId, receiverAddress) => {
    if (!contract) return null;
    const tx = await contract.logDelivered(containerId, receiverAddress || ethers.ZeroAddress);
    await tx.wait();
    return tx.hash;
};

const logRejected = async (containerId, reason) => {
    if (!contract) return null;
    const tx = await contract.logRejected(containerId, reason);
    await tx.wait();
    return tx.hash;
};

const logAccessGranted = async (containerId, receiverAddress) => {
    if (!contract) return null;
    const tx = await contract.logAccessGranted(containerId, receiverAddress || ethers.ZeroAddress);
    await tx.wait();
    return tx.hash;
};

module.exports = {
    logManufactured,
    logDispatched,
    logTamper,
    logDelivered,
    logRejected,
    logAccessGranted,
    provider,
    wallet
};
