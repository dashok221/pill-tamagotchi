# CLAUDE.md — PILL Tamagotchi

## Project Description
PILL Tamagotchi is a virtual pet game built on Bitcoin Layer 1 with OP_NET.
Users connect OP_WALLET, care for their pet by spending $PILL tokens on-chain.
Feed, clean, play, cure — all actions are real token transfers.

## BOB Integration
- Package versions and vite.config.ts from BOB's `opnet_opnet_dev` tool (setup section)
- Network configuration from BOB's frontend guidelines: `networks.opnetTestnet` (NOT `networks.testnet`)
- Provider pattern: singleton `JSONRpcProvider({ url, network })` per BOB's caching guidelines
- Contract interaction: `getContract<IOP20Contract>(addr, OP_20_ABI, provider, network, sender?)` per BOB

## Package Rules
### ALWAYS Use
- `opnet@rc` — OPNet SDK, JSONRpcProvider, getContract, ABIs
- `@btc-vision/bitcoin@rc` — Bitcoin library (OPNet fork, includes `networks.opnetTestnet`)
- `@btc-vision/transaction@rc` — Transaction types and ABI data types
- `@btc-vision/walletconnect@latest` — Wallet connection modal
- `react` — UI framework
- `vite` + `vite-plugin-node-polyfills` — Build tool with Node.js polyfills

### NEVER Use
- `bitcoinjs-lib`, `ethers`, `web3`, `@metamask/sdk`
- `window.ethereum`
- `express`
- `networks.testnet` — Use `networks.opnetTestnet` instead!

## Wallet Integration
- Use `@btc-vision/walletconnect` for the connection modal
- ALWAYS include the WalletConnect popup CSS fix (mandatory per BOB)
- signer and mldsaSigner are NULL on frontend — wallet extension signs
- Use `useWalletConnect()` hook for wallet state

## Contract Interaction
- Create SEPARATE `JSONRpcProvider({ url, network })` for read operations
- Testnet: `https://testnet.opnet.org` with `networks.opnetTestnet`
- ALWAYS check `'error' in result` before using contract call results
- NEVER put private keys in frontend code

## Game Mechanics
- Pet stats (hunger, cleanliness, happiness, energy) decay in real-time
- Each care action costs $PILL tokens (real on-chain transfer)
- Poops appear over time and need cleaning
- Pet evolves: egg → baby → child → teen → adult
- Pet can get sick and die if neglected
- State persisted in localStorage with offline decay

## Build and Dev
- `npm install` — install dependencies
- `npm run dev` — start dev server
- `npm run build` — production build to `dist/`
