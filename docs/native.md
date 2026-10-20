# Native Rust capture privacy

Add the `lapis-agent-redaction` crate to an embedding application's Cargo
dependencies. During source development, the versioned local crate is at
`crates/lapis-agent-redaction`; publication is a separate release action.

```rust,ignore
use lapis_agent_redaction::TranscriptSanitizer;
use std::path::Path;
let scope = TranscriptSanitizer::new(
    Path::new("/workspace/vault"), Path::new("/home/operator"),
    Path::new("/tmp/capture"), Path::new("/private/admitted-cache"),
)?;
let safe = scope.sanitize(serde_json::json!({"text": "hello"}));
if let Some(safe) = safe { /* publish only safe.bytes() */ }
# Ok::<(), lapis_agent_redaction::Error>(())
```

The host authorizes its private cache and supplies exact roots and credential
values explicitly. No environment, repository configuration or source discovery
is performed. The cache compiles pinned Kingfisher 1.4.0 builtin medium rules;
network validation and base64 detector decoding are disabled.

`sanitize_hook_payload` accepts one JSON object up to four MiB and returns a
validated result or omission. Sanitized JSON is at most one MiB. Scope scanning
replaces workspace/home/temp roots and explicit secrets in keys and values; key
collisions and scanner errors omit the result. Results preserve canonical JSON
independently of Serde feature unification in an embedding application.

`replace_stream_text` retains incomplete literal root/secret prefixes in its
caller-owned memory buffer. Flush at logical boundaries and always pass output
through `sanitize` before storage, logs or renderer delivery. Replacement is not
a detector and does not itself return `SanitizedJson`. Scope disposal drops the
registered values; retain rotated values until the old scope is retired.

The native hook policy is `kingfisher-scanner@1.4.0/builtin-medium/v1`; transcript
policy is `kingfisher-scanner@1.4.0/builtin-medium/transcript-paths/v1`. These are
preserved extraction identities. The TypeScript Secretlint policy and its
whole-block streaming contract remain independently versioned; the two policies
do not claim equivalent detector coverage or identical path matching.
