import { defineConfig } from '@playwright/test'

// UI smoke tests drive the built app (npm run build first). Native dialogs are
// stubbed in the main process by each test.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' }
})
