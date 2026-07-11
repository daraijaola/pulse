/**
 * Base-layer + Magic Router connections.
 */

import { Connection, PublicKey, clusterApiUrl, type Commitment } from "@solana/web3.js";
import { config } from "./config";

const commitment: Commitment = "confirmed";

let baseConn: Connection | null = null;
let routerConn: Connection | null = null;

export function getBaseConnection(): Connection {
  if (!baseConn) {
    const endpoint =
      config.solanaRpc ||
      clusterApiUrl(config.cluster === "mainnet-beta" ? "mainnet-beta" : "devnet");
    baseConn = new Connection(endpoint, {
      commitment,
      wsEndpoint: undefined,
    });
  }
  return baseConn;
}

/** Prefer Magic Router when sending txs that may land on ER or base */
export function getRouterConnection(): Connection {
  if (!routerConn) {
    routerConn = new Connection(config.magicRouterRpc, {
      commitment,
      wsEndpoint: config.magicRouterWs,
    });
  }
  return routerConn;
}

export function tryParsePubkey(s: string | null | undefined): PublicKey | null {
  if (!s) return null;
  try {
    return new PublicKey(s);
  } catch {
    return null;
  }
}

export async function pingBase(): Promise<{ ok: boolean; slot?: number; error?: string }> {
  try {
    const slot = await getBaseConnection().getSlot("processed");
    return { ok: true, slot };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
