# Agent redaction

Own portable sanitization policy and explicit detector/runtime adapters here.
Do not import controllers, Nostr, ACP, JJ, databases or application state.
Never log source text, credentials, roots or detector diagnostics. Keep executable
arguments separate from sanitized capture copies. Update the canonical spec
before behavior changes. Run the affected tests, `pnpm spec:check`, `pnpm check`,
`pnpm test`, `pnpm build` and `pnpm test:deno`. Commit verified slices with JJ.
Publication remains an explicit operator gate.
