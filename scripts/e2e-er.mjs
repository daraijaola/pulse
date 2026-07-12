/**
 * E2E: MagicBlock ER path on devnet
 * create → start → delegate → tap_solo (ER) → settle_and_undelegate (ER)
 *
 * Usage (from app/ with deps): node ../scripts/e2e-er.mjs
 * Or: cd app && node --experimental-vm-modules ../scripts/e2e-er.mjs
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRAM_ID = new PublicKey(
  "2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip",
);
const DELEGATION = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
);
const MAGIC = new PublicKey("Magic11111111111111111111111111111111111111");
const MAGIC_CTX = new PublicKey("MagicContext1111111111111111111111111111111");
const ER_VALIDATOR = new PublicKey(
  "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
);
const BASE = "https://api.devnet.solana.com";
const ER = "https://devnet-as.magicblock.app";

function disc(name) {
  return createHash("sha256").update(name).digest().subarray(0, 8);
}
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}
function codeBytes(code) {
  return Buffer.from(code.padEnd(4).slice(0, 4), "utf8");
}
function roomPda(code) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("room"), codeBytes(code)],
    PROGRAM_ID,
  )[0];
}
function makeCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

function loadKp(path) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))),
  );
}

async function send(conn, payer, ix, label) {
  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(conn, tx, [payer], {
    commitment: "confirmed",
    skipPreflight: true,
  });
  console.log(`  ✅ ${label}`, sig);
  return sig;
}

async function main() {
  console.log("\n═══ PULSE ER E2E (devnet) ═══");
  console.log("Base", BASE);
  console.log("ER  ", ER);
  console.log("Program", PROGRAM_ID.toBase58());

  const base = new Connection(BASE, "confirmed");
  const er = new Connection(ER, {
    commitment: "confirmed",
    wsEndpoint: "wss://devnet-as.magicblock.app",
  });

  // ping ER
  try {
    const slot = await er.getSlot("processed");
    console.log("  ✅ ER ping slot", slot);
  } catch (e) {
    console.error("  ❌ ER ping failed", e.message);
    process.exit(1);
  }

  const keysDir = join(__dirname, ".e2e-keys");
  const hostPath = join(keysDir, "host.json");
  const depPath = join(keysDir, "deployer.json");
  if (!existsSync(hostPath)) {
    console.error("Missing host key — run e2e-devnet first");
    process.exit(1);
  }
  const host = loadKp(hostPath);
  console.log("Host", host.publicKey.toBase58());

  let bal = await base.getBalance(host.publicKey);
  if (bal < 0.05 * LAMPORTS_PER_SOL && existsSync(depPath)) {
    const dep = loadKp(depPath);
    await sendAndConfirmTransaction(
      base,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: dep.publicKey,
          toPubkey: host.publicKey,
          lamports: Math.floor(0.08 * LAMPORTS_PER_SOL),
        }),
      ),
      [dep],
      { commitment: "confirmed" },
    );
    bal = await base.getBalance(host.publicKey);
    console.log("  funded host", bal / 1e9);
  }
  if (bal < 0.02 * LAMPORTS_PER_SOL) {
    console.error("Host needs SOL");
    process.exit(1);
  }

  const code = makeCode();
  const pda = roomPda(code);
  console.log("CODE", code, "PDA", pda.toBase58());

  // 1 create
  await send(
    base,
    host,
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: host.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([disc("global:create_room"), codeBytes(code)]),
    }),
    "create_room (base)",
  );

  // 2 start
  await send(
    base,
    host,
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: host.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.concat([disc("global:start_round"), u32(0)]),
    }),
    "start_round (base)",
  );

  // 3 delegate
  const [bufferPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("buffer"), pda.toBuffer()],
    PROGRAM_ID,
  );
  const [delRec] = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), pda.toBuffer()],
    DELEGATION,
  );
  const [delMeta] = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation-metadata"), pda.toBuffer()],
    DELEGATION,
  );

  console.log("  buffer", bufferPda.toBase58());
  console.log("  delRec", delRec.toBase58());

  let delSig;
  try {
    delSig = await send(
      base,
      host,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: host.publicKey, isSigner: true, isWritable: true },
          { pubkey: bufferPda, isSigner: false, isWritable: true },
          { pubkey: delRec, isSigner: false, isWritable: true },
          { pubkey: delMeta, isSigner: false, isWritable: true },
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: DELEGATION, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: ER_VALIDATOR, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([disc("global:delegate_room"), codeBytes(code)]),
      }),
      "delegate_room (base→ER)",
    );
  } catch (e) {
    console.error("  ❌ delegate failed", e.message || e);
    // dump logs if simulation
    if (e.logs) console.error(e.logs.join("\n"));
    process.exit(1);
  }

  // wait for ER
  await new Promise((r) => setTimeout(r, 2000));

  // check account on ER
  const erInfo = await er.getAccountInfo(pda, "confirmed");
  console.log(
    "  ER account",
    erInfo ? `owner=${erInfo.owner.toBase58()} len=${erInfo.data.length}` : "NULL",
  );

  // 4 tap_solo on ER
  try {
    await send(
      er,
      host,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: host.publicKey, isSigner: true, isWritable: false },
        ],
        data: Buffer.concat([disc("global:tap_solo"), u32(111), u32(222)]),
      }),
      "tap_solo (ER)",
    );
  } catch (e) {
    console.error("  ❌ tap_solo ER failed", e.message || e);
    if (e.logs) console.error(e.logs.slice(-20).join("\n"));
    process.exit(1);
  }

  // 5 settle_and_undelegate on ER
  try {
    await send(
      er,
      host,
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: host.publicKey, isSigner: true, isWritable: true },
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: MAGIC, isSigner: false, isWritable: false },
          { pubkey: MAGIC_CTX, isSigner: false, isWritable: true },
        ],
        data: disc("global:settle_and_undelegate"),
      }),
      "settle_and_undelegate (ER)",
    );
  } catch (e) {
    console.error("  ❌ settle_and_undelegate failed", e.message || e);
    if (e.logs) console.error(e.logs.slice(-30).join("\n"));
    // try finish_match + undelegate
    try {
      await send(
        er,
        host,
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: pda, isSigner: false, isWritable: true },
            { pubkey: host.publicKey, isSigner: true, isWritable: false },
          ],
          data: Buffer.concat([
            disc("global:finish_match"),
            u32(111),
            u32(222),
          ]),
        }),
        "finish_match (ER fallback)",
      );
    } catch (e2) {
      console.error("  finish fallback", e2.message);
    }
    process.exit(1);
  }

  // verify base after a few seconds
  await new Promise((r) => setTimeout(r, 3000));
  const baseInfo = await base.getAccountInfo(pda, "confirmed");
  if (baseInfo) {
    const d = Buffer.from(baseInfo.data);
    const status = d[8 + 32 + 32 + 4];
    const hostMs = d.readUInt32LE(8 + 32 + 32 + 4 + 1 + 4 + 4);
    console.log("  base after undelegate status=", status, "hostMs=", hostMs);
  } else {
    console.log("  base account missing (unexpected)");
  }

  console.log("\nER_E2E_PASS");
  console.log("delegate", delSig);
  console.log("code", code);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
