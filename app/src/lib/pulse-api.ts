/**
 * PULSE game client — minimal Phantom signing.
 *
 * Setup (once): create_room / join_room
 * Match: dual-ready + countdown off-chain → play → ONE finish_match sign
 * Multi fair scores: optional per-player tap with auto-settle (fallback)
 */

import { config } from "./config";
import type { RoomState, RoundPhase, RoundState } from "./types";
import {
  onchainCreateRoom,
  onchainJoinRoom,
  onchainStartRound,
  onchainTap,
  onchainFinishMatch,
  fetchRoom,
  fetchRoomRaw,
} from "./pulse-onchain";
import { getConnectedPublicKey } from "./wallet";
import {
  playCountdownBeep,
  playGoBeep,
  unlockAudio,
} from "./sfx";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function createRoom(hostPk: string | null): Promise<RoomState> {
  const pk = hostPk || getConnectedPublicKey();
  if (!pk) {
    throw new Error("Connect wallet first (use Open in Phantom on mobile).");
  }
  if (!config.programId) throw new Error("Program id missing.");
  const { room, signature } = await onchainCreateRoom(pk);
  console.info("[pulse] create_room", signature, room.code);
  return room;
}

export async function joinRoom(
  code: string,
  playerPk: string | null,
): Promise<RoomState> {
  const clean = code.trim().toUpperCase();
  if (clean.length < 3) throw new Error("Invalid room code");
  const pk = playerPk || getConnectedPublicKey();
  if (!pk || !config.programId) {
    throw new Error(
      "Connect wallet first (Open in Phantom on mobile), then Join with the host code.",
    );
  }
  const { room, signature } = await onchainJoinRoom(clean, pk);
  console.info("[pulse] join_room", signature, room.code);
  return room;
}

export async function refreshRoom(
  code: string,
  viewerPk: string | null,
): Promise<RoomState | null> {
  if (!code || !config.programId) return null;
  try {
    return await fetchRoom(code, viewerPk || getConnectedPublicKey());
  } catch {
    return null;
  }
}

export type RoundCallbacks = {
  onPhase: (phase: RoundPhase) => void;
  /** 3 | 2 | 1 during countdown */
  onCountdown?: (n: number) => void;
};

/**
 * Signal "I'm ready". For multiplayer, only the second ready player
 * hits the chain (start_round) so the peer can detect LIVE and sync.
 * Solo skips chain start — finish_match works from READY.
 */
export async function signalReady(
  roomCode: string,
  opts: { multiplayer: boolean; alreadyLive?: boolean },
): Promise<{ sig?: string; live: boolean }> {
  const pk = getConnectedPublicKey();
  if (!pk || !config.programId) {
    throw new Error("Connect wallet to play on-chain.");
  }

  const raw = await fetchRoomRaw(roomCode);
  if (raw?.status === 2 /* LIVE */ || opts.alreadyLive) {
    return { live: true, sig: "already-live" };
  }

  if (!opts.multiplayer) {
    // Solo: no start_round — one finish_match later
    return { live: true };
  }

  // Multi: this client is claiming "start" — puts room LIVE for peer poll
  try {
    const sig = await onchainStartRound(roomCode, pk, 0);
    console.info("[pulse] start_round (ready signal)", sig);
    return { live: true, sig };
  } catch (e) {
    const again = await fetchRoomRaw(roomCode);
    if (again?.status === 2) return { live: true, sig: "already-live" };
    throw e instanceof Error ? e : new Error("Could not signal ready on-chain");
  }
}

/**
 * Poll until room is LIVE (peer pressed Start) or timeout.
 */
export async function waitForPeerLive(
  roomCode: string,
  timeoutMs = 120_000,
  onTick?: () => void,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    onTick?.();
    const raw = await fetchRoomRaw(roomCode);
    if (raw?.status === 2) return true;
    if (raw?.status === 3) return false; // settled somehow
    await sleep(1200);
  }
  return false;
}

/**
 * Shared 3-2-1 countdown with audio, then GO.
 * No wallet prompts.
 */
export async function runCountdown(
  cb: RoundCallbacks,
): Promise<RoundState> {
  unlockAudio();
  cb.onPhase("countdown");

  for (const n of [3, 2, 1] as const) {
    cb.onCountdown?.(n);
    playCountdownBeep(n);
    await sleep(900);
  }

  playGoBeep();
  const goAt = performance.now();
  cb.onPhase("go");
  cb.onCountdown?.(0);

  return {
    roomCode: "",
    phase: "go",
    goAtMs: goAt,
    youScore: 0,
    oppScore: 0,
    youMs: null,
    oppMs: null,
    winner: null,
    sigs: {},
  };
}

/** @deprecated */
export async function runRound(
  roomCode: string,
  cb: RoundCallbacks,
): Promise<RoundState> {
  const ready = await signalReady(roomCode, { multiplayer: true });
  const round = await runCountdown(cb);
  return { ...round, roomCode, sigs: { vrf: ready.sig } };
}

export const runMockRound = runRound;

export function resolveTap(round: RoundState, reactionMs: number): RoundState {
  const ms = Math.max(1, reactionMs);
  const ghostMs = 120 + Math.floor(Math.random() * 280);
  const youScore = Math.max(10, 1000 - ms);
  const oppScore = Math.max(10, 1000 - ghostMs);
  const winner = ms === ghostMs ? "draw" : ms < ghostMs ? "you" : "opp";
  return {
    ...round,
    phase: "tapped",
    youMs: ms,
    oppMs: ghostMs,
    youScore,
    oppScore,
    winner,
    sigs: { ...round.sigs },
  };
}

function winnerFromChain(
  viewerPk: string,
  host: string,
  winner: number,
): "you" | "opp" | "draw" | null {
  if (winner === 3) return "draw";
  if (winner === 0) return null;
  const hostWins = winner === 1;
  const youAreHost = viewerPk === host;
  if (hostWins) return youAreHost ? "you" : "opp";
  return youAreHost ? "opp" : "you";
}

/**
 * After the local match: ONE signature.
 * - Solo: finish_match(host, ghost)
 * - Multi: each player submits their tap (auto-settles when both present);
 *   if you're host and peer already tapped, finish_match as fallback.
 */
export async function settleRound(
  round: RoundState,
  opts?: { multiplayer?: boolean; isHost?: boolean },
): Promise<RoundState> {
  const pk = getConnectedPublicKey();
  const youMs = Math.max(1, round.youMs ?? 1);
  const ghostMs = Math.max(1, round.oppMs ?? 200);
  const sigs = { ...round.sigs };

  if (!pk || !config.programId || !round.roomCode) {
    await sleep(300);
    return { ...round, phase: "done", sigs: { ...sigs, settle: "mock-settle" } };
  }

  const raw0 = await fetchRoomRaw(round.roomCode);
  const isMulti =
    opts?.multiplayer === true ||
    (!!raw0?.challenger && raw0.challenger !== null);
  const youAreHost = opts?.isHost ?? pk === raw0?.host;

  // ── Solo / ghost: single finish_match ─────────────────
  if (!isMulti) {
    const hostMs = youAreHost ? youMs : ghostMs;
    const challMs = youAreHost ? ghostMs : youMs;
    try {
      sigs.settle = await onchainFinishMatch(
        round.roomCode,
        pk,
        hostMs,
        challMs,
      );
      console.info("[pulse] finish_match (solo)", sigs.settle);
    } catch (e) {
      // Older program without finish_match — soft message
      console.warn("[pulse] finish_match failed", e);
      throw new Error(
        e instanceof Error
          ? e.message
          : "Could not lock result on-chain. Approve the settle in Phantom.",
      );
    }
    return { ...round, phase: "done", sigs };
  }

  // ── Multiplayer: submit your score (1 sign); auto-settle when both in ──
  try {
    sigs.tap = await onchainTap(round.roomCode, pk, youMs);
    console.info("[pulse] tap", sigs.tap);
  } catch (e) {
    // Room may still be READY if start was skipped — use finish_match as host
    if (youAreHost) {
      try {
        sigs.settle = await onchainFinishMatch(
          round.roomCode,
          pk,
          youMs,
          ghostMs,
        );
        console.info("[pulse] finish_match fallback", sigs.settle);
        return { ...round, phase: "done", sigs };
      } catch {
        /* fall through */
      }
    }
    throw e instanceof Error ? e : new Error("Could not submit reaction");
  }

  // Wait for peer score / auto-settle
  let raw = await fetchRoomRaw(round.roomCode);
  const deadline = Date.now() + 30_000;
  while (
    raw &&
    raw.status !== 3 &&
    (raw.hostMs === 0 || raw.challMs === 0) &&
    Date.now() < deadline
  ) {
    await sleep(1000);
    raw = await fetchRoomRaw(round.roomCode);
  }

  // If both scores in but not settled (old program), host settles via finish_match
  if (raw && raw.status === 2 && raw.hostMs > 0 && raw.challMs > 0) {
    try {
      sigs.settle = await onchainFinishMatch(
        round.roomCode,
        pk,
        raw.hostMs,
        raw.challMs,
      );
      console.info("[pulse] finish_match after taps", sigs.settle);
      raw = await fetchRoomRaw(round.roomCode);
    } catch {
      /* auto-settle may have raced */
      raw = await fetchRoomRaw(round.roomCode);
    }
  }

  if (!raw || (raw.hostMs === 0 && raw.challMs === 0)) {
    throw new Error("Waiting for opponent score timed out.");
  }

  const final = raw;
  const yMs = youAreHost ? final.hostMs : final.challMs;
  const oMs = youAreHost ? final.challMs : final.hostMs;
  const yScore = youAreHost ? final.hostScore : final.challScore;
  const oScore = youAreHost ? final.challScore : final.hostScore;
  const winner = winnerFromChain(pk, final.host, final.winner);

  return {
    ...round,
    phase: "done",
    youMs: yMs || youMs,
    oppMs: oMs || null,
    youScore: yScore || round.youScore,
    oppScore: oScore || round.oppScore,
    winner: winner ?? round.winner,
    sigs,
  };
}

export function isMockMode(): boolean {
  return !getConnectedPublicKey() || !config.programId;
}
