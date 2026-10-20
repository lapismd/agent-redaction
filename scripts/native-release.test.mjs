import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  crateName,
  repository,
  registryVersion,
  requireNativeApproval,
  sha256,
  verifyNativeArtifact,
} from "./native-release-policy.mjs";

const bytes = Buffer.from("immutable native candidate");
const sourceCommit = "a".repeat(40);
const manifest = {
  schema: "lapis.cargo-release/1",
  packageName: crateName,
  version: "0.1.0",
  sourceCommit,
  lockSha256: "b".repeat(64),
  filename: `${crateName}-0.1.0.crate`,
  sha256: sha256(bytes),
  files: [
    "Cargo.toml",
    "Cargo.lock",
    "README.md",
    "LICENSE.md",
    "NOTICE.md",
    "src/lib.rs",
    "tests/native_privacy.rs",
  ].map((file) => `${crateName}-0.1.0/${file}`),
};
const env = {
  GITHUB_REPOSITORY: repository,
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: sourceCommit,
  LAPIS_CARGO_RELEASE_APPROVED_SOURCE: sourceCommit,
  LAPIS_CARGO_RELEASE_VERSION: manifest.version,
  LAPIS_CARGO_RELEASE_SHA256: manifest.sha256,
};
const checks = ["validate", "Native macOS ARM64 / native"].map((name) => ({
  name,
  head_sha: sourceCommit,
  app: { id: 15368 },
  status: "completed",
  conclusion: "success",
}));

test("native candidate binds archive, source, package and required license files", () => {
  verifyNativeArtifact(manifest, bytes, sourceCommit);
  for (const field of [
    "schema",
    "packageName",
    "filename",
    "sha256",
    "lockSha256",
    "sourceCommit",
    "version",
  ])
    assert.throws(
      () =>
        verifyNativeArtifact(
          { ...manifest, [field]: "invalid" },
          bytes,
          sourceCommit,
        ),
      field,
    );
  assert.throws(() =>
    verifyNativeArtifact(manifest, Buffer.from("changed"), sourceCommit),
  );
  for (const file of manifest.files)
    assert.throws(() =>
      verifyNativeArtifact(
        {
          ...manifest,
          files: manifest.files.filter((entry) => entry !== file),
        },
        bytes,
      ),
    );
});

test("native candidate rejects traversal, extra state and unexpected files", () => {
  for (const file of [
    "../outside",
    `${crateName}-0.1.0/src/../private.rs`,
    `${crateName}-0.1.0/.env`,
    `${crateName}-0.1.0/target/cache`,
    "/absolute",
  ])
    assert.throws(() =>
      verifyNativeArtifact(
        { ...manifest, files: [...manifest.files, file] },
        bytes,
      ),
    );
});

test("publication needs explicit exact-main source/version/artifact approval", () => {
  requireNativeApproval(manifest, env, sourceCommit, checks);
  for (const key of Object.keys(env))
    assert.throws(
      () =>
        requireNativeApproval(
          manifest,
          { ...env, [key]: "wrong" },
          sourceCommit,
          checks,
        ),
      key,
    );
  assert.throws(() =>
    requireNativeApproval(manifest, env, "b".repeat(40), checks),
  );
});

test("successful stale, unrelated, skipped or non-Actions checks do not qualify", () => {
  for (const patch of [
    { head_sha: "b".repeat(40) },
    { name: "other" },
    { conclusion: "skipped" },
    { status: "in_progress" },
    { app: { id: 1 } },
  ])
    assert.throws(() =>
      requireNativeApproval(manifest, env, sourceCommit, [
        checks[0],
        { ...checks[1], ...patch },
      ]),
    );
  assert.throws(() => requireNativeApproval(manifest, env, sourceCommit, []));
});

test("registry absence is distinct from failure or a yanked identity", async () => {
  assert.equal(
    await registryVersion("0.1.0", async () => ({ status: 404 })),
    null,
  );
  const version = {
    crate: crateName,
    num: "0.1.0",
    yanked: false,
    checksum: manifest.sha256,
  };
  assert.deepEqual(
    await registryVersion("0.1.0", async () => ({
      status: 200,
      json: async () => ({ version }),
    })),
    version,
  );
  await assert.rejects(registryVersion("0.1.0", async () => ({ status: 503 })));
  for (const patch of [
    { yanked: true },
    { crate: "another" },
    { num: "0.2.0" },
    { checksum: "bad" },
  ])
    await assert.rejects(
      registryVersion("0.1.0", async () => ({
        status: 200,
        json: async () => ({ version: { ...version, ...patch } }),
      })),
    );
});

test("source CI cannot trigger Cargo publication and qualification defaults to no writes", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/release-native.yml", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|workflow_run):/m);
  assert.match(workflow, /options: \[qualify, publish\]/);
  assert.match(workflow, /default: qualify/);
  assert.match(workflow, /if: inputs.mode == 'publish'/);
  assert.match(
    workflow,
    /LAPIS_CARGO_RELEASE_APPROVED_SOURCE: \$\{\{ vars.CARGO_APPROVED_SOURCE \}\}/,
  );
  assert.match(
    workflow,
    /environment: \$\{\{ inputs.bootstrap && 'crates-io-bootstrap' \|\| 'crates-io' \}\}/,
  );
});
