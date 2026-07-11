import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadSession, saveSession } from "./lib/session-store";
import {
  createRoom as apiCreateRoom,
  runRound,
  resolveTap,
  settleRound,
} from "./lib/pulse-api";
import { useWallet } from "./hooks/useWallet";
import { WalletButton } from "./components/connect/WalletButton";
import { NetworkStatus } from "./components/connect/NetworkStatus";
import type { RoundState } from "./lib/types";
import "./App.css";

const SESSION_KEY = "pulse-flow";
const MIN_PLAYER_NAME = 2;
const MAX_PLAYER_NAME = 16;

type Screen = "home" | "enter" | "lobby" | "arena" | "result";

const FLOW_SCREENS: Screen[] = ["enter", "lobby", "arena", "result"];

const ARENA_PHASES: DemoPhase[] = [
  "delegating",
  "vrf",
  "waiting",
  "go",
  "tapped",
  "settling",
];

const ARENA_STEP_LABELS: Record<DemoPhase, string> = {
  idle: "Idle",
  delegating: "Delegate",
  vrf: "VRF",
  waiting: "Wait",
  go: "Go",
  tapped: "Hit",
  settling: "Settle",
};

function arenaStepClass(step: DemoPhase, current: DemoPhase) {
  const si = ARENA_PHASES.indexOf(step);
  const ci = ARENA_PHASES.indexOf(current);
  if (si < 0 || ci < 0) return "";
  if (si === ci) return "is-active";
  if (si < ci) return "is-done";
  return "";
}

function flowTabClass(
  target: Screen,
  current: Screen,
  live = false,
  locked = false,
) {
  const ti = FLOW_SCREENS.indexOf(target);
  const ci = FLOW_SCREENS.indexOf(current);
  if (ti < 0 || ci < 0) return "";
  const parts: string[] = [];
  if (ti === ci) parts.push("is-on");
  else if (ti < ci) parts.push("is-done");
  if (live) parts.push("is-live");
  if (locked) parts.push("is-locked");
  return parts.join(" ");
}

function sanitizePlayerName(raw: string) {
  return raw
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, MAX_PLAYER_NAME);
}

type DemoPhase =
  | "idle"
  | "delegating"
  | "vrf"
  | "waiting"
  | "go"
  | "tapped"
  | "settling";

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h12M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="8"
        y="8"
        width="11"
        height="13"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M6 16H5a2 2 0 01-2-2V5a2 2 0 012-2h9a2 2 0 012 2v1"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function RoomCodeGlyphs({ code }: { code: string }) {
  return (
    <div className="lobby-vault__glyphs" aria-hidden>
      {code.split("").map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className="lobby-vault__glyph"
          style={{ animationDelay: `${0.08 + i * 0.07}s` }}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

function Keycap({
  children,
  tone = "light",
  size = "md",
}: {
  children: ReactNode;
  tone?: "light" | "dark" | "blue" | "orange" | "pink" | "yellow" | "green";
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <span className={`keycap keycap--${tone} keycap--${size}`} aria-hidden>
      <span className="keycap__face">{children}</span>
    </span>
  );
}

const DEMO_REACTIONS = [84, 112, 127, 93, 156, 201, 78];

function PulseWave({ beat }: { beat: "wait" | "signal" | "go" | "hit" }) {
  const paths = {
    wait: "M0 24h72l3-1 3 1h18l2-2 4 2h20l3 1 3-1h40l2 1 2-1h80",
    signal:
      "M0 24h40l6-4 6 8 6-12 6 16 6-8 6 4h40l8-6 8 10 8-14 8 18 8-10 8 6h40",
    go: "M0 24h100l4-1 4 1h20l6-2 6 2h8l0-22 8 44 8-44 8 22h20l4 1 4-1h72",
    hit: "M0 24h88l4-1 4 1h16l6-2 6 2h6l0-18 6 36 6-36 6 18h16l4 1 4-1h88",
  };
  return (
    <svg
      className={`pulse-wave pulse-wave--${beat}`}
      viewBox="0 0 280 48"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={paths[beat]} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Btn({
  variant = "primary",
  children,
  onClick,
  disabled,
  type = "button",
}: {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="btn-inner">{children}</span>
      {variant !== "ghost" && (
        <span className="btn-icon">
          <ArrowIcon />
        </span>
      )}
    </button>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [nameDraft, setNameDraft] = useState("");
  const [lockedName, setLockedName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [flowUnlocked, setFlowUnlocked] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [youScore, setYouScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [ms, setMs] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [ghostMs, setGhostMs] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [boot, setBoot] = useState(true);
  const roundTimers = useRef<number[]>([]);
  /** Landing hero demo: cycles the real game feeling */
  const [heroBeat, setHeroBeat] = useState<
    "wait" | "signal" | "go" | "hit"
  >("wait");
  const [heroMs, setHeroMs] = useState(127);
  const [bootKeys, setBootKeys] = useState(0);
  const [chainBusy, setChainBusy] = useState(false);
  const [lastSigs, setLastSigs] = useState<RoundState["sigs"]>(undefined);
  const [chainError, setChainError] = useState<string | null>(null);
  const roundRef = useRef<RoundState | null>(null);
  const wallet = useWallet();

  const nameLocked = lockedName.trim().length >= MIN_PLAYER_NAME;
  const displayName = nameLocked ? lockedName.trim() : "Player";
  const hasValidPlayer = nameLocked;
  const canLockName =
    !nameLocked && nameDraft.trim().length >= MIN_PLAYER_NAME;

  const isRoundLive =
    screen === "arena" &&
    phase !== "idle";

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        lockedName?: string;
        roomCode?: string;
        flowUnlocked?: number;
        isHost?: boolean;
      };
      if (saved.lockedName) {
        setLockedName(saved.lockedName);
        setNameDraft(saved.lockedName);
      }
      if (saved.roomCode) setRoomCode(saved.roomCode);
      if (typeof saved.flowUnlocked === "number") {
        setFlowUnlocked(saved.flowUnlocked);
      }
      if (typeof saved.isHost === "boolean") setIsHost(saved.isHost);
    } catch {
      /* ignore corrupt flow snapshot */
    }
    const stored = loadSession();
    if (stored.playerName && !lockedName) {
      setLockedName(stored.playerName);
      setNameDraft(stored.playerName);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ lockedName, roomCode, flowUnlocked, isHost }),
    );
    if (nameLocked) {
      saveSession({ playerName: lockedName.trim() });
    }
  }, [lockedName, roomCode, flowUnlocked, isHost, nameLocked]);

  useEffect(() => {
    return () => {
      roundTimers.current.forEach(window.clearTimeout);
    };
  }, []);

  const canNavigateTo = useCallback(
    (target: Screen) => {
      const ti = FLOW_SCREENS.indexOf(target);
      if (ti < 0) return false;
      if (isRoundLive && target !== "arena") return false;
      if (ti > flowUnlocked) return false;

      if (target === "enter") return true;
      if (target === "lobby") {
        return hasValidPlayer && roomCode.length > 0;
      }
      if (target === "arena") {
        return flowUnlocked >= 2 && !roundComplete;
      }
      if (target === "result") {
        return flowUnlocked >= 3 && roundComplete;
      }
      return false;
    },
    [flowUnlocked, hasValidPlayer, isRoundLive, roomCode, roundComplete],
  );

  function clearRoundTimers() {
    roundTimers.current.forEach(window.clearTimeout);
    roundTimers.current = [];
  }

  function navigateFlow(target: Screen) {
    if (screen === target) return;
    if (!canNavigateTo(target)) return;
    if (screen === "arena" && isRoundLive) return;
    if (target === "lobby") setPhase("idle");
    setScreen(target);
  }

  useEffect(() => {
    const steps = [120, 220, 320, 420, 520];
    const timers = steps.map((ms, i) =>
      window.setTimeout(() => setBootKeys(i + 1), ms),
    );
    const done = window.setTimeout(() => setBoot(false), 900);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(done);
    };
  }, []);

  useEffect(() => {
    if (screen !== "home" || boot) return;
    let cancelled = false;
    const sleep = (ms: number) =>
      new Promise<void>((r) => {
        window.setTimeout(r, ms);
      });
    (async () => {
      while (!cancelled) {
        setHeroBeat("wait");
        await sleep(2600);
        if (cancelled) break;
        setHeroBeat("signal");
        await sleep(1900);
        if (cancelled) break;
        setHeroBeat("go");
        await sleep(720);
        if (cancelled) break;
        setHeroBeat("hit");
        setHeroMs(
          DEMO_REACTIONS[Math.floor(Math.random() * DEMO_REACTIONS.length)],
        );
        await sleep(1600);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screen, boot]);

  const statusText = useMemo(() => {
    switch (phase) {
      case "idle":
        return "Ready when you are";
      case "delegating":
        return (
          <>
            Delegating → <strong>Ephemeral Rollup</strong>
          </>
        );
      case "vrf":
        return (
          <>
            Fair pulse · <strong>MagicBlock VRF</strong>
          </>
        );
      case "waiting":
        return "Hold… wait for the pulse";
      case "go":
        return (
          <>
            <strong>GO</strong> — hit it
          </>
        );
      case "tapped":
        return ms != null ? (
          <>
            Reaction <strong>{ms}ms</strong>
          </>
        ) : (
          "Score locked"
        );
      case "settling":
        return (
          <>
            Commit → <strong>Solana base</strong>
          </>
        );
      default:
        return "";
    }
  }, [phase, ms]);

  const phaseLabel = useMemo(() => {
    const map: Record<DemoPhase, string> = {
      idle: "IDLE",
      delegating: "DELEGATE",
      vrf: "VRF",
      waiting: "WAIT",
      go: "GO",
      tapped: "HIT",
      settling: "SETTLE",
    };
    return map[phase];
  }, [phase]);

  const arenaBeat = useMemo(() => {
    switch (phase) {
      case "delegating":
        return "delegate";
      case "vrf":
        return "signal";
      case "waiting":
        return "wait";
      case "go":
        return "go";
      case "tapped":
      case "settling":
        return "hit";
      default:
        return "wait";
    }
  }, [phase]);

  const arenaWaveBeat = useMemo((): "wait" | "signal" | "go" | "hit" => {
    if (phase === "vrf") return "signal";
    if (phase === "go") return "go";
    if (phase === "tapped" || phase === "settling") return "hit";
    return "wait";
  }, [phase]);

  const arenaWord = useMemo(() => {
    switch (phase) {
      case "delegating":
        return "SYNC";
      case "vrf":
        return "VRF";
      case "waiting":
        return "WAIT";
      case "go":
        return "TAP";
      case "tapped":
        return "HIT";
      case "settling":
        return "LOCK";
      default:
        return "WAIT";
    }
  }, [phase]);

  function lockPlayerName() {
    const trimmed = nameDraft.trim();
    if (trimmed.length < MIN_PLAYER_NAME) return;
    setLockedName(trimmed);
    setNameDraft(trimmed);
    saveSession({ playerName: trimmed });
  }

  function unlockPlayerName() {
    setLockedName("");
  }

  function enterLobby(asHost: boolean, code?: string) {
    if (!hasValidPlayer) return;
    setIsHost(asHost);
    setRoomCode(asHost ? makeRoomCode() : (code ?? ""));
    if (asHost) setJoinInput("");
    setCodeCopied(false);
    setRoundComplete(false);
    setFlowUnlocked((u) => Math.max(u, 1));
    setScreen("lobby");
    setPhase("idle");
    setYouScore(0);
    setOppScore(0);
    setMs(null);
    setGhostMs(null);
  }

  async function createRoom() {
    if (!hasValidPlayer) return;
    setChainError(null);
    setChainBusy(true);
    try {
      const room = await apiCreateRoom(wallet.publicKey);
      setIsHost(true);
      setRoomCode(room.code);
      setJoinInput("");
      setCodeCopied(false);
      setRoundComplete(false);
      setFlowUnlocked((u) => Math.max(u, 1));
      setScreen("lobby");
      setPhase("idle");
      setYouScore(0);
      setOppScore(0);
      setMs(null);
      setGhostMs(null);
      setLastSigs(undefined);
    } catch (e) {
      setChainError(e instanceof Error ? e.message : String(e));
      enterLobby(true);
    } finally {
      setChainBusy(false);
    }
  }

  function joinRoom() {
    const code = joinInput.trim().toUpperCase();
    if (code.length < 3 || !hasValidPlayer) return;
    enterLobby(false, code);
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      setCodeCopied(false);
    }
  }

  async function startRound() {
    if (!hasValidPlayer || !roomCode || chainBusy) return;
    clearRoundTimers();
    setChainError(null);
    setChainBusy(true);
    setRoundComplete(false);
    setFlowUnlocked((u) => Math.max(u, 2));
    setScreen("arena");
    setPhase("delegating");
    setYouScore(0);
    setOppScore(0);
    setMs(null);
    setGhostMs(null);
    setLastSigs(undefined);
    roundRef.current = null;

    try {
      const round = await runRound(roomCode, {
        onPhase: (p) => setPhase(p as DemoPhase),
      });
      roundRef.current = round;
      setLastSigs(round.sigs);
      setPhase("go");
      (window as unknown as { __pulseGoAt?: number }).__pulseGoAt =
        round.goAtMs ?? performance.now();
    } catch (e) {
      setChainError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    } finally {
      setChainBusy(false);
    }
  }

  async function onTap() {
    if (phase !== "go" || chainBusy) return;
    const goAt = (window as unknown as { __pulseGoAt?: number }).__pulseGoAt;
    const reaction = goAt ? Math.round(performance.now() - goAt) : 0;
    setMs(reaction);
    setPhase("tapped");
    setChainBusy(true);
    setChainError(null);

    const base =
      roundRef.current ??
      ({
        roomCode,
        phase: "go" as const,
        goAtMs: goAt ?? null,
        youScore: 0,
        oppScore: 0,
        youMs: null,
        oppMs: null,
        winner: null,
        sigs: lastSigs,
      } satisfies RoundState);

    const tapped = resolveTap(base, reaction > 0 ? reaction : 1);
    setYouScore(tapped.youScore);
    setOppScore(tapped.oppScore);
    setGhostMs(tapped.oppMs);
    setWon(tapped.winner === "you");
    roundRef.current = tapped;

    setPhase("settling");
    try {
      const done = await settleRound(tapped);
      roundRef.current = done;
      setLastSigs(done.sigs);
      setRoundComplete(true);
      setFlowUnlocked((u) => Math.max(u, 3));
      setScreen("result");
    } catch (e) {
      setChainError(e instanceof Error ? e.message : String(e));
      setRoundComplete(true);
      setFlowUnlocked((u) => Math.max(u, 3));
      setScreen("result");
    } finally {
      setChainBusy(false);
    }
  }

  function backHome() {
    clearRoundTimers();
    setScreen("home");
    setPhase("idle");
    setJoinInput("");
    setCodeCopied(false);
    setRoomCode("");
    setFlowUnlocked(0);
    setRoundComplete(false);
    setYouScore(0);
    setOppScore(0);
    setMs(null);
  }

  function openEnter() {
    setFlowUnlocked(0);
    setRoundComplete(false);
    setScreen("enter");
  }

  const heroTelemetry = useMemo(() => {
    switch (heroBeat) {
      case "wait":
        return "VRF · pending";
      case "signal":
        return "Pulse · forming";
      case "go":
        return "Signal · live";
      case "hit":
        return `Locked · ${heroMs}ms`;
      default:
        return "";
    }
  }, [heroBeat, heroMs]);

  if (boot) {
    const letters = ["P", "U", "L", "S", "E"];
    return (
      <div className="boot">
        <div className="boot__keys" aria-hidden>
          {letters.map((ch, i) => (
            <Keycap
              key={ch}
              tone={i % 2 === 0 ? "dark" : "blue"}
              size="lg"
            >
              <span
                className={bootKeys > i ? "boot-key-in" : "boot-key-out"}
              >
                {ch}
              </span>
            </Keycap>
          ))}
        </div>
        <p className="boot__meta">Reaction battle</p>
      </div>
    );
  }

  const showChrome = screen !== "home";

  const arenaLive =
    screen === "arena" && (phase === "go" || phase === "waiting");

  return (
    <div className={`app screen-${screen}`}>
      {showChrome && (
        <header className="shell-nav">
          <button
            type="button"
            className="shell-nav__brand"
            onClick={backHome}
          >
            PULSE
          </button>
          <nav className="shell-nav__tabs" aria-label="Game flow">
            {(
              [
                ["enter", "01", "Enter"],
                ["lobby", "02", "Lobby"],
                ["arena", "03", "Arena"],
                ["result", "04", "Result"],
              ] as const
            ).map(([target, step, label]) => {
              const locked =
                !canNavigateTo(target) && screen !== target;
              return (
                <button
                  key={target}
                  type="button"
                  className={`shell-nav__tab ${flowTabClass(target, screen, target === "arena" && arenaLive, locked)}`}
                  data-step={step}
                  onClick={() => navigateFlow(target)}
                  disabled={locked}
                  aria-current={screen === target ? "step" : undefined}
                  aria-disabled={locked}
                  title={
                    locked
                      ? isRoundLive
                        ? "Finish the live round first"
                        : "Complete prior steps first"
                      : undefined
                  }
                >
                  {label}
                </button>
              );
            })}
          </nav>
        </header>
      )}

      <div className="app-body">
      {/* ═══════════ LANDING ═══════════ */}
      {screen === "home" && (
        <main className={`landing beat-${heroBeat}`}>
          <div className="landing__flash" aria-hidden />
          <span className="landing__watermark" aria-hidden>
            {heroBeat === "go" ? "GO" : heroBeat === "hit" ? "WIN" : "PULSE"}
          </span>

          <header className="l-band">
            <span className="l-band__mark">PULSE</span>
          </header>

          <section className="l-hero">
            <div className="l-copy">
              <p className="l-kicker">Mobile reaction battle</p>
              <h1 className="l-title">
                Hold your
                <br />
                nerve.
                <br />
                <span className="l-title__accent">Tap first.</span>
              </h1>
            </div>

            <section className="chamber" aria-hidden="true">
              <div className="chamber__status">{heroTelemetry}</div>

              <div className="chamber__frame">
                <span className="chamber__corner chamber__corner--tl" />
                <span className="chamber__corner chamber__corner--tr" />
                <span className="chamber__corner chamber__corner--bl" />
                <span className="chamber__corner chamber__corner--br" />

                <div className="chamber__wave">
                  <PulseWave beat={heroBeat} />
                </div>

                <div className="chamber__orbit">
                  <i className="chamber__ring chamber__ring--a" />
                  <i className="chamber__ring chamber__ring--b" />
                  <i className="chamber__ring chamber__ring--c" />
                  <i className="chamber__sweep" />
                </div>

                <div className="chamber__core">
                  <div className="chamber__core-face">
                    <span className="chamber__word">
                      {heroBeat === "wait" && "WAIT"}
                      {heroBeat === "signal" && "HOLD"}
                      {heroBeat === "go" && "TAP"}
                      {heroBeat === "hit" && "WIN"}
                    </span>
                    {heroBeat === "hit" && (
                      <span className="chamber__ms">{heroMs}ms</span>
                    )}
                  </div>
                  <div className="chamber__core-side" />
                </div>
              </div>

              <ol className="chamber-flow">
                <li className={heroBeat === "wait" ? "is-active" : "is-done"}>
                  <span className="chamber-flow__idx">01</span>
                  <span className="chamber-flow__label">Wait</span>
                </li>
                <li
                  className={
                    heroBeat === "signal"
                      ? "is-active"
                      : heroBeat === "go" || heroBeat === "hit"
                        ? "is-done"
                        : ""
                  }
                >
                  <span className="chamber-flow__idx">02</span>
                  <span className="chamber-flow__label">Pulse</span>
                </li>
                <li
                  className={
                    heroBeat === "go"
                      ? "is-active"
                      : heroBeat === "hit"
                        ? "is-done"
                        : ""
                  }
                >
                  <span className="chamber-flow__idx">03</span>
                  <span className="chamber-flow__label">Tap</span>
                </li>
                <li className={heroBeat === "hit" ? "is-active" : ""}>
                  <span className="chamber-flow__idx">04</span>
                  <span className="chamber-flow__label">Win</span>
                </li>
              </ol>
            </section>
          </section>

          <section className="l-facts">
            <article className="l-fact">
              <h2>Fair pulse</h2>
              <p>
                GO timing from MagicBlock VRF — verifiable, not browser random.
              </p>
            </article>
            <article className="l-fact">
              <div className="l-fact__head">
                <img
                  src={`${import.meta.env.BASE_URL}solana-mark.svg`}
                  alt=""
                  className="l-fact__solana"
                />
                <h2>Settles on Solana</h2>
              </div>
              <p>
                Room and taps on Ephemeral Rollup. Winner commits to base layer.
              </p>
            </article>
          </section>

          <div className="l-cta-zone">
            <p className="l-cta-hint">No wallet needed to explore</p>
            <Btn onClick={openEnter}>Enter arena</Btn>
          </div>
        </main>
      )}

      {/* ═══════════ ENTER — create / join ═══════════ */}
      {screen === "enter" && (
        <main className="flow flow-enter">
          <div className="flow-stack flow-stack--center">
            <header className="flow-intro">
              <p className="flow-kicker">Get in</p>
              <h1 className="flow-title">
                Set your
                <br />
                player name.
              </h1>
              <p className="flow-lede">
                Lock your name, then create or join a room.
              </p>
            </header>

            <section className="wallet-strip" aria-label="Wallet">
              <div className="wallet-strip__row">
                <NetworkStatus />
                <WalletButton variant="full" />
              </div>
              <p className="wallet-strip__hint">
                Optional now — connect Phantom (devnet) for on-chain rooms.
                Without wallet, create/join still works solo (Ghost).
              </p>
            </section>

            <section className="player-id" aria-labelledby="player-name-label">
              <div className="player-id__head">
                <span className="player-id__chip" aria-hidden>
                  <Keycap tone="blue" size="sm">
                    {nameLocked
                      ? displayName.charAt(0).toUpperCase()
                      : "?"}
                  </Keycap>
                </span>
                <div className="player-id__copy">
                  <label className="flow-label" id="player-name-label">
                    Player name
                  </label>
                  <p className="player-id__hint">
                    Shown in lobby, arena and results
                  </p>
                </div>
              </div>

              <div
                className={`name-lock ${nameLocked ? "is-locked" : ""}`}
              >
                <input
                  id="player-name"
                  className="name-lock__input"
                  placeholder="Enter your name"
                  value={nameDraft}
                  maxLength={MAX_PLAYER_NAME}
                  autoComplete="nickname"
                  autoCapitalize="words"
                  spellCheck={false}
                  readOnly={nameLocked}
                  onChange={(e) =>
                    setNameDraft(sanitizePlayerName(e.target.value))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") lockPlayerName();
                  }}
                  aria-label="Player name"
                />
                {nameLocked ? (
                  <button
                    type="button"
                    className="name-lock__btn name-lock__btn--edit"
                    onClick={unlockPlayerName}
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    className="name-lock__btn name-lock__btn--enter"
                    onClick={lockPlayerName}
                    disabled={!canLockName}
                    aria-label="Lock in player name"
                  >
                    <ArrowIcon />
                  </button>
                )}
              </div>

              {nameLocked && (
                <p className="player-id__locked">
                  <span className="player-id__pulse" aria-hidden />
                  Player name locked · <strong>{displayName}</strong>
                </p>
              )}
            </section>

            <section
              className={`flow-panel ${!nameLocked ? "flow-panel--gated" : ""}`}
            >
              <Btn onClick={createRoom} disabled={!hasValidPlayer}>
                Create room
              </Btn>
              <div className="flow-split" aria-hidden>
                <span />
                <em>or join with code</em>
                <span />
              </div>
              <label className="flow-label" htmlFor="room-code">
                Room code
              </label>
              <input
                id="room-code"
                className="code-input"
                placeholder="ABCD"
                value={joinInput}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                onChange={(e) =>
                  setJoinInput(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  )
                }
                aria-label="Room code"
              />
              <Btn
                variant="secondary"
                onClick={joinRoom}
                disabled={
                  !hasValidPlayer || joinInput.trim().length < 3
                }
              >
                Join room
              </Btn>
            </section>
          </div>
        </main>
      )}

      {/* ═══════════ LOBBY — code vault, versus, pre-round rail (FE mock) ═══════════ */}
      {screen === "lobby" && (
        <main className="flow flow-lobby">
          <div className="flow-stack">
            <header className="lobby-intro">
              <p className="flow-kicker">Room armed</p>
              <h1 className="lobby-headline">
                Drop the
                <br />
                <span className="lobby-headline__accent">code.</span>
              </h1>
              <p className="lobby-lede">
                Share the code so a friend can join — or play solo vs Ghost.
              </p>
            </header>

            <section className="wallet-strip" aria-label="Wallet">
              <div className="wallet-strip__row">
                <NetworkStatus />
                <WalletButton variant="full" />
              </div>
            </section>

            <section className="lobby-vault" aria-labelledby="lobby-code-label">
              <div className="lobby-vault__status">
                <span className="lobby-vault__pulse" aria-hidden />
                {isHost ? "Hosting" : "Joined"} · code {roomCode || "—"}
              </div>

              <div className="lobby-vault__frame">
                <span className="lobby-vault__corner lobby-vault__corner--tl" />
                <span className="lobby-vault__corner lobby-vault__corner--tr" />
                <span className="lobby-vault__corner lobby-vault__corner--bl" />
                <span className="lobby-vault__corner lobby-vault__corner--br" />

                <div className="lobby-vault__ring" aria-hidden />

                <div className="lobby-vault__body">
                  <span className="flow-label" id="lobby-code-label">
                    Room code
                  </span>
                  <p
                    className="lobby-vault__value"
                    aria-label={`Room code ${roomCode}`}
                  >
                    {roomCode}
                  </p>
                  <RoomCodeGlyphs code={roomCode} />
                  <button
                    type="button"
                    className={`lobby-vault__copy ${codeCopied ? "is-copied" : ""}`}
                    onClick={copyRoomCode}
                  >
                    <CopyIcon />
                    <span>{codeCopied ? "Copied" : "Copy code"}</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="lobby-versus" aria-label="Players in room">
              <article className="lobby-fighter lobby-fighter--you">
                <div className="lobby-fighter__top">
                  <span className="lobby-fighter__dot" aria-hidden />
                  <span className="lobby-fighter__state">Ready</span>
                </div>
                <span className="lobby-fighter__name">{displayName}</span>
                <span className="lobby-fighter__tag">
                  {isHost ? "Host" : "Joined"}
                </span>
              </article>

              <div className="lobby-versus__mid" aria-hidden>
                <span className="lobby-versus__line" />
                <span className="lobby-versus__badge">VS</span>
                <span className="lobby-versus__line" />
              </div>

              <article className="lobby-fighter lobby-fighter--ghost">
                <div className="lobby-fighter__top">
                  <span className="lobby-fighter__ghost-keys" aria-hidden>
                    <Keycap tone="dark" size="sm">
                      G
                    </Keycap>
                  </span>
                  <span className="lobby-fighter__state">Ghost</span>
                </div>
                <span className="lobby-fighter__name">Opponent</span>
                <span className="lobby-fighter__tag">Solo demo</span>
              </article>
            </section>

            <ol className="lobby-pipeline" aria-label="Pre-round steps">
              <li className="is-done">
                <span className="lobby-pipeline__idx">01</span>
                <span className="lobby-pipeline__label">Share</span>
              </li>
              <li className="is-active">
                <span className="lobby-pipeline__idx">02</span>
                <span className="lobby-pipeline__label">Ready</span>
              </li>
              <li>
                <span className="lobby-pipeline__idx">03</span>
                <span className="lobby-pipeline__label">Delegate</span>
              </li>
              <li>
                <span className="lobby-pipeline__idx">04</span>
                <span className="lobby-pipeline__label">Pulse</span>
              </li>
            </ol>

            <p className="lobby-er-hint">
              Next: room delegates to <strong>Ephemeral Rollup</strong> on
              start.
            </p>

            <div className="flow-actions">
              <Btn onClick={startRound}>Start round</Btn>
            </div>
          </div>
        </main>
      )}

      {screen === "arena" && (
        <main className={`flow flow-arena arena-beat-${arenaBeat}`}>
          <div className="flow-stack">
            <header className="arena-intro">
              <p className="flow-kicker">Live on ER</p>
              <div className="arena-intro__row">
                <h1 className="arena-headline">The pulse.</h1>
                <span className="arena-phase-badge">{phaseLabel}</span>
              </div>
            </header>

            <section className="arena-chamber" aria-label="Reaction arena">
              <div className="arena-chamber__flash" aria-hidden />
              <div className="arena-chamber__status">{statusText}</div>

              <div className="arena-chamber__frame">
                <span className="arena-chamber__corner arena-chamber__corner--tl" />
                <span className="arena-chamber__corner arena-chamber__corner--tr" />
                <span className="arena-chamber__corner arena-chamber__corner--bl" />
                <span className="arena-chamber__corner arena-chamber__corner--br" />

                <div className="arena-chamber__wave">
                  <PulseWave beat={arenaWaveBeat} />
                </div>

                <div className="arena-chamber__orbit" aria-hidden>
                  <i className="arena-chamber__ring arena-chamber__ring--a" />
                  <i className="arena-chamber__ring arena-chamber__ring--b" />
                  <i className="arena-chamber__sweep" />
                </div>

                <button
                  type="button"
                  className="arena-tap"
                  disabled={phase !== "go"}
                  onClick={onTap}
                  aria-label={
                    phase === "go" ? "Tap now" : `Tap disabled — ${phaseLabel}`
                  }
                >
                  <span className="arena-tap__core">
                    <span className="arena-tap__word">{arenaWord}</span>
                    {phase === "tapped" && ms != null && (
                      <span className="arena-tap__ms">{ms}ms</span>
                    )}
                    {phase === "go" && (
                      <span className="arena-tap__hint">now</span>
                    )}
                    {phase !== "go" && phase !== "tapped" && (
                      <span className="arena-tap__hint">
                        {phaseLabel.toLowerCase()}
                      </span>
                    )}
                  </span>
                  <span className="arena-tap__side" aria-hidden />
                </button>
              </div>

              <ol className="arena-pipeline" aria-label="Round phases">
                {ARENA_PHASES.map((step, i) => (
                  <li
                    key={step}
                    className={arenaStepClass(step, phase)}
                  >
                    <span className="arena-pipeline__idx">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="arena-pipeline__label">
                      {ARENA_STEP_LABELS[step]}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section
              className="arena-scoreboard scoreboard"
              aria-label="Live scores"
            >
              <div className="score-card you">
                <div className="label">{displayName}</div>
                <div className="value">{youScore || "—"}</div>
                {ms != null && (
                  <div className="sub">{ms}ms</div>
                )}
              </div>
              <div className="score-card opp">
                <div className="label">Ghost</div>
                <div className="value">{oppScore || "—"}</div>
                <div className="sub">Opponent</div>
              </div>
            </section>
          </div>
        </main>
      )}

      {screen === "result" && (
        <main className={`flow flow-result ${won ? "is-win" : "is-lose"}`}>
          <div className="flow-stack">
            <header className="result-intro">
              <p className="flow-kicker">{won ? "Victory" : "Defeat"}</p>
              <h1 className="result-headline">
                {won ? (
                  <>
                    {displayName}
                    <br />
                    <span className="result-headline__accent">took it.</span>
                  </>
                ) : (
                  <>
                    Ghost
                    <br />
                    <span className="result-headline__accent">was faster.</span>
                  </>
                )}
              </h1>
            </header>

            <section className="result-chamber" aria-label="Round result">
              <div className="result-chamber__status">
                {won ? "Winner locked" : "Round complete"} ·{" "}
                {ms != null ? `${ms}ms reaction` : "—"}
                {lastSigs?.settle
                  ? lastSigs.settle.startsWith("mock")
                    ? " · mock settle"
                    : " · on-chain settle"
                  : ""}
              </div>
              {lastSigs && (
                <div className="result-sigs">
                  {lastSigs.vrf && !String(lastSigs.vrf).startsWith("mock") && (
                    <a
                      className="result-sigs__link"
                      href={`https://explorer.solana.com/tx/${lastSigs.vrf}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      start_round tx
                    </a>
                  )}
                  {lastSigs.tap && !String(lastSigs.tap).startsWith("mock") && (
                    <a
                      className="result-sigs__link"
                      href={`https://explorer.solana.com/tx/${lastSigs.tap}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      tap_solo tx
                    </a>
                  )}
                  {lastSigs.settle &&
                    !String(lastSigs.settle).startsWith("mock") && (
                      <a
                        className="result-sigs__link"
                        href={`https://explorer.solana.com/tx/${lastSigs.settle}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        settle tx
                      </a>
                    )}
                </div>
              )}
              {chainError && (
                <p className="chain-error">{chainError}</p>
              )}

              <div className="result-chamber__frame">
                <span className="result-chamber__corner result-chamber__corner--tl" />
                <span className="result-chamber__corner result-chamber__corner--tr" />
                <span className="result-chamber__corner result-chamber__corner--bl" />
                <span className="result-chamber__corner result-chamber__corner--br" />

                <div className="result-chamber__keys" aria-hidden>
                  {won ? (
                    <>
                      <Keycap tone="green" size="md">
                        W
                      </Keycap>
                      <Keycap tone="dark" size="md">
                        I
                      </Keycap>
                      <Keycap tone="blue" size="md">
                        N
                      </Keycap>
                    </>
                  ) : (
                    <>
                      <Keycap tone="orange" size="md">
                        L
                      </Keycap>
                      <Keycap tone="dark" size="md">
                        O
                      </Keycap>
                      <Keycap tone="pink" size="md">
                        S
                      </Keycap>
                      <Keycap tone="blue" size="md">
                        T
                      </Keycap>
                    </>
                  )}
                </div>

                <div className="result-chamber__hero">
                  <span className="result-chamber__ms">
                    {ms != null ? `${ms}ms` : "—"}
                  </span>
                  <span className="result-chamber__label">Your reaction</span>
                </div>
              </div>

              <ol className="result-settle" aria-label="Settlement steps">
                <li className="is-done">
                  <span className="result-settle__idx">01</span>
                  <span className="result-settle__label">ER round</span>
                </li>
                <li className="is-done">
                  <span className="result-settle__idx">02</span>
                  <span className="result-settle__label">VRF pulse</span>
                </li>
                <li className="is-active">
                  <span className="result-settle__idx">03</span>
                  <span className="result-settle__label">Solana</span>
                </li>
              </ol>
            </section>

            <section className="result-matchup" aria-label="Final scores">
              <article className="result-fighter result-fighter--you">
                <span className="result-fighter__role">{displayName}</span>
                <span className="result-fighter__score">{youScore}</span>
                <span className="result-fighter__meta">
                  {ms != null ? `${ms}ms` : "—"}
                  {won ? " · Winner" : ""}
                </span>
              </article>
              <div className="result-matchup__mid" aria-hidden>
                <span className="result-matchup__badge">VS</span>
              </div>
              <article className="result-fighter result-fighter--ghost">
                <span className="result-fighter__role">Ghost</span>
                <span className="result-fighter__score">{oppScore}</span>
                <span className="result-fighter__meta">
                  {ghostMs != null ? `${ghostMs}ms` : "Opponent"}
                  {!won ? " · Winner" : ""}
                </span>
              </article>
            </section>

            <p className="result-solana-hint">
              <img
                src={`${import.meta.env.BASE_URL}solana-mark.svg`}
                alt=""
                className="result-solana-hint__mark"
              />
              Result commits to <strong>Solana base layer</strong> (FE preview)
            </p>

            <div className="flow-actions">
              <Btn onClick={startRound}>Play again</Btn>
              <Btn
                variant="ghost"
                onClick={() => navigateFlow("lobby")}
                disabled={!canNavigateTo("lobby")}
              >
                Back to lobby
              </Btn>
            </div>
          </div>
        </main>
      )}

      </div>

      {showChrome && (
        <footer className="dock">
          <div className="dock-left">
            {screen === "enter" && (
              <>
                <button type="button" className="dock-nav" onClick={backHome}>
                  Home
                </button>
                {hasValidPlayer && (
                  <span className="dock-player">{displayName}</span>
                )}
              </>
            )}
            {screen === "lobby" && (
              <>
                <span className="dock-code">{roomCode}</span>
                <span className="dock-player">{displayName}</span>
                <button type="button" className="dock-nav" onClick={backHome}>
                  Leave
                </button>
              </>
            )}
            {screen === "arena" && (
              <>
                <span className="dock-player">{displayName}</span>
                <span className="dock-phase">{phaseLabel}</span>
              </>
            )}
            {screen === "result" && (
              <>
                <span className="dock-player">{displayName}</span>
                <button type="button" className="dock-nav" onClick={backHome}>
                  Home
                </button>
              </>
            )}
          </div>
          <div className="dock-right">
            {screen === "enter" && (
              <button
                type="button"
                onClick={
                  joinInput.trim().length >= 3 ? joinRoom : createRoom
                }
                disabled={!hasValidPlayer}
              >
                {joinInput.trim().length >= 3 ? "Join" : "Create"}{" "}
                <ArrowIcon />
              </button>
            )}
            {screen === "lobby" && (
              <span className="dock-status">Ready</span>
            )}
            {screen === "arena" && (
              <button
                type="button"
                onClick={phase === "go" ? onTap : undefined}
                disabled={phase !== "go"}
              >
                {phase === "go" ? "Tap" : "Live"} <ArrowIcon />
              </button>
            )}
            {screen === "result" && (
              <button type="button" onClick={startRound}>
                Again <ArrowIcon />
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
