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
    chunkSizeWarningLimit: 400,

    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // React core — smallest possible vendor chunk
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Icons — large lib, separate chunk
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Recharts — used only on Dashboard
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-')) {
            return 'vendor-charts';
          }
          // i18n — tiny, separate for caching
          if (id.includes('/src/i18n')) {
            return 'i18n';
          }
          // Heavy pages — lazy load candidates
          if (id.includes('/src/pages/SettingsPage') ||
              id.includes('/src/pages/ConsultantProfilesPage')) {
            return 'pages-heavy';
          }
          // Secondary pages — rarely visited
          if (id.includes('/src/pages/CalculatorPage') ||
              id.includes('/src/pages/PricingPage')    ||
              id.includes('/src/pages/AuditLogPage')   ||
              id.includes('/src/pages/DataExportPage') ||
              id.includes('/src/pages/WorkspacesPage') ||
              id.includes('/src/pages/TeamPage')       ||
              id.includes('/src/pages/LinkedInAgentPage') ||
              id.includes('/src/pages/UserProfilePage')) {
            return 'pages-secondary';
          }
          // Auth pages
          if (id.includes('/src/pages/ForgotPasswordPage') ||
              id.includes('/src/pages/ResetPasswordPage')) {
            return 'pages-auth';
          }
        },
      },
    },
  },
});
