# Specification governance

## Requirements

| ID | Requirement |
| --- | --- |
| AR-GOV-001 | Canonical chapters MUST be listed in SUMMARY.md and build with mdBook. Generated output MUST be ignored. |
| AR-GOV-002 | Protected changes MUST update the mapped canonical chapter before or with code. |
| AR-GOV-003 | Every requirement MUST have exactly one verification row distinguishing implemented and planned evidence. |

## Change map

| Protected paths | Canonical chapter |
| --- | --- |
| `src/`, `scripts/`, `package.json`, `deno.json`, `docs/` | `sanitization.md` |
| `AGENTS.md`, `spec-validator.config.mjs`, `spec/book.toml`, `.gitignore` | `spec-governance.md` |
