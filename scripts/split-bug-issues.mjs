/**
 * Split bug-report.md into one GitHub issue body per defect.
 *
 * bug-report.md is the graded artifact and the single source of truth; the issue bodies are
 * derived from it so the two can never drift. Each `## BUG-NN — <title>` section becomes
 * evidence/issue-bodies/bug-NN.md, and evidence/issue-bodies/titles.tsv carries the
 * "[FR-xx] title" line `gh issue create -t` needs.
 *
 * Usage: node scripts/split-bug-issues.mjs [../bug-report.md]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const source = process.argv[2] ?? '../bug-report.md';
const outDir = 'evidence/issue-bodies';
const REPO_RAW =
  'https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence';

mkdirSync(outDir, { recursive: true });

const md = readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
const sections = md.split(/^## (?=BUG-\d)/m).slice(1);
if (!sections.length) {
  console.error(`no "## BUG-NN" sections found in ${source}`);
  process.exit(1);
}

const titles = [];
for (const section of sections) {
  const [headline, ...rest] = section.split('\n');
  const match = headline.match(/^(BUG-(\d+))\s+[—-]\s+(.*)$/);
  if (!match) {
    console.error(`unparseable heading: ${headline}`);
    process.exit(1);
  }
  const [, id, num, title] = match;
  const slug = `bug-${num.padStart(2, '0')}`;

  const feature = section.match(/\*\*Feature:\*\*\s*(FR-\d+)/)?.[1] ?? 'FR-??';
  const severity = section.match(/\*\*Severity:\*\*\s*([A-Za-z]+)/)?.[1] ?? '';

  // Local image paths only resolve inside the repo tree; in an issue they must be absolute.
  const body = rest
    .join('\n')
    .replace(/!\[([^\]]*)\]\(evidence\/([^)]+)\)/g, `![$1](${REPO_RAW}/$2)`)
    .trim();

  writeFileSync(`${outDir}/${slug}.md`, `${body}\n`);
  titles.push([slug, `[${feature}] ${title}`, severity.toLowerCase()].join('\t'));
  console.log(`${outDir}/${slug}.md  ${id}`);
}

writeFileSync(`${outDir}/titles.tsv`, titles.join('\n') + '\n');
console.log(`\n${sections.length} issue bodies + titles.tsv written to ${outDir}/`);
