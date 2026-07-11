/**
 * Ephemeral Rollup connection helpers.
 * Real delegate/tap txs will use these endpoints later.
 */

import { Connection, PublicKey, type Commitment } from "@solana/web3.js";
import { config } from "./config";

const commitment: Commitment = "confirmed";
let erConn: Connection | null = null;

export function getErConnection(): Connection {
  if (!erConn) {
    erConn = new Connection(config.erRpc, {
      commitment,
      wsEndpoint: config.erWs,
    });
  }
  return erConn;
}

export function getErValidatorPubkey(): PublicKey {
  return new PublicKey(config.erValidator);
}

export async function pingEr(): Promise<{ ok: boolean; slot?: number; error?: string }> {
  try {
    const slot = await getErConnection().getSlot("processed");
    return { ok: true, slot };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Placeholder for future: send a signed tx to ER.
 * Keep signature so Arena can call one API later.
 */
export async function sendErRawTransaction(raw: Uint8Array): Promise<string> {
  const conn = getErConnection();
  const sig = await conn.sendRawTransaction(raw, {
    skipPreflight: true,
    preflightCommitment: "confirmed",
  });
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}
