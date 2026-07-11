/**
 * Real-chain client stubs — filled after deploy sets VITE_PULSE_PROGRAM_ID.
 * Until then FE keeps using pulse-api mock.
 *
 * Instruction discriminators will come from IDL after `anchor build`.
 */

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { config } from "./config";
import { getProgramId } from "./program";
import { getBaseConnection, getRouterConnection } from "./solana";

export function isProgramConfigured(): boolean {
  return Boolean(config.programId) && config.programId.length >= 32;
}

export function assertReadyForChain(): void {
  if (!isProgramConfigured()) {
    throw new Error(
      "Program not deployed. Set VITE_PULSE_PROGRAM_ID after anchor deploy.",
    );
  }
  void getProgramId();
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

export { getProgramId } from "./program";
export { findRoomPda, codeToBytes, ROOM_SEED } from "./program";
export { getErValidatorPubkey } from "./er";
