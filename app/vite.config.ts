import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Hosted on agentr.online VM under /sites/pulse/
  base: '/sites/pulse/',
})
