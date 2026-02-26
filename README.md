<div align="center">

# uWu

### Trustless Peer-to-Peer Crypto ↔ Fiat Protocol

> *Non-custodial escrow, stake-backed trust, and game-theoretic fraud prevention — bridging USDC to INR in under 60 seconds.*

[![opBNB Testnet](https://img.shields.io/badge/opBNB_Testnet-Live-F0B90B?style=for-the-badge)](https://opbnb.bnbchain.org)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)

**[Live Demo](https://hackmoney-eosin.vercel.app)** · **[Economics Paper](./ECONOMICS.md)** · **[Contract Docs](./contracts/README.md)**

</div>

---

## Table of Contents

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Architecture Overview](#-architecture-overview)
- [Smart Contracts](#-smart-contracts)
- [Core Protocol Mechanics](#-core-protocol-mechanics)
- [Security & Anti-Fraud](#-security--anti-fraud)
- [Dispute Resolution — 3-Tier DAO](#-dispute-resolution--3-tier-dao)
- [Identity & Naming](#-identity--naming)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Features Implemented](#-features-implemented)
- [Quick Start](#-quick-start)
- [Deployed Contracts](#-deployed-contracts)
- [Why This Matters](#-why-this-matters)
- [Roadmap](#-roadmap)
- [License](#license)

---

## 🔴 The Problem

**Crypto-to-fiat conversion is fundamentally broken in emerging markets.**

More than 400 million people in India alone hold or want to hold crypto, yet converting USDC to INR (or vice versa) still means choosing between bad options:

| Existing Option | Critical Failures |
|---|---|
| **Centralized Exchanges** (WazirX, CoinDCX) | KYC friction, 24–48hr withdrawal delays, custodial risk (WazirX hacked for $230M in 2024), 2–5% fees, regulatory uncertainty |
| **P2P on Binance/Paxful** | Counterparty fraud, fake payment screenshots, no on-chain escrow, centralized arbitration, platform can freeze your funds without recourse |
| **OTC / Telegram Dealers** | Zero accountability, scam-prevalent, no dispute resolution, legally grey |

**The root cause:** There is no trustless, non-custodial mechanism that makes counterparty fraud *economically irrational* while keeping the UX fast enough for mainstream adoption.

---

## 🟢 The Solution

**uWu is a multi-chain P2P payment protocol that makes crypto ↔ fiat conversion as simple as scanning a QR code — secured by on-chain escrow, stake-backed liquidity providers, and a game-theoretic economic model where fraud always costs more than it gains.**

### How It Works (30-Second Version)

```
User scans UPI QR → USDC locked in smart contract escrow → LP pays INR via UPI → 
DAO validates payment proof → USDC released to LP → Done in < 60 seconds
```

If anything goes wrong, the LP's USDC stake is slashed and the user is made whole. **The math guarantees that fraud is a losing proposition.**

### Detailed Protocol Flow

```
┌──────────────────┐     ┌───────────────────────┐     ┌───────────────────┐
│      USER        │     │     SMART CONTRACT     │     │   LIQUIDITY       │
│  (holds USDC)    │────▶│     (P2PEscrowV5)      │────▶│   PROVIDER (LP)   │
│                  │     │                         │     │   (holds INR)     │
└──────────────────┘     └───────────────────────┘     └───────────────────┘
        │                          │                            │
        │  1. Scan UPI QR          │                            │
        │  2. Enter USDC amount    │                            │
        │  3. Rate locked (live)   │                            │
        │  4. USDC → Escrow ──────▶│                            │
        │                          │  5. Round-robin LP match   │
        │                          │─────────────────────────▶ │
        │                          │                            │  6. LP sends INR
        │                          │                            │     via UPI
        │                          │                            │  7. Uploads payment
        │                          │                            │     screenshot
        │                          │                            │
        │                          │  8. DAO validators verify  │
        │                          │     payment proof (2/3     │
        │                          │     consensus)             │
        │                          │                            │
        │                          │  9. USDC released ────────▶│
        │                          │     + reward               │
        │                          │                            │
        │       ── DISPUTE? ──     │                            │
        │  Evidence + IPFS ───────▶│  DAO votes (3-tier) ──────▶│
        │                          │  Loser stake slashed       │
        │                          │  Winner compensated        │
        └──────────────────────────┴────────────────────────────┘
```

---

## 🏗 Architecture Overview

uWu runs on **BNB Chain (opBNB / BSC)** for escrow and dispute resolution:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 16)                     │
│  PWA · Mobile-First · Thirdweb Wallet · Framer Motion           │
│  Landing · Dashboard · Scan & Pay · LP Terminal · DAO Panel     │
└────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────┐     ┌──────────────────────┐
│   BNB CHAIN          │     │   OFF-CHAIN INFRA    │
│   (opBNB / BSC)      │     │                      │
│   EVM · Solidity     │     │  • Upstash Redis     │
│                      │     │    (Order state sync) │
│  • P2PEscrowV5       │     │  • Pinata IPFS       │
│  • TrustScore        │     │    (Dispute evidence) │
│  • DisputeDAO        │     │  • CoinGecko API     │
│  • USDC (ERC-20)     │     │  • Fraud Detection    │
└──────────────────────┘     └──────────────────────┘
```

**Why BNB Chain?** Low fees, EVM compatibility, and broad adoption. Escrow, staking, slashing, and USDC transfers run on Solidity + OpenZeppelin on opBNB or BSC testnet.

---

## ⛓ Smart Contracts

### Solidity Contracts (BNB Chain — opBNB / BSC Testnet)

#### P2PEscrowV5.sol — *Core Escrow Engine*
The production-grade escrow contract handling all financial operations:

- **USDC Escrow:** Lock, release, and refund flows with `SafeERC20` + `ReentrancyGuard`
- **LP Staking:** Stake-to-operate model where `stake ≥ max order size` (enforced at contract level)
- **Round-Robin LP Rotation:** Fair order distribution across active LPs, auto-skip unresponsive providers
- **Rate Locking:** Exchange rate frozen at order creation via CoinGecko snapshot — prevents front-running
- **Comprehensive Cooldown System:**
  - 30–60s post-order cooldown for LPs (quality service)
  - 24h dispute cooldown (investigation buffer)
  - 12h abandon cooldown (discourage ghosting)
  - 30min velocity cooldown (5 orders/hr cap)
  - 10min new-account cooldown (anti-Sybil)
- **Tiered Daily Volume Caps:** $150/day (new) → $300/day (established) → $750/day (high-trust)
- **Fee Model:** 0.5% platform fee; $0.12 flat fee for micro-orders (<$10 USDC)

#### TrustScore.sol — *On-Chain Reputation*
Persistent, tamper-proof reputation tracking:

- `Reputation` struct: `completedTrades`, `totalVolume`, `successfulReleases`, `disputes`, `disputesLost`, `firstTradeAt`, `lastTradeAt`, `isLP`, `lpStake`
- Authorized-contract pattern (only the escrow contract can write scores)
- Trust score bands: **Trusted** (90–100, green), **Good** (70–89), **Caution** (50–69, yellow), **Risky** (0–49, red)

#### DisputeDAO.sol — *3-Tier Dispute Resolution*
Decentralized, escalating dispute resolution:

- **Tier 0 — Auto-Resolution:** High-confidence off-chain signals (clear UTR match, timestamp alignment)
- **Tier 1 — Community Arbitration:** 3 qualified arbitrators vote; 2/3 majority required; 4-hour window
- **Tier 2 — Admin Review:** Escalated edge cases; 24-hour investigation with evidence review
- **Arbitrator Requirements:** 500+ USDC staked, 50+ completed trades, <2% dispute rate
- **Arbitrator Reward:** 0.5% of disputed order value per review

*(Move/Sui contracts removed — app uses BNB Chain only; order state in Redis.)*

---

## ⚙ Core Protocol Mechanics

### LP Tier System — Stake = Maximum Exposure

Liquidity Providers must collateralize their position. **The LP can never process an order larger than their stake**, creating a natural risk ceiling enforced at the smart contract level.

| Tier | Stake Required | Max Order Size | Daily Volume Cap | Target Segment |
|------|:-:|:-:|:-:|---|
| **Bronze** | $50 USDC | $50 | $50/day | New LPs, testing |
| **Silver** | $200 USDC | $200 | $200/day | Small regular trades |
| **Gold** | $500 USDC | $500 | $500/day | Power users, DAO validators |
| **Diamond** | $2,000 USDC | $2,000 | $2,000/day | High-volume professionals |

### Why Fraud Is Economically Irrational

This is the **core protocol invariant**. We don't rely on trust — we make fraud a mathematically losing strategy.

```
Scenario: LP attempts to steal $100 from a user

LP's stake at risk:    $200 USDC (Silver tier minimum)
Potential gain:        $100 (the stolen USDC)
Detection probability: ~90% (DAO review + evidence + UTR)

Progressive slashing applied:
  1st offense:  20% of $200 = $40 slashed → net $60 gain (but flagged)
  2nd offense:  50% of $160 = $80 slashed → net loss
  3rd offense: 100% of $80  = $80 slashed → ZERO balance + PERMANENT BAN

Expected Value = P(success) × $100 - P(caught) × $200
               = 0.10 × $100 - 0.90 × $200
               = $10 - $180
               = -$170

RESULT: Fraud has deeply negative expected value.
```

### Fee Structure

| Fee Type | Amount | Distribution |
|---|---|---|
| Standard platform fee | 0.5% of order value | 80% treasury · 20% arbitrator pool |
| Micro-order flat fee | $0.12 (~₹10) for orders < $10 | 100% treasury |

### LP Round-Robin Rotation

The `useLPRotation` hook implements fair, intelligent LP matching:
- **Round-robin selection** from the active LP pool
- **Auto-skip** unresponsive LPs (60s timeout threshold)
- **Cooldown-aware** — respects 45s post-order cooldown
- **Daily limit check** — skips LPs who have hit their volume cap
- **10s refresh interval** for real-time pool updates

---

## 🔒 Security & Anti-Fraud

### Multi-Layer Defense System

| Attack Vector | Protection Mechanism | Enforcement |
|---|---|---|
| **Sybil attacks** (fake accounts) | 10-min new-account cooldown + $150/day new-user limit | Contract + API |
| **Velocity abuse** (wash trading) | Max 5 orders/hour; 30-min cooldown if exceeded | Contract |
| **LP front-running** (rate manipulation) | Exchange rate frozen at order creation time (CoinGecko snapshot) | Contract |
| **LP ghosting** (accept & ignore) | Auto-escalate to dispute after 15 min unresponsive | API + Contract |
| **Fake payment proofs** | UTR verification required; 3 strikes → permanent ban | DAO + Contract |
| **Stake withdrawal during dispute** | 24-hour unstaking notice period; auto-deactivation during active orders | Contract |
| **Order exceeds stake** | Hard rejection: `require(amount <= stake)` | Contract |
| **Behavioral anomalies** | ML-based fraud scoring: velocity profiling, amount escalation detection, geo-mismatch flags | Server-side |

### Fraud Detection Engine (`fraud-detection.ts`)

A server-side behavioral analysis engine that computes a `RiskAssessment` for every order:

- **Velocity signals:** orders/hour, orders/24h, rapid successive amounts
- **Pattern signals:** amount escalation rate, round-number frequency, repeat counterparties
- **Wallet signals:** account age, historical completion rate, dispute-to-trade ratio
- **Session signals:** new device fingerprint, geographic mismatch, timezone anomalies
- **Output:** `riskScore` (0–100), `riskLevel`, `requiredActions` (normal / higher stake / manual review / block)

---

## ⚖ Dispute Resolution — 3-Tier DAO

uWu implements a progressive, decentralized dispute resolution system that balances speed with fairness:

```
                    ┌───────────────────┐
                    │   DISPUTE RAISED  │
                    │  (Evidence + IPFS) │
                    └────────┬──────────┘
                             │
                    ┌────────▼──────────┐
                    │   TIER 0: AUTO    │  High-confidence signals
                    │   (Off-chain)     │  (clear UTR match, timestamps align)
                    └────────┬──────────┘
                             │ Inconclusive?
                    ┌────────▼──────────┐
                    │  TIER 1: DAO VOTE │  3 qualified arbitrators
                    │  (Community)      │  2/3 majority · 4-hour window
                    │  Reward: 0.5%     │  Race-to-review (first 3 votes)
                    └────────┬──────────┘
                             │ Split vote / Edge case?
                    ┌────────▼──────────┐
                    │  TIER 2: ADMIN    │  Core team review
                    │  (24-hour SLA)    │  Full evidence audit
                    │  + Mediation call │  Jitsi meet link generated
                    └───────────────────┘
```

### Validator Dashboard (DAO Panel)
- **Open pool model:** All Gold+ stakers ($500+) see pending validations
- **Race-to-review:** First 3 votes resolve the task; majority wins
- **Evidence display:** Side-by-side buyer QR + LP payment screenshot, wallet addresses, full timeline
- **Reward:** $0.05 USDC per completed review
- **Escalation:** If majority flags → auto-escalated to admin with full vote breakdown

### Progressive Slashing Schedule

| Offense | Stake Slashed | Cooldown | Additional Consequence |
|:-:|:-:|:-:|---|
| 1st | 20% | 24 hours | Warning issued; trust score reduced |
| 2nd | 50% | 48 hours | Trust score severely impacted |
| 3rd | 100% | **Permanent** | **Wallet banned forever**; remaining stake forfeited |

### Slashing Distribution
- **90%** → Affected user (direct compensation)
- **10%** → Resolving arbitrator (incentive for timely review)

---

## 🪪 Identity & Naming

### ENS Integration (Ethereum)

For users who already have an ENS name on Ethereum, uWu automatically resolves and displays it alongside their wallet address via the `useENS` hook.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16 (Turbopack) · TypeScript · Tailwind CSS · Framer Motion | Mobile-first PWA with dark minimal theme |
| **Wallet** | Thirdweb SDK v5 | MetaMask, WalletConnect, embedded Social Login (Google/Apple) |
| **EVM Contracts** | Solidity 0.8.20 · Hardhat · OpenZeppelin | P2PEscrowV5, TrustScore, DisputeDAO on BNB (opBNB/BSC) |
| **State Sync** | Upstash Redis | Real-time order state shared across Vercel edge instances |
| **Evidence Storage** | Pinata (IPFS) | Immutable dispute evidence (screenshots, UTR proofs) |
| **Pricing Oracle** | CoinGecko API (1-min cache) | Live USDC/INR rates with rate-lock at order creation |
| **Fraud Detection** | Custom TypeScript engine | Behavioral scoring, velocity analysis, geo-mismatch detection |
| **UI Components** | Radix UI + shadcn/ui | Accessible primitives (Dialog, Dropdown, Tabs) |
| **Charts** | Recharts | Revenue analytics, trust score trends in admin panel |
| **QR** | html5-qrcode + qrcode | QR scanning (camera) and generation |

---

## 📂 Project Structure

```
uwu/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── page.tsx                      # Marketing landing page (Hero, FAQ, sections)
│   │   ├── layout.tsx                    # Root layout (theme, fonts, analytics)
│   │   ├── globals.css                   # Tailwind + custom design tokens
│   │   ├── admin/page.tsx                # Admin panel (wallet-gated, core team only)
│   │   ├── grievance/page.tsx            # Public grievance submission
│   │   ├── (app)/                        # Authenticated app shell (with BottomNav)
│   │   │   ├── layout.tsx                # Route guard + bottom navigation
│   │   │   ├── dashboard/                # User home: balance, quick actions, recent orders
│   │   │   ├── scan/                     # QR Scan & Pay — core user flow
│   │   │   ├── buy/                      # Buy USDC with INR
│   │   │   ├── sell/                     # Sell USDC for INR
│   │   │   ├── trade/                    # Unified trade interface
│   │   │   ├── solver/                   # LP Terminal — accept orders, upload proofs
│   │   │   ├── lp/register/              # LP onboarding (4-step: eligibility → stake → configure → activate)
│   │   │   ├── stake/                    # Manage staking position
│   │   │   ├── dao/                      # Validator dashboard — review & vote on orders
│   │   │   ├── orders/                   # Order history & transaction logs
│   │   │   ├── wallet/                   # Deposit, withdraw, balance, tx history
│   │   │   ├── profile/                  # Reputation, tier, settings
│   │   │   ├── rewards/                  # Points & reward tracking
│   │   │   └── onboarding/               # First-time user setup
│   │   └── api/                          # Next.js API Routes (serverless)
│   │       ├── orders/                   # Order CRUD + SSE real-time stream
│   │       ├── admin/                    # Admin actions + revenue analytics
│   │       ├── fraud/                    # Fraud scoring endpoint
│   │       ├── lp/                       # LP registration + rotation
│   │       ├── payment/                  # Payment verification
│   │       ├── reputation/               # Trust score queries
│   │       ├── settlement/               # On-chain settlement triggers
│   │       ├── validations/              # DAO validation task management
│   │       ├── wallet/                   # Wallet balance + history
│   │       ├── users/                    # User profile management
│   │       └── ipfs/                     # Pinata IPFS upload/retrieve
│   │
│   ├── components/
│   │   ├── app/                          # Feature components (wallet-connect, QR scanner,
│   │   │                                 #   trust badges, cooldown display, bottom nav)
│   │   ├── landing/                      # Landing page sections (hero, LP stake, DAO, FAQ)
│   │   ├── providers/                    # React context providers
│   │   └── ui/                           # Radix + shadcn/ui primitives
│   │
│   ├── hooks/
│   │   ├── useWallet.ts                  # Core wallet state (connect, balance, address)
│   │   ├── useEscrow.ts                  # Escrow contract interactions
│   │   ├── useStaking.ts                 # Stake deposit, withdrawal, tier management
│   │   ├── useTrustScore.ts              # On-chain reputation fetching
│   │   ├── useLPRotation.ts              # Round-robin LP selection algorithm
│   │   ├── useCooldown.ts                # Cooldown state tracking
│   │   ├── useUserLimits.ts              # Trust-based daily volume limits
│   │   ├── useOrders.ts                  # Order state management + SSE
│   │   ├── usePaymentVerification.ts     # UTR + payment proof validation
│   │   ├── useFraudProfile.ts            # Per-user fraud risk assessment
│   │   ├── useReputation.ts              # Reputation display logic
│   │   ├── useLPEarnings.ts              # LP P&L tracking
│   │   ├── useUwuName.ts                 # Stub (name system removed)
│   │   ├── useENS.ts                     # ENS name resolution (Ethereum)
│   │   └── useSafeNavigation.ts          # Type-safe routing helpers
│   │
│   ├── context/
│   │   └── wallet-context.tsx            # Global wallet state provider
│   │
│   └── lib/
│       ├── escrow-abi.ts                 # P2PEscrowV5 ABI
│       ├── web3-config.ts                # BNB chain config, RPC, contract addresses
│       ├── thirdweb-config.ts            # Thirdweb client + chain setup
│       ├── order-store.ts                # Redis-backed order storage with in-memory fallback
│       ├── reputation-scoring.ts         # Dual LP/User scoring formulas (0–100)
│       ├── fraud-detection.ts            # Behavioral fraud analysis engine
│       ├── currency-converter.ts         # Live CoinGecko rates + multi-currency support
│       ├── rate-lock.ts                  # Exchange rate freezing at order creation
│       ├── qr-parser.ts                  # UPI QR string parsing
│       ├── utr-verification.ts           # UTR payment proof validation
│       ├── slashing-rules.ts             # Progressive slashing calculations
│       ├── ipfs-storage.ts               # Pinata upload/retrieve for evidence
│       ├── validation-store.ts           # DAO validation task storage
│       ├── redis.ts                      # Upstash Redis client
│       └── platform-config.ts            # Global config constants
│
├── contracts/
│   ├── solidity/                         # EVM smart contracts (Hardhat)
│   │   ├── contracts/
│   │   │   ├── P2PEscrowV5.sol           # Core escrow (v5) — staking, cooldowns, fees, rotation
│   │   │   ├── TrustScore.sol            # On-chain reputation system
│   │   │   └── DisputeDAO.sol            # 3-tier dispute resolution with arbitrator staking
│   │   ├── scripts/                      # Deployment scripts (deploy_v5.js)
│   │   ├── artifacts/                    # Compiled contract ABIs
│   │   └── hardhat.config.ts             # opBNB/BSC Testnet network config
│   │
│   └── (contracts/sui removed — BNB only)
│
└── public/                               # Static assets + PWA manifest
```

---

## ✅ Features Implemented

| # | Feature | Description | Status |
|:-:|---|---|:-:|
| 1 | **QR Scan & Pay** | Camera-based UPI QR scanning with live amount entry | ✅ |
| 2 | **Instant LP Matching** | Round-robin LP rotation with cooldown + capacity awareness | ✅ |
| 3 | **On-Chain Escrow** | USDC locked in P2PEscrowV5 with rate-lock at creation time | ✅ |
| 4 | **LP Terminal** | Real-time order feed, payment proof upload, SSE live updates | ✅ |
| 5 | **4-Step LP Onboarding** | Eligibility → Stake → Configure → Activate | ✅ |
| 6 | **Tiered Staking** | Bronze ($50) → Silver ($200) → Gold ($500) → Diamond ($2k) | ✅ |
| 7 | **Trust Score System** | Dual LP + User reputation (0–100), on-chain via TrustScore.sol | ✅ |
| 8 | **3-Tier Dispute DAO** | Auto → Community (3 voters) → Admin escalation | ✅ |
| 9 | **Progressive Slashing** | 20% → 50% → 100% + permanent ban | ✅ |
| 10 | **Validator Dashboard** | Open-pool race-to-review; evidence display; $0.05/review reward | ✅ |
| 11 | **Admin Panel** | Wallet-gated (core team); escalated cases, revenue analytics, validators | ✅ |
| 12 | **Fraud Detection Engine** | Behavioral scoring with velocity, pattern, wallet, session signals | ✅ |
| 13 | **Velocity Limits & Cooldowns** | 5/hr cap, 30-min cooldown, 10-min new-account wait, 12h abandon | ✅ |
| 14 | **Trust-Based Daily Limits** | $150 (new) → $300 (established) → $750 (high-trust) per day | ✅ |
| 15 | **.uwu Name System** | (removed — BNB-only build) | — |
| 16 | **ENS Integration** | Ethereum ENS name resolution + display | ✅ |
| 17 | **Order Storage** | Redis-backed order state (on-chain escrow on BNB) | ✅ |
| 18 | **IPFS Evidence** | Pinata-backed dispute evidence (screenshots, proofs) | ✅ |
| 19 | **Live Rate Oracle** | CoinGecko multi-currency rates with rate-lock | ✅ |
| 20 | **Mediation System** | Jitsi video call link generation for complex disputes | ✅ |
| 21 | **PWA Support** | Installable mobile app with offline manifest | ✅ |
| 22 | **Social Login** | Google/Apple sign-in via Thirdweb embedded wallets | ✅ |
| 23 | **LP Dispute View** | Full dispute detail panel on LP side (evidence, timeline, meet link) | ✅ |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (20 recommended)
- **pnpm** (recommended) or npm
- **MetaMask** browser extension (for opBNB/BSC Testnet)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/uwu.git
cd uwu

# Install frontend dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Configure: Thirdweb client ID, Upstash Redis URL/token, Pinata keys

# Start the development server
pnpm dev
```

Open **[http://localhost:3000](http://localhost:3000)** to view the app.

### Smart Contract Development

```bash
# Solidity (BNB Chain)
cd contracts/solidity
pnpm install
npx hardhat compile
# Set USDC_ADDRESS and DEPLOYER_PRIVATE_KEY in .env, then:
npx hardhat run scripts/deploy_v5.js --network opbnbTestnet
# or: --network bscTestnet
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Thirdweb wallet connect |
| `NEXT_PUBLIC_P2P_ESCROW_ADDRESS` | Deployed P2PEscrowV5 on BNB |
| `NEXT_PUBLIC_DISPUTE_DAO_ADDRESS` | Deployed DisputeDAO on BNB |
| `NEXT_PUBLIC_TRUST_SCORE_ADDRESS` | Deployed TrustScore on BNB |
| `NEXT_PUBLIC_USDC_ADDRESS` | USDC token on opBNB/BSC testnet |
| `UPSTASH_REDIS_REST_URL` | Redis for cross-instance order sync |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `PINATA_API_KEY` | IPFS evidence upload |
| `PINATA_SECRET_KEY` | IPFS auth |

---

## 📋 Deployed Contracts

### BNB Chain (opBNB Testnet / BSC Testnet)

After deploying with `npx hardhat run scripts/deploy_v5.js --network opbnbTestnet` (or `bscTestnet`), add the printed addresses to `.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_P2P_ESCROW_ADDRESS` | P2PEscrowV5 |
| `NEXT_PUBLIC_TRUST_SCORE_ADDRESS` | TrustScore |
| `NEXT_PUBLIC_DISPUTE_DAO_ADDRESS` | DisputeDAO |
| `NEXT_PUBLIC_USDC_ADDRESS` | USDC token on the chosen chain |

---

## 💡 Why This Matters

**BNB Hack track: Smart Collateral for Web3 Credit & BNPL.** uWu’s escrow acts as a **programmable vault**: users lock USDC in a verifiable, on-chain contract instead of handing custody to a central party. That lock is the **credit guarantee** — trust-minimised Web3 credit with no custody surrender. Default and disputes are handled on-chain (DAO + slashing), making the protocol a natural fit for BNPL and credit use cases built on BNB Chain.

### For Users
- **Zero KYC** — Connect wallet and start trading immediately
- **Non-custodial** — Funds live in auditable smart contracts, not a company's hot wallet
- **Sub-1% fees** — LP competition drives costs well below exchange rates
- **Sub-60s settlement** — UPI payment + DAO validation in real-time
- **Full protection** — If defrauded, LP stake is slashed and user is compensated

### For Liquidity Providers
- **Earn on every trade** — Spread between conversion rates + platform rewards
- **Flexible hours** — Go online/offline at will; no minimum commitment
- **Transparent rules** — Every rule enforced on-chain; no platform arbitrariness
- **Tier progression** — Stake more → process larger orders → earn more
- **Reputation portability** — On-chain trust score follows you across the ecosystem

### For the Ecosystem
- **True decentralization** — No single point of failure; no custodial entity
- **Regulatory resilience** — Pure P2P, non-custodial, no money transmission license required
- **Composable** — Any dApp can integrate uWu's escrow as an on/off-ramp primitive
- **BNB Chain native** — opBNB/BSC for settlement; extensible to other EVM chains

---

## 🗺 Roadmap

### V5 — Current (Hackathon Submission)
- [x] Full escrow lifecycle with staking + slashing
- [x] 3-tier DAO dispute resolution
- [x] ENS display (optional)
- [x] Behavioral fraud detection engine
- [x] Admin panel with revenue analytics
- [x] LP dispute detail view with mediation

### V6 — Next
- [ ] Multi-sig arbitration (3-of-5 community council)
- [ ] Insurance pool for shortfall coverage
- [ ] LP staking yield (protocol revenue sharing)
- [ ] Cross-chain settlement (Arbitrum, Base, Polygon)
- [ ] Multi-fiat support (beyond INR — NGN, BRL, PHP)
- [ ] Mobile native app (React Native)

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

<div align="center">

*"We didn't build another DEX. We built the bridge between crypto and the real world — where your USDC becomes rupees in someone's UPI wallet in under 60 seconds, trustlessly."*

**Built for BNB Chain** · **opBNB / BSC**

</div>

