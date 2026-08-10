/**
 * The official HW04 run: 3 features × 3 browsers = 9 browser runs, each producing its own
 * HTML report stamped "Run by: {StudentID}" + an ISO timestamp.
 *
 * For every combination it: reseeds the database, runs that feature on that engine, verifies
 * the report stamp, and records the counts. Finally it writes reports/summary.json, which is
 * the source for the README's test-summary table (numbers are never typed by hand).
 *
 * Usage:
 *   node scripts/run-all.mjs                 # all 9
 *   node scripts/run-all.mjs --feature FR-09 # one feature on all 3 engines
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const RUN_BY = process.env.RUN_BY ?? '23127396';
const FEATURES = ['FR-05', 'FR-09', 'FR-14'];
const BROWSERS = ['chromium', 'firefox', 'webkit'];

const argFeature = process.argv.includes('--feature')
  ? process.argv[process.argv.indexOf('--feature') + 1]
  : null;
const features = argFeature ? [argFeature] : FEATURES;

/**
 * Run Playwright's CLI entry point with this same node binary.
 *
 * Not `npx`: since Node 18.20/20.12, execFile refuses to spawn a `.cmd` shim without
 * `shell: true` (CVE-2024-27980), so `execFileSync('npx.cmd', …)` throws instantly on
 * Windows — and because the runner deliberately swallows the non-zero exit of a test run,
 * that failure was invisible until results.json turned up missing. Resolving the CLI module
 * removes both the shell and the PATH from the equation.
 */
const PLAYWRIGHT_CLI = createRequire(import.meta.url).resolve('@playwright/test/cli');

function countResults(reportDir) {
  const report = JSON.parse(readFileSync(path.join(reportDir, 'results.json'), 'utf8'));
  const specs = [];
  (function walk(node) {
    for (const s of node.specs ?? []) specs.push(s);
    for (const c of node.suites ?? []) walk(c);
  })({ suites: report.suites });

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failedIds = [];
  for (const spec of specs) {
    for (const t of spec.tests ?? []) {
      const status = t.results?.[t.results.length - 1]?.status;
      // A conditional test.skip() (e.g. FR-14 C09 when no seeded category still has products)
      // is neither a pass nor a defect. Folding it into `failed` would inflate the defect count
      // in the report, so skips are counted in their own column and reported as such.
      if (status === 'passed') passed++;
      else if (status === 'skipped') skipped++;
      else {
        failed++;
        failedIds.push(spec.title.split(' ')[0]);
      }
    }
  }
  return { total: passed + failed + skipped, passed, failed, skipped, failedIds };
}

mkdirSync('reports', { recursive: true });
const summary = { runBy: RUN_BY, generatedAt: new Date().toISOString(), runs: [] };

for (const feature of features) {
  for (const browser of BROWSERS) {
    const out = `reports/${feature}-${browser}`;
    const startedAt = new Date().toISOString();
    process.stdout.write(`\n=== ${feature} on ${browser} — ${startedAt} ===\n`);

    // Deterministic starting state for every single run.
    execSync('node backend/database.js', { stdio: 'ignore' });

    // NOTE: never pass --reporter here. A CLI --reporter REPLACES the config's reporter list,
    // which would silently discard the HTML report and results.json this run exists to produce.
    try {
      execFileSync(
        process.execPath,
        [PLAYWRIGHT_CLI, 'test', '--project=' + browser, '--grep', '@' + feature],
        { stdio: 'inherit', env: { ...process.env, HTML_OUT: out, FEATURE: feature, RUN_BY } },
      );
    } catch (err) {
      // A non-zero exit just means some tests failed — expected on a deliberately-buggy SUT.
      // Anything else (the CLI never started) must not be mistaken for "tests failed".
      if (typeof err.status !== 'number') {
        console.error(`\nFATAL: could not run Playwright for ${feature}/${browser}:`, err.message);
        process.exit(1);
      }
    }

    // Distinguish "the suite ran and some tests failed" from "the suite never produced a report".
    if (!existsSync(path.join(out, 'results.json'))) {
      console.error(`\nFATAL: ${out}/results.json was not produced — the run did not complete.`);
      process.exit(1);
    }

    const counts = countResults(out);

    // Gate: the report must visibly carry the student ID and an ISO timestamp (§12).
    let stamped = true;
    try {
      execFileSync('node', ['scripts/verify-stamp.mjs', out, RUN_BY], { stdio: 'inherit' });
    } catch {
      stamped = false;
    }

    summary.runs.push({ feature, browser, startedAt, report: `${out}/index.html`, stamped, ...counts });
  }
}

const totals = summary.runs.reduce(
  (acc, r) => ({
    executions: acc.executions + r.total,
    passed: acc.passed + r.passed,
    failed: acc.failed + r.failed,
    skipped: acc.skipped + r.skipped,
  }),
  { executions: 0, passed: 0, failed: 0, skipped: 0 },
);
summary.totals = { ...totals, browserRuns: summary.runs.length };
// `generatedAt` is set when the batch STARTS (it is the object's creation time), so record the
// end explicitly rather than letting the landing page imply the wrong one.
summary.completedAt = new Date().toISOString();

writeFileSync('reports/summary.json', JSON.stringify(summary, null, 2));
console.log('\n===== SUMMARY =====');
for (const r of summary.runs) {
  console.log(
    `${r.feature} ${r.browser.padEnd(9)} ${String(r.passed).padStart(2)} passed  ` +
      `${String(r.failed).padStart(2)} failed  ${String(r.skipped).padStart(2)} skipped  ` +
      `stamp:${r.stamped ? 'OK' : 'MISSING'}`,
  );
}
console.log(
  `TOTAL ${summary.totals.browserRuns} browser runs · ${totals.executions} executions · ` +
    `${totals.passed} passed · ${totals.failed} failed · ${totals.skipped} skipped`,
);
console.log('written: reports/summary.json');

// The landing page (D3) must agree with the run that just happened, so it is regenerated here
// rather than being a step someone can forget.
execFileSync('node', ['scripts/make-report-index.mjs'], { stdio: 'inherit' });
