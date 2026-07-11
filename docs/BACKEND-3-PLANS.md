# Backend — 3 plans (test after each)

## Plan 1 — Connect (you test on phone)
- [x] Scaffold: wallet, session, base/ER ping, mock API
- [ ] Wire WalletButton + NetworkStatus into Lobby shell
- [ ] Confirm Base · ER live on phone

## Plan 2 — Program + ER (in progress)
- [x] Write `programs/pulse` Anchor source (create/join/start/delegate/tap/settle)
- [ ] Install toolchain on VM
- [ ] `anchor build` + `anchor deploy` devnet
- [ ] Set `VITE_PULSE_PROGRAM_ID`
- [ ] Client: create_room + start + delegate + tap_solo real txs

## Plan 3 — Demo package
- [ ] settle_and_undelegate path
- [ ] Result shows explorer sigs
- [ ] README MagicBlock blurb
- [ ] Phone record + Luma submit

## Program instructions
create_room → join_room? → start_round → delegate_room → tap / tap_solo → settle_and_undelegate
