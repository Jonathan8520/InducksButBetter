import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/InducksButBetter/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('cmdk') || id.includes('class-variance-authority')) {
              return 'ui-vendor';
            }
            if (id.includes('@libsql') || id.includes('hrana')) {
              return 'db-vendor';
            }
            if (id.includes('@mlc-ai') || id.includes('web-llm')) {
              return 'ai-vendor';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
