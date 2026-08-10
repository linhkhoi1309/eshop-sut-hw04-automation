/**
 * Generate ai-audit-report.md (§10) from the Claude Code session logs.
 *
 * Every timestamp, prompt and response summary is read out of the session JSONL files —
 * nothing here is hand-written, which is the whole point of the requirement. The JSONL is the
 * tool's own append-only record of the session, so it cannot be back-dated after the fact.
 *
 * For each human prompt it records: ISO timestamp, the prompt verbatim, the assistant's text
 * reply, and the tools it invoked (with the files each one touched). Full tool payloads are
 * summarised rather than pasted — the two sessions total ~4 MB and the artifact has to be
 * readable — but the counts and file lists are complete.
 *
 * Usage: node scripts/ai-audit.mjs [outfile]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.join(
  process.env.USERPROFILE ?? process.env.HOME,
  '.claude',
  'projects',
  'C--Users-Khoi-Downloads-23127396-HW04-AI-Automation-090',
);
const OUT = process.argv[2] ?? '../ai-audit-report.md';
const STUDENT = '23127396';

const files = readdirSync(LOG_DIR)
  .filter((f) => f.endsWith('.jsonl'))
  .map((f) => path.join(LOG_DIR, f));

/** One entry per human prompt, in chronological order across all sessions. */
const entries = [];
const sessions = new Map();

for (const file of files) {
  const records = readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  let current = null;
  for (const r of records) {
    if (r.type === 'user' && r.origin?.kind === 'human' && typeof r.message?.content === 'string') {
      current = {
        session: r.sessionId,
        version: r.version,
        timestamp: r.timestamp,
        prompt: r.message.content.trim(),
        reply: [],
        tools: new Map(),
        toolCalls: 0,
      };
      entries.push(current);

      const s = sessions.get(r.sessionId) ?? { first: r.timestamp, last: r.timestamp, prompts: 0 };
      s.last = r.timestamp;
      s.prompts++;
      sessions.set(r.sessionId, s);
      continue;
    }

    if (r.type === 'assistant' && current) {
      for (const block of r.message?.content ?? []) {
        if (block.type === 'text' && block.text.trim()) current.reply.push(block.text.trim());
        if (block.type === 'tool_use') {
          current.toolCalls++;
          const target =
            block.input?.file_path ??
            block.input?.path ??
            block.input?.pattern ??
            block.input?.command ??
            block.input?.description ??
            '';
          const list = current.tools.get(block.name) ?? new Set();
          if (target) list.add(String(target).replace(/\\/g, '/').slice(0, 110));
          current.tools.set(block.name, list);
        }
      }
      if (r.timestamp) current.lastReplyAt = r.timestamp;
    }
  }
}

entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

/**
 * The JSONL stores UTC. The work was done in UTC+07, so a late-evening local session lands on
 * the previous UTC date — reporting only UTC would misrepresent which calendar day the work
 * happened on, and §13 counts calendar days. Both are shown.
 */
const TZ_OFFSET_HOURS = 7;
const utcDay = (ts) => ts.slice(0, 10);
const localDay = (ts) =>
  new Date(Date.parse(ts) + TZ_OFFSET_HOURS * 3600_000).toISOString().slice(0, 10);

const byDay = new Map();
for (const e of entries) {
  const key = `${localDay(e.timestamp)}|${utcDay(e.timestamp)}`;
  byDay.set(key, (byDay.get(key) ?? 0) + 1);
}

const totalToolCalls = entries.reduce((n, e) => n + e.toolCalls, 0);
const toolTotals = new Map();
for (const e of entries) {
  for (const [name, targets] of e.tools) {
    const t = toolTotals.get(name) ?? { calls: 0, targets: new Set() };
    t.calls++;
    for (const x of targets) t.targets.add(x);
    toolTotals.set(name, t);
  }
}

const trim = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() + ' …' : s);
const fence = (s) => s.replace(/```/g, '``​`');

const out = [];
out.push(`# AI Audit Report — HW04`);
out.push('');
out.push(`**Student:** Lương Linh Khôi · **ID:** ${STUDENT}`);
out.push(`**AI tool:** Claude Code (Claude Opus 5) — CLI \`${entries.at(-1)?.version ?? 'n/a'}\``);
out.push(
  `**Sessions:** ${sessions.size} · **Human prompts:** ${entries.length} · ` +
    `**Tool invocations by the AI:** ${totalToolCalls}`,
);
out.push(
  `**Period:** ${entries[0]?.timestamp} → ${entries.at(-1)?.lastReplyAt ?? entries.at(-1)?.timestamp}`,
);
out.push('');
out.push(
  `Every timestamp, prompt and response in this document is extracted programmatically by ` +
    `\`scripts/ai-audit.mjs\` from the Claude Code session logs ` +
    `(\`~/.claude/projects/…/*.jsonl\`) — the tool's own append-only record of the session. ` +
    `**No timestamp in this report was typed by hand.** Re-running the script regenerates it.`,
);
out.push('');
out.push('## Activity by day');
out.push('');
out.push(
  `All timestamps in this report are ISO-8601 **UTC**, exactly as the session log stores them. ` +
    `The work was done in **UTC+07**, so a late-evening local session appears on the previous ` +
    `UTC date; both columns are given so the calendar-day count (§13) is unambiguous.`,
);
out.push('');
out.push('| Local date (UTC+07) | UTC date | Human prompts |');
out.push('|---------------------|----------|---------------|');
for (const [k, n] of [...byDay].sort()) {
  const [loc, utc] = k.split('|');
  out.push(`| ${loc} | ${utc} | ${n} |`);
}
out.push('');
out.push('## Sessions');
out.push('');
out.push('| Session ID | First prompt | Last prompt | Prompts |');
out.push('|------------|--------------|-------------|---------|');
for (const [id, s] of sessions) out.push(`| \`${id}\` | ${s.first} | ${s.last} | ${s.prompts} |`);
out.push('');
out.push('## Tools the AI invoked');
out.push('');
out.push('| Tool | Prompts in which it was used | Distinct targets |');
out.push('|------|------------------------------|------------------|');
for (const [name, t] of [...toolTotals].sort((a, b) => b[1].calls - a[1].calls)) {
  out.push(`| ${name} | ${t.calls} | ${t.targets.size} |`);
}
out.push('');
out.push('---');
out.push('');
out.push('## Interaction log');
out.push('');

entries.forEach((e, i) => {
  out.push(`### ${String(i + 1).padStart(3, '0')} · ${e.timestamp}`);
  out.push('');
  out.push(`**AI tool:** Claude Code (Claude Opus 5) · **Session:** \`${e.session.slice(0, 8)}\``);
  out.push('');
  out.push('**User prompt**');
  out.push('');
  out.push('```text');
  out.push(fence(trim(e.prompt, 1800)));
  out.push('```');
  out.push('');
  out.push('**AI output**');
  out.push('');
  if (e.reply.length) {
    out.push('```text');
    out.push(fence(trim(e.reply.join('\n\n'), 2200)));
    out.push('```');
  } else {
    out.push('*(no prose reply — the turn consisted entirely of tool actions, listed below)*');
  }
  if (e.tools.size) {
    out.push('');
    out.push(`**Actions taken** — ${e.toolCalls} tool invocation(s):`);
    out.push('');
    for (const [name, targets] of e.tools) {
      const list = [...targets].slice(0, 6);
      const more = targets.size > 6 ? ` … +${targets.size - 6} more` : '';
      out.push(`- \`${name}\`${list.length ? ` → ${list.map((t) => `\`${t}\``).join(', ')}` : ''}${more}`);
    }
  }
  if (e.lastReplyAt) {
    out.push('');
    out.push(`*Response completed: ${e.lastReplyAt}*`);
  }
  out.push('');
  out.push('---');
  out.push('');
});

writeFileSync(OUT, out.join('\n'));
console.log(
  `${OUT} written — ${entries.length} prompts, ${totalToolCalls} tool calls, ` +
    `${sessions.size} sessions, ${[...byDay].length} days.`,
);
