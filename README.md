# Agent redaction

Portable complete-block sanitization for observable agent transcripts. The core
has no runtime effects. Explicit Node and Deno adapters add reviewed Secretlint
detectors and granted secret discovery. This package does not sanitize external
agent software, native VCS archives or data written before capture.

See the canonical [specification](spec/src/sanitization.md) and
[verification record](spec/src/verification.md). Publication is not part of local
development acceptance.
