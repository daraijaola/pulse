# Scripts

Run from `app/` so `@solana/web3.js` resolves (or set `NODE_PATH=./node_modules`).

| Script | What |
|--------|------|
| `e2e-devnet.mjs` | Two keypairs: create → join → start → tap×2 → settle. Expect **`E2E_PASS`**. |
| `e2e-er.mjs` | Solo ER: create → start → **delegate** → **tap_solo on ER** → **settle_and_undelegate**. Expect **`ER_E2E_PASS`**. |

Keys: `scripts/.e2e-keys/` (gitignored). Fund from deployer or faucet.

```bash
cd app
node ../scripts/e2e-er.mjs
```
