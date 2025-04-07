import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  assetsInclude: [
    // Add model files patterns to be treated as assets
    '**/models/*-shard*',
    '**/models/*-weights_manifest.json'
  ]
})
