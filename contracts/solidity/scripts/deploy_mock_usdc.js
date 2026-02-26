const hre = require("hardhat");

/**
 * Deploy MockUSDC (6 decimals) on opBNB Testnet / BSC Testnet.
 * Use the printed address as USDC_ADDRESS in .env, then run deploy_v5.js.
 */
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const token = await MockUSDC.deploy();
    await token.waitForDeployment();
    const address = await token.getAddress();

    console.log("\nMockUSDC deployed to:", address);
    console.log("Decimals: 6 (same as real USDC)");
    console.log("Deployer balance: 1,000,000 Mock USDC\n");
    console.log("Add to contracts/solidity/.env:");
    console.log("USDC_ADDRESS=" + address);
    console.log("\nThen run: npx hardhat run scripts/deploy_v5.js --network opbnbTestnet");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
