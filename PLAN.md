# PULSE — Solana Blitz v6 Ship Plan

> **Historical research / planning notes** from the start of the weekend.  
> For the **shipped product**, see **[README.md](./README.md)** and **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

**Product:** Mobile-first real-time reaction battles on Solana  
**Hackathon:** Solana Blitz v6 · MagicBlock · theme **Mobile**  
**Repo:** https://github.com/daraijaola/pulse  
**Rule:** One path. One demo. No feature thrash. UI theme owned by human.

---

## Decision: Website or App?

| Option | Time (24h) | Mobile story | Risk |
|--------|------------|--------------|------|
| Native Seeker / Kotlin | Too long | Strongest “app” | **Lose time** |
| dApp Store APK (TWA wrap) | 3–6h after web works | Strong | Only if core works early |
| **Mobile-first web (PWA)** | **Fast** | **Phone-first + installable** | **Chosen** |

**Locked choice: mobile-first website (PWA).**

Why this still wins “mobile” for 1st prize:
- Luma: *best mobile project* — product must be **designed for the phone**, not desktop resized.
- Solana Mobile docs: PWAs are first-class (manifest → optional TWA → dApp Store later).
- Past Blitz winners shipped **live web demos + GitHub**, not necessarily Store listings.
- With ~1 day left, native Android is a death trap.

**Demo posture:** open on phone browser (or desktop device mode) → full loop.  
**Stretch only:** PWA icons/manifest + “Add to Home Screen” badge.  
**Do not block on:** Seeker dApp Store publish.

---

## Concrete research: how past winners won

### v5 (Jun 12–14 2026) — trading · 34 apps
| Place | Project | Pattern |
|-------|---------|---------|
| 🥇 Ghost Stops | ER recomputes triggers **every price tick** → settle Solana |
| 🥈 Eclipse | Private state **inside ER**, settle on resolve |
| 🥉 Shear | Market-neutral mechanic (product sharpness) |
| 🧙 EPOCH | **Each market = ER session** |

### v3 (Apr 3–5) — privacy wave
| Place | Pattern |
|-------|---------|
| 🥇 privRoll | Private ER / Payment API as **load-bearing** primitive |
| Winners generally | One clear MagicBlock primitive, not a kitchen-sink dApp |

### Win formula (apply to PULSE)
1. **One mechanic** judges remember in one sentence.  
2. **ER is visible** (latency / gasless taps / live scores), not a logo.  
3. **Optional second primitive** (we use **VRF** for fair round seed).  
4. **Live link + repo + 60–90s demo.**  
5. **Theme alignment** — for us: **mobile thumb UX**, not desktop trading UI.

### How PULSE surpasses “thin game / dice demo”
| Weak demo | Our bar |
|-----------|---------|
| Counter++ only | Full **room → pulse → tap → winner → settle** story |
| Client `Math.random` | **MagicBlock VRF** for go-time seed |
| Desktop only | **Phone layout first**, large hit target, one screen |
| Hidden ER | UI labels **“Ephemeral Rollup · gasless”** + tx explorer links |
| No multiplayer story | 2-player **or** 1P vs ghost bot so solo demo still works |

---

## Product freeze

### In (MVP)
- Create / join room (code)
- Connect Solana wallet (Phantom / mobile wallet deep link where possible)
- **Delegate room PDA → ER**
- **VRF** requests fair “pulse delay” / target window
- Players **TAP** (ER txs) — first valid / best reaction score wins
- Live scoreboard (poll/WS on ER RPC)
- Commit / undelegate → result on base layer
- README: “How we use MagicBlock” for judges
- Deployed Vercel (or similar) live URL

### Out
- Token economy, betting, NFT mint
- Native Android / full dApp Store
- Multi-game modes, chat, leaderboards backend
- Private ER / TEE (stretch only if MVP green with hours left)

---

## Tech stack (fact-based)

| Layer | Choice | Why |
|-------|--------|-----|
| UI | Vite + React + TS | Fast ship; mobile CSS you control |
| Wallet | `@solana/wallet-adapter` | Standard; works on mobile browsers |
| Program | Anchor + `ephemeral-rollups-sdk` | Official path |
| Randomness | `ephemeral_vrf_sdk` | Official VRF dice pattern |
| ER RPC | Magic Router / region ER (devnet-as first) | Docs-supported free dev endpoints |
| Fork base | [magicblock-engine-examples](https://github.com/magicblock-labs/magicblock-engine-examples): `counter` + `roll-dice` | Proven patterns |
| Cluster | **Devnet** for speed | Mainnet only if time |

### Official endpoints (dev)
- Magic Router: `https://devnet-router.magicblock.app`
- ER example: `https://devnet-as.magicblock.app` (+ wss)
- Base: `https://api.devnet.solana.com`
- Asia ER validator: `MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57`

### Machine status (checked)
- Node **v24** + npm OK  
- GitHub auth as **daraijaola** OK  
- **Rust / Anchor not installed yet** → Step 2 installs toolchain before program work  

---

## On-chain model (minimal)

```
Room PDA
  host, players[2], status, vrf_seed, pulse_at, winner, scores[]
```

**Ixs (target)**
1. `initialize_room` — base layer  
2. `join_room` — base layer  
3. `delegate_room` — base → ER  
4. `request_pulse` — VRF request (ER or base per pattern)  
5. `callback_pulse` — VRF callback sets go window  
6. `tap` — ER high-frequency (score / first-tap)  
7. `commit_result` / `undelegate` — settle winner to base  

UI never hides these steps; demo script names them out loud.

---

## Demo script (60–90s) — judges

1. Phone: open live URL  
2. Connect wallet  
3. Create room → show **Delegate → ER**  
4. “VRF picks fair pulse time”  
5. TAP — scores update live **on ER**  
6. Winner + **commit/settle**  
7. One line: *“Mobile UX + gasless real-time state + verifiable fairness — only works because of MagicBlock.”*

---

## Step ladder (one step at a time)

| Step | Deliverable | Done when | Owner |
|------|-------------|-----------|--------|
| **0** | Research + plan + empty repo | This file + GitHub exists | Agent |
| **1** | Scaffold monorepo (`programs/`, `app/`) | Builds locally; placeholder UI shell | Agent |
| **2** | Install Rust + Anchor (or use prebuilt path) | `anchor --version` works | Agent |
| **3** | Program MVP (room + delegate + tap) | Deployed **devnet** program id | Agent |
| **4** | Wire frontend to program + ER | Create room + tap works in browser | Agent |
| **5** | VRF pulse fairness | Random delay not client-side fake | Agent |
| **6** | Mobile polish + PWA manifest | Phone usable; theme from you | Human theme + Agent CSS |
| **7** | Deploy live + README judges section | Public URL | Agent |
| **8** | Demo video + Luma submit | Submitted before deadline | Human + Agent checklist |

**Current step after this commit: Step 0 complete → await “go” for Step 1.**

---

## Competitive checklist (before submit)

- [ ] ER used for high-frequency taps (not only one base-layer tx)  
- [ ] VRF used for fairness  
- [ ] Mobile layout (thumb zone, single column)  
- [ ] Live URL works cold on a second phone  
- [ ] README explains MagicBlock in judge language  
- [ ] Demo ≤ 90s, one path only  

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Anchor install burns hours | Step 2 first; fallback: heavy fork of roll-dice + counter UI |
| Wallet mobile friction | Phantom in-app browser; clear “use mobile wallet browser” tip |
| No second player for demo | Ghost bot / second window same machine |
| Over-scope UI | You pick theme colors only; we don’t redesign mid-flight |

---

## Pitch (form)

> **PULSE** — real-time mobile reaction battles powered by MagicBlock Ephemeral Rollups. Gasless onchain taps, VRF-fair pulse timing, Solana settlement. Built phone-first for Solana Blitz v6.
