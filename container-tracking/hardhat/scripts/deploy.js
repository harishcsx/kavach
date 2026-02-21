const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const ContainerTracking = await hre.ethers.getContractFactory("ContainerTracking");
    const contract = await ContainerTracking.deploy();

    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`ContainerTracking deployed to: ${address}`);

    // Save the address to backend config or a JSON file
    const configDir = path.join(__dirname, "../../backend/src/config");
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    const contractData = {
        address: address,
    };

    fs.writeFileSync(
        path.join(configDir, "contractAddress.json"),
        JSON.stringify(contractData, null, 2)
    );
    console.log("Contract address saved to backend config.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
