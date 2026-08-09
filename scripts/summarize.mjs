/**
 * Summarise a Playwright JSON report: per-project counts and the failing case IDs.
 * Used during development and by scripts/run-all.mjs to build the final test summary.
 *
 * Usage: node scripts/summarize.mjs <reportDir> [--ids]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] ?? 'reports/local';
const showIds = process.argv.includes('--ids');
const report = JSON.parse(readFileSync(path.join(dir, 'results.json'), 'utf8'));

/** Playwright nests suites arbitrarily deep; collect every spec regardless of depth. */
function collectSpecs(node, out = []) {
  for (const spec of node.specs ?? []) out.push(spec);
  for (const child of node.suites ?? []) collectSpecs(child, out);
  return out;
}

const specs = collectSpecs({ suites: report.suites });
const byProject = new Map();

for (const spec of specs) {
  for (const t of spec.tests ?? []) {
    const project = t.projectName ?? 'unknown';
    const status = t.results?.[t.results.length - 1]?.status ?? 'unknown';
    const bucket = byProject.get(project) ?? { passed: 0, failed: 0, other: 0, failedIds: [] };
    if (status === 'passed') bucket.passed++;
    else if (status === 'failed' || status === 'timedOut') {
      bucket.failed++;
      bucket.failedIds.push(spec.title.split(' ')[0]);
    } else bucket.other++;
    byProject.set(project, bucket);
  }
}

let total = { passed: 0, failed: 0, other: 0 };
for (const [project, b] of byProject) {
  total = { passed: total.passed + b.passed, failed: total.failed + b.failed, other: total.other + b.other };
  const ids = showIds && b.failedIds.length ? `  failed: ${b.failedIds.join(' ')}` : '';
  console.log(`${project.padEnd(10)} passed ${String(b.passed).padStart(3)}  failed ${String(b.failed).padStart(3)}${ids}`);
}
console.log(`${'TOTAL'.padEnd(10)} passed ${String(total.passed).padStart(3)}  failed ${String(total.failed).padStart(3)}`);

export { collectSpecs };
