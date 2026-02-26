# uWu Smart Contracts

Smart contracts for the uWu P2P platform on **BNB Chain**.

---

## Summary

| Item | Value |
|------|--------|
| **Current deployment target** | **opBNB Testnet** (chainId 5611) |
| **After validation** | Deploy to **opBNB Mainnet** (chainId 204) — config present, commented |
| **Alternate chains (commented in codebase)** | BSC Testnet (97), BSC Mainnet (56) |
| **Config files** | `contracts/solidity/hardhat.config.ts` (networks); `src/lib/web3-config.ts` and `src/lib/thirdweb-config.ts` (app chain) |
| **Deploy script** | `scripts/deploy_v5.js` |

**Active in code:** Only **opBNB Testnet** is enabled. opBNB Mainnet and BSC (testnet + mainnet) are kept in the repo as commented blocks so you can uncomment and use them without conflicts.

**opBNB Testnet USDC:** The app expects a token with **6 decimals**. Use the included **MockUSDC** (deploy with `scripts/deploy_mock_usdc.js`) so the app works as-is. The bridged USDC on opBNB Testnet (`0x845E27B8A4ad1Fe3dc0b41b900dC8C1Bb45141C3`) has 18 decimals and would require app changes.

---

## Steps to deploy (opBNB Testnet — current)

1. **Go to the Solidity folder**
   ```bash
   cd contracts/solidity
   ```

2. **Install dependencies** (if not done)
   ```bash
   pnpm install
   # or: npm install
   ```

3. **Get a USDC address on opBNB Testnet** (pick one):

   **Option A — Deploy MockUSDC (recommended, 6 decimals, no app change)**  
   The app expects USDC with **6 decimals**. Deploy the included mock first, then use its address as `USDC_ADDRESS`:
   ```bash
   npx hardhat run scripts/deploy_mock_usdc.js --network opbnbTestnet
   ```
   Copy the printed `USDC_ADDRESS=` into `contracts/solidity/.env`. Deployer receives 1,000,000 Mock USDC.

   **Option B — Use bridged USDC on opBNB Testnet (18 decimals)**  
   Official bridged USDC: `0x845E27B8A4ad1Fe3dc0b41b900dC8C1Bb45141C3`  
   ([opBNB bridge tokens](https://github.com/bnb-chain/opbnb-bridge-tokens)). This token uses **18 decimals**. Our app uses **6 decimals** everywhere, so you would need to either change the app (parseUsdc/formatUsdc and all `1e6` usages) to 18 decimals for testnet, or use Option A.

4. **Create `.env`** in `contracts/solidity/` with:
   ```env
   DEPLOYER_PRIVATE_KEY=0x_your_wallet_private_key_here
   USDC_ADDRESS=0x...   # from Option A or B above
   ```
   - **DEPLOYER_PRIVATE_KEY:** Wallet that will deploy; must hold **tBNB** for gas.

5. **Get tBNB for gas (opBNB Testnet)**
   - [L2 Faucet](https://www.l2faucet.com/opbnb) or [thirdweb opBNB faucet](https://thirdweb.com/opbnb-testnet).
   - Add "opBNB Testnet" (chainId 5611) to MetaMask, then request tBNB to your deployer address.

6. **Compile**
   ```bash
   npx hardhat compile
   ```

7. **Deploy to opBNB Testnet**
   ```bash
   npm run deploy
   # or: npx hardhat run scripts/deploy_v5.js --network opbnbTestnet
   ```

8. **Copy printed addresses** into the app’s `.env.local` (project root):
   ```env
   NEXT_PUBLIC_P2P_ESCROW_ADDRESS=0x...
   NEXT_PUBLIC_TRUST_SCORE_ADDRESS=0x...
   NEXT_PUBLIC_DISPUTE_DAO_ADDRESS=0x...
   NEXT_PUBLIC_USDC_ADDRESS=0x...
   ```

---

## Deploy to opBNB Mainnet (after testnet is validated)

1. **In `contracts/solidity/hardhat.config.ts`:**
   - Uncomment the `opbnbMainnet` block under `networks`.
   - Uncomment the `opbnbMainnet` entry in `etherscan.apiKey` and the `opbnbMainnet` block in `etherscan.customChains`.

2. **Set `.env` for mainnet:**
   - `USDC_ADDRESS` = USDC on opBNB Mainnet (look up on [opbnb.bscscan.com](https://opbnb.bscscan.com)).
   - Deployer wallet must hold **BNB** (mainnet) for gas.

3. **Deploy:**
   ```bash
   npm run deploy:opbnb-mainnet
   # or: npx hardhat run scripts/deploy_v5.js --network opbnbMainnet
   ```

4. **App:** To point the frontend to mainnet, in `src/lib/web3-config.ts` and `src/lib/thirdweb-config.ts` uncomment `opbnbMainnet` / `opbnbMainnetChain` and set `defaultChain = opbnbMainnet` (or `opbnbMainnetChain`).

---

## Deploy to BSC Testnet or BSC Mainnet

1. **In `contracts/solidity/hardhat.config.ts`:**
   - Uncomment the `bscTestnet` and/or `bscMainnet` blocks under `networks`.
   - Uncomment the corresponding `etherscan.apiKey` and `customChains` entries.

2. **Set `.env`:**
   - **BSC Testnet:** `USDC_ADDRESS=0x64544969ed7ebf5f083679233325356ebe738930` (common test USDC). Get tBNB from [BNB Chain testnet faucet](https://www.bnbchain.org/en/testnet-faucet).
   - **BSC Mainnet:** Use mainnet USDC address; deployer needs BNB for gas.

3. **Deploy:**
   ```bash
   # BSC Testnet
   npm run deploy:bsc
   # or: npx hardhat run scripts/deploy_v5.js --network bscTestnet

   # BSC Mainnet (add script in package.json if needed, e.g. deploy:bsc-mainnet)
   npx hardhat run scripts/deploy_v5.js --network bscMainnet
   ```

4. **App:** In `web3-config.ts` and `thirdweb-config.ts` uncomment `bscTestnet` / `bscMainnet` and set `defaultChain` to the chosen chain.

---

## Structure

```
contracts/
└── solidity/
    ├── contracts/
    │   ├── P2PEscrowV5.sol
    │   ├── TrustScore.sol
    │   └── DisputeDAO.sol
    ├── hardhat.config.ts   # opBNB testnet active; mainnet & BSC commented
    ├── package.json
    └── scripts/
        └── deploy_v5.js
```

---

## Contract overview

| Contract | Purpose |
|----------|---------|
| **P2PEscrowV5** | USDC escrow, LP staking, cooldowns, rate lock |
| **TrustScore** | On-chain reputation (0–100) |
| **DisputeDAO** | 3-tier dispute resolution |

---

## Security notes

⚠️ **Contracts are for testnet use and have not been audited.**

Before mainnet: audit, pause, upgrade pattern, rate limiting, MEV consideration.
