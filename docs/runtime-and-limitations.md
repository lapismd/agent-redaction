# Runtime and coverage

The portable root export uses Web-platform primitives only. It provides literal,
semantic-field, private-key, Nostr-secret, bearer and credential-URL checks. Its
summary says `portable`; it does not imply Secretlint ran. The `/node` and `/deno`
factories run the explicit 27-rule Secretlint 13.0.5 inventory in a worker, with
empty environment, discarded stdout/stderr, a 10-second deadline and bounded
queue. A timeout terminates the worker and omits affected blocks. `/secretlint`
is the lower-level in-memory detector seam, without worker isolation; prefer a
runtime factory for enforcement. No preset, repository config or suppression
directives are loaded. Findings redact their affected complete lines to avoid
partial credential ranges.

`createNodeRedaction` and `createDenoRedaction` return a scope and a disposer.
Call `refreshNodeSecrets` / `refreshDenoSecrets` with explicit environment names
and canonical dotenv paths before capture. Missing or unsafe sources invalidate
the scope. Nothing scans the home directory or launches credential helpers.
Destroy the scope and its worker after capture. Environment grants and roots
are private policy inputs, never returned metadata.

Scopes accept plain JSON data only. Accessors, custom serializers, cycles,
prototype keys, symbols and malformed Unicode are rejected. Callers must not
pass arbitrary executable JavaScript proxies. Terminal control sequences are
removed before scanning. A block never emits intermediate text; cancellation
and crash discard unfinished buffers. The caller records the resulting gap.

Root resolution is lexical and never follows a displayed path as a filesystem
capability. Trusted symlink aliases must be registered by the caller. Free text
path recognition is necessarily heuristic; structured `path()` references give
explicit classification. Web URLs are preserved after credential checks. A
workspace-relative filename can itself reveal private context. Public export is
not general anonymization. Per-block scanning cannot detect arbitrary secrets,
unknown encodings, or deliberate exfiltration split across independent records.

Native JJ/Git objects, external provider traffic, external agent journals,
arbitrary binary attachments, and standalone Rust marks remain separate
boundaries. Sanitized patches and command representations must never be replayed
as executable inputs. Do not report previously stored or published copies erased.

`SynchronousRedaction` is for synchronous durable-store adapters. It runs the
same scanner in a worker and waits on a bounded shared result buffer, with a
deadline independent of the calling event loop. Ordinary event capture should
use the async factory. The first call starts the worker; subsequent calls reuse
it. Only completed sanitized results cross back to the writing thread.
