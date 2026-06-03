import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration — DataSphere Innovation IA Platform
 *
 * Key feature: proxy /api → backend in dev mode.
 * This is an ALTERNATIVE to setting CORS_ORIGINS on the backend.
 *
 * With this proxy active, the frontend calls /api/v1/... (relative URL)
 * and Vite forwards them to the backend — no cross-origin request, no CORS issue.
 *
 * To use the proxy, set in .env.local:
 *   VITE_USE_PROXY=true
 *   # VITE_API_BASE_URL stays unset (or empty) — proxy handles it
 *
 * To NOT use the proxy (call backend directly), set:
 *   VITE_API_BASE_URL=http://localhost:8000/api/v1
 */

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:8000';
const USE_PROXY   = process.env.VITE_USE_PROXY === 'true';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    host: true, // Allow access from all interfaces (useful in Docker)

    // Dev proxy: optional but eliminates CORS issues entirely
    ...(USE_PROXY && {
      proxy: {
        '/api': {
          target:      BACKEND_URL,
          changeOrigin: true,
          secure:      false,
        },
      },
    }),
  },

  build: {
    outDir:  'dist',
    sourcemap: false,
  },
});
