# Sanitization

The package converts complete observable text and plain JSON DTOs to immutable
sanitized representations. It does not change executable arguments or native
archives. Detectors cannot recognize every secret or prevent adversarial
exfiltration through unrelated messages or external agent software.

## Requirements

| ID | Requirement |
| --- | --- |
| AR-CORE-001 | Text and JSON MUST be scanned before delivery. Results MUST contain only independent immutable values and fixed safe metadata, never raw input, roots, detector diagnostics, fingerprints of secrets, or restoration mappings. |
| AR-CORE-002 | Scoped known values MUST match literally, including overlaps and documented encoded variants. Rotation MUST retain old values until disposal. Registries MUST be bounded at 1,024 values and 1 MiB of secret material. |
| AR-CORE-003 | Sensitive structured fields MUST be removed regardless of value type. Traversal MUST reject cycles, accessors, custom serializers, unsupported objects, malformed Unicode and collisions without executing user code. |
| AR-CORE-004 | Text blocks MUST be bounded at 2 MiB, structured records at 4 MiB and depth at 32. Detector, policy, decoding and size failures MUST return a fixed omission or rejection without raw fallback. |
| AR-PATH-001 | Trusted roots MUST use longest component-boundary matching across POSIX, Windows, UNC and file URLs. Workspace identity and relative path MUST be distinct from display text. Traversal and secret-bearing filenames MUST NOT become resolvable file capabilities. |
| AR-PATH-002 | Private portable views MAY retain home/temp suffixes. Public views MUST remove non-workspace absolute paths. Unregistered paths MUST be explicitly non-resolvable; root aliases MUST be granted explicitly. |
| AR-STREAM-001 | Whole-block buffering MUST emit no text before successful final scanning. Overflow, cancellation and invalid decoding MUST discard the buffer with one omission. Byte partitions MUST yield the same final result. |
| AR-ADAPTER-001 | Secretlint MUST use pinned 13.0.5 rules with an explicit inventory excluding comment suppression. No repository configuration discovery, raw diagnostics, network validation or source logging is permitted. Portable exports MUST report detector coverage honestly. |
| AR-ADAPTER-002 | Environment and dotenv discovery MUST require explicit grants and happen only on an explicit call. Refresh MUST be atomic, bounded and retain rotated values. Node and Deno enforcement MUST be tested separately. |
| AR-PKG-001 | Portable exports MUST NOT depend on a runtime, controller, signer, relay, database or native VCS. Published dependencies MUST use registry versions. |

Known values are byte-sensitive strings, not a blanket entropy heuristic. Commit
IDs and public keys are not credentials. Exact required protocol identifiers
that would be transformed must be rejected by the publishing consumer. Native
archives and external ACP provider/session files are separate boundaries.

Public output uses `$WORKSPACE[id]/path`, `[REDACTED]`, and `[EXTERNAL_PATH]`.
Private portable output additionally permits `$HOME` and `$TMP`. These marker
strings are reserved; a known value colliding with them invalidates the scope.
No mapping is exported with the result. Encoded matching covers URI component,
JSON-escaped, UTF-8 base64 and base64url representations, not arbitrary encodings.

Only complete text and plain data objects are supported. Binary attachments and
opaque transport data must be represented by an omission by the caller. No
incremental release guarantee is claimed. A scanner deadline may omit a block;
Node enforcement isolates scanning in a worker so it can terminate the scan.
