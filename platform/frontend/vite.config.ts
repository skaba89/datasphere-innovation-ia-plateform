import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('/src/pages/CalculatorPage') ||
              id.includes('/src/pages/PricingPage')    ||
              id.includes('/src/pages/SettingsPage')   ||
              id.includes('/src/pages/AuditLogPage')   ||
              id.includes('/src/pages/DataExportPage') ||
              id.includes('/src/pages/WorkspacesPage') ||
              id.includes('/src/pages/TeamPage')       ||
              id.includes('/src/pages/UserProfilePage')) {
            return 'pages-secondary';
          }
          if (id.includes('/src/i18n')) {
            return 'i18n';
          }
        },
      },
    },
  },
});
