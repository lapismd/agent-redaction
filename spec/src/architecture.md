# Architecture

Repository-owned source validation enforces counted-line budgets so modules
stay extractable. Counted lines are physical lines minus blanks and
comment-only lines, measured by `scripts/architecture-lines.mjs`. New
production and script files are capped at 300 counted lines and new tests at 500. Existing paths use `scripts/architecture-baseline.json` as a no-growth
ratchet: growth requires an updated budget in the same change, and a budget
more than twenty counted lines above the current size is stale.

Generic dump filenames (`utils`, `helpers`, `common`, `services`) and
production imports of tests are rejected. `src/types.ts` remains a cohesive
public-contract module. Fixture trees under `scripts/architecture-fixtures/`
are harness-only and stay outside TypeScript `include`.

## Requirements

| ID          | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-ARCH-001 | Repository validation MUST enforce counted-line budgets with `scripts/check-architecture.mjs`. New production and script source MUST NOT exceed 300 counted lines, and new tests MUST NOT exceed 500. Existing files MUST NOT increase counted lines without updating the path budget in `scripts/architecture-baseline.json` in the same change. A recorded budget MUST fail when the current counted size plus twenty is still below that budget. |
