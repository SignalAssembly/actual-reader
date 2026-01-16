import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  server: {
    port: 5174, // Different port than React version
  },
  build: {
    outDir: '../dist-solid',
  },
})
