import { defineConfig, devices } from '@playwright/test';

/**
 * HW04 — AI Automation Testing on the EShop SUT
 * Student: Luong Linh Khoi — 23127396
 *
 * Anti-AI-cheat requirement (§12 of the brief): every generated HTML report must visibly
 * carry "Run by: {StudentID}" together with an ISO timestamp. That is stamped three ways:
 *   1. the HTML reporter `title` (rendered as the report header),
 *   2. `metadata` (rendered in the report's metadata block),
 *   3. a per-test annotation added in tests/_hooks (so it survives any reporter change).
 */
export const RUN_BY = process.env.RUN_BY ?? '23127396';
export const FEATURE = process.env.FEATURE ?? 'ALL';
export const STARTED_AT = new Date().toISOString();

const HTML_OUT = process.env.HTML_OUT ?? 'reports/local';

export default defineConfig({
  testDir: './tests',

  // The SUT is a single shared SQLite database; parallel workers would race on it.
  // Serial execution is a deliberate trade-off, documented in the report.
  fullyParallel: false,
  workers: 1,

  // No retries on purpose: a flaky result is a finding to report, not noise to hide.
  retries: 0,

  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: [
    ['list'],
    ['html', {
      outputFolder: HTML_OUT,
      open: 'never',
      title: `Run by: ${RUN_BY} — ${FEATURE} — ${STARTED_AT}`,
    }],
    ['json', { outputFile: `${HTML_OUT}/results.json` }],
  ],

  metadata: {
    'Run by': RUN_BY,
    'Student ID': RUN_BY,
    'Student name': 'Luong Linh Khoi',
    Feature: FEATURE,
    'Run at (ISO)': STARTED_AT,
  },

  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
