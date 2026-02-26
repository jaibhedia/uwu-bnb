const { ethers } = require("hardhat");
require("dotenv").config();

// Deployed contract addresses from previous run
const TRUST_SCORE_ADDRESS = "0x25cC4Da421FA5A8dcEa7CEC64eA9Bab0f1f8F08a";
const ESCROW_ADDRESS = "0x87F119F824ff7b8B156fd53A8606Edb68273A775";
const DISPUTE_DAO_ADDRESS = "0x06c9B1A7d05eF5e75Ad566B349c5486424Be9743";

async function main() {
  console.log("\n🔧 Configuring deployed contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📦 Configuring as:", deployer.address);

  // Get TrustScore contract
  const TrustScore = await ethers.getContractFactory("TrustScore");
  const trustScore = TrustScore.attach(TRUST_SCORE_ADDRESS);

  // Authorize escrow contract
  console.log("   • Authorizing P2PEscrowV5 in TrustScore...");
  const tx = await trustScore.authorizeContract(ESCROW_ADDRESS, true);
  await tx.wait();
  console.log("   ✅ P2PEscrowV5 authorized in TrustScore");

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║         ✅ CONFIGURATION COMPLETE!                        ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("\n📋 Deployed Contract Addresses:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   TrustScore:     ${TRUST_SCORE_ADDRESS}`);
  console.log(`   P2PEscrowV5:    ${ESCROW_ADDRESS}`);
  console.log(`   DisputeDAO:     ${DISPUTE_DAO_ADDRESS}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n📝 Add to your .env.local:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`NEXT_PUBLIC_TRUST_SCORE_ADDRESS=${TRUST_SCORE_ADDRESS}`);
  console.log(`NEXT_PUBLIC_ESCROW_ADDRESS=${ESCROW_ADDRESS}`);
  console.log(`NEXT_PUBLIC_DISPUTE_DAO_ADDRESS=${DISPUTE_DAO_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Configuration failed:", error);
    process.exit(1);
  });
