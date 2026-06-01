import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Where the dev server forwards /api requests. Point this at the NAS backend
  // (e.g. http://192.168.1.50:5000). Keeping the browser on localhost:5173 and
  // proxying server-side means requests stay same-origin, so the httpOnly auth
  // cookie works over plain HTTP without HTTPS/sameSite=none.
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
