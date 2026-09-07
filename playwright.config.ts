import {defineConfig,devices} from "@playwright/test";

export default defineConfig({
  testDir:"e2e",
  fullyParallel:false,
  forbidOnly:!!process.env.CI,
  retries:process.env.CI?1:0,
  workers:1,
  reporter:process.env.CI?"github":"list",
  use:{
    baseURL:process.env.PLAYWRIGHT_BASE_URL||"http://127.0.0.1:8790",
    trace:"on-first-retry",
  },
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
  globalSetup:"./e2e/global-setup.ts",
  webServer:process.env.PLAYWRIGHT_SKIP_WEBSERVER?undefined:{
    command:"pnpm start",
    url:"http://127.0.0.1:8790/api/health",
    reuseExistingServer:!process.env.CI,
    timeout:120_000,
    env:{
      ...process.env,
      PORT:"8790",
      HOSTNAME:"127.0.0.1",
    },
  },
});
