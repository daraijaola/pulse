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
import { codeToBytes, findRoomPda, getProgramId, RoomStatus } from "./program";
import { getInjectedProvider } from "./wallet";
import { makeRoomCode, saveSession } from "./session-store";
import type { RoomState } from "./types";

const PROGRAM_ID = getProgramId();
const ZERO = PublicKey.default;

const D = {
  create_room: [130, 166, 32, 2, 247, 120, 178, 53],
  join_room: [95, 232, 188, 81, 124, 130, 78, 139],
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

function statusLabel(s: number): RoomState["status"] {
  if (s === RoomStatus.LIVE) return "live";
  if (s === RoomStatus.SETTLED) return "closed";
  if (s === RoomStatus.READY) return "ready";
  return "open";
}

/** Decode Room account (Anchor 8-byte disc + fields) */
export function decodeRoomAccount(
  data: Buffer,
  viewerPk: string | null,
): RoomState | null {
  if (data.length < 8 + 95) return null;
  let o = 8;
  const host = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const challenger = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const code = data.subarray(o, o + 4).toString("utf8").replace(/\0/g, "");
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
  // go_ts i64 skip
  o += 8;
  // winner, bump
  o += 2;

  const hostStr = host.toBase58();
  const challStr = challenger.equals(ZERO) ? null : challenger.toBase58();
  const youAreHost = viewerPk === hostStr;
  const youAreChall = viewerPk != null && viewerPk === challStr;

  const hostSeat = {
    publicKey: hostStr,
    displayName: youAreHost ? "You" : "Host",
    isGhost: false,
    ready: true,
    score: hostScore,
    reactionMs: hostMs || null,
  };
  const challSeat = {
    publicKey: challStr,
    displayName: youAreChall ? "You" : challStr ? "Opponent" : "Waiting…",
    isGhost: !challStr,
    ready: !!challStr,
    score: challScore,
    reactionMs: challMs || null,
  };

  return {
    code,
    host: hostStr,
    status: statusLabel(status),
    you: youAreChall ? challSeat : hostSeat,
    opponent: youAreChall ? hostSeat : challSeat,
    createdAt: Date.now(),
  };
}

export async function fetchRoom(
  code: string,
  viewerPk: string | null,
): Promise<RoomState | null> {
  const connection = getBaseConnection();
  const [pda] = findRoomPda(code, PROGRAM_ID);
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info?.data) return null;
  return decodeRoomAccount(Buffer.from(info.data), viewerPk);
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
  const room = await fetchRoom(code, hostPk);
  if (!room) {
    throw new Error("Room created but could not fetch account");
  }
  saveSession({ lastRoomCode: code, room });
  return { room, signature, roomPda: roomPda.toBase58() };
}

export async function onchainJoinRoom(
  code: string,
  challengerPk: string,
): Promise<{ room: RoomState; signature: string }> {
  const connection = getBaseConnection();
  const clean = code.trim().toUpperCase();
  const challenger = new PublicKey(challengerPk);
  const [roomPda] = findRoomPda(clean, PROGRAM_ID);

  // must exist
  const existing = await connection.getAccountInfo(roomPda, "confirmed");
  if (!existing) {
    throw new Error("Room not found on-chain. Host must create first (with wallet).");
  }

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: challenger, isSigner: true, isWritable: false },
    ],
    data: disc("join_room"),
  });

  const signature = await signAndSend(
    connection,
    new Transaction().add(ix),
    challenger,
  );
  const room = await fetchRoom(clean, challengerPk);
  if (!room) throw new Error("Joined but could not fetch room");
  saveSession({ lastRoomCode: clean, room });
  return { room, signature };
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
