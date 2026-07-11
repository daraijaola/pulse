/**
 * PULSE game client API.
 * Mock implementation now — swap bodies for Anchor + ER when program is live.
 * Arena/Result FE should call only these methods (stable surface).
 */

import { config } from "./config";
import { makeRoomCode, saveSession } from "./session-store";
import type { RoomState, RoundPhase, RoundState } from "./types";

function ghostSeat(name = "Ghost"): RoomState["opponent"] {
  return {
    publicKey: null,
    displayName: name,
    isGhost: true,
    ready: true,
    score: 0,
    reactionMs: null,
  };
}

function youSeat(pk: string | null): RoomState["you"] {
  return {
    publicKey: pk,
    displayName: pk ? "You" : "You",
    isGhost: false,
    ready: true,
    score: 0,
    reactionMs: null,
  };
}

/** Create a local room (mock host) */
export async function createRoom(hostPk: string | null): Promise<RoomState> {
  const code = makeRoomCode(4);
  const room: RoomState = {
    code,
    host: hostPk,
    status: "ready",
    you: youSeat(hostPk),
    opponent: ghostSeat(),
    createdAt: Date.now(),
  };
  saveSession({ lastRoomCode: code, room });
  return room;
}

/** Join by code (mock — always succeeds if code length ok) */
export async function joinRoom(
  code: string,
  playerPk: string | null,
): Promise<RoomState> {
  const clean = code.trim().toUpperCase();
  if (clean.length < 3) throw new Error("Invalid room code");
  const room: RoomState = {
    code: clean,
    host: null,
    status: "ready",
    you: youSeat(playerPk),
    opponent: ghostSeat("Host"),
    createdAt: Date.now(),
  };
  saveSession({ lastRoomCode: clean, room });
  return room;
}

/**
 * Mock round pipeline matching FE phases.
 * Real path later: delegate → VRF request → wait → GO → tap ix → settle.
 */
export type RoundCallbacks = {
  onPhase: (phase: RoundPhase) => void;
};

export async function runMockRound(
  roomCode: string,
  cb: RoundCallbacks,
): Promise<RoundState> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  cb.onPhase("delegating");
  await sleep(700);
  cb.onPhase("vrf");
  await sleep(800);
  cb.onPhase("waiting");
  // fair-ish delay stand-in for VRF
  await sleep(600 + Math.random() * 900);
  const goAt = performance.now();
  cb.onPhase("go");

  return {
    roomCode,
    phase: "go",
    goAtMs: goAt,
    youScore: 0,
    oppScore: 0,
    youMs: null,
    oppMs: null,
    winner: null,
    sigs: config.useMockChain
      ? { delegate: "mock-delegate", vrf: "mock-vrf" }
      : undefined,
  };
}

/** Resolve scores after user tap (ghost reaction for solo) */
export function resolveTap(
  round: RoundState,
  reactionMs: number,
): RoundState {
  const ghostMs = 120 + Math.floor(Math.random() * 280);
  const youScore = Math.max(10, 1000 - reactionMs);
  const oppScore = Math.max(10, 1000 - ghostMs);
  const winner =
    reactionMs === ghostMs ? "draw" : reactionMs < ghostMs ? "you" : "opp";
  return {
    ...round,
    phase: "tapped",
    youMs: reactionMs,
    oppMs: ghostMs,
    youScore,
    oppScore,
    winner,
    sigs: {
      ...round.sigs,
      tap: config.useMockChain ? "mock-tap" : undefined,
    },
  };
}

export async function settleRound(round: RoundState): Promise<RoundState> {
  // Real: commit + undelegate on ER → base
  await new Promise((r) => setTimeout(r, 500));
  return {
    ...round,
    phase: "done",
    sigs: {
      ...round.sigs,
      settle: config.useMockChain ? "mock-settle" : undefined,
    },
  };
}

export function isMockMode(): boolean {
  return config.useMockChain || !config.programId;
}
