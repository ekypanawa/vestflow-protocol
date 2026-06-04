# VestFlow Protocol

VestFlow Protocol is a trustless native OPN vesting and fund-locking dashboard for OPN Builders. It lets builders create transparent vaults, track vesting progress, verify proofs on OPN Testnet, and claim vested funds directly from the deployed smart contract.

## Project Overview

VestFlow turns contributor payouts, grants, milestone rewards, and team unlocks into verifiable on-chain vaults. The frontend connects to OPN Testnet, creates native OPN locks, reads live contract state, and generates a proof receipt after vault creation.

## Problem

Builder teams often coordinate fund releases with spreadsheets, manual reminders, and private screenshots. That makes it hard for recipients, reviewers, and communities to verify whether funds were locked, when they unlock, and whether claims happened according to the rules.

## Solution

VestFlow uses an OPN Testnet smart contract to hold native OPN and enforce release rules. Creators set a recipient, amount, lock style, release date, and note. Recipients can check claimable and vested balances, then claim directly from the contract.

## OPN Chain Integration

- Network: OPN Testnet
- Chain ID: `984`
- RPC: `https://testnet-rpc.iopn.tech`
- Explorer: `https://testnet.iopn.tech`
- Contract: `0x5E0d0146804E6c34f748CED382C5ee179aFb3A5E`
- Deploy TX: `0x7638dc202f14c797b3441aa50375fab6e07ba5ea2cffb2da08c3e2111c796f59`
- Deployer: `0xd564ab77aDE8D2a4f3199d71f4Aa9F487976d63C`

Frontend integration includes wallet connection, OPN Testnet switch/add network, live `nextVaultId()` reads, selected vault `claimableAmount()` and `vestedAmount()` reads, proof receipts, and explorer links.

## Live Demo URL

- Live demo URL: add the hosted deployment URL after deployment.
- Repository: `https://github.com/ekypanawa/vestflow-protocol`
- Contract explorer: `https://testnet.iopn.tech/address/0x5E0d0146804E6c34f748CED382C5ee179aFb3A5E`

## Core Features

- Native OPN lock creation
- Simple timelock and linear vesting UI mapped to the current contract
- Track and claim by vault ID
- Live contract reader
- Proof receipt after vault creation
- Copyable contract, deploy transaction, deployer, repository, and proof summary
- Dark/light dashboard mode
- Connected wallet dropdown with copy, explorer, profile, and sign out
- Lottie wallet-lock and connected mascot animations

## How to Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL, usually:

```text
http://127.0.0.1:5173/
```

## Compile Contract

```bash
npm run compile
```

## Deploy to OPN Testnet

1. Copy `.env.example` to `.env`.
2. Add a funded testnet deployer key to `.env`.
3. Run:

```bash
npm run deploy:opn
```

4. Set the deployed contract address for the frontend:

```bash
VITE_VESTFLOW_ADDRESS=your_deployed_contract_address
```

5. Restart the frontend:

```bash
npm run dev
```

Never commit `.env` or private keys.

## How to Test the Demo

1. Connect wallet.
2. Switch or add OPN Testnet.
3. Enter recipient and amount.
4. Choose Simple Timelock or Linear Vesting.
5. Create Secure Lock.
6. Save the proof receipt and transaction link.
7. Track Vault ID.
8. Check claimable and vested amounts.
9. Claim when funds are available.
10. Verify on OPN Explorer.

## Deployment Checklist

- Confirm `.env` is local only and not committed.
- Confirm the frontend uses the intended contract address.
- Run `npm run build`.
- Test wallet connection, lock creation, proof receipt, track, claimable read, and explorer links on OPN Testnet.
- Deploy the static frontend only after the build and manual test flow pass.

## Security Notes

- Testnet demo only. Do not send mainnet funds.
- The current contract supports native OPN only.
- ERC-20 support is marked as coming soon and requires a new contract deployment.
- Private keys must remain in local `.env` files and must not be exposed in frontend code.
- A production release should include external review, broader test coverage, and audit preparation.

## Roadmap

### Q1 2026: MVP and OPN Testnet deployment

- Deploy VestFlow smart contract on OPN Testnet
- Support native OPN lock and vesting vaults
- Add vault creation, claim flow, and proof receipt
- Add multi-wallet connection and on-chain explorer links
- Build the first public dashboard for tracking vault status

### Q2 2026: Builder feedback and product refinement

- Improve UX based on builder and community feedback
- Add better vault indexing and wallet-based vault discovery
- Improve vault analytics, claim status, and activity history
- Add public usage examples for contributors, grants, and community rewards
- Polish mobile experience and dashboard performance

### Q3 2026: Advanced distribution flows

- Add DAO grant and contributor reward templates
- Explore multi-recipient vault creation
- Add richer dashboard data for teams and recipients
- Improve proof sharing for communities and grant programs
- Research reusable vault templates for ecosystem campaigns

### Q4 2026: Security, scalability, and expansion research

- Prepare for security review and audit readiness
- Improve contract safety, validation, and edge-case handling
- Research ERC-20 support for future token vesting
- Explore mainnet readiness if OPN ecosystem conditions are ready
- Document integration paths for OPN builders and ecosystem partners

### Long-term Vision

VestFlow aims to become a reusable fund distribution layer for the OPN ecosystem.

The goal is to help builders, DAOs, grant programs, contributors, and communities manage vesting, rewards, treasury payouts, and launch unlocks transparently on-chain.

Instead of relying on manual payments, private spreadsheets, or trust-based promises, VestFlow turns fund distribution into a verifiable smart contract workflow on OPN Chain.

## Changelog

- Added live contract reader for `nextVaultId`, claimable, vested, network, and contract status.
- Added proof receipt after vault creation with explorer link and copy summary.
- Added copy buttons for key public proof fields.
- Added guided demo steps for OPN Builders reviewers.
- Improved wallet dropdown, dark/light UI, and Lottie dashboard animations.
