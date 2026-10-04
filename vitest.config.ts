import { createRequire } from 'node:module'
import { defineConfig } from 'vitest/config'

// Tests run in UTC; `TEST_TZ` runs the date-sensitive suites in another zone
// (`test:tz`). Set before the workers fork, so they inherit it.
process.env.TZ = process.env.TEST_TZ ?? 'UTC'

const require = createRequire(import.meta.url)

export default defineConfig({
  resolve: {
    // Vite's resolver misses chrono-node's `./*` exports pattern; Node's
    // finds the same file the built CJS `require`s.
    alias: { 'chrono-node/en': require.resolve('chrono-node/en') },
  },
  test: {
    include: ['__tests__/**/*.test.ts'],
  },
})
