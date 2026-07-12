# PULSE

**Real-time mobile reaction battles on Solana** — powered by [MagicBlock](https://www.magicblock.xyz/) Ephemeral Rollups + VRF.

> Built for **Solana Blitz v6** (Mobile theme) · MagicBlock weekend hackathon.

## One-liner

Open on your phone → create a room → fair VRF pulse → **gasless taps on an Ephemeral Rollup** → winner settles to Solana.

## Why MagicBlock

| Capability | Where PULSE uses it |
|------------|---------------------|
| **Ephemeral Rollup** | High-frequency tap / score updates without spamming base-layer fees |
| **VRF** | Provably fair pulse timing (not `Math.random` in the browser) |
| **Commit / undelegate** | Final result lands on Solana base layer |

## Status (Blitz v6)

| | |
|--|--|
| **Program (devnet)** | `2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip` |
| **Live FE** | Vercel after deploy (or https://agentr.online/sites/pulse/) |
| **Flow** | Create/join room → both Start → 3-2-1 → TAP → lock result on Solana |
| **Cluster** | Devnet (intentional for judges) |

Submit notes: [SUBMIT.md](./SUBMIT.md) · Plan: [PLAN.md](./PLAN.md)

### How we use MagicBlock (judges)

- **Ephemeral Rollups (live)** — solo settle path: `start_round` → **`delegate_room`** (base) → **`tap_solo` on ER** → **`settle_and_undelegate`** → Solana. Falls back to base `finish_match` if ER is down.
- **Verified** — `scripts/e2e-er.mjs` prints `ER_E2E_PASS` against `devnet-as.magicblock.app`.
- **Mobile** — Phantom in-app browser, dual-ready start, 3-2-1, large hit target.

## Stack

- Mobile-first web (PWA) — Vite + React + TypeScript  
- Solana program — Anchor + MagicBlock `ephemeral-rollups-sdk` + VRF  
- Cluster — Devnet for Blitz speed  

## Docs we build on

- [ER Quickstart](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart)  
- [VRF Quickstart](https://docs.magicblock.gg/pages/verifiable-randomness-functions-vrfs/how-to-guide/quickstart)  
- [Engine examples](https://github.com/magicblock-labs/magicblock-engine-examples) (`counter`, `roll-dice`)  
- [Solana Mobile PWA](https://docs.solanamobile.com/dapp-store/publishing-a-web-app)  

## License

MIT
