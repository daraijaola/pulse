# Connection scaffold — for FE + chain handoff

**Status:** Ready for double-work. Does **not** replace Landing / Enter / Lobby / Arena UI.

Live FE: https://agentr.online/sites/pulse/  
Repo: https://github.com/daraijaola/pulse  

## What was added

```
app/src/lib/
  config.ts          # RPC, ER, flags
  types.ts           # Room, Round, Wallet, Health
  session-store.ts   # localStorage session
  solana.ts          # base + magic router Connection
  er.ts              # ER Connection + validator
  wallet.ts          # Phantom / injected wallet
  pulse-api.ts       # create/join/round mock API (stable surface)
  index.ts           # re-exports

app/src/hooks/
  useWallet.ts
  useNetworkHealth.ts

app/src/components/connect/
  WalletButton.tsx   # drop into Lobby/Arena chrome
  NetworkStatus.tsx  # Base · ER live chip
  connect.css

app/.env.example
programs/README.md   # future Anchor outline
```

## How the other FE AI plugs in

### 1) Styles
```tsx
import "./components/connect/connect.css";
```

### 2) Lobby header (example)
```tsx
import { WalletButton } from "./components/connect/WalletButton";
import { NetworkStatus } from "./components/connect/NetworkStatus";

// in lobby chrome:
<NetworkStatus />
<WalletButton />
```

### 3) Create / join with session
```tsx
import { createRoom, joinRoom } from "./lib/pulse-api";
import { useWallet } from "./hooks/useWallet";

const { publicKey } = useWallet();
const room = await createRoom(publicKey);
// or joinRoom(code, publicKey);
```

### 4) Arena mock round (until program)
```tsx
import { runMockRound, resolveTap, settleRound } from "./lib/pulse-api";

await runMockRound(roomCode, { onPhase: setPhase });
// on TAP:
const next = resolveTap(round, reactionMs);
const done = await settleRound(next);
```

## Session model

- **Identity** = wallet `publicKey` when connected (not email/password).  
- **Room code** stored in `localStorage` key `pulse:session:v1`.  
- Solo: opponent seat is **Ghost** (`isGhost: true`).  

## Mock vs real chain

| Flag | Behavior |
|------|----------|
| `VITE_USE_MOCK_CHAIN=true` (default) | `pulse-api` simulates phases + sigs |
| `VITE_USE_MOCK_CHAIN=false` + program id | Wire real txs in `pulse-api.ts` only |

Do **not** scatter RPC calls inside random components — keep them in `lib/`.

## VM deploy note

Landing/FE static still deploys to `/var/www/agentr-sites/pulse/` with Vite `base: '/sites/pulse/'`.  
Connection scaffold is source-only until merged into the build the FE AI ships.

## Product reminder

PULSE is a **skill reaction game** (fair GO + live ER), not a stake/gamble product for this Blitz MVP.
