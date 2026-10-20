# Agent redaction

[![npm version](https://img.shields.io/npm/v/%40lapismd%2Fagent-redaction)](https://www.npmjs.com/package/@lapismd/agent-redaction)

Portable complete-block sanitization for observable agent transcripts. The core
has no runtime effects. Explicit Node and Deno adapters add reviewed Secretlint
detectors and granted secret discovery. This package does not sanitize external
agent software, native VCS archives or data written before capture.

## Install

```sh
npm install @lapismd/agent-redaction
# or
pnpm add @lapismd/agent-redaction
```

The Node adapter and executable require Node.js 22.13 or newer. The ESM package
includes TypeScript declarations. Choose a public entry point for your runtime:

| Import                                | Purpose                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `@lapismd/agent-redaction`            | Portable scopes, complete-block buffering, result types and limits         |
| `@lapismd/agent-redaction/node`       | Explicit Secretlint worker, synchronous adapter and granted secret loading |
| `@lapismd/agent-redaction/deno`       | Deno enforcement through its Node compatibility layer                      |
| `@lapismd/agent-redaction/secretlint` | Explicit reviewed detector inventory                                       |

## Sanitize in Node.js

```ts
import { createNodeRedaction } from "@lapismd/agent-redaction/node";

const runtime = createNodeRedaction({
  secrets: ["demo-only-token"],
  roots: [{ kind: "workspace", path: "/srv/project", id: "project" }],
  destination: "public",
});

try {
  const result = await runtime.scope.text(
    "Loaded /srv/project/README.md with demo-only-token",
  );
  if (result.status === "sanitized") {
    console.log(result.value);
    // Loaded $WORKSPACE[project]/README.md with [REDACTED]
  } else {
    // Store or report only the fixed omission reason; never fall back to input.
    console.log(result.reason);
  }
} finally {
  runtime.dispose();
}
```

Use `scope.value(plainJson)` for structured records and `scope.path(path)` for
logical path classification. Sensitive structured fields are removed; sanitized
results are independent immutable values. Always handle both `sanitized` and
`omitted` results. Keep real executable arguments separate from capture copies.

Environment and dotenv values are read only when explicitly granted:

```ts
import {
  createNodeRedaction,
  refreshNodeSecrets,
} from "@lapismd/agent-redaction/node";

const runtime = createNodeRedaction();
try {
  const ready = await refreshNodeSecrets(runtime.scope, {
    environment: ["API_TOKEN"],
  });
  if (!ready) throw new Error("Secret policy could not be loaded");
  const result = await runtime.scope.text("A complete captured message");
  // Deliver only result.value when result.status is "sanitized".
} finally {
  runtime.dispose();
}
```

Grant `dotenvFiles` separately using canonical absolute file paths. Refresh keeps
previous secret values until disposal so rotation cannot expose earlier captures.
There is no automatic file or environment discovery.

## Portable and streamed captures

```ts
import { CompleteBlock, RedactionScope } from "@lapismd/agent-redaction";

const scope = new RedactionScope({ secrets: ["demo-only-token"] });
try {
  const block = new CompleteBlock(scope);
  block.append("Message with demo-");
  block.append("only-token");
  const result = await block.finish();
  // No text is released before finish() successfully scans the complete block.
} finally {
  scope.dispose();
}
```

The portable scope applies registered values, structured-field policy and path
normalization; its coverage is `portable`. Construct the Node or Deno adapter to
add the reviewed credential detectors (`credential-detectors` coverage).
`CompleteBlock` accepts strings or UTF-8 byte chunks, but do not mix them within
one block. Call `block.cancel()` when the capture is interrupted.

Text blocks are limited to 2 MiB; structured records to 4 MiB and depth 32.
Overflow, invalid input and detector failures produce a fixed omission. A
detector cannot recognize every secret; register sensitive values explicitly.

## Deno

```ts
import { createDenoRedaction } from "npm:@lapismd/agent-redaction@0.1.0/deno";

const runtime = createDenoRedaction({ secrets: ["demo-only-token"] });
try {
  const result = await runtime.scope.text("Message with demo-only-token");
} finally {
  runtime.dispose();
}
```

Run with the adapter's required permissions: `deno run --allow-read --allow-env
--allow-sys example.ts`. Deno still enforces permissions; grant only the files and
environment names your application authorizes. No worker starts on import.

## Command-line transport

The executable reads one version-1 JSON request from stdin and writes one result
to stdout. It does not accept raw text lines or an NDJSON stream.

```sh
printf '%s' '{"version":1,"value":"Message with demo-only-token","policy":{"secrets":["demo-only-token"],"destination":"public"}}' \
  | npx --yes --package=@lapismd/agent-redaction lapismd-agent-redaction
```

Provide actual capture data and secrets through your application's stdin pipe.
The adapter keeps stderr empty, accepts at most 6 MiB of request data, and emits
only sanitized results or fixed omissions.

## Specification and development

Read the [published specification](https://lapismd.github.io/agent-redaction/),
the canonical [sanitization contract](spec/src/sanitization.md), and the
[verification record](spec/src/verification.md). The spec site is built from
`spec/src` and deployed by GitHub Actions on `main`.

```sh
pnpm install --frozen-lockfile
pnpm spec:check
pnpm check
pnpm test
pnpm test:deno
pnpm build
pnpm publint
```

Specification builds require mdBook on `PATH`; Deno adapter tests require Deno.
Package publication uses the separate protected release workflow.

## Native Rust

The independent `lapis-agent-redaction` Rust crate preserves jj-store’s versioned
Kingfisher privacy profiles. See [native usage](docs/native.md). It has no Node,
Deno, JJ or agent-runtime dependency; the TypeScript policy remains separate.

Native checks use `pnpm check:native` and `pnpm test:native`, also included in the
normal check/test lanes. Local source use does not publish the Cargo package.

`pnpm release:native:prepare` verifies the Cargo archive, notices, dependency
licenses and an isolated consumer with `serde_json/preserve_order` enabled.
CI runs native gates on Linux and Apple Silicon macOS. See the
[release procedure](docs/releases.md) for independent npm and Cargo approvals,
first-crate bootstrap and immutable publication recovery.
