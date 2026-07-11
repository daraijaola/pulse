/** Public scaffold surface for FE wiring */
export { config, shortPk } from "./config";
export * from "./types";
export {
  loadSession,
  saveSession,
  clearSession,
  makeRoomCode,
} from "./session-store";
export { getBaseConnection, getRouterConnection, pingBase } from "./solana";
export { getErConnection, getErValidatorPubkey, pingEr } from "./er";
export {
  connectWallet,
  disconnectWallet,
  getConnectedPublicKey,
  isWalletAvailable,
} from "./wallet";
export {
  createRoom,
  joinRoom,
  runMockRound,
  resolveTap,
  settleRound,
  isMockMode,
} from "./pulse-api";
