import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    // Tauri/Cargo writes transient .exe/.dll files while Rust is compiling.
    // Watching them on Windows may crash Vite with EBUSY (UV_FSWatcher).
    // Tauri itself watches src-tauri: Vite must watch frontend files only.
    watch: {
      ignored: [
        '**/src-tauri/**',
        '**/target/**',
        '**/.vs/**',
      ],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: { target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'es2022' },
});
