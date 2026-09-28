import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "vitest";
import { sanitizeStdioRequest } from "../dist/stdio.js";

const secret = "stdio-synthetic-secret-8842";
const request = {
  version: 1,
  value: {
    token: secret,
    path: "/private/workspace/src/main.rs",
  },
  policy: {
    secrets: [secret],
    roots: [
      {
        kind: "workspace",
        path: "/private/workspace",
        id: "workspace-1",
        repositoryId: "repository-1",
      },
    ],
    destination: "private-portable",
  },
};

test("stdio request returns only a sanitized bounded result", async () => {
  const result = await sanitizeStdioRequest(request);
  assert.equal(result.status, "sanitized");
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes("/private/workspace"), false);
  if (result.status === "sanitized") {
    assert.equal(result.value.token, "[REDACTED]");
    assert.match(String(result.value.path), /^\$WORKSPACE\[workspace-1\]/);
  }
});

test("published executable emits fixed omissions without source diagnostics", () => {
  const invalid = spawnSync(process.execPath, ["dist/stdio.js"], {
    cwd: process.cwd(),
    input: Buffer.alloc(7 * 1024 * 1024, 0x61),
    maxBuffer: 1024 * 1024,
  });
  assert.equal(invalid.status, 0);
  assert.equal(invalid.stderr.toString(), "");
  assert.deepEqual(JSON.parse(invalid.stdout.toString()), {
    status: "omitted",
    reason: "limit_exceeded",
  });

  const child = spawnSync(process.execPath, ["dist/stdio.js"], {
    cwd: process.cwd(),
    input: JSON.stringify(request),
    maxBuffer: 1024 * 1024,
  });
  assert.equal(child.status, 0);
  assert.equal(child.stderr.toString(), "");
  assert.equal(child.stdout.toString().includes(secret), false);
  assert.equal(JSON.parse(child.stdout.toString()).status, "sanitized");
});
