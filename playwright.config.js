'use strict';
const os = require('node:os');
const path = require('node:path');
const { defineConfig } = require('@playwright/test');
const port = 48371;
module.exports = defineConfig({
  testDir: './e2e', timeout: 30_000, retries: 0, reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', headless: true },
  webServer: {
    command: 'node server.js', url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: true, timeout: 30_000,
    env: { PORT: String(port), NODE_ENV: 'test', DB_PATH: path.join(os.tmpdir(), `nestnavigator-e2e-${process.pid}.sqlite`) }
  }
});










