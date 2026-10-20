# Native source CI follow-up

AR-NATIVE-001/002 remain unchanged. The first source PR's CI run 39482716962
at `08408209870ec1f34d80321ee6bcda196437b365` fails on both Linux and macOS
at rustfmt: shortening the synthetic detector expression allows its sanitizer
call to fit on one line. Both failures precede compilation. The macOS runner
is confirmed as `macos-15-arm64`, Rust 1.99.0.

`rustfmt --edition 2024 crates/lapis-agent-redaction/tests/native_privacy.rs`
applies the required formatting; the same command with `--check` passes.
Standalone formatting performs no compilation and does not bypass Cargo's
30 GiB build guard. Canonical spec, architecture and release-control checks
remain required; fresh exact-source hosted native qualification is pending.
No runtime assertion, detector coverage or public publication gate changes.
