import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const repository = "lapismd/agent-redaction";
export const crateName = "lapis-agent-redaction";
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export function verifyNativeArtifact(manifest, bytes, source) {
  assert.equal(manifest.schema, "lapis.cargo-release/1");
  assert.equal(manifest.packageName, crateName);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.filename, `${crateName}-${manifest.version}.crate`);
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(manifest.lockSha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.sha256, sha256(bytes));
  if (source) assert.equal(manifest.sourceCommit, source);
  const prefix = `${crateName}-${manifest.version}/`;
  for (const name of manifest.files) {
    assert.ok(name.startsWith(prefix));
    assert.ok(!name.split("/").some((part) => part === ".." || part === "."));
    assert.match(
      name.slice(prefix.length),
      /^(?:src\/.+\.rs|tests\/.+\.rs|Cargo\.toml(?:\.orig)?|Cargo\.lock|README\.md|LICENSE\.md|NOTICE\.md|\.cargo_vcs_info\.json)$/,
    );
  }
  for (const name of [
    "Cargo.toml",
    "Cargo.lock",
    "README.md",
    "LICENSE.md",
    "NOTICE.md",
    "src/lib.rs",
    "tests/native_privacy.rs",
  ])
    assert.ok(
      manifest.files.includes(prefix + name),
      `Missing packaged ${name}`,
    );
}

export function requireNativeApproval(manifest, env, main, checks) {
  assert.equal(env.GITHUB_REPOSITORY, repository);
  assert.equal(env.GITHUB_EVENT_NAME, "workflow_dispatch");
  assert.equal(env.GITHUB_REF, "refs/heads/main");
  assert.equal(manifest.sourceCommit, env.GITHUB_SHA);
  assert.equal(manifest.sourceCommit, env.LAPIS_CARGO_RELEASE_APPROVED_SOURCE);
  assert.equal(manifest.sourceCommit, main);
  assert.equal(manifest.version, env.LAPIS_CARGO_RELEASE_VERSION);
  assert.equal(manifest.sha256, env.LAPIS_CARGO_RELEASE_SHA256);
  for (const name of ["validate", "Native macOS ARM64 / native"])
    assert.ok(
      checks.some(
        (check) =>
          check.name === name &&
          check.head_sha === main &&
          check.app?.id === 15368 &&
          check.status === "completed" &&
          check.conclusion === "success",
      ),
      `Missing exact-source CI: ${name}`,
    );
}

export async function registryVersion(version, request = fetch) {
  const response = await request(
    `https://crates.io/api/v1/crates/${crateName}/${version}`,
    {
      headers: {
        "User-Agent": `LapisMD release (https://github.com/${repository})`,
      },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (response.status === 404) return null;
  assert.equal(response.status, 200, "Cargo registry lookup failed");
  const data = (await response.json()).version;
  assert.equal(data.crate, crateName);
  assert.equal(data.num, version);
  assert.equal(data.yanked, false);
  assert.match(data.checksum, /^[a-f0-9]{64}$/);
  return data;
}
