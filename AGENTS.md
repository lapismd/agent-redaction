# Agent redaction

Own portable sanitization policy and explicit detector/runtime adapters here.
Do not import controllers, Nostr, ACP, JJ, databases or application state.
Never log source text, credentials, roots or detector diagnostics. Keep executable
arguments separate from sanitized capture copies. Update the canonical spec
before behavior changes. Run the affected tests, `pnpm spec:check`, `pnpm check`,
`pnpm test`, `pnpm build` and `pnpm test:deno`. Commit verified slices with JJ.
Publication remains an explicit operator gate.

## Source organisation

Keep one primary responsibility per module and a feature-specific name. Do not
add `src/utils`, `src/helpers`, or `src/common`, and do not use dump filenames
`utils`, `helpers`, `common`, or `services`. `src/types.ts` remains the cohesive
public-contract module. New production and script files must stay at or under
300 counted lines; new tests at or under 500. Existing files must not grow
counted lines without updating `scripts/architecture-baseline.json` in the same
change. Run `pnpm check:architecture` with the relevant tests.

### Completion checklist

- [ ] New/changed modules have one primary responsibility and a
      feature-specific name (not `utils` / `helpers` / `common`).
- [ ] Counted lines: new files ≤ 300 (tests ≤ 500); existing files did not
      grow, or the baseline budget dropped after extraction.
- [ ] `pnpm check:architecture` and the existing `pnpm check` lane relevant
      to the surface passed.
