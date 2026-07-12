import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vercel / root deploy: base "/"
// agentr.online subpath: VITE_BASE=/sites/pulse/ npm run build
const base = process.env.VITE_BASE || "/";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base,
});
