/**
 * Full PULSE two-wallet E2E on Solana devnet (no browser).
 * Flow: fund → create → fetch lobby → join → fetch opponent → start → tap×2 → settle
 * Also: re-start after settle, host-cannot-join, room-not-found, disconnect sim.
 *
 * Usage: node scripts/e2e-devnet.mjs
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// works when run from scripts/ or copied to app/
const ROOT = existsSync(join(__dirname, "scripts", ".e2e-keys"))
  ? __dirname
  : join(__dirname, "..");
const PROGRAM_ID = new PublicKey(
  "2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip",
);
const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const ROOM_SEED = Buffer.from("room");
const ZERO = PublicKey.default;

const D = {
  create_room: disc("global:create_room"),
  join_room: disc("global:join_room"),
  start_round: disc("global:start_round"),
  tap: disc("global:tap"),
  tap_solo: disc("global:tap_solo"),
  settle: disc("global:settle"),
};

function disc(name) {
  return createHash("sha256").update(name).digest().subarray(0, 8);
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function codeToBytes(code) {
  const c = code.trim().toUpperCase().padEnd(4, "X").slice(0, 4);
  return Buffer.from(c, "utf8");
}

function findRoomPda(code) {
  return PublicKey.findProgramAddressSync(
    [ROOM_SEED, codeToBytes(code)],
    PROGRAM_ID,
  );
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function decodeRoom(data) {
  if (data.length < 8 + 95) throw new Error("room account too short");
  let o = 8;
  const host = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const challenger = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const code = data.subarray(o, o + 4).toString("utf8");
  o += 4;
  const status = data[o];
  o += 1;
  const hostScore = data.readUInt32LE(o);
  o += 4;
  const challScore = data.readUInt32LE(o);
  o += 4;
  const hostMs = data.readUInt32LE(o);
  o += 4;
  const challMs = data.readUInt32LE(o);
  o += 4;
  const goTs = Number(data.readBigInt64LE(o));
  o += 8;
  const winner = data[o];
  o += 1;
  const bump = data[o];
  return {
    host: host.toBase58(),
    challenger: challenger.equals(ZERO) ? null : challenger.toBase58(),
    code,
    status,
    hostScore,
    challScore,
    hostMs,
    challMs,
    goTs,
    winner,
    bump,
  };
}

const STATUS = { OPEN: 0, READY: 1, LIVE: 2, SETTLED: 3 };
const results = [];

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`  ✅ PASS  ${name}${detail ? " — " + detail : ""}`);
}

function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(`  ❌ FAIL  ${name}${detail ? " — " + detail : ""}`);
}

function assert(cond, name, detail = "") {
  if (cond) pass(name, detail);
  else fail(name, detail);
  return cond;
}

async function fundFromDeployer(connection, deployer, kp, label, amountSol = 0.08) {
  const bal = await connection.getBalance(kp.publicKey);
  if (bal >= 0.03 * LAMPORTS_PER_SOL) {
    pass(`fund ${label}`, `${(bal / LAMPORTS_PER_SOL).toFixed(4)} SOL already`);
    return;
  }
  if (!deployer) {
    fail(`fund ${label}`, "no deployer key + airdrop blocked");
    return;
  }
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: deployer.publicKey,
      toPubkey: kp.publicKey,
      lamports,
    }),
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [deployer], {
    commitment: "confirmed",
  });
  const b = await connection.getBalance(kp.publicKey);
  pass(
    `fund ${label}`,
    `from deployer ${amountSol} SOL → ${(b / LAMPORTS_PER_SOL).toFixed(4)} (${sig.slice(0, 12)}…)`,
  );
}

async function fund(connection, kp, label, minSol = 0.05, deployer = null) {
  const bal = await connection.getBalance(kp.publicKey);
  if (bal >= minSol * LAMPORTS_PER_SOL) {
    pass(`fund ${label}`, `${(bal / LAMPORTS_PER_SOL).toFixed(4)} SOL already`);
    return;
  }
  if (deployer) {
    try {
      await fundFromDeployer(connection, deployer, kp, label, 0.08);
      return;
    } catch (e) {
      console.warn("  deployer transfer failed:", e.message?.slice(0, 120));
    }
  }
  // try airdrop up to 2 times
  for (let i = 0; i < 2; i++) {
    try {
      const sig = await connection.requestAirdrop(
        kp.publicKey,
        Math.ceil(0.2 * LAMPORTS_PER_SOL),
      );
      await connection.confirmTransaction(sig, "confirmed");
      const b = await connection.getBalance(kp.publicKey);
      if (b >= minSol * LAMPORTS_PER_SOL) {
        pass(`fund ${label}`, `airdrop ok ${(b / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        return;
      }
    } catch (e) {
      console.warn(`  airdrop attempt ${i + 1} failed:`, e.message?.slice(0, 120));
      await sleep(1500 * (i + 1));
    }
  }
  fail(`fund ${label}`, "could not fund wallet");
}

async function sendIx(connection, payer, ixs, label) {
  const tx = new Transaction().add(...(Array.isArray(ixs) ? ixs : [ixs]));
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
    skipPreflight: false,
  });
  console.log(`  ↗ ${label}  ${sig}`);
  return sig;
}

async function fetchRoom(connection, code) {
  const [pda] = findRoomPda(code);
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info) return null;
  return { pda, ...decodeRoom(Buffer.from(info.data)) };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadOrCreateKp(path) {
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  const kp = Keypair.generate();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify([...kp.secretKey]));
  return kp;
}

async function main() {
  console.log("\n═══ PULSE full E2E (devnet) ═══");
  console.log("RPC:", RPC);
  console.log("Program:", PROGRAM_ID.toBase58());

  const connection = new Connection(RPC, "confirmed");

  // 0. Program live
  const prog = await connection.getAccountInfo(PROGRAM_ID);
  assert(!!prog?.executable, "program executable on-chain");

  const keysDirCandidates = [
    join(ROOT, "scripts", ".e2e-keys"),
    join(__dirname, ".e2e-keys"),
    join(__dirname, "scripts", ".e2e-keys"),
  ];
  const keysDir =
    keysDirCandidates.find((p) => existsSync(p)) || keysDirCandidates[0];
  mkdirSync(keysDir, { recursive: true });
  const host = loadOrCreateKp(join(keysDir, "host.json"));
  const chall = loadOrCreateKp(join(keysDir, "challenger.json"));
  let deployer = null;
  const depPath = join(keysDir, "deployer.json");
  if (existsSync(depPath)) {
    deployer = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(depPath, "utf8"))),
    );
    console.log(
      "Deployer:   ",
      deployer.publicKey.toBase58(),
      (await connection.getBalance(deployer.publicKey) / 1e9).toFixed(4),
      "SOL",
    );
  }
  console.log("Host:       ", host.publicKey.toBase58());
  console.log("Challenger: ", chall.publicKey.toBase58());

  // 1. Fund both wallets from deployer (connect sim)
  console.log("\n[1] Fund / connect wallets (deployer → host + challenger)");
  await fund(connection, host, "host", 0.05, deployer);
  await fund(connection, chall, "challenger", 0.05, deployer);
  const h2 = await connection.getBalance(host.publicKey);
  const c2 = await connection.getBalance(chall.publicKey);
  assert(h2 >= 0.015 * LAMPORTS_PER_SOL, "host has gas", `${(h2 / 1e9).toFixed(4)} SOL`);
  assert(c2 >= 0.01 * LAMPORTS_PER_SOL, "challenger has gas", `${(c2 / 1e9).toFixed(4)} SOL`);

  if (h2 < 0.015 * LAMPORTS_PER_SOL || c2 < 0.01 * LAMPORTS_PER_SOL) {
    console.error("\nAborting: cannot fund wallets.");
    process.exit(2);
  }

  // 2. Create room
  console.log("\n[2] create_room (host)");
  const code = makeCode();
  const codeBytes = codeToBytes(code);
  const [roomPda] = findRoomPda(code);
  const createIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: host.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([D.create_room, codeBytes]),
  });
  const createSig = await sendIx(connection, host, createIx, "create_room");
  pass("create_room tx", createSig.slice(0, 16) + "…");

  // 3. Lobby poll — host view (no opponent yet)
  console.log("\n[3] lobby fetch (host view — waiting for opponent)");
  let room = await fetchRoom(connection, code);
  assert(!!room, "room account exists after create");
  assert(room?.host === host.publicKey.toBase58(), "host matches");
  assert(room?.challenger === null, "no challenger yet (ghost)");
  assert(room?.status === STATUS.READY, "status READY after create", `status=${room?.status}`);
  assert(room?.code === code, "code matches", code);
  console.log("  room", JSON.stringify(room, null, 2));

  // 4. Host cannot join own room
  console.log("\n[4] host cannot join as challenger");
  try {
    const badJoin = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: roomPda, isSigner: false, isWritable: true },
        { pubkey: host.publicKey, isSigner: true, isWritable: false },
      ],
      data: D.join_room,
    });
    await sendIx(connection, host, badJoin, "join_as_host");
    fail("host-cannot-join", "tx succeeded but should fail");
  } catch (e) {
    pass("host-cannot-join rejected", (e.message || "").slice(0, 80));
  }

  // 5. Join room (challenger)
  console.log("\n[5] join_room (challenger)");
  const joinIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: chall.publicKey, isSigner: true, isWritable: false },
    ],
    data: D.join_room,
  });
  const joinSig = await sendIx(connection, chall, joinIx, "join_room");
  pass("join_room tx", joinSig.slice(0, 16) + "…");

  // 6. Lobby poll — both see opponent
  console.log("\n[6] lobby fetch after join (both see opponent)");
  room = await fetchRoom(connection, code);
  assert(room?.challenger === chall.publicKey.toBase58(), "challenger set");
  assert(room?.status === STATUS.READY, "status still READY");
  pass("opponent visible on-chain", `${room.challenger.slice(0, 8)}…`);

  // double join should fail
  try {
    await sendIx(connection, chall, joinIx, "double_join");
    fail("room-full reject", "double join succeeded");
  } catch {
    pass("room-full reject on second join");
  }

  // 7. Start round (host)
  console.log("\n[7] start_round (host)");
  const startIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: host.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([D.start_round, u32(0)]),
  });
  const startSig = await sendIx(connection, host, startIx, "start_round");
  pass("start_round tx", startSig.slice(0, 16) + "…");
  room = await fetchRoom(connection, code);
  assert(room?.status === STATUS.LIVE, "status LIVE after start");

  // 8. Real 2-player taps
  console.log("\n[8] tap host + challenger (real 2p)");
  const hostMs = 142;
  const challMs = 187;
  const tapHostIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: host.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([D.tap, u32(hostMs)]),
  });
  const tapHostSig = await sendIx(connection, host, tapHostIx, "tap_host");
  pass("tap host", `${hostMs}ms ${tapHostSig.slice(0, 12)}…`);

  const tapChallIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: chall.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([D.tap, u32(challMs)]),
  });
  const tapChallSig = await sendIx(connection, chall, tapChallIx, "tap_challenger");
  pass("tap challenger", `${challMs}ms ${tapChallSig.slice(0, 12)}…`);

  room = await fetchRoom(connection, code);
  assert(room?.hostMs === hostMs, "host_ms on chain", String(room?.hostMs));
  assert(room?.challMs === challMs, "chall_ms on chain", String(room?.challMs));

  // double tap should fail
  try {
    await sendIx(connection, host, tapHostIx, "double_tap");
    fail("already-tapped reject", "double tap ok");
  } catch {
    pass("already-tapped reject");
  }

  // 9. Settle
  console.log("\n[9] settle");
  const settleIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: host.publicKey, isSigner: true, isWritable: false },
    ],
    data: D.settle,
  });
  const settleSig = await sendIx(connection, host, settleIx, "settle");
  pass("settle tx", settleSig.slice(0, 16) + "…");
  room = await fetchRoom(connection, code);
  assert(room?.status === STATUS.SETTLED, "status SETTLED");
  assert(room?.winner === 1, "winner host (faster)", `winner=${room?.winner}`);
  pass(
    "scores",
    `host ${room.hostScore} vs chall ${room.challScore} winner=${room.winner}`,
  );

  // 10. Second room: solo path (tap_solo) — host only
  console.log("\n[10] solo path create → start → tap_solo → settle");
  const code2 = makeCode();
  const [pda2] = findRoomPda(code2);
  const create2 = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pda2, isSigner: false, isWritable: true },
      { pubkey: host.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([D.create_room, codeToBytes(code2)]),
  });
  await sendIx(connection, host, create2, "create_solo");
  const start2 = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pda2, isSigner: false, isWritable: true },
      { pubkey: host.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([D.start_round, u32(0)]),
  });
  await sendIx(connection, host, start2, "start_solo");
  const soloTap = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pda2, isSigner: false, isWritable: true },
      { pubkey: host.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([D.tap_solo, u32(99), u32(210)]),
  });
  await sendIx(connection, host, soloTap, "tap_solo");
  const settle2 = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: pda2, isSigner: false, isWritable: true },
      { pubkey: host.publicKey, isSigner: true, isWritable: false },
    ],
    data: D.settle,
  });
  await sendIx(connection, host, settle2, "settle_solo");
  const soloRoom = await fetchRoom(connection, code2);
  assert(soloRoom?.status === STATUS.SETTLED, "solo settled");
  assert(soloRoom?.winner === 1, "solo host wins vs ghost");
  pass("solo path complete", code2);

  // 11. Replay after settle (start_round allows SETTLED → LIVE)
  console.log("\n[11] rematch start after settle (2p room)");
  try {
    await sendIx(connection, host, startIx, "rematch_start");
    room = await fetchRoom(connection, code);
    assert(room?.status === STATUS.LIVE, "rematch LIVE");
    assert(room?.hostMs === 0 && room?.challMs === 0, "scores reset on rematch");
    pass("rematch start works");
  } catch (e) {
    fail("rematch start", e.message?.slice(0, 100));
  }

  // 12. Disconnect sim — balances still readable, keys independent
  console.log("\n[12] disconnect sim (independent keypairs still valid)");
  const hb = await connection.getBalance(host.publicKey);
  const cb = await connection.getBalance(chall.publicKey);
  assert(hb > 0 && cb > 0, "both wallets still funded after flow", `h=${(hb / 1e9).toFixed(4)} c=${(cb / 1e9).toFixed(4)}`);

  // 13. Missing room
  console.log("\n[13] fetch missing room");
  const missing = await fetchRoom(connection, "ZZZZ");
  assert(missing === null, "missing room returns null");

  // Summary
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  console.log("\n════════════════════════════════");
  console.log(`E2E RESULT: ${passed.length} passed, ${failed.length} failed`);
  if (failed.length) {
    console.log("Failures:");
    failed.forEach((f) => console.log(" -", f.name, f.detail));
    console.log("E2E_FAIL");
    process.exit(1);
  }
  console.log("2p room code:", code);
  console.log("solo room code:", code2);
  console.log("E2E_PASS");
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
