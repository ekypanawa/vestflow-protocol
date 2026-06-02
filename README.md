# VestFlow Protocol

VestFlow Protocol is a trustless vesting and fund distribution protocol built for the OPN Builders Season 1: DeFi & Open Finance track.

## What it does

VestFlow lets teams, communities, and contributors create transparent on-chain vesting vaults. A creator can deposit native OPN, set a recipient, define a cliff period, define a vesting duration, and let the recipient claim unlocked funds directly from the smart contract.

## Why it matters

Web3 teams often distribute grants, campaign rewards, contributor payments, or token launch allocations through manual processes. VestFlow moves this workflow on-chain so deposits, schedules, claims, and proofs can be verified publicly.

## Core features

- Native OPN vesting vaults
- Cliff and duration-based release schedules
- Recipient claim function
- Creator cancellation with vested/unvested settlement
- Frontend wallet connection
- OPN Testnet network switching
- On-chain proof through transaction hashes and explorer links

## Tech stack

- Solidity
- Hardhat
- React
- Vite
- Ethers.js
- OPN Chain Testnet

## OPN Testnet

- Network Name: OPN Testnet
- Chain ID: 984
- RPC URL: https://testnet-rpc.iopn.tech
- Currency Symbol: OPN
- Explorer: https://testnet.iopn.tech
- Faucet: https://faucet.iopn.tech

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Compile contract

```bash
npm run compile
```

## Deploy to OPN Testnet

1. Add your wallet private key to `.env`.
2. Make sure the wallet has testnet OPN from the faucet.
3. Run:

```bash
npm run deploy:opn
```

After deployment, copy the contract address into `.env`:

```bash
VITE_VESTFLOW_ADDRESS=your_deployed_contract_address
```

Then restart the frontend:

```bash
npm run dev
```

## Builder submission fields

**Project name:** VestFlow Protocol

**One-line tagline:** A trustless vesting and fund distribution protocol for teams, contributors, and communities on OPN Chain.

**Demo URL:** Add the Vercel deployment URL after deployment.

**Repository URL:** https://github.com/ekypanawa/vestflow-protocol

## Roadmap

### Phase 1
- Deploy VestFlow smart contract on OPN Testnet
- Build frontend dashboard
- Add wallet connection, create vault, track vault, and claim functions
- Publish GitHub source code
- Submit contract address and deployment transaction hash

### Phase 2
- Add ERC-20 token support
- Add multi-recipient vaults
- Add vault history and analytics
- Improve UI/UX for non-technical users

### Phase 3
- Add reusable vesting templates
- Add team treasury dashboard
- Add exportable proof reports
- Prepare for production-ready security review
