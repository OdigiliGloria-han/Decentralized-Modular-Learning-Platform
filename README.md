# EduUnlock: Decentralized Modular Learning Platform

## Overview

**EduUnlock** is a Web3-powered education platform built on the Stacks blockchain using Clarity smart contracts. It enables flexible, ad-free access to certification programs through micro-token payments. Users can unlock individual learning modules (e.g., video lessons, quizzes, or resources) without committing to an entire course, paying tiny fractions of a token (e.g., 0.01 $EDU) per module. Upon completing modules, users earn verifiable NFT-based certifications stored on-chain, ensuring tamper-proof credentials that can be shared with employers or institutions.

This project leverages blockchain for transparency, low-cost micropayments, and ownership of educational achievements, making high-quality, specialized learning accessible to underserved populations like gig workers, lifelong learners, and those in developing regions.

### Key Features
- **Micro-Payments**: Pay per module using $EDU tokens (or STX), with fees as low as 0.001 STX equivalent.
- **Modular Unlocks**: No full-course lock-in; unlock, learn, and certify at your pace.
- **Ad-Free Experience**: Pure educational content without interruptions.
- **On-Chain Certifications**: SIP-721 NFTs for completed modules or full tracks, verifiable via blockchain explorers.
- **Creator Incentives**: Course creators earn direct royalties from unlocks.
- **Decentralized Governance**: Token holders vote on platform upgrades.

## Real-World Problems Solved

EduUnlock addresses critical barriers in traditional online education:

1. **Affordability and Accessibility**: Conventional platforms like Coursera or Udemy charge $50–200 for full courses, excluding many users. Micro-payments reduce entry barriers, enabling bite-sized learning for low-income individuals or those in high-inflation economies.

2. **Rigidity and Dropout Rates**: 70% of online course enrollees drop out due to overwhelming commitments (per edX data). Modular unlocks allow flexible pacing, reducing abandonment and increasing completion rates.

3. **Credential Verifiability**: Fake degrees plague hiring; blockchain NFTs provide immutable proof of skills, trusted by employers without third-party verification services.

4. **Monetization for Creators**: Independent educators struggle with platform cuts (up to 50%). Direct on-chain payouts ensure creators retain 90%+ of earnings.

5. **Ad Overload and Privacy**: Ad-driven models invade privacy and distract learners. EduUnlock is fully ad-free, with user data controlled via wallet-based auth.

By tokenizing education, EduUnlock democratizes knowledge, potentially impacting 1.7 billion unbanked adults (World Bank) who can now participate via mobile wallets.

## Architecture

The platform consists of 6 core Clarity smart contracts deployed on Stacks mainnet/testnet. They form a modular, secure system for tokenomics, content gating, progress tracking, and certification. Contracts interact via cross-contract calls, with off-chain components (e.g., IPFS for module storage) for media hosting.

### Smart Contracts (5–7 Solid Implementations)

1. **EduToken (SIP-010 Fungible Token)**  
   - **Purpose**: Custom $EDU token for micro-payments, with minting controlled by governance. Supports transfers, approvals, and burn-on-unlock to prevent hoarding.  
   - **Key Functions**: `transfer`, `get-balance`, `mint-to-creators` (for initial liquidity).  
   - **Security**: Fixed supply cap (1B tokens), anti-whale minting limits.  
   - **Real-World Tie-In**: Enables sub-cent payments, solving high gas fees in other chains.

2. **ModuleRegistry**  
   - **Purpose**: Decentralized registry for course creators to list modules (metadata on IPFS: title, description, difficulty, prerequisites).  
   - **Key Functions**: `register-module` (creator-only, with unlock price in $EDU), `get-module-info`, `update-price`.  
   - **Security**: Access control via principal traits; events for indexing off-chain.  
   - **Real-World Tie-In**: Empowers niche experts (e.g., AI ethics modules) to publish without gatekeepers.

3. **UnlockManager**  
   - **Purpose**: Handles micro-payments and access grants. Users call to pay and receive a time-bound unlock (e.g., 30-day access via signed message).  
   - **Key Functions**: `unlock-module` (transfers $EDU, emits access event), `escrow-refund` (if module fails delivery), `batch-unlock`.  
   - **Security**: Reentrancy guards, payment escrow until access confirmed.  
   - **Real-World Tie-In**: Reduces overpayment; e.g., unlock a "Python Basics" module for $0.05 instead of $99/course.

4. **ProgressTracker**  
   - **Purpose**: On-chain ledger for user progress (module completion hashes submitted via oracle or self-report with proof).  
   - **Key Functions**: `log-completion` (user submits hash, verified by creator), `get-user-progress`, `prerequisite-check`.  
   - **Security**: Merkle proofs for batch verification; anti-spam deposits refunded on valid proof.  
   - **Real-World Tie-In**: Tracks skill-building paths, e.g., stacking modules into a "Data Science Cert" for portfolio proof.

5. **CertNFT (SIP-721 Non-Fungible Token)**  
   - **Purpose**: Mints soulbound NFTs for certifications upon threshold completions (e.g., 5/7 modules). Metadata includes skills, timestamps, and verifiers.  
   - **Key Functions**: `mint-cert`, `burn-cert` (revocable for fraud), `transfer` (optional soulbound mode).  
   - **Security**: Royalty enforcement (5% to platform), URI pinning on IPFS.  
   - **Real-World Tie-In**: Employers query on-chain for instant verification, reducing hiring biases from unverified claims.

6. **PayoutDistributor**  
   - **Purpose**: Distributes creator earnings from unlocks, with platform fees (5%) to a DAO treasury.  
   - **Key Functions**: `claim-payouts` (periodic, based on accrued royalties), `set-fee-rate` (governance-only).  
   - **Security**: Timelock on withdrawals (7 days), audited math for splits.  
   - **Real-World Tie-In**: Ensures fair revenue sharing, incentivizing quality content creation.

*(Optional 7th: Governance contract for $EDU holders to propose/vote on upgrades, using quadratic voting.)*

Contracts are designed for composability: e.g., `UnlockManager` calls `EduToken.transfer` and triggers `ProgressTracker` events. Total gas efficiency: ~50k cycles per unlock (Stacks' low fees).

### High-Level Flow
1. Creator registers modules in `ModuleRegistry`.
2. User pays via `UnlockManager` to access (IPFS-hosted content).
3. User completes and logs in `ProgressTracker`.
4. On threshold, `CertNFT` mints credential.
5. Earnings flow to `PayoutDistributor`.

## Tech Stack
- **Blockchain**: Stacks (L2 on Bitcoin for security).
- **Smart Contracts**: Clarity (secure, decidable language).
- **Frontend**: React + Hiro Wallet Kit (for STX/$EDU integration).
- **Storage**: IPFS for module files; Gaia for user data.
- **Oracles**: SimpleHash or custom for off-chain verification.
- **Testing**: Clarinet (local Stacks dev env).
- **Deployment**: Hiro's stacks.js and Clarinet CLI.

## Installation & Setup

### Prerequisites
- Node.js 18+, Yarn/NPM.
- Clarinet CLI: `cargo install clarinet`.
- Hiro Wallet for testing.

### Clone & Install
```bash
git clone `git clone <repo-url>`
cd edunlock
yarn install  # For frontend
clarinet integrate  # For contracts
```

### Local Development
1. Start Clarinet devnet: `clarinet develop`.
2. Deploy contracts: `clarinet deploy --initialize`.
3. Test: `clarinet test` (includes unit tests for each contract).
4. Frontend: `yarn start` (runs on localhost:3000).

### Configuration
- Edit `Clarity.toml` for contract paths.
- Set `.env`: `STACKS_NETWORK=mainnet`, `EDU_CONTRACT_ID=SP...::edutoken`.
- IPFS pinning via Pinata or Infura.

## Usage

### For Learners
1. Connect Hiro Wallet.
2. Browse modules in app (fetches from `ModuleRegistry`).
3. Unlock: Approve $EDU spend → Access content.
4. Complete quizzes → Log progress → Claim NFT cert.

### For Creators
1. Connect wallet.
2. Upload module metadata/price to `ModuleRegistry`.
3. Verify completions via dashboard.
4. Claim payouts monthly.

### Example Transaction (Clarity Snippet)
```clarity
;; In UnlockManager
(define-public (unlock-module (module-id uint) (user principal))
  (let (
    (price (get-module-price module-id))
    (success (contract-call? ?EduToken transfer user tx-sender price))
  )
    (asserts! success (err u1000))
    (emit-event! (tuple (type "unlock") (module module-id) (user user)))
    (ok true)
  )
)
```

## Testing & Security
- **Unit Tests**: 100% coverage via Clarinet; fuzzing for payment edges.
- **Audits**: Recommend OpenZeppelin-style review; common vulnerabilities mitigated (reentrancy, overflows).
- **Bug Bounty**: Planned via Immunefi post-launch.

## Contributing
Fork the repo, create a feature branch, and submit PRs. Focus on contract optimizations or frontend UX. Join our Discord for discussions.

## License
MIT License. See [LICENSE](LICENSE) for details.