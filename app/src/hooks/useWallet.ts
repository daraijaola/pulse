import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  getConnectedPublicKey,
  isWalletAvailable,
} from "../lib/wallet";
import { loadSession, saveSession } from "../lib/session-store";
import type { WalletSession } from "../lib/types";

export function useWallet() {
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = isWalletAvailable();

  useEffect(() => {
    const stored = loadSession().wallet;
    const live = getConnectedPublicKey();
    if (live) {
      const session: WalletSession = {
        publicKey: live,
        connectedAt: stored?.connectedAt ?? Date.now(),
      };
      setWallet(session);
      saveSession({ wallet: session });
    } else if (stored) {
      setWallet(stored);
    }
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { publicKey } = await connectWallet();
      const session: WalletSession = {
        publicKey,
        connectedAt: Date.now(),
        label: "Phantom",
      };
      setWallet(session);
      saveSession({ wallet: session });
      return session;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnectWallet();
      setWallet(null);
      saveSession({ wallet: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    wallet,
    publicKey: wallet?.publicKey ?? null,
    connected: !!wallet?.publicKey,
    available,
    busy,
    error,
    connect,
    disconnect,
  };
}
