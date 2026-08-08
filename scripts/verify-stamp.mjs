/**
 * Verification gate for the §12 anti-AI-cheat requirement:
 * open a generated Playwright HTML report the way a TA would, and confirm that
 * "Run by: {StudentID}" and an ISO timestamp are VISIBLE on the rendered page
 * (not merely present in the embedded report data).
 *
 * Usage: node scripts/verify-stamp.mjs [reportDir] [studentId]
 */
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const reportDir = process.argv[2] ?? 'reports/_smoke';
const runBy = process.argv[3] ?? '23127396';
const indexUrl = pathToFileURL(path.resolve(reportDir, 'index.html')).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(indexUrl);
await page.waitForSelector('text=/Run by/i', { timeout: 10_000 });

const bodyText = await page.locator('body').innerText();
const hasRunBy = bodyText.includes(`Run by: ${runBy}`);
const isoMatch = bodyText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);

const shot = path.join(reportDir, 'stamp-verification.png');
await page.screenshot({ path: shot, fullPage: false });
await browser.close();

console.log(`report      : ${indexUrl}`);
console.log(`"Run by: ${runBy}" visible : ${hasRunBy ? 'YES' : 'NO'}`);
console.log(`ISO timestamp visible      : ${isoMatch ? isoMatch[0] : 'NO'}`);
console.log(`screenshot  : ${shot}`);

if (!hasRunBy || !isoMatch) {
  console.error('\nFAIL — the report does not visibly carry the required stamp.');
  process.exit(1);
}
console.log('\nOK — report satisfies the "Run by: {StudentID}" + ISO timestamp requirement.');
