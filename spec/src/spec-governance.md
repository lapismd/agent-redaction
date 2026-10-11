# Specification governance

## Requirements

| ID         | Requirement                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-GOV-001 | Canonical chapters MUST be listed in SUMMARY.md and build with mdBook. Generated output MUST be ignored.                                                                                  |
| AR-GOV-002 | Protected changes MUST update the mapped canonical chapter before or with code.                                                                                                           |
| AR-GOV-003 | Every requirement MUST have exactly one verification row distinguishing implemented and planned evidence.                                                                                 |
| AR-GOV-004 | Repository validation MUST include Prettier formatting through `pnpm check:format`. The check MUST use the repository Prettier configuration and MUST fail on unformatted tracked source. |

## Change map

| Protected paths                                                                                                 | Canonical chapter    |
| --------------------------------------------------------------------------------------------------------------- | -------------------- |
| `src/`, `scripts/check-boundaries.mjs`, `scripts/deno.test.ts`, `package.json`, `deno.json`, `docs/`            | `sanitization.md`    |
| `scripts/check-architecture.mjs`, `scripts/architecture-*`, `scripts/architecture-fixtures/`                    | `architecture.md`    |
| `AGENTS.md`, `spec-validator.config.mjs`, `spec/book.toml`, `.gitignore`, `.prettierrc.json`, `.prettierignore` | `spec-governance.md` |

Release helpers, workflow files, and their package scripts map to sanitization
and AR-PKG-002. Registry lockfile audit updates and the workspace override map
to this governance chapter. The release checks retain all package assertions.
