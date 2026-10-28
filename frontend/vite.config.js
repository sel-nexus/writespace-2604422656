/** Configure the browser build and isolated DOM tests. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: { host: env.DEV_HOST || '0.0.0.0', port: Number(env.DEV_PORT || 5173) },
    test: {
      globals: true, environment: 'jsdom', setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'], pool: 'forks', poolOptions: { forks: { singleFork: true } },
      coverage: { reporter: ['text', 'json-summary'], include: ['src/utils/*.js'] }
    }
  };
});
