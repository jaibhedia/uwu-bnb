const hre = require("hardhat");

/**
 * Deploy uWu Production Contracts (V5)
 * 
 * Deploys:
 * 1. TrustScore - On-chain reputation tracking
 * 2. P2PEscrowV5 - Full-featured escrow with cooldowns, velocity limits, LP rotation
 * 3. DisputeDAO - Community dispute resolution
 * 
 * Chain: opBNB Testnet (5611) or BSC Testnet (97)
 * Set USDC_ADDRESS in .env for the target chain (e.g. BSC testnet USDC).
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║           uWu P2P V5 Contract Deployment                    ║");
    console.log("║           BNB Chain (opBNB / BSC Testnet)                    ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📦 Deployer:", deployer.address);
    
    // Check balance (BNB native token on opBNB/BSC)
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(balance), "BNB\n");

    // USDC on target chain - set in .env (e.g. BSC testnet or opBNB testnet USDC)
    const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x0000000000000000000000000000000000000000";
    if (USDC_ADDRESS === "0x0000000000000000000000000000000000000000") {
        console.warn("⚠️  USDC_ADDRESS not set. Set it in .env for the target chain.");
    }
    console.log("🪙 USDC Address:", USDC_ADDRESS);

    // ============================================
    // 1. Deploy TrustScore
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("1️⃣  Deploying TrustScore...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const TrustScore = await hre.ethers.getContractFactory("TrustScore");
    const trustScore = await TrustScore.deploy();
    await trustScore.waitForDeployment();
    const trustScoreAddress = await trustScore.getAddress();
    console.log("   ✅ TrustScore deployed to:", trustScoreAddress);

    // ============================================
    // 2. Deploy P2PEscrowV5
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("2️⃣  Deploying P2PEscrowV5...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const P2PEscrowV5 = await hre.ethers.getContractFactory("P2PEscrowV5");
    const escrow = await P2PEscrowV5.deploy(
        USDC_ADDRESS,
        deployer.address // Initial arbitrator
    );
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    console.log("   ✅ P2PEscrowV5 deployed to:", escrowAddress);

    // ============================================
    // 3. Deploy DisputeDAO
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("3️⃣  Deploying DisputeDAO...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const DisputeDAO = await hre.ethers.getContractFactory("DisputeDAO");
    const disputeDAO = await DisputeDAO.deploy(
        USDC_ADDRESS,
        escrowAddress
    );
    await disputeDAO.waitForDeployment();
    const disputeDAOAddress = await disputeDAO.getAddress();
    console.log("   ✅ DisputeDAO deployed to:", disputeDAOAddress);

    // ============================================
    // 4. Configure Contracts
    // ============================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("4️⃣  Configuring contracts...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Authorize P2PEscrowV5 to update TrustScore
    console.log("   • Authorizing P2PEscrowV5 in TrustScore...");
    let tx = await trustScore.authorizeContract(escrowAddress, true);
    await tx.wait();
    console.log("   ✅ P2PEscrowV5 authorized in TrustScore");

    // Note: P2PEscrowV5 has its own arbitrator set to deployer during construction
    // DisputeDAO works independently - it references the escrow contract

    // ============================================
    // Summary
    // ============================================
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                   🎉 DEPLOYMENT COMPLETE!                   ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    
    console.log("\n📋 Contract Addresses:");
    console.log("┌─────────────────────────────────────────────────────────────┐");
    console.log(`│  TrustScore:   ${trustScoreAddress}  │`);
    console.log(`│  P2PEscrowV5:  ${escrowAddress}  │`);
    console.log(`│  DisputeDAO:   ${disputeDAOAddress}  │`);
    console.log("└─────────────────────────────────────────────────────────────┘");
    
    console.log("\n📝 Add to .env.local:");
    console.log("────────────────────────────────────────────────────────────────");
    console.log(`NEXT_PUBLIC_P2P_ESCROW_ADDRESS=${escrowAddress}`);
    console.log(`NEXT_PUBLIC_TRUST_SCORE_ADDRESS=${trustScoreAddress}`);
    console.log(`NEXT_PUBLIC_DISPUTE_DAO_ADDRESS=${disputeDAOAddress}`);
    
    console.log("\n🔧 Features Deployed:");
    console.log("   ✅ Comprehensive cooldown system");
    console.log("   ✅ Velocity limits (5 orders/hour)");
    console.log("   ✅ User daily limits ($150/$300/$750)");
    console.log("   ✅ LP rotation");
    console.log("   ✅ UTR proof requirement");
    console.log("   ✅ Rate lock at order creation");
    console.log("   ✅ Trust score tracking");
    console.log("   ✅ Dispute resolution (centralized for MVP)");

    // Return addresses for verification
    return {
        trustScore: trustScoreAddress,
        escrow: escrowAddress,
        disputeDAO: disputeDAOAddress
    };
}

main()
    .then((addresses) => {
        console.log("\n✨ All contracts deployed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
