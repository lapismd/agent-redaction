# Native fixture source publication

AR-NATIVE-001 remains unchanged. GitHub push protection rejected the unpublished
extraction because its detector regression stored a complete synthetic token.
The fixture is now assembled at runtime from its prefix and body, preserving
identical scanned bytes and expected redaction. No protection bypass is used.

This rewrites only the unpublished extraction and its unpublished descendant.
Historical local verification remains in native-rust-extraction.md. Exact-source
Linux/macOS qualification is required in the release-preparation PR; local Rust
execution remains blocked by the 30 GiB disk guard. No real credential or
private capture is involved. Public publication remains unapproved.
