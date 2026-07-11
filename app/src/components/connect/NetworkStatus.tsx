import { useNetworkHealth } from "../../hooks/useNetworkHealth";
import { config } from "../../lib/config";

type Props = {
  className?: string;
};

/** Devnet + ER health chip for shell / lobby */
export function NetworkStatus({ className = "" }: Props) {
  const { health, checking, refresh } = useNetworkHealth(30_000);

  const baseOk = health.base === "ok";
  const erOk = health.er === "ok";
  const label =
    baseOk && erOk
      ? "Base · ER live"
      : checking
        ? "Checking…"
        : "Network issue";

  return (
    <button
      type="button"
      className={`net-status ${baseOk && erOk ? "is-ok" : "is-bad"} ${className}`}
      onClick={() => void refresh()}
      title={
        health.message ||
        `cluster=${config.cluster} baseSlot=${health.baseSlot ?? "—"} erSlot=${health.erSlot ?? "—"} mock=${config.useMockChain}`
      }
    >
      <span className="net-status__dot" aria-hidden />
      {label}
    </button>
  );
}
