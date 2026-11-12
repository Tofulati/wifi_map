import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Pre-bundled together so both share a single maplibre-gl instance (and its worker URL setting).
    include: ['maplibre-gl', 'react-map-gl/maplibre'],
  },
})
