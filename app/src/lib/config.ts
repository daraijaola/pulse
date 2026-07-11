/**
 * PULSE runtime config — Solana base + MagicBlock ER.
 * Values override via Vite env (see .env.example).
 */

export type ClusterName = "devnet" | "mainnet-beta" | "localnet";

const env = import.meta.env;

export const config = {
  cluster: (env.VITE_SOLANA_CLUSTER as ClusterName) || "devnet",

  /** Base-layer Solana RPC */
  solanaRpc: (env.VITE_SOLANA_RPC as string) || "https://api.devnet.solana.com",

  /** Magic Router — preferred send path when wiring real txs */
  magicRouterRpc:
    (env.VITE_MAGIC_ROUTER_RPC as string) ||
    "https://devnet-router.magicblock.app",
  magicRouterWs:
    (env.VITE_MAGIC_ROUTER_WS as string) ||
    "wss://devnet-router.magicblock.app",

  /** Direct Ephemeral Rollup endpoint (Asia devnet default) */
  erRpc:
    (env.VITE_ER_RPC as string) || "https://devnet-as.magicblock.app",
  erWs: (env.VITE_ER_WS as string) || "wss://devnet-as.magicblock.app",

  /** Pin ER validator on delegate */
  erValidator:
    (env.VITE_ER_VALIDATOR as string) ||
    "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",

  /** Anchor program id — empty until deploy */
  programId: (env.VITE_PULSE_PROGRAM_ID as string) || "",

  /**
   * When true, pulseApi uses in-memory mock (FE can ship without program).
   * Flip to false after program deploy + IDL wiring.
   */
  useMockChain: env.VITE_USE_MOCK_CHAIN !== "false",
} as const;

export function shortPk(pk: string, n = 4): string {
  if (!pk || pk.length < n * 2 + 3) return pk || "—";
  return `${pk.slice(0, n)}…${pk.slice(-n)}`;
}
