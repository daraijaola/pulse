import { useEffect, useMemo, useState, type ReactNode } from "react";
import "./App.css";

type Screen = "home" | "enter" | "lobby" | "arena" | "result";

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
  const [roomCode, setRoomCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [youScore, setYouScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [ms, setMs] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [isHost, setIsHost] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [boot, setBoot] = useState(true);
  /** Landing hero demo: cycles the real game feeling */
  const [heroBeat, setHeroBeat] = useState<
    "wait" | "signal" | "go" | "hit"
  >("wait");
  const [heroMs, setHeroMs] = useState(127);
  const [bootKeys, setBootKeys] = useState(0);

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

  function createRoom() {
    setIsHost(true);
    setRoomCode(makeRoomCode());
    setJoinInput("");
    setCodeCopied(false);
    setScreen("lobby");
    setPhase("idle");
    setYouScore(0);
    setOppScore(0);
    setMs(null);
  }

  function joinRoom() {
    const code = joinInput.trim().toUpperCase();
    if (code.length < 3) return;
    setIsHost(false);
    setRoomCode(code);
    setCodeCopied(false);
    setScreen("lobby");
    setPhase("idle");
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

  function startRound() {
    setScreen("arena");
    setPhase("delegating");
    setYouScore(0);
    setOppScore(0);
    setMs(null);

    window.setTimeout(() => setPhase("vrf"), 900);
    window.setTimeout(() => setPhase("waiting"), 1800);
    window.setTimeout(() => {
      setPhase("go");
      (window as unknown as { __pulseGoAt?: number }).__pulseGoAt =
        performance.now();
    }, 1800 + 900 + Math.random() * 1100);
  }

  function onTap() {
    if (phase !== "go") return;
    const goAt = (window as unknown as { __pulseGoAt?: number }).__pulseGoAt;
    const reaction = goAt ? Math.round(performance.now() - goAt) : 0;
    setMs(reaction);
    setPhase("tapped");
    setYouScore(reaction > 0 ? Math.max(10, 1000 - reaction) : 500);
    const ghost = 120 + Math.floor(Math.random() * 280);
    setOppScore(Math.max(10, 1000 - ghost));
    window.setTimeout(() => setPhase("settling"), 700);
    window.setTimeout(() => {
      setWon(reaction > 0 && reaction <= ghost);
      setScreen("result");
    }, 1600);
  }

  function backHome() {
    setScreen("home");
    setPhase("idle");
    setJoinInput("");
    setCodeCopied(false);
  }

  const shellStep = useMemo(() => {
    if (screen === "enter") return "Enter";
    if (screen === "lobby") return "Lobby";
    if (screen === "arena") return "Arena";
    if (screen === "result") return "Result";
    return "";
  }, [screen]);

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

  return (
    <div className={`app screen-${screen}`}>
      <div className="frame-glow" aria-hidden />

      {showChrome && (
        <header className="shell-bar">
          <button type="button" className="shell-bar__brand" onClick={backHome}>
            PULSE
          </button>
          <span
            className={`shell-bar__step ${
              screen === "arena" &&
              (phase === "go" || phase === "waiting")
                ? "is-live"
                : ""
            }`}
          >
            {shellStep}
          </span>
        </header>
      )}

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
            <Btn onClick={() => setScreen("enter")}>Enter arena</Btn>
          </div>
        </main>
      )}

      {/* ═══════════ ENTER — create / join (FE mock, no wallet) ═══════════ */}
      {screen === "enter" && (
        <main className="flow flow-enter">
          <h1 className="flow-title">Create or join.</h1>

          <section className="flow-panel">
            <Btn onClick={createRoom}>Create room</Btn>
            <p className="flow-or">or</p>
            <input
              id="room-code"
              className="code-input"
              placeholder="CODE"
              value={joinInput}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              onChange={(e) =>
                setJoinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              aria-label="Room code"
            />
            <Btn
              variant="secondary"
              onClick={joinRoom}
              disabled={joinInput.trim().length < 3}
            >
              Join room
            </Btn>
          </section>
        </main>
      )}

      {/* ═══════════ LOBBY — share code, matchup, start (FE mock) ═══════════ */}
      {screen === "lobby" && (
        <main className="flow flow-lobby">
          <section className="lobby-code">
            <div className="lobby-code__row">
              <span className="flow-label">Room code</span>
              <button
                type="button"
                className="lobby-code__copy"
                onClick={copyRoomCode}
              >
                {codeCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p
              className="lobby-code__value"
              aria-label={`Room code ${roomCode}`}
            >
              {roomCode}
            </p>
          </section>

          <section className="matchup" aria-label="Players in room">
            <article className="matchup-card matchup-card--you">
              <span className="matchup-card__role">You</span>
              <span className="matchup-card__state">Ready</span>
              <span className="matchup-card__meta">
                {isHost ? "Host" : "Joined"}
              </span>
            </article>
            <article className="matchup-card matchup-card--ghost">
              <span className="matchup-card__role">Ghost</span>
              <span className="matchup-card__state">In</span>
              <span className="matchup-card__meta">Demo</span>
            </article>
          </section>

          <p className="flow-hint">Delegates to ER on start.</p>
        </main>
      )}

      {screen === "arena" && (
        <main className="stage stage-arena">
          <div className="arena-top">
            <div className="phase-rail" aria-hidden>
              {(["delegating", "vrf", "waiting", "go"] as DemoPhase[]).map(
                (p) => (
                  <span
                    key={p}
                    className={`phase-dot ${
                      phase === p ||
                      (phase === "tapped" && p === "go") ||
                      (phase === "settling" && p === "go")
                        ? "is-on"
                        : ""
                    } ${
                      [
                        "delegating",
                        "vrf",
                        "waiting",
                        "go",
                        "tapped",
                        "settling",
                      ].indexOf(phase) >
                      ["delegating", "vrf", "waiting", "go"].indexOf(p)
                        ? "is-done"
                        : ""
                    }`}
                  />
                ),
              )}
            </div>
            <div className="status-line">{statusText}</div>
            <div className="phase-badge">{phaseLabel}</div>
          </div>

          <div className="arena">
            <div
              className={`pulse-ring ${
                phase === "go"
                  ? "ready"
                  : phase === "waiting" || phase === "vrf"
                    ? "waiting"
                    : phase === "delegating"
                      ? "booting"
                      : phase === "tapped" || phase === "settling"
                        ? "hit"
                        : ""
              }`}
            >
              <div className="pulse-ring__grid" aria-hidden />
              <button
                type="button"
                className="tap-btn"
                disabled={phase !== "go"}
                onClick={onTap}
              >
                <span className="tap-btn__label">TAP</span>
                <span className="tap-btn__hint">
                  {phase === "go" ? "now" : phaseLabel.toLowerCase()}
                </span>
              </button>
            </div>

            <div className="scoreboard">
              <div className="score-card you">
                <div className="label">You</div>
                <div className="value">{youScore || "—"}</div>
              </div>
              <div className="score-card opp">
                <div className="label">Opp</div>
                <div className="value">{oppScore || "—"}</div>
              </div>
            </div>
          </div>
        </main>
      )}

      {screen === "result" && (
        <main className="stage stage-result">
          <div className={`result-banner ${won ? "win" : "lose"}`}>
            <div className="result-banner__keys" aria-hidden>
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
                    G
                  </Keycap>
                  <Keycap tone="dark" size="md">
                    H
                  </Keycap>
                  <Keycap tone="pink" size="md">
                    O
                  </Keycap>
                  <Keycap tone="blue" size="md">
                    S
                  </Keycap>
                  <Keycap tone="yellow" size="md">
                    T
                  </Keycap>
                </>
              )}
            </div>
            <h2>{won ? "You won the pulse" : "Ghost edged you"}</h2>
            <p>
              {ms != null ? `Reaction ${ms}ms · ` : ""}
              UI preview — onchain settle next
            </p>
          </div>

          <div className="scoreboard">
            <div className="score-card you">
              <div className="label">You</div>
              <div className="value">{youScore}</div>
              <div className="sub">{ms != null ? `${ms}ms` : "—"}</div>
            </div>
            <div className="score-card opp">
              <div className="label">Opp</div>
              <div className="value">{oppScore}</div>
              <div className="sub">Ghost</div>
            </div>
          </div>

          <div className="stack">
            <Btn onClick={startRound}>Play again</Btn>
            <Btn variant="ghost" onClick={backHome}>
              Home
            </Btn>
          </div>
        </main>
      )}

      {showChrome && (
        <footer className="dock">
          <div className="dock-left">
            {screen === "enter" && (
              <button type="button" className="dock-nav" onClick={backHome}>
                Home
              </button>
            )}
            {screen === "lobby" && (
              <button type="button" className="dock-nav" onClick={backHome}>
                Leave
              </button>
            )}
            {screen === "arena" && phaseLabel}
            {screen === "result" && (won ? "Victory" : "Retry")}
          </div>
          <div className="dock-right">
            {screen === "enter" && (
              <button
                type="button"
                onClick={
                  joinInput.trim().length >= 3 ? joinRoom : createRoom
                }
              >
                {joinInput.trim().length >= 3 ? "Join" : "Create"}{" "}
                <ArrowIcon />
              </button>
            )}
            {screen === "lobby" && (
              <button type="button" onClick={startRound}>
                Start <ArrowIcon />
              </button>
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
