import { shortPk } from "../../lib/config";
import { useWallet } from "../../hooks/useWallet";

type Props = {
  className?: string;
  /** compact = chip for shell; full = primary-style bar */
  variant?: "compact" | "full";
};

/**
 * Drop-in wallet control for Lobby / Arena chrome.
 * Does not change page routing — parent decides when to show.
 */
export function WalletButton({ className = "", variant = "compact" }: Props) {
  const { connected, publicKey, available, busy, error, connect, disconnect } =
    useWallet();

  if (!available && !connected) {
    return (
      <button
        type="button"
        className={`wallet-btn wallet-btn--warn ${variant} ${className}`}
        disabled
        title="Install Phantom or open in a Solana wallet browser"
      >
        No wallet
      </button>
    );
  }

  if (connected && publicKey) {
    return (
      <button
        type="button"
        className={`wallet-btn wallet-btn--on ${variant} ${className}`}
        onClick={() => void disconnect()}
        disabled={busy}
        title={publicKey}
      >
        {shortPk(publicKey)}
        <span className="wallet-btn__hint">disconnect</span>
      </button>
    );
  }

  return (
    <div className={`wallet-btn-wrap ${className}`}>
      <button
        type="button"
        className={`wallet-btn wallet-btn--off ${variant}`}
        onClick={() => void connect().catch(() => undefined)}
        disabled={busy}
      >
        {busy ? "Connecting…" : "Connect wallet"}
      </button>
      {error && <p className="wallet-btn__err">{error}</p>}
    </div>
  );
}
