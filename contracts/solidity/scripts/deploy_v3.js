const hre = require("hardhat");

async function main() {
    console.log("Deploying uWu P2P V3 Contract (BNB Chain — set network in CLI)...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // USDC on target chain — set in .env for opBNB/BSC testnet
    const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x0000000000000000000000000000000000000000";
    console.log("Using USDC at:", USDC_ADDRESS);

    // ============================================
    // 1. Deploy P2PEscrowV3
    // ============================================
    console.log("\n1. Deploying P2PEscrowV3...");
    const P2PEscrowV3 = await hre.ethers.getContractFactory("P2PEscrowV3");
    // Initial arbitrator is deployer
    const escrow = await P2PEscrowV3.deploy(
        USDC_ADDRESS,
        deployer.address
    );
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    console.log("   P2PEscrowV3 deployed to:", escrowAddress);

    // ============================================
    // 2. Deploy DisputeDAO (optional, for multi-sig disputes)
    // ============================================
    console.log("\n2. Deploying DisputeDAO...");
    const DisputeDAO = await hre.ethers.getContractFactory("DisputeDAO");
    const disputeDAO = await DisputeDAO.deploy(
        USDC_ADDRESS,
        escrowAddress
    );
    await disputeDAO.waitForDeployment();
    const disputeDAOAddress = await disputeDAO.getAddress();
    console.log("   DisputeDAO deployed to:", disputeDAOAddress);

    // ============================================
    // 3. Configure Contracts
    // ============================================
    console.log("\n3. Configuring contracts...");

    // Set DisputeDAO in Escrow
    console.log("   Setting arbitrator to DisputeDAO in P2PEscrowV3...");
    const tx = await escrow.setArbitrator(disputeDAOAddress);
    await tx.wait();
    console.log("   ✅ Arbitrator set to DisputeDAO");

    // ============================================
    // Summary
    // ============================================
    console.log("\n" + "=".repeat(50));
    console.log("DEPLOYMENT SUMMARY (BNB Chain)");
    console.log("=".repeat(50));
    console.log("P2PEscrowV3:           ", escrowAddress);
    console.log("DisputeDAO:            ", disputeDAOAddress);
    console.log("USDC (precompile):     ", USDC_ADDRESS);
    console.log("Deployer/Owner:        ", deployer.address);
    console.log("=".repeat(50));
    
    console.log("\n⚠️  UPDATE YOUR .env.local:");
    console.log(`NEXT_PUBLIC_ESCROW_ADDRESS=${escrowAddress}`);
    
    console.log("\n✅ V3 uses raw IERC20 calls (no SafeERC20) for compatibility");
    console.log("✅ All USDC transfers use require() for validation");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
