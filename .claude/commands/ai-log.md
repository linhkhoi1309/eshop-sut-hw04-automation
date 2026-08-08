---
allowed-tools:
  - bash
---

Find the current Claude Code session JSONL file.

Extract for every message:
- timestamp
- role
- content

Then generate an AI usage report containing:

- Name of AI Tool
- Timestamp
- User Prompt
- AI Output

Use timestamps from the JSONL file only.
Do not invent timestamps.