import { useCallback, useEffect, useState } from "react";
import { pingBase } from "../lib/solana";
import { pingEr } from "../lib/er";
import type { NetworkHealth } from "../lib/types";

const initial: NetworkHealth = {
  base: "unknown",
  er: "unknown",
};

export function useNetworkHealth(pollMs = 20_000) {
  const [health, setHealth] = useState<NetworkHealth>(initial);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const [base, er] = await Promise.all([pingBase(), pingEr()]);
    setHealth({
      base: base.ok ? "ok" : "error",
      er: er.ok ? "ok" : "error",
      baseSlot: base.slot,
      erSlot: er.slot,
      lastCheckedAt: Date.now(),
      message:
        !base.ok || !er.ok
          ? [base.error, er.error].filter(Boolean).join(" · ")
          : undefined,
    });
    setChecking(false);
  }, []);

  useEffect(() => {
    void check();
    if (pollMs <= 0) return;
    const id = window.setInterval(() => void check(), pollMs);
    return () => window.clearInterval(id);
  }, [check, pollMs]);

  return { health, checking, refresh: check };
}
