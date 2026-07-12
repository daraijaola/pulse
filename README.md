# PULSE

**Mobile reaction battles on Solana** — rooms, taps, and settlement powered by [MagicBlock](https://www.magicblock.xyz/) **Ephemeral Rollups**.

> **Solana Blitz v6** · theme **Mobile** · MagicBlock weekend hackathon

| | |
|--|--|
| **Live app** | https://pulse-inky-eight.vercel.app |
| **Program (devnet)** | `2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip` |
| **Cluster** | Solana **devnet** (intentional for judges) |
| **Repo** | https://github.com/daraijaola/pulse |

---

## One-liner (demo)

Open on **phone (Phantom)** → create room → friend joins **or** play solo → both press Start → **3-2-1** → **TAP** → result **delegates to ER**, scores on the rollup, then **commits back to Solana**.

---

## How we use MagicBlock

| Primitive | Role in PULSE |
|-----------|----------------|
| **Ephemeral Rollup** | After GO, the room PDA is **`delegate_room`**’d to the ER. **`tap_solo` / taps** run on the ER for low-latency score writes, then **`settle_and_undelegate`** returns ownership + final state to the base layer. |
| **Delegation program** | Standard MagicBlock `DELeG…` CPI via Anchor `#[delegate]` / `#[commit]` / `#[ephemeral]`. |
| **ER validator (devnet Asia)** | `MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57` · RPC `https://devnet-as.magicblock.app` |
| **Fallback** | If ER is unreachable, solo settle uses base-layer `finish_match` so the mobile demo never hard-crashes. |

### Live path (solo — what the video should show)

```
Base layer                         Ephemeral Rollup
─────────                          ────────────────
create_room
join_room? (optional)
start_round  ──────────────────►   (room LIVE)
delegate_room (+ ER validator)
               ──────────────────► tap_solo / scores
               ──────────────────► settle_and_undelegate
               ◄────────────────── committed SETTLED on base
```

Verified by `scripts/e2e-er.mjs` → prints **`ER_E2E_PASS`**.

---

## Mobile UX (Blitz theme)

- Phone-first layout, large hit target, Overflow-inspired keycap UI  
- **Open in Phantom** deep link (required on mobile — no injected wallet in Safari alone)  
- Dual-ready: both players press **Start** → shared **3-2-1 + beep** → GO  
- Result screen links: **delegate → ER**, **tap on ER**, **commit + undelegate**

---

## Repo map

```
pulse/
├── app/                 # Vite + React FE (deploy root on Vercel)
│   ├── src/lib/
│   │   ├── pulse-api.ts      # game flow API
│   │   ├── pulse-onchain.ts  # base-layer instructions
│   │   ├── pulse-er.ts       # MagicBlock ER path
│   │   └── wallet.ts         # Phantom + mobile deep link
│   └── src/idl/pulse.json
├── programs/pulse/      # Anchor program (ER macros)
├── scripts/
│   ├── e2e-devnet.mjs   # 2-wallet base-layer E2E
│   └── e2e-er.mjs       # ER delegate → tap → undelegate E2E
├── docs/                # architecture + brief
├── SUBMIT.md            # demo video script for Luma
└── README.md            # you are here
```

---

## Quick start (local FE)

```bash
cd app
cp .env.example .env.local   # already points at deployed program + devnet ER
npm install
npm run dev
```

Open http://localhost:5173 with Phantom (devnet).

### Env (production / Vercel)

| Variable | Value |
|----------|--------|
| `VITE_SOLANA_CLUSTER` | `devnet` |
| `VITE_SOLANA_RPC` | `https://api.devnet.solana.com` |
| `VITE_PULSE_PROGRAM_ID` | `2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip` |
| `VITE_ER_RPC` | `https://devnet-as.magicblock.app` |
| `VITE_ER_VALIDATOR` | `MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57` |
| `VITE_USE_MOCK_CHAIN` | `false` |

Vercel: project root = **`app`**, build `npm run build`, output `dist`.

---

## Program instructions

| Instruction | Layer | Purpose |
|-------------|--------|---------|
| `create_room` | Base | Host opens 4-char room PDA |
| `join_room` | Base | Challenger seat |
| `start_round` | Base | Status → LIVE |
| `delegate_room` | Base → ER | Delegate room to MagicBlock |
| `tap` / `tap_solo` | ER (or base) | Reaction scores |
| `finish_match` | Base fallback | One-shot scores + settle |
| `settle` / `settle_and_undelegate` | ER → Base | Winner + undelegate |
| `commit_room` / `undelegate_room` | ER | Commit / exit ER |

Source: [`programs/pulse/src/lib.rs`](./programs/pulse/src/lib.rs)

---

## Tests

```bash
# From app/ (needs @solana/web3.js installed there)
# Funded keypairs under scripts/.e2e-keys/ (gitignored)

node ../scripts/e2e-devnet.mjs   # 2-player base path → E2E_PASS
node ../scripts/e2e-er.mjs       # MagicBlock ER path → ER_E2E_PASS
```

---

## Demo video (60–90s)

See **[SUBMIT.md](./SUBMIT.md)** for a shot list. Keep it phone-vertical, Phantom, solo ER path so explorer links show **delegate / ER / undelegate**.

---

## Docs

| Doc | What |
|-----|------|
| [SUBMIT.md](./SUBMIT.md) | Video + Luma submit checklist |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Layers, accounts, trust |
| [PLAN.md](./PLAN.md) | Original Blitz research / decisions |
| MagicBlock ER quickstart | https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart |

---

## License

MIT
