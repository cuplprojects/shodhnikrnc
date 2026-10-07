import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // RNC is served under /rnc/* behind the gateway (see Gateway/appsettings.*.json
  // and the Shodhanik-x-RNC integration plan, §9.2). Without this, index.html's
  // root-relative asset paths (e.g. /src/main.jsx) resolve against the gateway's
  // origin root instead of /rnc/, which the gateway then routes to Shodhanik's UI
  // instead of RNC's -- the two apps' JS getting silently swapped under one page.
  base: '/rnc/',
})
