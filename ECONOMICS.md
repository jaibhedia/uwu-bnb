# UwU Economic Model

## Overview

UwU is a trustless P2P crypto-to-INR ramp built on Arc blockchain. This document outlines the economic mechanisms that ensure fair play, discourage fraud, and incentivize honest behavior.

---

## 🏦 LP Tier System

Liquidity Providers (LPs) must stake USDC to operate. **Stake amount = Maximum order size**.

| Tier | Stake Required | Max Order Size | Target Users |
|------|---------------|----------------|--------------|
| 1 | $50 USDC | $50 | New LPs, testing |
| 2 | $100 USDC | $100 | Small trades |
| 3 | $250 USDC | $250 | Regular users |
| 4 | $500 USDC | $500 | Power users |
| 5 | $1,000 USDC | $1,000 | High volume |

### Why Stake = Max Order?

This ensures LPs have "skin in the game" proportional to their exposure:
- LP can only process orders up to their staked amount
- If LP commits fraud, they lose their stake (up to order value)
- Creates natural risk ceiling for both parties

---

## 💰 Fee Structure

### Standard Fees
- **Platform Fee**: 0.5% of order value
- **Small Order Fee**: 0.12 USDC (~₹10) for orders < $10 USDC

### Fee Distribution
- 80% → Protocol treasury
- 20% → Arbitrator rewards pool

---

## ⚖️ Dispute Resolution

### Timeline
- **Dispute Window**: 4 hours maximum
- **Resolution Target**: < 2 hours for clear-cut cases
- **Evidence Submission**: First 30 minutes after dispute filed

### Progressive Slashing

When an LP loses a dispute, penalties escalate:

| Lost Disputes | Slash Amount | Status |
|---------------|-------------|--------|
| 1 | 20% of staked amount | Warning issued |
| 2 | 50% of staked amount | Strike recorded |
| 3+ | 100% of staked amount | **BANNED** |

### Slashing Distribution
- 90% → Affected user (compensation)
- 10% → Arbitrator who resolved

### Ban Mechanics
- Address permanently blacklisted
- Cannot register as LP again
- Remaining stake forfeited to treasury

---

## 🕐 Cooldown System

Comprehensive anti-abuse controls:

| Event | Cooldown | Reason |
|-------|----------|--------|
| New account | 10 minutes | Prevent bot spam |
| LP completes order | 30-60 seconds | Quality service |
| User raises dispute | 24 hours | Investigation buffer |
| Loses dispute (user) | **BANNED** | Zero tolerance for fraud |
| Abandons order | 12 hours | Discourage abandonment |
| 5 orders in 1 hour | 30 minutes | Velocity limit |

---

## 👤 User Daily Limits

Trust-based limits prevent abuse while rewarding good behavior:

| Trust Level | Requirement | Daily Limit |
|-------------|-------------|-------------|
| New User | < 50 trades | $150/day |
| Established | 50+ trades | $300/day |
| High Trust | 100+ trades, 0 disputes lost | $750/day |

---

## 🔒 Edge Case Handling

### LP Goes Offline Mid-Order
- User claims payment sent with UTR
- LP has 15 minutes to respond
- Auto-escalates to dispute if no response
- LP stake at risk

### User Lies About Payment
- UTR proof required when claiming payment
- False claims = Strike issued
- **3 strikes = Permanent ban**

### Rate Lock
- Exchange rate frozen at order creation
- Prevents gaming rate fluctuations
- Rate valid for 5 minutes
- Displayed clearly to both parties

### Velocity Limits
- Maximum 5 orders per hour per user
- Prevents wash trading
- 30-minute cooldown if exceeded

---

## 📊 Trust Score Calculation

Trust scores range from 0-100 and determine LP visibility/priority:

```
TrustScore = BaseScore 
           + (SuccessfulTrades × 0.5)
           - (Disputes × 10)
           - (AvgCompletionTime > 5min ? 5 : 0)
           + (MemberDays > 30 ? 10 : MemberDays / 3)
```

### Score Bands
| Score | Label | Card Color |
|-------|-------|------------|
| 90-100 | Trusted | Green |
| 70-89 | Good | Default |
| 50-69 | Caution | Yellow |
| 0-49 | Risky | Red |

---

## 🎯 Incentive Alignment

### For Users
- ✅ Low fees (0.5%)
- ✅ Fast settlement (< 5 min typical)
- ✅ Full protection via escrow
- ✅ Compensation from slashing if defrauded

### For LPs
- ✅ Earn spread on INR/USDC
- ✅ Passive income from volume
- ✅ Reputation building
- ⚠️ Stake at risk if fraudulent

### For Arbitrators
- ✅ Earn fees from dispute resolution
- ✅ DAO governance participation
- ⚠️ Must stake to participate
- ⚠️ Slashed for incorrect rulings

---

## 🔐 Security Mechanisms

### Anti-Fraud
1. **Stake-at-risk**: LP must have collateral
2. **Progressive slashing**: Escalating penalties
3. **Cooldowns**: Velocity limits
4. **UTR Verification**: Payment proof validation
5. **Fraud Detection**: ML-based risk scoring

### Anti-Sybil
1. **Minimum stake**: $50 barrier to entry
2. **Cooldowns**: Prevent rapid account cycling
3. **Trust Score**: New accounts start low priority
4. **ENS Integration**: Identity verification option

---

## 📈 Protocol Revenue

| Source | % of Volume |
|--------|-------------|
| Platform fees | 0.4% (80% of 0.5%) |
| Small order fees | Fixed ₹10 |
| Slashing (10%) | Variable |
| Premium features | Future |

### Treasury Allocation
- 50% → Development
- 30% → Liquidity incentives
- 20% → Emergency fund

---

## 🔄 Upgrade Path

### V3 Features (Current)
- [x] Stake = max order
- [x] 5-tier system
- [x] 4hr disputes
- [x] Progressive slashing
- [x] Cooldowns

### V4 Roadmap
- [ ] Multi-sig arbitration
- [ ] Insurance pool
- [ ] LP staking rewards
- [ ] Cross-chain settlement
- [ ] Fiat diversity (beyond INR)

---

## FAQ

**Q: What happens if I dispute and LP has insufficient stake?**
A: You receive 100% of LP's remaining stake. Protocol insurance covers shortfall for orders < $100.

**Q: Can LPs increase tier mid-order?**
A: No. Tier locked at order creation time.

**Q: How are arbitrators selected?**
A: Currently protocol-operated. DAO selection coming in V4.

**Q: What prevents LP from ignoring payment?**
A: Escrow holds user's USDC. LP has 4 hours to confirm, else user can dispute and LP stake gets slashed.

---

## Smart Contract

See [P2PEscrowV3.sol](./contracts/solidity/contracts/P2PEscrowV3.sol) for implementation.

Key functions:
- `stake(uint256 amount)` - Stake USDC to become LP
- `createEscrow(...)` - Start new order (validates tier)
- `confirmPayment(uint256 escrowId)` - LP confirms receipt
- `releaseEscrow(uint256 escrowId)` - Complete order
- `raiseDispute(uint256 escrowId)` - File dispute
- `resolveDispute(uint256 escrowId, bool lpWins)` - Arbitrator resolves

---

*Last updated: Hackathon submission v1.0*
`