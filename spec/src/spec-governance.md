# Specification governance

## Requirements

The public README uses only declared package exports. The independent
`publish-spec-pages.yml` workflow builds the canonical book without installing
runtime dependencies, so spec publication does not depend on npm release gates.

| ID         | Requirement                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-GOV-001 | Canonical chapters MUST be listed in SUMMARY.md and build with mdBook. Generated output MUST be ignored.                                                                                                                      |
| AR-GOV-002 | Protected changes MUST update the mapped canonical chapter before or with code.                                                                                                                                               |
| AR-GOV-003 | Every requirement MUST have exactly one verification row distinguishing implemented and planned evidence.                                                                                                                     |
| AR-GOV-004 | Repository validation MUST include Prettier formatting through `pnpm check:format`. The check MUST use the repository Prettier configuration and MUST fail on unformatted tracked source.                                     |
| AR-GOV-005 | The README MUST document registry installation, public runtime imports, safe result handling, explicit secret grants, disposal, complete-block capture, and the published specification.                                      |
| AR-GOV-006 | GitHub Actions MUST build canonical `spec/src` with mdBook on specification pull requests and publish the generated book to GitHub Pages only from `main`, including manual dispatch. Generated output MUST remain untracked. |

## Change map

| Protected paths                                                                                                 | Canonical chapter    |
| --------------------------------------------------------------------------------------------------------------- | -------------------- |
| `src/`, `scripts/check-boundaries.mjs`, `scripts/deno.test.ts`, `package.json`, `deno.json`, `docs/`            | `sanitization.md`    |
| `scripts/check-architecture.mjs`, `scripts/architecture-*`, `scripts/architecture-fixtures/`                    | `architecture.md`    |
| `AGENTS.md`, `spec-validator.config.mjs`, `spec/book.toml`, `.gitignore`, `.prettierrc.json`, `.prettierignore` | `spec-governance.md` |

Release helpers, workflow files, and their package scripts map to sanitization
and AR-PKG-002 / AR-NATIVE-002. Registry lockfile audit updates and the workspace override map
to this governance chapter. The release checks retain all package assertions.

Rust `crates/`, `Cargo.toml`, `Cargo.lock` and `rust-toolchain.toml` changes map to
`sanitization.md`; native package ignores and validator mappings map here.

The native privacy test configuration includes its dependency-boundary regressions
without changing the existing TypeScript and architecture scenarios.

Wave 2 reviews all open Dependabot proposals before source publication. No
proposals were open on 2026-10-20; the frozen npm audit has zero findings. Native
detector pins remain policy identities and are not upgraded as routine tooling.
