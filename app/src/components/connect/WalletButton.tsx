import { shortPk } from "../../lib/config";
import { useWallet } from "../../hooks/useWallet";
import { isMobileUa, isWalletAvailable, openInPhantomBrowser } from "../../lib/wallet";

type Props = {
  className?: string;
  variant?: "compact" | "full";
};

export function WalletButton({ className = "", variant = "compact" }: Props) {
  const { connected, publicKey, busy, error, connect, disconnect } = useWallet();
  const injected = isWalletAvailable();
  const mobile = isMobileUa();

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

  // Mobile Safari/Chrome: no injected wallet — deep link into Phantom
  if (!injected && mobile) {
    return (
      <div className={`wallet-btn-wrap ${className}`}>
        <button
          type="button"
          className={`wallet-btn wallet-btn--off ${variant}`}
          onClick={() => openInPhantomBrowser()}
        >
          Open in Phantom
        </button>
        <p className="wallet-btn__err">
          Mobile needs Phantom in-app browser. Tap above, then Connect.
        </p>
      </div>
    );
  }

  if (!injected) {
    return (
      <div className={`wallet-btn-wrap ${className}`}>
        <button
          type="button"
          className={`wallet-btn wallet-btn--warn ${variant}`}
          onClick={() =>
            window.open("https://phantom.app/", "_blank", "noopener")
          }
        >
          Install Phantom
        </button>
        <p className="wallet-btn__err">
          Desktop: install Phantom extension, then reload.
        </p>
      </div>
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
