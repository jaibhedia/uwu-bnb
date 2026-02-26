# BNB Chain x YZi Labs Hack — Codebase Review

Review of the uWu codebase against **BNB Hack submission rules** and **scoring criteria**. Event: Feb 27–28, 2026, Bengaluru.

---

## 1. Submission requirements (mandatory)

| Requirement | Status | Notes |
|-------------|--------|------|
| **Deployed on or connected to opBNB/BSC mainnet or testnet** | **OK** | App and contracts target **opBNB Testnet** (chainId 5611). Config in `src/lib/web3-config.ts`, `src/lib/thirdweb-config.ts`, `contracts/solidity/hardhat.config.ts`. Explorer links use `opbnb-testnet.bscscan.com`. |
| **Not previously funded / past hackathons** | N/A | For you to confirm. |
| **Open source, free to use** | **Partial** | README states MIT and references `./LICENSE` — **no `LICENSE` file found in repo root**. Add a `LICENSE` file (e.g. MIT) for open-source compliance. |
| **Shared: GitHub + deck + demo video** | **Repo only** | GitHub repo is the codebase. **Deck** and **demo video** are not in the repo — create and link or host separately. |
| **Contract has ≥ 2 successful txs in hackathon window** | **Action** | During Feb 27–28, execute at least 2 on-chain transactions (e.g. create order, stake, or release) on the deployed P2PEscrow so the contract address shows activity in the window. |
| **Tweet: @BNBChain, #BNBHack, track name** | **Action** | Before/at submission, post a tweet describing the project, tag @BNBChain, use #BNBHack, and include the track (e.g. **Smart Collateral for Web3 Credit & BNPL**). |

---

## 2. Scoring criteria alignment

| Criteria | Codebase / docs | Recommendation |
|----------|------------------|----------------|
| **Design & Usability** | PWA, mobile-first, dark theme, scan flow, LP terminal, DAO panel. | Demo a clean flow (connect → scan → escrow → settle). Mention PWA/install in deck. |
| **Scalability** | Round-robin LP matching, Redis order sync, rate-lock, velocity/cooldown limits. | In README or deck, briefly describe horizontal scaling (Redis, serverless) and on-chain limits. |
| **Innovation** | Trustless P2P USDC↔INR, stake-backed LPs, 3-tier DAO, slashing, fraud engine. | Emphasize “programmable escrow as credit guarantee” and game-theoretic fraud. |
| **Open Source** | Code is in repo; README and contract docs present. | Add root **LICENSE** (e.g. MIT). Ensure no secrets in committed files; use `.env` only locally and add root **.gitignore** (`.env`, `.env.local`, `node_modules`, etc.) if missing. |
| **Integration** | opBNB Testnet + contract addresses from env; USDC (MockUSDC) integrated. | README already states BNB Chain; add one line “Deployed on opBNB Testnet” and explorer link for escrow. |

---

## 3. Track: Smart Collateral for Web3 Credit & BNPL

- **Fit:** Escrow = users lock USDC in a programmable contract (verifiable credit guarantee); non-custodial; default/dispute = on-chain (DAO + slashing).
- **Gap:** README and docs do not use the track wording (“programmable vaults”, “verifiable credit guarantees”, “trust-minimised Web3 credit”).
- **Recommendation:** In README (e.g. “Why This Matters” or a new “BNB Hack” subsection) and in the **deck**, add 2–3 sentences framing uWu under **Smart Collateral for Web3 Credit & BNPL**: programmable escrow vault, verifiable credit guarantee, no custody surrender, on-chain default logic (DAO + slashing).

---

## 4. Config and env checklist

| Item | Status |
|------|--------|
| opBNB Testnet (5611) as default chain | OK in `web3-config.ts`, `thirdweb-config.ts` |
| Contract addresses from env | OK: `NEXT_PUBLIC_P2P_ESCROW_ADDRESS`, `TRUST_SCORE`, `DISPUTE_DAO`, `USDC_ADDRESS` in `.env` |
| Thirdweb client ID | Set in `.env` (do not commit; ensure root `.gitignore` has `.env`) |
| Explorer links | Point to `https://opbnb-testnet.bscscan.com` (e.g. wallet page) |
| Hardhat deploy target | `opbnbTestnet`; BSC/mainnet commented |

---

## 5. Gaps and actions

1. **Add `LICENSE`** in repo root (e.g. MIT) — README references it.
2. **Add root `.gitignore`** if missing: include `.env`, `.env.local`, `node_modules`, `.next`, etc., so secrets and build artifacts are not committed.
3. **Deck + demo video:** Create and host; link in README or submission form.
4. **During hackathon (Feb 27–28):** Execute ≥ 2 successful txs on the deployed escrow (e.g. create order, release or stake).
5. **Tweet:** @BNBChain, #BNBHack, track name “Smart Collateral for Web3 Credit & BNPL”.
6. **Pitch alignment:** Add short “Smart Collateral / BNPL” framing in README and deck (programmable vault, verifiable credit guarantee, no custody surrender).

---

## 6. Summary

- **Chain and integration:** Correctly set for **opBNB Testnet**; app and contracts are aligned with BNB Hack’s “deployed on or connected to opBNB/BSC” requirement.
- **Open source:** Add `LICENSE` and ensure `.gitignore` protects `.env`.
- **Submission:** Repo ready; add deck, video, tweet, and ≥2 on-chain txs during the event.
- **Track and scoring:** Align pitch and docs with “Smart Collateral for Web3 Credit & BNPL” and call out design, scalability, innovation, open source, and integration in the deck.
