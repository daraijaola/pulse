/**
 * On-chain program constants + PDA helpers.
 * Program id updates after first successful `anchor deploy`.
 */

import { PublicKey } from "@solana/web3.js";
import { config } from "./config";

/** Placeholder until deploy — replace via VITE_PULSE_PROGRAM_ID */
export const DEFAULT_PROGRAM_ID = "2ATahSWWWkFu1j4SzbJ2RYerHR445ZqTTLCh9bWsFcip";

export const ROOM_SEED = "room";

export function getProgramId(): PublicKey {
  const id = config.programId || DEFAULT_PROGRAM_ID;
  return new PublicKey(id);
}

/** Encode 4-char room code to bytes */
export function codeToBytes(code: string): Buffer {
  const c = code.trim().toUpperCase().padEnd(4, "X").slice(0, 4);
  return Buffer.from(c, "utf8");
}

export function findRoomPda(code: string, programId = getProgramId()): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ROOM_SEED), codeToBytes(code)],
    programId,
  );
}

/** Account layout status codes — keep in sync with programs/pulse/src/lib.rs */
export const RoomStatus = {
  OPEN: 0,
  READY: 1,
  LIVE: 2,
  SETTLED: 3,
} as const;

export const Winner = {
  NONE: 0,
  HOST: 1,
  CHALLENGER: 2,
  DRAW: 3,
} as const;
