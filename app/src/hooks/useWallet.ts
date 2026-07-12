import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  getConnectedPublicKey,
  getInjectedProvider,
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
    // Only treat as connected when the injected provider actually has a pubkey.
    // Restoring localStorage alone caused ghost "connected" state that couldn't sign.
    const stored = loadSession().wallet;
    const live = getConnectedPublicKey();
    if (live) {
      const session: WalletSession = {
        publicKey: live,
        connectedAt: stored?.connectedAt ?? Date.now(),
        label: stored?.label ?? "Phantom",
      };
      setWallet(session);
      saveSession({ wallet: session });
    } else if (stored) {
      saveSession({ wallet: null });
      setWallet(null);
    }

    const provider = getInjectedProvider();

    const onConnect = () => {
      const pk = getConnectedPublicKey();
      if (!pk) return;
      const session: WalletSession = {
        publicKey: pk,
        connectedAt: Date.now(),
        label: "Phantom",
      };
      setWallet(session);
      saveSession({ wallet: session });
    };
    const onDisconnect = () => {
      setWallet(null);
      saveSession({ wallet: null });
    };
    const onAccountChanged = (pk: unknown) => {
      if (!pk) {
        onDisconnect();
        return;
      }
      const str =
        typeof pk === "object" && pk && "toString" in pk
          ? String((pk as { toString: () => string }).toString())
          : String(pk);
      const session: WalletSession = {
        publicKey: str,
        connectedAt: Date.now(),
        label: "Phantom",
      };
      setWallet(session);
      saveSession({ wallet: session });
    };

    provider?.on?.("connect", onConnect);
    provider?.on?.("disconnect", onDisconnect);
    provider?.on?.("accountChanged", onAccountChanged);
    return () => {
      provider?.off?.("connect", onConnect);
      provider?.off?.("disconnect", onDisconnect);
      provider?.off?.("accountChanged", onAccountChanged);
    };
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
