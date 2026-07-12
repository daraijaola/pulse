# programs/pulse

Anchor program for PULSE rooms + MagicBlock Ephemeral Rollup hooks.

**Devnet program id:** `2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip`

## Instructions

| Ix | Layer | Purpose |
|----|--------|---------|
| `create_room` | Base | Init room PDA (4-char code) |
| `join_room` | Base | Set challenger |
| `start_round` | Base | LIVE + reset scores |
| `delegate_room` | Base | Delegate PDA to ER (+ validator remaining account) |
| `tap` | ER/Base | One player’s reaction_ms |
| `tap_solo` | ER/Base | Host writes host + ghost ms |
| `finish_match` | Base | One-shot scores + SETTLED (fallback) |
| `settle` | ER/Base | Compute winner |
| `settle_and_undelegate` | ER | Settle + commit + undelegate |
| `commit_room` / `undelegate_room` | ER | Commit / exit ER |

Built with `ephemeral-rollups-sdk` (`#[ephemeral]`, `#[delegate]`, `#[commit]`).

## Source

[`pulse/src/lib.rs`](./pulse/src/lib.rs)

## Devnet endpoints

- Base: `https://api.devnet.solana.com`  
- ER Asia: `https://devnet-as.magicblock.app`  
- Validator: `MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57`  
