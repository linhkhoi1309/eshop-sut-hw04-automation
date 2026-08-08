import { readFileSync } from 'node:fs';

/**
 * Minimal RFC 4180 CSV reader — quoted fields, embedded commas/newlines, and "" escapes.
 * Deliberately dependency-free: the data files are part of the deliverable and must stay
 * readable/diffable, so nothing here transforms values beyond trimming the record separator.
 *
 * Returns an array of plain objects keyed by the header row.
 */
export function parseCsv(text) {
  const rows = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ',') { record.push(field); field = ''; }
    else if (ch === '\n') { record.push(field); rows.push(record); record = []; field = ''; }
    else field += ch;
  }
  if (field !== '' || record.length) { record.push(field); rows.push(record); }

  const [header, ...body] = rows.filter((r) => r.length && r.some((c) => c !== ''));
  return body.map((cells) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? '').trim()])),
  );
}

/** Read + parse a CSV file relative to the project root. */
export function readCsv(path) {
  return parseCsv(readFileSync(path, 'utf8'));
}

/** `a|b|c` → ['a','b','c']; empty string → []. */
export function splitList(value) {
  return value ? value.split('|').map((s) => s.trim()).filter(Boolean) : [];
}
