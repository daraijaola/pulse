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

## Status

Hackathon build in progress. See [PLAN.md](./PLAN.md) for research, website-vs-app decision, and step ladder.

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
