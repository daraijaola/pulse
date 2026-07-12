# PULSE architecture

## Layers

```
┌─────────────────────────────────────────────┐
│  Mobile browser (Phantom in-app)            │
│  Vite/React · wallet.ts · pulse-api.ts      │
└───────────────┬─────────────────────────────┘
                │
     ┌──────────┴──────────┐
     ▼                     ▼
 Solana base            MagicBlock ER
 api.devnet.solana.com  devnet-as.magicblock.app
     │                     │
 create / join / start     tap_solo / settle_and_undelegate
 delegate_room ──────────► (delegated room PDA)
     ▲                     │
     └──── commit/undelegate
```

## Room PDA

Seeds: `["room", code_bytes_4]`  
Program: `2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip`

| Field | Notes |
|-------|--------|
| host / challenger | Pubkeys |
| code | 4 ASCII bytes |
| status | OPEN=0 READY=1 LIVE=2 SETTLED=3 |
| host_ms / chall_ms | Reaction times |
| host_score / chall_score | `1000 - min(ms,1000)` |
| winner | 0 none · 1 host · 2 chall · 3 draw |

## Client modules

| File | Responsibility |
|------|----------------|
| `pulse-api.ts` | Screen-facing game API (create, join, ready, countdown, settle) |
| `pulse-onchain.ts` | Base-layer txs (create, join, start, finish_match, …) |
| `pulse-er.ts` | Delegate + ER RPC settle path |
| `wallet.ts` | Phantom inject + mobile “Open in Phantom” |
| `er.ts` | ER connection + validator pubkey |

## Trust / honesty

- Countdown UX is **client-side** (sync via dual Start + LIVE status).  
- Scores on the ER path are written **on-chain** on the rollup, then committed.  
- Multiplayer peer scores use per-player `tap` (base or ER depending on path).  
- No custody of user keys; all signing is in Phantom.

## Related MagicBlock docs

- [ER Quickstart](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart)  
- [Engine examples](https://github.com/magicblock-labs/magicblock-engine-examples) (`counter`)  
