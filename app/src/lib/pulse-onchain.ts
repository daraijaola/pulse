/**
 * Real on-chain client — program 2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip (devnet)
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getBaseConnection } from "./solana";
import { codeToBytes, findRoomPda, getProgramId } from "./program";
import { getInjectedProvider } from "./wallet";
import { makeRoomCode, saveSession } from "./session-store";
import type { RoomState } from "./types";

const PROGRAM_ID = getProgramId();

const D = {
  create_room: [130, 166, 32, 2, 247, 120, 178, 53],
  start_round: [144, 144, 43, 7, 193, 42, 217, 215],
  tap_solo: [249, 252, 88, 224, 234, 54, 91, 30],
  settle: [175, 42, 185, 87, 144, 131, 102, 212],
} as const;

function disc(name: keyof typeof D): Buffer {
  return Buffer.from(D[name]);
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

async function signAndSend(
  connection: Connection,
  tx: Transaction,
  payer: PublicKey,
): Promise<string> {
  const provider = getInjectedProvider();
  if (!provider?.signTransaction) {
    throw new Error("Wallet cannot sign. Open Phantom / Solana mobile browser.");
  }
  tx.feePayer = payer;
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  // Phantom accepts web3.js Transaction
  const signed = (await provider.signTransaction(tx as never)) as {
    serialize: () => Uint8Array;
  };
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
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

export async function onchainCreateRoom(hostPk: string): Promise<{
  room: RoomState;
  signature: string;
  roomPda: string;
}> {
  const connection = getBaseConnection();
  const host = new PublicKey(hostPk);
  const code = makeRoomCode(4);
  const codeBytes = codeToBytes(code);
  const [roomPda] = findRoomPda(code, PROGRAM_ID);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: host, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc("create_room"), codeBytes]),
  });

  const signature = await signAndSend(connection, new Transaction().add(ix), host);

  const room: RoomState = {
    code,
    host: hostPk,
    status: "ready",
    you: {
      publicKey: hostPk,
      displayName: "You",
      isGhost: false,
      ready: true,
      score: 0,
      reactionMs: null,
    },
    opponent: {
      publicKey: null,
      displayName: "Ghost",
      isGhost: true,
      ready: true,
      score: 0,
      reactionMs: null,
    },
    createdAt: Date.now(),
  };
  saveSession({ lastRoomCode: code, room });
  return { room, signature, roomPda: roomPda.toBase58() };
}

export async function onchainStartRound(
  code: string,
  payerPk: string,
  goDelayMs = 0,
): Promise<string> {
  const connection = getBaseConnection();
  const payer = new PublicKey(payerPk);
  const [roomPda] = findRoomPda(code, PROGRAM_ID);
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([disc("start_round"), u32(goDelayMs)]),
  });
  return signAndSend(connection, new Transaction().add(ix), payer);
}

export async function onchainTapSolo(
  code: string,
  hostPk: string,
  hostMs: number,
  ghostMs: number,
): Promise<string> {
  const connection = getBaseConnection();
  const host = new PublicKey(hostPk);
  const [roomPda] = findRoomPda(code, PROGRAM_ID);
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: host, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([disc("tap_solo"), u32(hostMs), u32(ghostMs)]),
  });
  return signAndSend(connection, new Transaction().add(ix), host);
}

export async function onchainSettle(code: string, payerPk: string): Promise<string> {
  const connection = getBaseConnection();
  const payer = new PublicKey(payerPk);
  const [roomPda] = findRoomPda(code, PROGRAM_ID);
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: false },
    ],
    data: disc("settle"),
  });
  return signAndSend(connection, new Transaction().add(ix), payer);
}

export { PROGRAM_ID };
