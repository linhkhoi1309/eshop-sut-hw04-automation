/**
 * Assemble the submission folder and produce 23127396_HW04_AI_Automation_090.zip.
 *
 * The graded artifacts live in two places on purpose: committed in the repo (so the public
 * GitHub link shows them) and copied up into the submission root (so the zip is self-contained
 * and its relative image paths — evidence/bug-NN.png, reports/…/stamp-verification.png — resolve
 * from the documents that reference them).
 *
 * Excluded from the zip: node_modules/, test-results/, .git/, Ref/, and the SUT's own
 * database file, none of which are deliverables.
 *
 * Usage: node scripts/assemble-submission.mjs   (run from hw04/)
 */
import { cpSync, existsSync, rmSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REPO = process.cwd();
const ROOT = path.resolve(REPO, '..');
const NAME = '23127396_HW04_AI_Automation_090';

/** repo-relative -> submission-root-relative */
const COPY = [
  ['reports', 'reports'],
  ['evidence', 'evidence'],
  ['skills', 'skills'],
  ['docs/prompt-log.md', 'docs/prompt-log.md'],
  ['docs/ai-gap-analysis.md', 'docs/ai-gap-analysis.md'],
  ['docs/fr05', 'docs/fr05'],
  ['docs/fr09', 'docs/fr09'],
  ['docs/fr14', 'docs/fr14'],
];

for (const [from, to] of COPY) {
  const src = path.join(REPO, from);
  const dst = path.join(ROOT, to);
  if (!existsSync(src)) {
    console.error(`MISSING: ${from} — not copied`);
    continue;
  }
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
  console.log(`copied ${from} -> ${path.relative(ROOT, dst)}`);
}

// The commit log is a graded artifact in its own right (§13).
const log = execFileSync('git', ['log', '--stat', '--date=iso'], { encoding: 'utf8' });
writeFileSync(path.join(ROOT, 'git-commit-log.txt'), log);
console.log(`wrote git-commit-log.txt (${log.split('\n').length} lines)`);

/** Everything the zip must contain, checked before it is built rather than after. */
const REQUIRED = [
  'README.md',
  'report.md',
  'report.pdf',
  'bug-report.md',
  'bug-report.pdf',
  'ai-audit-report.md',
  'ai-audit-report.pdf',
  'ai-critique.md',
  'ai-critique.pdf',
  'git-commit-log.txt',
  'evidence/bug-01.png',
  'evidence/bug-13.png',
  'reports/index.html',
  'reports/summary.json',
  'skills/playwright-data-driven-automation/SKILL.md',
  'docs/plan.md',
  'docs/video-scripts.md',
  'docs/ai-gap-analysis.md',
];

const missing = REQUIRED.filter((f) => !existsSync(path.join(ROOT, f)));
if (missing.length) {
  console.error(`\nFATAL — the submission is incomplete:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nall ${REQUIRED.length} required artifacts present`);

// Nine reports, each with its rendered stamp proof.
const runs = readdirSync(path.join(ROOT, 'reports')).filter((d) => /^FR-\d+-/.test(d));
const unstamped = runs.filter(
  (d) => !existsSync(path.join(ROOT, 'reports', d, 'stamp-verification.png')),
);
if (runs.length !== 9 || unstamped.length) {
  console.error(`FATAL — expected 9 stamped reports, found ${runs.length}` +
    (unstamped.length ? `; unstamped: ${unstamped.join(', ')}` : ''));
  process.exit(1);
}
console.log(`${runs.length} stamped reports: ${runs.join(', ')}`);

// ---- build the zip ------------------------------------------------------------------
const zipPath = path.join(ROOT, '..', `${NAME}.zip`);
rmSync(zipPath, { force: true });

const EXCLUDE = [
  '*\\node_modules\\*',
  '*\\test-results\\*',
  '*\\.git\\*',
  '*\\Ref\\*',
  '*\\.md2pdf-*',
  '*.sqlite',
];

const ps = [
  '$ErrorActionPreference = "Stop"',
  `$src = "${ROOT}"`,
  `$dst = "${zipPath}"`,
  `$exclude = @(${EXCLUDE.map((e) => `"${e}"`).join(',')})`,
  '$items = Get-ChildItem -Path $src -Recurse -File | Where-Object {',
  '  $p = $_.FullName',
  '  -not ($exclude | Where-Object { $p -like $_ })',
  '}',
  '$tmp = Join-Path $env:TEMP "hw04-zip-staging"',
  'if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }',
  `New-Item -ItemType Directory -Path (Join-Path $tmp "${NAME}") -Force | Out-Null`,
  'foreach ($f in $items) {',
  '  $rel = $f.FullName.Substring($src.Length).TrimStart("\\")',
  `  $target = Join-Path (Join-Path $tmp "${NAME}") $rel`,
  '  New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null',
  '  Copy-Item $f.FullName $target',
  '}',
  'Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $dst -CompressionLevel Optimal',
  'Remove-Item $tmp -Recurse -Force',
  '$z = Get-Item $dst',
  'Write-Output ("zip: " + $z.FullName + "  " + [math]::Round($z.Length/1MB,2) + " MB")',
].join('; ');

execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
  stdio: 'inherit',
});
