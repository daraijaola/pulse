# PULSE on-chain (scaffold)

Not deployed yet. FE uses `VITE_USE_MOCK_CHAIN=true` until this lands.

## Target program

Anchor program with MagicBlock:

| Instruction | Layer | Purpose |
|-------------|--------|---------|
| `initialize_room` | Base | Create room PDA |
| `join_room` | Base | Second player |
| `delegate_room` | Base → ER | Delegate room PDA to ER validator |
| `request_pulse` | ER / base | VRF request for fair GO |
| `callback_pulse` | VRF callback | Store go window |
| `tap` | ER | Record reaction / first tap |
| `settle` | ER → Base | Commit + undelegate, set winner |

## References (do not reinvent)

- ER counter: https://github.com/magicblock-labs/magicblock-engine-examples/tree/main/counter
- VRF dice: https://github.com/magicblock-labs/magicblock-engine-examples/tree/main/roll-dice
- Docs: https://docs.magicblock.gg/

## Devnet

- Router: `https://devnet-router.magicblock.app`
- ER Asia: `https://devnet-as.magicblock.app`
- Validator: `MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57`

## Next engineer step

1. Install Rust + Anchor on builder or VM  
2. `anchor init pulse` (or copy counter + rename)  
3. Add VRF + room state  
4. Deploy devnet → set `VITE_PULSE_PROGRAM_ID`  
5. Set `VITE_USE_MOCK_CHAIN=false` and replace `pulse-api.ts` mock bodies  
