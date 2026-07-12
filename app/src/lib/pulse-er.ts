/**
 * MagicBlock Ephemeral Rollup path for PULSE rooms.
 *
 * Flow (solo demo judges care about):
 *   base: create → start_round → delegate_room (+ ER validator)
 *   ER:   finish_match (or tap) → settle_and_undelegate
 *
 * Falls back to base-only if delegate/ER fails so the phone still works.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Commitment,
} from "@solana/web3.js";
import { getBaseConnection } from "./solana";
import { getErConnection, getErValidatorPubkey } from "./er";
import { codeToBytes, findRoomPda, getProgramId } from "./program";
import { getInjectedProvider } from "./wallet";
import { config } from "./config";

const PROGRAM_ID = getProgramId();
const DELEGATION_PROGRAM = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
);
const MAGIC_PROGRAM = new PublicKey(
  "Magic11111111111111111111111111111111111111",
);
const MAGIC_CONTEXT = new PublicKey(
  "MagicContext1111111111111111111111111111111",
);

/** From IDL — buffer PDA program (same owner as pulse for this deploy) */
const BUFFER_OWNER = PROGRAM_ID;

const D = {
  start_round: Buffer.from([144, 144, 43, 7, 193, 42, 217, 215]),
  delegate_room: Buffer.from([39, 6, 122, 70, 65, 76, 166, 26]),
  finish_match: Buffer.from([65, 193, 5, 71, 16, 64, 11, 186]),
  tap: Buffer.from([31, 254, 225, 122, 3, 186, 67, 245]),
  tap_solo: Buffer.from([249, 252, 88, 224, 234, 54, 91, 30]),
  settle_and_undelegate: Buffer.from([169, 143, 70, 235, 249, 1, 119, 52]),
  undelegate_room: Buffer.from([151, 179, 196, 11, 39, 232, 174, 131]),
} as const;

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function delegationPdas(roomPda: PublicKey) {
  const [bufferPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("buffer"), roomPda.toBuffer()],
    BUFFER_OWNER,
  );
  const [delegationRecord] = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), roomPda.toBuffer()],
    DELEGATION_PROGRAM,
  );
  const [delegationMetadata] = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation-metadata"), roomPda.toBuffer()],
    DELEGATION_PROGRAM,
  );
  return { bufferPda, delegationRecord, delegationMetadata };
}

async function signAndSend(
  connection: Connection,
  tx: Transaction,
  payer: PublicKey,
  opts?: { skipPreflight?: boolean },
): Promise<string> {
  const provider = getInjectedProvider();
  if (!provider?.signTransaction) {
    throw new Error("Wallet cannot sign. Open Phantom / Solana mobile browser.");
  }
  tx.feePayer = payer;
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  const signed = (await provider.signTransaction(tx as never)) as {
    serialize: () => Uint8Array;
  };
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: opts?.skipPreflight ?? true,
    preflightCommitment: "confirmed" as Commitment,
  });
  await connection.confirmTransaction(
    {
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed",
  );
  return sig;
}

/** Keypair path for Node E2E — optional */
export type ErSigner = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
};

async function signAndSendWith(
  connection: Connection,
  tx: Transaction,
  signer: ErSigner,
  opts?: { skipPreflight?: boolean },
): Promise<string> {
  tx.feePayer = signer.publicKey;
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  const signed = await signer.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: opts?.skipPreflight ?? true,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    {
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed",
  );
  return sig;
}

function buildDelegateIx(code: string, payer: PublicKey): TransactionInstruction {
  const codeBytes = codeToBytes(code);
  const [roomPda] = findRoomPda(code, PROGRAM_ID);
  const { bufferPda, delegationRecord, delegationMetadata } =
    delegationPdas(roomPda);
  const validator = getErValidatorPubkey();

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: bufferPda, isSigner: false, isWritable: true },
      { pubkey: delegationRecord, isSigner: false, isWritable: true },
      { pubkey: delegationMetadata, isSigner: false, isWritable: true },
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: DELEGATION_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // Pin ER validator (required on public ER)
      { pubkey: validator, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([D.delegate_room, codeBytes]),
  });
}

function buildFinishMatchIx(
  code: string,
  payer: PublicKey,
  hostMs: number,
  challMs: number,
): TransactionInstruction {
  const [roomPda] = findRoomPda(code, PROGRAM_ID);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([
      D.finish_match,
      u32(Math.max(1, Math.floor(hostMs))),
      u32(Math.max(1, Math.floor(challMs))),
    ]),
  });
}

function buildStartIx(code: string, payer: PublicKey): TransactionInstruction {
  const [roomPda] = findRoomPda(code, PROGRAM_ID);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([D.start_round, u32(0)]),
  });
}

function buildSettleAndUndelegateIx(
  code: string,
  payer: PublicKey,
): TransactionInstruction {
  const [roomPda] = findRoomPda(code, PROGRAM_ID);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: MAGIC_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: MAGIC_CONTEXT, isSigner: false, isWritable: true },
    ],
    data: D.settle_and_undelegate,
  });
}

function buildUndelegateIx(code: string, payer: PublicKey): TransactionInstruction {
  const [roomPda] = findRoomPda(code, PROGRAM_ID);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: MAGIC_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: MAGIC_CONTEXT, isSigner: false, isWritable: true },
    ],
    data: D.undelegate_room,
  });
}

function buildTapSoloIx(
  code: string,
  host: PublicKey,
  hostMs: number,
  ghostMs: number,
): TransactionInstruction {
  const [roomPda] = findRoomPda(code, PROGRAM_ID);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: host, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([
      D.tap_solo,
      u32(Math.max(1, Math.floor(hostMs))),
      u32(Math.max(1, Math.floor(ghostMs))),
    ]),
  });
}

export type ErRoundResult = {
  ok: boolean;
  usedEr: boolean;
  sigs: {
    start?: string;
    delegate?: string;
    finish?: string;
    undelegate?: string;
  };
  error?: string;
};

/**
 * Browser wallet: full ER solo/lock path.
 * 1) start_round on base (if not LIVE)
 * 2) delegate_room on base
 * 3) finish_match on ER (or tap_solo + settle_and_undelegate)
 * 4) undelegate if finish left account settled on ER
 */
export async function runErSettlePath(
  code: string,
  payerPk: string,
  hostMs: number,
  challMs: number,
  opts?: { alreadyLive?: boolean },
): Promise<ErRoundResult> {
  const payer = new PublicKey(payerPk);
  const base = getBaseConnection();
  const er = getErConnection();
  const sigs: ErRoundResult["sigs"] = {};

  try {
    if (!opts?.alreadyLive) {
      try {
        sigs.start = await signAndSend(
          base,
          new Transaction().add(buildStartIx(code, payer)),
          payer,
        );
        console.info("[pulse-er] start_round", sigs.start);
      } catch (e) {
        // may already be LIVE
        console.warn("[pulse-er] start_round", e);
      }
    }

    // Delegate on base
    sigs.delegate = await signAndSend(
      base,
      new Transaction().add(buildDelegateIx(code, payer)),
      payer,
      { skipPreflight: true },
    );
    console.info("[pulse-er] delegate_room", sigs.delegate);

    // Small wait for ER to pick up delegated account
    await new Promise((r) => setTimeout(r, 800));

    // Score + settle on ER via tap_solo + settle_and_undelegate
    // (finish_match alone does not undelegate; settle_and_undelegate needs LIVE + taps)
    try {
      sigs.finish = await signAndSend(
        er,
        new Transaction().add(buildTapSoloIx(code, payer, hostMs, challMs)),
        payer,
        { skipPreflight: true },
      );
      console.info("[pulse-er] tap_solo (ER)", sigs.finish);
      sigs.undelegate = await signAndSend(
        er,
        new Transaction().add(buildSettleAndUndelegateIx(code, payer)),
        payer,
        { skipPreflight: true },
      );
      console.info("[pulse-er] settle_and_undelegate", sigs.undelegate);
    } catch (e1) {
      console.warn("[pulse-er] tap_solo path failed, try finish_match+undelegate", e1);
      sigs.finish = await signAndSend(
        er,
        new Transaction().add(
          buildFinishMatchIx(code, payer, hostMs, challMs),
        ),
        payer,
        { skipPreflight: true },
      );
      console.info("[pulse-er] finish_match (ER)", sigs.finish);
      try {
        sigs.undelegate = await signAndSend(
          er,
          new Transaction().add(buildUndelegateIx(code, payer)),
          payer,
          { skipPreflight: true },
        );
        console.info("[pulse-er] undelegate_room", sigs.undelegate);
      } catch (e2) {
        console.warn("[pulse-er] undelegate after finish", e2);
      }
    }

    return { ok: true, usedEr: true, sigs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[pulse-er] ER path failed", msg);
    return { ok: false, usedEr: false, sigs, error: msg };
  }
}

/**
 * Node E2E: same path with Keypair-style signer.
 */
export async function runErSettlePathWithSigner(
  code: string,
  signer: ErSigner,
  hostMs: number,
  challMs: number,
): Promise<ErRoundResult> {
  const base = getBaseConnection();
  const er = getErConnection();
  const payer = signer.publicKey;
  const sigs: ErRoundResult["sigs"] = {};

  try {
    try {
      sigs.start = await signAndSendWith(
        base,
        new Transaction().add(buildStartIx(code, payer)),
        signer,
      );
    } catch {
      /* already live */
    }

    sigs.delegate = await signAndSendWith(
      base,
      new Transaction().add(buildDelegateIx(code, payer)),
      signer,
      { skipPreflight: true },
    );

    await new Promise((r) => setTimeout(r, 1000));

    try {
      sigs.finish = await signAndSendWith(
        er,
        new Transaction().add(buildTapSoloIx(code, payer, hostMs, challMs)),
        signer,
        { skipPreflight: true },
      );
      sigs.undelegate = await signAndSendWith(
        er,
        new Transaction().add(buildSettleAndUndelegateIx(code, payer)),
        signer,
        { skipPreflight: true },
      );
    } catch {
      sigs.finish = await signAndSendWith(
        er,
        new Transaction().add(
          buildFinishMatchIx(code, payer, hostMs, challMs),
        ),
        signer,
        { skipPreflight: true },
      );
      try {
        sigs.undelegate = await signAndSendWith(
          er,
          new Transaction().add(buildUndelegateIx(code, payer)),
          signer,
          { skipPreflight: true },
        );
      } catch {
        /* optional */
      }
    }

    return { ok: true, usedEr: true, sigs };
  } catch (e) {
    return {
      ok: false,
      usedEr: false,
      sigs,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function erEndpoints() {
  return {
    base: config.solanaRpc,
    er: config.erRpc,
    router: config.magicRouterRpc,
    validator: config.erValidator,
  };
}
