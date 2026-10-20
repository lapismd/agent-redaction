# Native Rust privacy extraction

AR-NATIVE-001 moves the native Kingfisher policy from jj-store 3be80ad2 into
`lapis-agent-redaction` without JJ, controller or application imports. Hook and
transcript policy IDs, pinned scanner/rules/core versions, symbolic markers,
ordinary/OAuth secret limits, bounded intermediate prefixes, canonical JSON and
omission behavior remain preserved. The Rust cache location is host-admitted;
the JJ adapter retains its outside-checkout check. This does not replace the
TypeScript Secretlint policy or claim equivalent detector coverage.

## Actual verification

- `CARGO_INCREMENTAL=0 pnpm dev:cargo -- test --workspace --offline`: two native
  cases pass, covering golden canonical bytes, detector replacement, every UTF-8
  root/secret split, rebinding, collisions, limits and unavailable cache.
- `CARGO_INCREMENTAL=0 pnpm check`: initial all-target Clippy rejected one needless
  borrow; it was removed. The second run found two unformatted updated Markdown
  tables. After formatting, the final run passes format, types, portable/native
  import guards, counted-line checks, Rust format and strict all-target Clippy.
- `pnpm spec:check`: the first run found a detached verification table row. The
  row was joined to its owning table. The final run passes all four canonical,
  architecture, mdBook and specification-first lanes.
- `CARGO_INCREMENTAL=0 pnpm test`: final 60 TypeScript/architecture/native-boundary
  cases pass across seven files, followed by both native Rust cases. An earlier
  58-case run preceded adding the native boundary file to the test inventory.
- `pnpm build`: TypeScript output builds.
- `pnpm test:deno`: both existing Deno worker/synchronous cases pass.
- `pnpm exec vitest run scripts/native-boundaries.test.mjs`: both native dependency
  guard cases pass, rejecting JJ/runtime dependencies and detector defaults.

The source architecture checker now includes Rust crates and integration tests
under the existing limits. Its checker grows by one counted line and Rust classification by four, recorded
in the owning baseline; no limit is raised. Public Rust examples and concise crate README link
the full native guide. Existing npm export and release formats are unchanged.

Consumer verification is recorded in jj-store's E-REUSABLE-AGENTS-001: original
transcript privacy regressions, independent-library/adapter byte equivalence and
complete capture coverage remain separate from this source-package evidence.
No package, tag, service or installed application is published or replaced.
