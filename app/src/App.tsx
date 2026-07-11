import { useMemo, useState, type ReactNode } from "react";
import "./App.css";

type Screen = "home" | "lobby" | "arena" | "result";

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

  const statusText = useMemo(() => {
    switch (phase) {
      case "idle":
        return "Ready when you are";
      case "delegating":
        return (
          <>
            Delegating room → <strong>Ephemeral Rollup</strong>
          </>
        );
      case "vrf":
        return (
          <>
            Fair pulse via <strong>MagicBlock VRF</strong>
          </>
        );
      case "waiting":
        return "Wait for the pulse — no early tap";
      case "go":
        return (
          <>
            <strong>GO</strong> — tap now
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
            Commit → <strong>Solana base layer</strong>
          </>
        );
      default:
        return "";
    }
  }, [phase, ms]);

  function createRoom() {
    setRoomCode(makeRoomCode());
    setScreen("lobby");
    setPhase("idle");
    setYouScore(0);
    setOppScore(0);
    setMs(null);
  }

  function joinRoom() {
    const code = joinInput.trim().toUpperCase();
    if (code.length < 3) return;
    setRoomCode(code);
    setScreen("lobby");
    setPhase("idle");
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
    }, 1800 + 800 + Math.random() * 1200);
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
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div className="brand-text">
            <span className="brand-name">Pulse</span>
            <span className="brand-sub">Blitz · MagicBlock</span>
          </div>
        </div>
        <span
          className={`chip ${
            phase === "go" || phase === "waiting" ? "live" : ""
          }`}
        >
          {screen === "arena" ? "ER Live" : "Devnet"}
        </span>
      </header>

      {screen === "home" && (
        <main className="stage">
          <div className="hero">
            <p className="eyebrow">Solana Blitz v6 · Mobile</p>
            <h1>
              Feel the <span>pulse</span>.
              <br />
              Tap first.
            </h1>
            <p>
              Real-time mobile reaction battles. Gasless rounds on Ephemeral
              Rollups. Fair starts with VRF.
            </p>
          </div>

          <div className="tech-row">
            <span className="tech er">Ephemeral Rollup</span>
            <span className="tech hot">VRF fair start</span>
            <span className="tech">Mobile-first</span>
            <span className="tech pink">Solana settle</span>
          </div>

          <div className="card stack">
            <div className="card-head">
              <div className="card-icon blue">01</div>
              <div>
                <h2 style={{ margin: 0 }}>Start a battle</h2>
                <p>UI shell — wallet + chain after theme lock.</p>
              </div>
            </div>
            <Btn onClick={createRoom}>Create room</Btn>
            <div className="row">
              <input
                className="input"
                placeholder="CODE"
                value={joinInput}
                maxLength={6}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                aria-label="Room code"
              />
            </div>
            <Btn
              variant="secondary"
              onClick={joinRoom}
              disabled={joinInput.trim().length < 3}
            >
              Join room
            </Btn>
          </div>

          <div className="card tint-orange">
            <div className="card-head">
              <div className="card-icon orange">//</div>
              <h2 style={{ margin: 0 }}>Demo path</h2>
            </div>
            <ul className="steps">
              <li>
                <span className="step-num">1</span>
                <span>Create room on phone</span>
              </li>
              <li>
                <span className="step-num">2</span>
                <span>Delegate room → MagicBlock ER</span>
              </li>
              <li>
                <span className="step-num">3</span>
                <span>VRF picks fair pulse moment</span>
              </li>
              <li>
                <span className="step-num">4</span>
                <span>TAP on ER — settle to Solana</span>
              </li>
            </ul>
          </div>

          <p className="footer-note">Theme: Sui Overflow system · TWK Everett</p>
        </main>
      )}

      {screen === "lobby" && (
        <main className="stage">
          <div className="hero">
            <p className="eyebrow">Room ready</p>
            <h1>
              Share
              <br />
              the code.
            </h1>
            <p>Solo works — ghost opponent fills the slot for demo.</p>
          </div>

          <div className="room-code-xl">{roomCode}</div>

          <div className="scoreboard">
            <div className="score-card you">
              <div className="label">You</div>
              <div className="value">Ready</div>
            </div>
            <div className="score-card opp">
              <div className="label">Opponent</div>
              <div className="value">Ghost</div>
            </div>
          </div>

          <div className="card tint-gray">
            <div className="card-head">
              <div className="card-icon gray">ER</div>
              <div>
                <h2 style={{ margin: 0 }}>MagicBlock flow</h2>
                <p>
                  Next: <strong>delegate</strong> room account, then taps hit
                  the ER RPC.
                </p>
              </div>
            </div>
          </div>

          <div className="stack">
            <Btn onClick={startRound}>Start round</Btn>
            <Btn variant="ghost" onClick={backHome}>
              Leave room
            </Btn>
          </div>
        </main>
      )}

      {screen === "arena" && (
        <main className="stage">
          <div className="status-line">{statusText}</div>

          <div className="arena">
            <div
              className={`pulse-ring ${
                phase === "go"
                  ? "ready"
                  : phase === "waiting" || phase === "vrf"
                    ? "waiting"
                    : ""
              }`}
            >
              <button
                type="button"
                className="tap-btn"
                disabled={phase !== "go"}
                onClick={onTap}
              >
                TAP
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

            <div className="tech-row">
              <span className="tech er">ER session</span>
              <span className="tech">Room {roomCode}</span>
            </div>
          </div>
        </main>
      )}

      {screen === "result" && (
        <main className="stage">
          <div className={`result-banner ${won ? "win" : ""}`}>
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
            </div>
            <div className="score-card opp">
              <div className="label">Opp</div>
              <div className="value">{oppScore}</div>
            </div>
          </div>

          <div className="card tint-pink">
            <div className="card-head">
              <div className="card-icon pink">MB</div>
              <div>
                <h2 style={{ margin: 0 }}>Judge line</h2>
                <p>
                  Mobile UX + gasless real-time state + verifiable fairness —
                  only works because of MagicBlock ER + VRF.
                </p>
              </div>
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

      <footer className="dock">
        <div className="dock-left">
          {screen === "home" && "Overflow theme"}
          {screen === "lobby" && `Room ${roomCode}`}
          {screen === "arena" && statusText}
          {screen === "result" && (won ? "Victory" : "Retry")}
        </div>
        <div className="dock-right">
          {screen === "home" && (
            <button type="button" onClick={createRoom}>
              Create <ArrowIcon />
            </button>
          )}
          {screen === "lobby" && (
            <button type="button" onClick={startRound}>
              Start <ArrowIcon />
            </button>
          )}
          {screen === "arena" && (
            <button type="button" onClick={phase === "go" ? onTap : undefined}>
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
    </div>
  );
}
