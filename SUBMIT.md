# PULSE — submit checklist (Solana Blitz v6)

## You are “done enough” when

| Item | Status |
|------|--------|
| Live mobile FE | Need **public URL** (Vercel below) |
| Devnet program | ✅ `2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip` |
| Create / join / play / settle | ✅ On-chain path works |
| Dual start + 3-2-1 + one lock sign | ✅ |
| Phantom mobile | ✅ Open in Phantom |
| Repo public | ✅ github.com/daraijaola/pulse |
| README for judges | Update + push latest |
| Demo video 60–90s | **You record** |
| Luma / Blitz submit form | **You submit** before deadline |

### Honest gaps (optional stretch — not blockers if time is gone)

- Full **ER delegate + VRF** path is scaffolded in program but demo settles on **base layer** (still real Solana + MagicBlock-ready program).
- Multiplayer uses per-player score txs; solo is one `finish_match` sign.

Judges care: **phone works, clear MagicBlock story, live link, repo.**

---

## FE only on Vercel (recommended)

**Do not paste API tokens in chat.** Use one of:

### A — Dashboard (easiest, no key in chat)

1. https://vercel.com → **Add New Project** → import `daraijaola/pulse`
2. **Root Directory:** `app`
3. **Framework:** Vite
4. **Build:** `npm run build` · **Output:** `dist`
5. Environment variables:

```
VITE_SOLANA_CLUSTER=devnet
VITE_SOLANA_RPC=https://api.devnet.solana.com
VITE_PULSE_PROGRAM_ID=2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip
VITE_USE_MOCK_CHAIN=false
VITE_MAGIC_ROUTER_RPC=https://devnet-router.magicblock.app
VITE_ER_RPC=https://devnet-as.magicblock.app
```

(Fix ER if needed: `https://devnet-as.magicblock.app`)

6. Deploy → copy `https://your-app.vercel.app`

### B — CLI (if you set token on your machine only)

```bash
cd app
npx vercel login
npx vercel --prod
```

Never commit `VERCEL_TOKEN` or put it in the repo.

---

## What you still do by hand

1. **Push latest code** to GitHub (or Vercel won’t have countdown / finish_match FE).
2. **Deploy Vercel** (above).
3. **Phone test cold:** Phantom → Create → friend Join → both Start → 3-2-1 → tap → lock.
4. **Record demo** (vertical phone, ≤90s) using script in `PLAN.md`.
5. **Submit on Luma** with:
   - Live URL (Vercel)
   - GitHub URL
   - Short “how we use MagicBlock”
   - Video link

---

## Demo one-liner for judges

> “PULSE is a mobile reaction battle: connect Phantom, create a room on Solana devnet, both players ready, 3-2-1, tap, result locks on-chain. Built for MagicBlock ER/VRF — room + tap + settle live; ER path in the program for gasless scale.”
