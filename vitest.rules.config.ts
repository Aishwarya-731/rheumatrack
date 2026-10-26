import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/** Security Rules tests — run with `npm run test:rules` (starts the Firestore emulator; needs Java 21+). */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
