/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_CLUSTER?: string;
  readonly VITE_SOLANA_RPC?: string;
  readonly VITE_MAGIC_ROUTER_RPC?: string;
  readonly VITE_MAGIC_ROUTER_WS?: string;
  readonly VITE_ER_RPC?: string;
  readonly VITE_ER_WS?: string;
  readonly VITE_ER_VALIDATOR?: string;
  readonly VITE_PULSE_PROGRAM_ID?: string;
  readonly VITE_USE_MOCK_CHAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
