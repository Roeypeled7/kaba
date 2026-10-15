import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // נתיבים יחסיים — האתר עובד גם בתת-תיקייה (GitHub Pages: /kaba/)
  base: './',
  server: { port: 5180 },
  worker: { format: 'es' },
});
