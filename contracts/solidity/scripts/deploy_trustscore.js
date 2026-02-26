const hre = require("hardhat");

async function main() {
    console.log("Deploying TrustScore Contract...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // New P2PEscrowV2 address (deployed earlier)
    const ESCROW_ADDRESS = "0x6a200f47705A535001124f683364A6429b75317C";

    // ============================================
    // 1. Deploy TrustScore
    // ============================================
    console.log("\n1. Deploying TrustScore...");
    const TrustScore = await hre.ethers.getContractFactory("TrustScore");
    const trustScore = await TrustScore.deploy();
    await trustScore.waitForDeployment();
    const trustScoreAddress = await trustScore.getAddress();
    console.log("   TrustScore deployed to:", trustScoreAddress);

    // ============================================
    // 2. Authorize P2PEscrowV2 to update TrustScore
    // ============================================
    console.log("\n2. Authorizing P2PEscrowV2 to update TrustScore...");
    const tx = await trustScore.authorizeContract(ESCROW_ADDRESS, true);
    await tx.wait();
    console.log("   ✅ P2PEscrowV2 authorized");

    // ============================================
    // Summary
    // ============================================
    console.log("\n============================================");
    console.log("TrustScore Deployment Complete!");
    console.log("============================================");
    console.log("\nContract Address:");
    console.log("  TrustScore: ", trustScoreAddress);
    console.log("\nUpdate in your .env.local:");
    console.log(`  NEXT_PUBLIC_TRUST_SCORE_ADDRESS=${trustScoreAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
