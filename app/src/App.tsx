import { useMemo, useState } from "react";
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
            Requesting fair pulse via <strong>MagicBlock VRF</strong>
          </>
        );
      case "waiting":
        return "Wait for the pulse… don’t early-tap";
      case "go":
        return (
          <>
            <strong>GO!</strong> Tap now
          </>
        );
      case "tapped":
        return ms != null ? (
          <>
            Reaction <strong>{ms}ms</strong> (UI preview)
          </>
        ) : (
          "Score locked"
        );
      case "settling":
        return (
          <>
            Committing result → <strong>Solana base layer</strong>
          </>
        );
      default:
        return "";
    }
  }, [phase, ms]);

  function createRoom() {
    const code = makeRoomCode();
    setRoomCode(code);
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

    // FE-only choreography so you can judge pacing/theme.
    // Real ER + VRF wiring lands after theme lock.
    window.setTimeout(() => setPhase("vrf"), 900);
    window.setTimeout(() => setPhase("waiting"), 1800);
    window.setTimeout(() => {
      setPhase("go");
      (window as unknown as { __pulseGoAt?: number }).__pulseGoAt = performance.now();
    }, 1800 + 800 + Math.random() * 1200);
  }

  function onTap() {
    if (phase !== "go") return;
    const goAt = (window as unknown as { __pulseGoAt?: number }).__pulseGoAt;
    const reaction = goAt ? Math.round(performance.now() - goAt) : 0;
    setMs(reaction);
    setPhase("tapped");
    setYouScore(reaction > 0 ? Math.max(10, 1000 - reaction) : 500);
    // ghost opponent for solo demo feel
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
            <span className="brand-name">PULSE</span>
            <span className="brand-sub">Solana · MagicBlock</span>
          </div>
        </div>
        <span className={`chip ${phase === "go" || phase === "waiting" ? "live" : ""}`}>
          {screen === "arena" ? "ER LIVE" : "DEVNET"}
        </span>
      </header>

      {screen === "home" && (
        <main className="stage">
          <div className="hero">
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
            <span className="tech">VRF fair start</span>
            <span className="tech">Mobile-first</span>
            <span className="tech">Solana settle</span>
          </div>

          <div className="card stack">
            <h2>Start a battle</h2>
            <p>UI shell only — wallet + onchain land after you lock theme.</p>
            <button type="button" className="btn btn-primary" onClick={createRoom}>
              Create room
            </button>
            <div className="row">
              <input
                className="input"
                placeholder="CODE"
                value={joinInput}
                maxLength={6}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                aria-label="Room code"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={joinRoom}
                disabled={joinInput.trim().length < 3}
              >
                Join
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Demo path</h2>
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
                <span>TAP — score on ER — settle Solana</span>
              </li>
            </ul>
          </div>

          <p className="footer-note">
            Solana Blitz v6 · Theme tokens in <code>src/theme.css</code>
          </p>
        </main>
      )}

      {screen === "lobby" && (
        <main className="stage">
          <div className="hero">
            <h1>
              Room <span>{roomCode}</span>
            </h1>
            <p>Share the code. Solo works — ghost opponent fills the slot for demo.</p>
          </div>

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

          <div className="card">
            <h2>MagicBlock flow</h2>
            <p>
              Next step will call <strong>delegate</strong> on the room account,
              then high-frequency taps hit the ER RPC.
            </p>
          </div>

          <div className="stack">
            <button type="button" className="btn btn-primary" onClick={startRound}>
              Start round
            </button>
            <button type="button" className="btn btn-ghost" onClick={backHome}>
              Leave room
            </button>
          </div>
        </main>
      )}

      {screen === "arena" && (
        <main className="stage">
          <div className="status-line">{statusText}</div>

          <div className="arena">
            <div
              className={`pulse-ring ${
                phase === "go" ? "ready" : phase === "waiting" || phase === "vrf" ? "waiting" : ""
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
          <div className="result-banner">
            <h2>{won ? "You won the pulse" : "Ghost edged you"}</h2>
            <p>
              {ms != null ? `Your reaction: ${ms}ms · ` : ""}
              UI preview scores — onchain settle next.
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

          <div className="card">
            <h2>Judge line</h2>
            <p>
              Mobile UX + gasless real-time state + verifiable fairness — only
              works because of MagicBlock ER + VRF.
            </p>
          </div>

          <div className="stack">
            <button type="button" className="btn btn-primary" onClick={startRound}>
              Play again
            </button>
            <button type="button" className="btn btn-ghost" onClick={backHome}>
              Home
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
