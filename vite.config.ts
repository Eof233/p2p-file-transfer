import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/p2p-file-transfer/',
  server: {
    port: 3000,
  },
});
