const hre = require("hardhat");

async function main() {
    console.log("Deploying uWu P2P V2 Contracts (Enhanced Security & Disputes)...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // USDC on target chain — set in .env for opBNB/BSC testnet
    const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x0000000000000000000000000000000000000000";
    console.log("Using USDC at:", USDC_ADDRESS);

    // ============================================
    // 1. Deploy P2PEscrowV2
    // ============================================
    console.log("\n1. Deploying P2PEscrowV2...");
    const P2PEscrowV2 = await hre.ethers.getContractFactory("P2PEscrowV2");
    // Initial arbitrator is deployer, will be updated to DisputeDAO later
    const escrow = await P2PEscrowV2.deploy(
        USDC_ADDRESS,
        deployer.address
    );
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    console.log("   P2PEscrowV2 deployed to:", escrowAddress);

    // ============================================
    // 2. Deploy DisputeDAO
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
    console.log("   Setting DisputeDAO in P2PEscrowV2...");
    const tx = await escrow.setDisputeDAO(disputeDAOAddress);
    await tx.wait();
    console.log("   ✅ DisputeDAO set");

    // Also update arbitrator to DisputeDAO for V2 flows? 
    // The contract documentation says "Arbritrator or DisputeDAO" can resolve.
    // Usually, the arbitrator address is a fallback or specific role.
    // For now, we keep deployer as 'arbitrator' (admin) and 'disputeDAO' as the community mechanism.

    // ============================================
    // Summary
    // ============================================
    console.log("\n============================================");
    console.log("Deployment Complete!");
    console.log("============================================");
    console.log("\nContract Addresses:");
    console.log("  P2PEscrowV2: ", escrowAddress);
    console.log("  DisputeDAO:  ", disputeDAOAddress);
    console.log("\nUpdate these in your .env.local:");
    console.log(`  NEXT_PUBLIC_P2P_ESCROW_ADDRESS=${escrowAddress}`);
    console.log(`  NEXT_PUBLIC_DISPUTE_DAO_ADDRESS=${disputeDAOAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
