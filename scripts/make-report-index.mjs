/**
 * Build reports/index.html — the landing page for the 9 official browser runs.
 *
 * The §12 stamp requirement applies to what a TA actually opens, so this page carries the
 * "Run by: {StudentID}" banner and an ISO timestamp itself, in addition to the per-run reports
 * it links to. Every number comes from reports/summary.json; nothing here is typed by hand.
 *
 * Usage: node scripts/make-report-index.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SUMMARY = 'reports/summary.json';
if (!existsSync(SUMMARY)) {
  console.error(`${SUMMARY} not found — run "node scripts/run-all.mjs" first.`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(SUMMARY, 'utf8'));
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rows = summary.runs
  .map((r) => {
    const skipped = r.skipped ?? 0;
    return `      <tr>
        <td>${esc(r.feature)}</td>
        <td>${esc(r.browser)}</td>
        <td class="num">${r.total}</td>
        <td class="num pass">${r.passed}</td>
        <td class="num fail">${r.failed}</td>
        <td class="num">${skipped}</td>
        <td><time>${esc(r.startedAt)}</time></td>
        <td>${r.stamped ? '<span class="ok">stamped</span>' : '<span class="fail">MISSING</span>'}</td>
        <td><a href="${esc(r.feature)}-${esc(r.browser)}/index.html">open report</a></td>
      </tr>`;
  })
  .join('\n');

const t = summary.totals;
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Run by: ${esc(summary.runBy)} — HW04 execution index</title>
<style>
  :root { color-scheme: light; }
  body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 24px;
         background: #f6f7f9; color: #17191c; }
  .wrap { max-width: 1000px; margin: 0 auto; }
  .banner { background: #10243f; color: #fff; padding: 18px 22px; border-radius: 8px; }
  .banner h1 { margin: 0 0 6px; font-size: 21px; letter-spacing: .2px; }
  .banner .meta { font-size: 13.5px; opacity: .88; line-height: 1.7; }
  .banner code { background: rgba(255,255,255,.13); padding: 1px 6px; border-radius: 4px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 18px 0; }
  .card { flex: 1 1 150px; background: #fff; border: 1px solid #e1e4e8; border-radius: 8px;
          padding: 12px 14px; }
  .card .n { font-size: 24px; font-weight: 650; }
  .card .l { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: #5b6470; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px;
          overflow: hidden; border: 1px solid #e1e4e8; font-size: 14px; }
  th, td { padding: 9px 11px; border-bottom: 1px solid #eceff2; text-align: left; }
  th { background: #eef2f7; font-size: 12.5px; text-transform: uppercase; letter-spacing: .5px; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .pass { color: #14733c; font-weight: 600; }
  .fail { color: #b3261e; font-weight: 600; }
  .ok { color: #14733c; }
  time { font-family: Consolas, monospace; font-size: 12.5px; color: #444; }
  footer { margin-top: 18px; font-size: 12.5px; color: #5b6470; line-height: 1.6; }
  a { color: #0b5fa5; }
</style>
</head>
<body>
<div class="wrap">
  <div class="banner">
    <h1>Run by: ${esc(summary.runBy)}</h1>
    <div class="meta">
      HW04 — AI Automation Testing · EShop SUT · Playwright multi-browser execution<br>
      Index generated at <code>${esc(summary.generatedAt)}</code> (ISO 8601, UTC)<br>
      ${summary.runs.length} browser runs · 3 features × 3 engines · each report below carries the
      same <code>Run by: ${esc(summary.runBy)}</code> header and its own ISO start timestamp.
    </div>
  </div>

  <div class="cards">
    <div class="card"><div class="n">${t.browserRuns}</div><div class="l">browser runs</div></div>
    <div class="card"><div class="n">${t.executions}</div><div class="l">executions</div></div>
    <div class="card"><div class="n pass">${t.passed}</div><div class="l">passed</div></div>
    <div class="card"><div class="n fail">${t.failed}</div><div class="l">failed</div></div>
    <div class="card"><div class="n">${t.skipped ?? 0}</div><div class="l">skipped</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Feature</th><th>Browser</th><th class="num">Total</th><th class="num">Passed</th>
        <th class="num">Failed</th><th class="num">Skipped</th><th>Started (ISO)</th>
        <th>Stamp</th><th>Report</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>

  <footer>
    A failed assertion on this SUT is a candidate defect, not a broken test — the SUT is
    deliberately buggy and the specification (<code>README.md</code>) is the oracle.
    Triage and the resulting defect list are in <code>bug-report.md</code>.<br>
    Source: <code>reports/summary.json</code>, written by <code>scripts/run-all.mjs</code>.
  </footer>
</div>
</body>
</html>
`;

writeFileSync('reports/index.html', html);
console.log(
  `reports/index.html written — ${t.browserRuns} runs, ${t.executions} executions, ` +
    `${t.passed} passed, ${t.failed} failed, ${t.skipped ?? 0} skipped.`,
);
