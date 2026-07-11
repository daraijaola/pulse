/**
 * Thin wallet connect — Phantom / Solana mobile in-app browser.
 * No heavy wallet-adapter dependency; drop-in for scaffold.
 */

export type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  isConnected?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  signAllTransactions?: (txs: unknown[]) => Promise<unknown[]>;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
  }
}

export function getInjectedProvider(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const p = window.phantom?.solana ?? window.solana;
  return p ?? null;
}

export function isWalletAvailable(): boolean {
  return !!getInjectedProvider();
}

export async function connectWallet(): Promise<{ publicKey: string }> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error(
      "No Solana wallet found. Open in Phantom / a Solana mobile browser.",
    );
  }
  const res = await provider.connect();
  const publicKey = res.publicKey?.toString() || provider.publicKey?.toString();
  if (!publicKey) throw new Error("Wallet connected but no public key.");
  return { publicKey };
}

export async function disconnectWallet(): Promise<void> {
  const provider = getInjectedProvider();
  if (provider?.disconnect) await provider.disconnect();
}

export function getConnectedPublicKey(): string | null {
  const provider = getInjectedProvider();
  try {
    return provider?.publicKey?.toString() ?? null;
  } catch {
    return null;
  }
}
