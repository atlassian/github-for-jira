import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Documentation: https://vitejs.dev/config/
 */
export default defineConfig({
  plugins: [react()],
	base: "/spa"
});
