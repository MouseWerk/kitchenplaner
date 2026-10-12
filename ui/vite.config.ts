import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port in dev and serves the built files in release.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1430, strictPort: true, host: "127.0.0.1" },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    // three.js alone is ~700 kB; the app is loaded from disk, not over a network.
    chunkSizeWarningLimit: 1500,
  },
});
