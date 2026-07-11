/**
 * Lightweight client session — survives refresh for room code + last wallet.
 * Not a server session; identity = wallet pubkey when connected.
 */

import type { RoomState, WalletSession } from "./types";

const KEY = "pulse:session:v1";

export type StoredSession = {
  wallet: WalletSession | null;
  lastRoomCode: string | null;
  room: RoomState | null;
};

function empty(): StoredSession {
  return { wallet: null, lastRoomCode: null, room: null };
}

export function loadSession(): StoredSession {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) } as StoredSession;
  } catch {
    return empty();
  }
}

export function saveSession( partial: Partial<StoredSession>): StoredSession {
  const next = { ...loadSession(), ...partial };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function makeRoomCode(len = 4): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
