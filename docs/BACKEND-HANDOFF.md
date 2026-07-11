# PULSE — Backend wiring handoff (FE locked order)

This document locks the **screen order**, **client state**, and **backend touchpoints** so chain wiring does not break the approved mobile UI.

## 1. Canonical screen order

| Step | Screen | User action | Backend later |
|------|--------|-------------|---------------|
| 01 | Landing | Enter arena | None |
| 02 | Enter | Lock **player name** → Create or Join | `initialize_room` / `join_room` |
| 03 | Lobby | Share code → Start round | `delegate_room` prep |
| 04 | Arena | Wait → GO → Tap | ER: `tap`, VRF callback, phase updates |
| 05 | Result | Scores → Play again / Lobby / Home | `commit_result` / undelegate |

**Navigation rules (do not weaken):**

- Tabs only open **completed or current** steps (`flowUnlocked`).
- **Arena** locked after round completes until **Play again**.
- **Live round** blocks leaving Arena until result (or explicit abort API).
- **Home / Leave** clears room flow; **player name** may persist.

## 2. Player name (locked on Enter)

- User types name → taps **arrow** (or Enter key) to lock.
- **Create / Join** disabled until name is locked.
- Copy is **“Player name”** only — not “call sign” or “session”.
- Locked name is stored in:
  - `sessionStorage` key `pulse-flow` → `lockedName`
  - `localStorage` key `pulse:session:v1` → `playerName` (`app/src/lib/session-store.ts`)

**Backend mapping:**

- `PlayerSeat.displayName` in `app/src/lib/types.ts`
- On-chain: optional metadata; primary identity remains **wallet pubkey**
- Do not allow room create/join without locked display name on FE

## 3. Client state that affects backend

### Flow snapshot (`pulse-flow` / sessionStorage)

```json
{
  "lockedName": "Alex",
  "roomCode": "ABCD",
  "flowUnlocked": 1,
  "isHost": true
}
```

### Persistent session (`pulse:session:v1` / localStorage)

See `StoredSession` in `session-store.ts`:

- `playerName` — locked display name
- `lastRoomCode` — last room joined/created
- `room` — `RoomState` when API wired
- `wallet` — `WalletSession` when Phantom connected

### Round state (Arena → Result)

Mirror `RoundState` in `types.ts`:

- `phase`: delegating → vrf → waiting → go → tapped → settling → done
- `youMs`, `oppMs` (Ghost), `youScore`, `oppScore`, `winner`
- `sigs.delegate`, `sigs.vrf`, `sigs.tap`, `sigs.settle` when live

## 4. Recommended backend wiring order

Wire in this order to avoid breaking the UI flow:

1. **Wallet connect** — populate `WalletSession`; show pubkey in dock (optional).
2. **Room create** — host wallet + locked `playerName` → room PDA + 4-char code.
3. **Room join** — guest wallet + code + locked name → `join_room`.
4. **Delegate** — Arena phase `delegating`; room account → Ephemeral Rollup.
5. **VRF pulse** — Arena `vrf` → `waiting` → `go`; use MagicBlock VRF, not `Math.random`.
6. **Tap on ER** — Arena `go` → `tapped`; high-frequency tx via ER RPC (`app/src/lib/er.ts`).
7. **Settle** — Arena `settling` → Result; commit winner + scores to Solana base.
8. **Play again** — new round in same room without clearing locked name.

## 5. Files backend work will touch

| Area | Path |
|------|------|
| Domain types | `app/src/lib/types.ts` |
| Session persistence | `app/src/lib/session-store.ts` |
| ER connection | `app/src/lib/er.ts` |
| Mock → real API | `app/src/lib/pulse-api.ts` |
| Wallet hook | `app/src/hooks/useWallet.ts` |
| Main UI flow | `app/src/App.tsx` |

## 6. FE mock vs production labels

Until chain is wired, UI must stay truthful:

- Result: “FE preview” / “commits to Solana base layer” as **intent**, not fake tx hashes.
- Replace mock timers in `startRound()` with real phase events from program/WebSocket.
- Ghost opponent stays for solo demo; second human replaces `opponent` seat when joined.

## 7. What must not change without design review

- Mobile shell: nav tabs, dock, 430px frame, Overflow tokens.
- Enter: name lock + arrow before room actions.
- Lobby: single Start (no duplicate dock Start).
- Arena: pulse chamber + 6-step phase rail + thumb TAP.
- Result: reaction ms hero + ER/VRF/Solana settle rail + matchup scores.

---

*Last updated with Result screen + player name lock-in (FE mock).*