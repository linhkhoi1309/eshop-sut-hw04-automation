/**
 * Markdown -> PDF using the Playwright chromium that is already installed (no pandoc needed).
 * Supports the subset of Markdown these deliverables use: headings, tables, lists, code,
 * blockquotes, links, images, bold/italic, and horizontal rules.
 *
 * Usage: node scripts/md2pdf.mjs <in.md> [out.pdf]
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/md2pdf.mjs <in.md> [out.pdf]');
  process.exit(1);
}
const output = process.argv[3] ?? input.replace(/\.md$/i, '.pdf');
const baseDir = path.dirname(path.resolve(input));

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

function render(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inCode = false;
  let listType = null;

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^```/.test(line)) {
      closeList();
      html.push(inCode ? '</code></pre>' : '<pre><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(escapeHtml(line));
      continue;
    }

    // Tables: a header row followed by a |---|---| separator.
    if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      closeList();
      const cells = (row) =>
        row.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      html.push('<table><thead><tr>');
      for (const c of cells(line)) html.push(`<th>${c}</th>`);
      html.push('</tr></thead><tbody>');
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        html.push('<tr>');
        for (const c of cells(lines[i])) html.push(`<td>${c}</td>`);
        html.push('</tr>');
        i++;
      }
      i--;
      html.push('</tbody></table>');
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      html.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== 'ol') {
        closeList();
        html.push('<ol>');
        listType = 'ol';
      }
      html.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      closeList();
      html.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
      continue;
    }
    if (/^\s*(---|___|\*\*\*)\s*$/.test(line)) {
      closeList();
      html.push('<hr>');
      continue;
    }
    if (line.trim() === '') {
      closeList();
      continue;
    }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return html.join('\n');
}

const css = `
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11pt; line-height: 1.5;
         color: #1a1a1a; max-width: 100%; }
  h1 { font-size: 20pt; border-bottom: 2px solid #333; padding-bottom: 6px; }
  h2 { font-size: 15pt; margin-top: 18px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  h3 { font-size: 12.5pt; margin-top: 14px; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9.5pt;
          page-break-inside: auto; }
  th, td { border: 1px solid #bbb; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #eef2f7; }
  tr { page-break-inside: avoid; }
  code { background: #f2f2f2; padding: 1px 4px; border-radius: 3px;
         font-family: Consolas, monospace; font-size: 9.5pt; }
  pre { background: #f7f7f7; border: 1px solid #ddd; padding: 8px; border-radius: 4px;
        overflow-x: auto; page-break-inside: avoid; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #bbb; margin-left: 0; padding-left: 12px; color: #444; }
  img { max-width: 100%; }
  a { color: #0b5fa5; }
`;

const md = readFileSync(input, 'utf8');
const page_html = `<!doctype html><meta charset="utf-8"><style>${css}</style><body>${render(md)}</body>`;
const tmp = path.join(baseDir, `.md2pdf-${path.basename(input)}.html`);
writeFileSync(tmp, page_html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + tmp.replace(/\\/g, '/'));
await page.pdf({
  path: output,
  format: 'A4',
  printBackground: true,
  margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="font-size:8pt;width:100%;text-align:center;color:#666;">' +
    '23127396 — HW04 AI Automation Testing — <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
});
await browser.close();
console.log(`${input} -> ${output}`);
