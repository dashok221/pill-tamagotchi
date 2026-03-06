# PILL Tamagotchi — Bitcoin L1 Virtual Pet

A Tamagotchi-style virtual pet game built on **Bitcoin Layer 1** via **OP_NET**. Your pet is a sentient $PILL capsule that needs to be fed, cleaned, and played with — all actions powered by **$PILL** token transfers on-chain.

## How It Works

Your PILL Pet is born as an egg and evolves over time through stages: **Egg → Baby → Child → Teen → Adult**. Its stats (hunger, cleanliness, happiness, energy) decay in real-time. If you neglect it too long, it gets sick and eventually dies!

### Actions & Costs

| Action | Cost | Effect |
|--------|------|--------|
| 🍔 Feed | 100 $PILL | +30 Hunger, +5 Happiness |
| 🧹 Clean | 50 $PILL | Removes 1 poop, +25 Cleanliness |
| 🎮 Play | 75 $PILL | +25 Happiness, -15 Energy |
| 💉 Medicine | 200 $PILL | Cures sickness, +10 all stats |
| 💤 Sleep | Free | Toggles sleep (restores energy) |
| ✨ Revive | 500 $PILL | Brings pet back from death |

Every action (except sleep) sends **real $PILL tokens** on-chain — your care is provably recorded on Bitcoin L1!

### Pet Mechanics

- **Stat Decay**: All stats decrease over time, even while the app is closed
- **Poops**: Appear every ~90 seconds. More poops = faster cleanliness/happiness decay
- **Sickness**: Triggers when average stats drop below 15%. Accelerates decay
- **Death**: If hunger, cleanliness, and happiness all hit zero for 3 minutes
- **Evolution**: Based on age — egg (0-3min), baby (3-15min), child (15min-1hr), teen (1-4hr), adult (4hr+)
- **Mood System**: Happy, Content, Hungry, Dirty, Sad, Sick, Sleeping, Dead — visually reflected on the pet

## Tech Stack

- **OP_NET** — Bitcoin L1 smart contract platform
- **$PILL** OP-20 token — in-game currency
- **React** + **TypeScript** — UI framework
- **Vite** — Build tool with Node.js polyfills
- **@btc-vision/walletconnect** — OP_WALLET connection
- **localStorage** — Pet state persistence

## Setup & Run

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Requirements

- [OP_WALLET](https://chromewebstore.google.com/detail/opwallet/pmbjpcmaaladnfpacpmhmnfmpklgbdjb) browser extension
- $PILL tokens on OP_NET testnet

## Contract Info

- **$PILL Contract**: `0xb09fc29c112af8293539477e23d8df1d3126639642767d707277131352040cbb`
- **Network**: OP_NET Testnet (`https://testnet.opnet.org`)

## Why This Matters

PILL Tamagotchi demonstrates that fun, interactive consumer apps can run directly on Bitcoin L1. Every care action is a real on-chain token transfer — no sidechains, no bridges, no L2s. Your virtual pet's entire care history is permanently recorded on the Bitcoin blockchain via OP_NET.

## License

Open source. Built for the OP_NET Vibe Code challenge.

---

Built with OP_NET's BOB AI agent • #opnetvibecode
