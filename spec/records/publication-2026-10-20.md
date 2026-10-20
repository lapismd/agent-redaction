# Wave 2 public publication

Date: 2026-10-20. Revision: enclosing Jujutsu change. The user explicitly approved
both qualified candidates with “let's publish these”. No audit exception applies.

AR-NATIVE-001/002 and AR-PKG-001/002 are unchanged. This evidence-only follow-up
records the completed library release gate, without changing package contents,
runtime policy or immutable release tags. AR-NATIVE-002 is now Implemented.

## Immutable releases

Both tags select source `02a6b4926de335bee147017b56fcdac7cac314bd`, merged by
[PR #1](https://github.com/lapismd/agent-redaction/pull/1). Exact-source CI
[39483877270](https://github.com/lapismd/agent-redaction/actions/runs/39483877270)
qualifies Linux and Apple Silicon macOS. npm qualification 39483891173 and
specification deployment 39483877185 pass. No open Dependabot PRs remain at the
publication/evidence refresh.

- [Cargo lapis-agent-redaction@0.1.0](https://crates.io/crates/lapis-agent-redaction/0.1.0):
  30,347 bytes, 13 allowlisted files. SHA-256
  `19781b5d786a79d7db9b36c3d8ca29139ed0d208982ee3b69c7f52050b729bf2`.
  Lock SHA-256
  `fa3393e67dc46ed617c17789c15c9664156ff1bf6ac39c5c6480e95b6ea0a97c`.
  The reviewed manifest inventories 359 dependency licenses and carries Apache
  licensing/extraction notices. Registry creation: 19:49:31 UTC.
- [npm @lapismd/agent-redaction@0.1.1](https://www.npmjs.com/package/@lapismd/agent-redaction/v/0.1.1):
  16,062 bytes, 29 files. SHA-256
  `ef70ff57f2d12956d388c9619f626cb2a100c85375050c031266a098d568aca0`.
  Integrity
  `sha512-GCA0ALq/4IUoOqUifEZYAIDVyXwfLSmG35H1NmCv/E3Ghbc+qJxmyX1xjUfNP6J+CNh8eUZUpnSVd0bR68CigQ==`.
  The 26 TypeScript runtime files remain byte-identical to npm 0.1.0; the patch
  carries reviewed package metadata/documentation changes.

GitHub releases are public, stable and non-draft:

- [lapis-agent-redaction@0.1.0](https://github.com/lapismd/agent-redaction/releases/tag/lapis-agent-redaction%400.1.0),
  published 19:52:35 UTC. Crate asset digest matches crates.io. Manifest digest:
  `a7fecdba188561a9e6c4a3882fc7ded0bf7e492128e58f42299c91e9251dd648`.
- [agent-redaction@0.1.1](https://github.com/lapismd/agent-redaction/releases/tag/agent-redaction%400.1.1),
  published 19:56:57 UTC. Tarball asset digest matches npm. Manifest digest:
  `8d36355c60692733f0ade0b76dc8c055fdfa7e47b106470d695b92a7ea4e5ba7`.

## Publication, failures and recovery

1. [Native bootstrap 39485878423](https://github.com/lapismd/agent-redaction/actions/runs/39485878423)
   passes artifact, protected publication, downloaded-byte and registry-only
   consumer gates. Both native privacy tests pass with `serde_json/preserve_order`.
   The existing local Cargo credential was staged through stdin into the
   reviewer-protected bootstrap environment, never printed or stored in a
   checkout. The original local credential was preserved. `/api/v1/me` returns
   website-only 403; it is not a token-validation endpoint.
2. [npm 39485709902](https://github.com/lapismd/agent-redaction/actions/runs/39485709902)
   attempt 1 fails before upload with ENEEDAUTH; local `npm whoami` also returns
   E401. `npm login --auth-type=web --browser=false` completes after user security-key
   authentication. `npm trust github @lapismd/agent-redaction --file release.yml
--repo lapismd/agent-redaction --env npm-production --allow-publish --yes
--browser=false` establishes binding `bf14fbf8-0522-4f8f-a648-4797660f542d`.
3. Registry absence is rechecked before attempt 2. Exactly one npm upload is
   acknowledged at 19:53:13 UTC. Trusted OIDC signs provenance at transparency
   log index `3342716025`. Immediate visibility verification then fails because
   registry integrity is not yet visible. This is an unknown verification
   outcome, not permission for another upload.
4. Public metadata, tarball and attestations become visible and independently
   match the approved identity. Attempt 3 reruns failed jobs, verifies the
   existing matching version and completes GitHub notes. No second upload,
   replacement archive or tag movement occurs.
5. Cargo trusted publisher configuration `27220` binds this repository,
   `release-native.yml` and protected `crates-io` environment. OIDC verification
   [39486952295](https://github.com/lapismd/agent-redaction/actions/runs/39486952295)
   passes, explicitly retains the matching published crate and reruns its
   registry consumer. The action obtains and revokes its temporary token.
6. Bootstrap secret `CARGO_REGISTRY_BOOTSTRAP_TOKEN` and both environments'
   `CARGO_APPROVED_SOURCE` variables are removed; GitHub API read-back lists are
   empty. Reviewer/main-only environment protection remains. npm uses trusted
   publication with no repository npm token.

## Independent consumers and completion

An isolated npm consumer outside checkouts installs the exact registry version
using empty user/global npm configurations and no operator authentication. It
adds 41 packages and audits 42. `npm audit signatures --include-attestations`
verifies 41 registry signatures and 31 attestations; `npm audit --omit=dev`
reports zero findings. Portable `RedactionScope` and Node worker sanitization
pass from a normal ESM file, with exact installed lock integrity verified.

Independent SLSA verification binds the exact npm PURL and SHA-512 to source
`02a6b4926de335bee147017b56fcdac7cac314bd`, `release.yml`, main and workflow
39485709902 attempt 2. Downloaded crates.io bytes and its public checksum also
match. Both protected native runs resolve only public registry dependencies.

Final refresh commands: `gh run view` for both npm/OIDC runs; `gh release view`
for both tags; `npm view @lapismd/agent-redaction@0.1.1 version dist.integrity
--registry=https://registry.npmjs.org`; crates.io version API with independent
SHA-256 of both downloaded archives; `gh api` bootstrap secret/environment
variable read-backs. All pass. No open Dependabot PRs are found.

Documentation validation: `pnpm spec:check` passes all four lanes (validate,
architecture, mdBook and spec-first); `pnpm check:format` and
`pnpm check:architecture` pass with zero failures. Product suites are not rerun
locally for this evidence-only change. Exact released-source hosted evidence
above is retained. Earlier local native builds remain stopped
by the 30 GiB disk guard; no guard is bypassed. The previously recorded eval
worker launch-flag limitation remains; ordinary file-based ESM passes.

Library release review: Wave 2 is published and registry-consumer verified.
Other native platforms and later consumer manifest/lock adoption remain pending.
This does not qualify Desktop AI recovery, application distribution, installation
or Deno retirement; Desktop M11/M12 retain their original Planned gates.
