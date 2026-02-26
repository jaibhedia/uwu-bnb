const hre = require("hardhat");

async function main() {
    console.log("Deploying uWu P2P Contracts (BNB Chain — set network in CLI)...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // USDC on target chain — set in .env (e.g. opBNB or BSC testnet)
    const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x0000000000000000000000000000000000000001";

    // ============================================
    // Deploy TrustScore (Reputation System)
    // ============================================
    console.log("\n1. Deploying TrustScore...");
    const TrustScore = await hre.ethers.getContractFactory("TrustScore");
    const trustScore = await TrustScore.deploy();
    await trustScore.waitForDeployment();
    const trustScoreAddress = await trustScore.getAddress();
    console.log("   TrustScore deployed to:", trustScoreAddress);

    // ============================================
    // Deploy P2PEscrow
    // ============================================
    console.log("\n2. Deploying P2PEscrow...");
    const P2PEscrow = await hre.ethers.getContractFactory("P2PEscrow");
    const escrow = await P2PEscrow.deploy(
        USDC_ADDRESS,           // USDC token address
        deployer.address        // Initial arbitrator (deployer)
    );
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    console.log("   P2PEscrow deployed to:", escrowAddress);

    // ============================================
    // Configure Contracts
    // ============================================
    console.log("\n3. Configuring contracts...");

    // Authorize P2PEscrow to update TrustScore
    await trustScore.authorizeContract(escrowAddress, true);
    console.log("   P2PEscrow authorized to update TrustScore");

    // ============================================
    // Summary
    // ============================================
    console.log("\n============================================");
    console.log("Deployment Complete!");
    console.log("============================================");
    console.log("\nContract Addresses:");
    console.log("  P2PEscrow:  ", escrowAddress);
    console.log("  TrustScore: ", trustScoreAddress);
    console.log("\nUpdate these in your .env.local:");
    console.log(`  NEXT_PUBLIC_P2P_ESCROW_ADDRESS=${escrowAddress}`);
    console.log(`  NEXT_PUBLIC_TRUST_SCORE_ADDRESS=${trustScoreAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
