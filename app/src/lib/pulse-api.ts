/**
 * PULSE game client — mock by default, on-chain when wallet + program ready.
 */

import { config } from "./config";
import { makeRoomCode, saveSession } from "./session-store";
import type { RoomState, RoundPhase, RoundState } from "./types";
import {
  onchainCreateRoom,
  onchainJoinRoom,
  onchainStartRound,
  onchainTapSolo,
  onchainSettle,
  fetchRoom,
} from "./pulse-onchain";
import { getConnectedPublicKey } from "./wallet";

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
    displayName: "You",
    isGhost: false,
    ready: true,
    score: 0,
    reactionMs: null,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Create room — on-chain when wallet connected */
export async function createRoom(hostPk: string | null): Promise<RoomState> {
  const pk = hostPk || getConnectedPublicKey();
  if (pk && config.programId) {
    try {
      const { room, signature } = await onchainCreateRoom(pk);
      console.info("[pulse] create_room", signature, room.code);
      return room;
    } catch (e) {
      console.warn("[pulse] create_room on-chain failed → mock", e);
    }
  }
  const code = makeRoomCode(4);
  const room: RoomState = {
    code,
    host: pk,
    status: "ready",
    you: youSeat(pk),
    opponent: ghostSeat(),
    createdAt: Date.now(),
  };
  saveSession({ lastRoomCode: code, room });
  return room;
}

export async function joinRoom(
  code: string,
  playerPk: string | null,
): Promise<RoomState> {
  const clean = code.trim().toUpperCase();
  if (clean.length < 3) throw new Error("Invalid room code");
  const pk = playerPk || getConnectedPublicKey();

  if (pk && config.programId) {
    try {
      const { room, signature } = await onchainJoinRoom(clean, pk);
      console.info("[pulse] join_room", signature, room.code);
      return room;
    } catch (e) {
      console.warn("[pulse] join_room on-chain failed", e);
      throw e instanceof Error
        ? e
        : new Error("Could not join room on-chain");
    }
  }

  // Offline / no wallet: local-only join (not shared with host)
  const room: RoomState = {
    code: clean,
    host: null,
    status: "ready",
    you: youSeat(pk),
    opponent: ghostSeat("Host"),
    createdAt: Date.now(),
  };
  saveSession({ lastRoomCode: clean, room });
  return room;
}

/** Poll room from chain (lobby refresh) */
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
};

/**
 * Start a round through phases. Calls on-chain start_round when possible.
 */
export async function runRound(
  roomCode: string,
  cb: RoundCallbacks,
): Promise<RoundState> {
  const pk = getConnectedPublicKey();
  const sigs: RoundState["sigs"] = {};

  cb.onPhase("delegating");
  await sleep(500);

  cb.onPhase("vrf");
  if (pk && config.programId) {
    try {
      // go_delay_ms=0 — client still does UX wait for tension
      sigs.vrf = await onchainStartRound(roomCode, pk, 0);
      console.info("[pulse] start_round", sigs.vrf);
    } catch (e) {
      console.warn("[pulse] start_round failed → continue mock phases", e);
      sigs.vrf = "mock-start";
    }
  } else {
    sigs.vrf = "mock-start";
  }
  await sleep(600);

  cb.onPhase("waiting");
  await sleep(700 + Math.random() * 900);

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
    sigs,
  };
}

/** @deprecated use runRound */
export const runMockRound = runRound;

export function resolveTap(round: RoundState, reactionMs: number): RoundState {
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
    sigs: { ...round.sigs },
  };
}

/**
 * After tap: write scores on-chain (tap_solo + settle) when wallet present.
 */
export async function settleRound(round: RoundState): Promise<RoundState> {
  const pk = getConnectedPublicKey();
  const hostMs = round.youMs ?? 1;
  const ghostMs = round.oppMs ?? 200;
  const sigs = { ...round.sigs };

  if (pk && config.programId && round.roomCode) {
    try {
      sigs.tap = await onchainTapSolo(round.roomCode, pk, hostMs, ghostMs);
      console.info("[pulse] tap_solo", sigs.tap);
      sigs.settle = await onchainSettle(round.roomCode, pk);
      console.info("[pulse] settle", sigs.settle);
    } catch (e) {
      console.warn("[pulse] settle path failed", e);
      sigs.settle = "mock-settle";
    }
  } else {
    await sleep(400);
    sigs.settle = "mock-settle";
  }

  return {
    ...round,
    phase: "done",
    sigs,
  };
}

export function isMockMode(): boolean {
  return !getConnectedPublicKey() || !config.programId;
}
