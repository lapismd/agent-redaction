# lapis-agent-redaction

Native Rust sanitization for agent hooks and streamed transcripts. It preserves
the versioned Kingfisher profiles used by jj-store while remaining independent
of JJ, agent runtimes and application persistence.

Use `sanitize_hook_payload` for one bounded JSON object, or create a
`TranscriptSanitizer` with explicit workspace, home, temporary and private cache
locations. Register exact credentials with `for_secrets`. Only `SanitizedJson`
bytes may cross a capture boundary; `replace_stream_text` is an intermediate
root/secret replacement step and must be followed by `sanitize`.

Hosts admit cache locations and keep raw execution inputs separate. Failure
returns omission or a fixed safe error. No publication or credential discovery
is performed. Full policy and examples live in [the native guide](https://github.com/lapismd/agent-redaction/blob/main/docs/native.md)
and [canonical sanitization](https://lapismd.github.io/agent-redaction/sanitization.html).
