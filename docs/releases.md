# Release procedure

Source integration does not publish packages. npm and Cargo have independent
manual workflows and require operator approval for the reviewed source,
versions, checksums and limitations. Ordinary CI creates no public package or
tag. Native detector policy and the TypeScript policy remain separate.

## Wave 2 candidates

- Cargo: `lapis-agent-redaction@0.1.0`, first publication.
- npm: `@lapismd/agent-redaction@0.1.1`. The 0.1.0 registry archive's README,
  scripts and package-manager metadata differ from the native extraction.
  TypeScript runtime source and exports are unchanged.

The 2026-10-20 review found no open Dependabot PRs. npm audit reports zero
findings; the Visual Delta exception does not apply here.

## Qualify before approval

1. Run the repository specification, format, architecture, types, native and
   Deno gates, npm release tests and package inspection.
2. Require successful Linux and macOS ARM64 CI at the exact source revision.
   `pnpm release:native:prepare` builds a Cargo-verified archive, inspects its
   allowlisted files and notices, records source/lock/archive SHA-256 values and
   dependency licenses, then runs both native privacy regressions from an
   extracted archive outside the checkout. Only this unpublished candidate uses
   an explicit temporary path dependency; all other dependencies use crates.io.
3. Merge the qualified protected PR, then qualify exact main. Dispatch the
   Cargo workflow in its default `qualify` mode to obtain canonical Linux bytes.
   Record that manifest and workflow URL in the approval packet.
4. A local disk preflight failure remains a failure/deferred local lane. Use
   hosted qualification instead of bypassing the 30 GiB guard.

## Cargo publication and bootstrap

First reserve the crate with the reviewed package through the manual
`release-native.yml` workflow's `publish` mode and `bootstrap: true`. This is a
separate operator approval, not a side effect of source CI. Configure a
reviewer-protected `crates-io-bootstrap` environment restricted to main, with
the short-lived/scoped `CARGO_REGISTRY_BOOTSTRAP_TOKEN` secret. Do not place
credentials in a checkout or artifact. The operator sets `CARGO_APPROVED_SOURCE`
for the reviewed source and supplies the reviewed version and Linux SHA-256.
The script rechecks exact current main and both successful CI checks before an
upload. Empty or mismatching approval fails closed.

After first publication, configure crates.io's trusted publisher for this
repository, `release-native.yml` and protected `crates-io` environment. Later
releases use `bootstrap: false` and the short-lived OIDC action token. Retire the
bootstrap secret and clear `CARGO_APPROVED_SOURCE` after the release.

The publisher regenerates the crate at the same clean source and checks its
checksum before one upload attempt. Existing versions must match the reviewed
checksum. Network errors and delayed visibility do not authorize another
upload: inspect registry state, then resume verification. Public verification
downloads the immutable registry archive, compares SHA-256 and runs the same
consumer with an exact registry dependency and no path override. The consumer
also enables `serde_json/preserve_order` to exercise feature unification.

Create the GitHub tag/release only after registry and consumer verification,
using the reviewed source and attaching its manifest/archive. Do not move an
existing tag or replace assets. Record tag/release completion separately from
registry completion.

## npm publication

Use the existing `release.yml` protected npm lane after separate approval of
the exact tarball. Its artifact, npm integrity/provenance and clean-consumer
gates remain required. Native source does not authorize publishing npm, and
neither release is considered consumer-verified merely because a source PR
merged. Do not reuse any other repository's audit exception.
