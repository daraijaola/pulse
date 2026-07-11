/**
 * Real-chain client stubs — filled after deploy sets VITE_PULSE_PROGRAM_ID.
 * Until then FE keeps using pulse-api mock.
 *
 * Instruction discriminators will come from IDL after `anchor build`.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Signer,
} from "@solana/web3.js";
import { config } from "./config";
import { codeToBytes, findRoomPda, getProgramId, ROOM_SEED } from "./program";
import { getBaseConnection, getRouterConnection } from "./solana";
import { getErValidatorPubkey } from "./er";

export function isProgramConfigured(): boolean {
  return Boolean(config.programId) && config.programId.length >= 32;
}

/** Anchor sha256("global:create_room")[0..8] — replace with IDL after build */
// These placeholders are WRONG until generated from IDL.
// After deploy, run: anchor idl parse → copy discriminators or use @coral-xyz/anchor Program.

export type BuiltIx = {
  ix: TransactionInstruction;
  roomPda: PublicKey;
};

/**
 * Temporary: builds nothing useful without IDL.
 * After `anchor build`, generate client with:
 *   anchor idl build -o app/src/idl/pulse.json
 * and switch this file to Program methods.
 */
export function assertReadyForChain(): void {
  if (!isProgramConfigured()) {
    throw new Error(
      "Program not deployed. Set VITE_PULSE_PROGRAM_ID after anchor deploy.",
    );
  }
}

export async function sendWithWallet(
  connection: Connection,
  tx: Transaction,
  feePayer: PublicKey,
  signAndSend: (tx: Transaction) => Promise<string>,
): Promise<string> {
  tx.feePayer = feePayer;
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  return signAndSend(tx);
}

export function getPreferredConnection(): Connection {
  // Magic Router when available for ER-aware routing
  try {
    return getRouterConnection();
  } catch {
    return getBaseConnection();
  }
}

export { findRoomPda, codeToBytes, getProgramId, ROOM_SEED, getErValidatorPubkey };
