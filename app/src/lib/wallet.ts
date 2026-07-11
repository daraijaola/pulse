/**
 * Wallet connect for desktop injected + mobile Phantom deep link.
 */

export type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  isConnected?: boolean;
  connect: (opts?: {
    onlyIfTrusted?: boolean;
  }) => Promise<{ publicKey: { toString(): string } }>;
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

export function isMobileUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function getInjectedProvider(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const p = window.phantom?.solana ?? window.solana;
  return p ?? null;
}

export function isWalletAvailable(): boolean {
  return !!getInjectedProvider();
}

/** Open current site inside Phantom mobile browser (required on phones) */
export function openInPhantomBrowser(): void {
  const url = window.location.href;
  // Universal link → opens URL inside Phantom so window.solana exists
  const deep = `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(window.location.origin)}`;
  window.location.href = deep;
}

export async function connectWallet(): Promise<{ publicKey: string }> {
  const provider = getInjectedProvider();
  if (!provider) {
    if (isMobileUa()) {
      openInPhantomBrowser();
      throw new Error("Opening Phantom… then tap Connect again.");
    }
    throw new Error("Install Phantom extension, or open this site in Phantom.");
  }
  const res = await provider.connect();
  const publicKey =
    res.publicKey?.toString() || provider.publicKey?.toString();
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
