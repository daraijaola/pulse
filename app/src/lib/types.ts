/**
 * Shared domain types for PULSE sessions + rounds.
 * FE screens and future Anchor client should share these.
 */

export type ConnectionLayer = "base" | "er" | "router";

export type NetworkHealth = {
  base: "unknown" | "ok" | "error";
  er: "unknown" | "ok" | "error";
  baseSlot?: number;
  erSlot?: number;
  lastCheckedAt?: number;
  message?: string;
};

/** Browser wallet session (pubkey = identity) */
export type WalletSession = {
  publicKey: string;
  connectedAt: number;
  label?: string;
};

export type RoomStatus =
  | "open"
  | "ready"
  | "delegating"
  | "live"
  | "settling"
  | "closed";

export type RoundPhase =
  | "idle"
  | "delegating"
  | "vrf"
  | "waiting"
  | "go"
  | "tapped"
  | "settling"
  | "done";

export type PlayerSeat = {
  publicKey: string | null;
  displayName: string;
  isGhost: boolean;
  ready: boolean;
  score: number;
  reactionMs: number | null;
};

export type RoomState = {
  code: string;
  host: string | null;
  status: RoomStatus;
  you: PlayerSeat;
  opponent: PlayerSeat;
  createdAt: number;
};

export type RoundState = {
  roomCode: string;
  phase: RoundPhase;
  goAtMs: number | null;
  youScore: number;
  oppScore: number;
  youMs: number | null;
  oppMs: number | null;
  winner: "you" | "opp" | "draw" | null;
  /** base/er signatures when real chain is wired */
  sigs?: {
    delegate?: string;
    vrf?: string;
    tap?: string;
    settle?: string;
  };
};

export type PulseSessionSnapshot = {
  wallet: WalletSession | null;
  room: RoomState | null;
  round: RoundState | null;
  health: NetworkHealth;
  mock: boolean;
};
