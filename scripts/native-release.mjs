import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  crateName,
  registryVersion,
  repository,
  requireNativeApproval,
  sha256,
  verifyNativeArtifact,
} from "./native-release-policy.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = path.join(root, ".local/cargo-release");
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
    ...options,
  });
const cargo = (args) =>
  run(process.execPath, ["scripts/dev-cargo.mjs", ...args], {
    stdio: "inherit",
  });
const metadata = () =>
  JSON.parse(run("cargo", ["metadata", "--locked", "--format-version=1"]));
const sourceCommit = () =>
  process.env.GITHUB_SHA ??
  run("jj", [
    "--no-pager",
    "log",
    "-r",
    "@",
    "--no-graph",
    "-T",
    "commit_id",
  ]).trim();
const github = (endpoint) =>
  JSON.parse(run("gh", ["api", `repos/${repository}/${endpoint}`]));
const approval = (manifest) =>
  requireNativeApproval(
    manifest,
    process.env,
    github("branches/main").commit.sha,
    github(
      `commits/${manifest.sourceCommit}/check-runs?filter=latest&per_page=100`,
    ).check_runs,
  );

async function prepare() {
  const data = metadata();
  const pkg = data.packages.find((pkg) => pkg.name === crateName);
  assert.ok(pkg);
  assert.equal(pkg.license, "Apache-2.0");
  assert.equal(pkg.repository, `https://github.com/${repository}`);
  const dependencies = data.packages
    .filter((pkg) => pkg.id !== data.workspace_members[0])
    .map((pkg) => {
      assert.ok(
        pkg.source?.startsWith(
          "registry+https://github.com/rust-lang/crates.io-index",
        ),
        `Non-registry dependency: ${pkg.name}`,
      );
      assert.ok(pkg.license, `Missing license: ${pkg.name}`);
      return { name: pkg.name, version: pkg.version, license: pkg.license };
    })
    .sort((a, b) =>
      `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
    );
  cargo(["package", "-p", crateName, "--locked"]);
  await mkdir(artifacts, { recursive: true });
  const filename = `${crateName}-${pkg.version}.crate`;
  const archive = path.join(artifacts, filename);
  await copyFile(
    path.join(data.target_directory, "package", filename),
    archive,
  );
  const bytes = await readFile(archive);
  const files = run("tar", ["-tzf", archive]).trim().split("\n").sort();
  const manifest = {
    schema: "lapis.cargo-release/1",
    packageName: crateName,
    version: pkg.version,
    sourceCommit: sourceCommit(),
    lockSha256: sha256(await readFile(path.join(root, "Cargo.lock"))),
    filename,
    sha256: sha256(bytes),
    files,
    dependencies,
  };
  verifyNativeArtifact(manifest, bytes, sourceCommit());
  const vcs = JSON.parse(
    run("tar", [
      "-xOf",
      archive,
      `${crateName}-${pkg.version}/.cargo_vcs_info.json`,
    ]),
  );
  assert.equal(vcs.git.sha1, manifest.sourceCommit);
  assert.notEqual(vcs.git.dirty, true);
  await writeFile(
    path.join(artifacts, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  run(process.execPath, ["scripts/native-consumer.mjs", "archive"], {
    stdio: "inherit",
  });
  console.log(`Qualified ${crateName}@${pkg.version}: ${manifest.sha256}`);
}

async function candidate() {
  const manifest = JSON.parse(
    await readFile(path.join(artifacts, "manifest.json"), "utf8"),
  );
  verifyNativeArtifact(
    manifest,
    await readFile(path.join(artifacts, manifest.filename)),
    sourceCommit(),
  );
  assert.equal(
    manifest.lockSha256,
    sha256(await readFile(path.join(root, "Cargo.lock"))),
  );
  return manifest;
}

async function publish() {
  const manifest = await candidate();
  approval(manifest);
  const existing = await registryVersion(manifest.version);
  if (existing) {
    assert.equal(
      existing.checksum,
      manifest.sha256,
      "Existing crate differs; do not replace or republish",
    );
    console.log("Published crate already matches; resuming verification only");
    return;
  }
  // Recreate at the same clean commit and compare before the single upload attempt.
  cargo(["package", "-p", crateName, "--locked"]);
  const data = metadata();
  assert.equal(
    sha256(
      await readFile(
        path.join(data.target_directory, "package", manifest.filename),
      ),
    ),
    manifest.sha256,
  );
  approval(manifest);
  assert.ok(
    process.env.CARGO_REGISTRY_TOKEN,
    "Protected registry credential required",
  );
  cargo(["publish", "-p", crateName, "--locked", "--registry", "crates-io"]);
}

async function verify() {
  const manifest = await candidate();
  const published = await registryVersion(manifest.version);
  assert.ok(
    published,
    "Crate not visible yet; resume verification without publishing again",
  );
  assert.equal(published.checksum, manifest.sha256);
  const response = await fetch(
    `https://static.crates.io/crates/${crateName}/${manifest.filename}`,
    { signal: AbortSignal.timeout(30000) },
  );
  assert.equal(response.status, 200);
  verifyNativeArtifact(
    manifest,
    Buffer.from(await response.arrayBuffer()),
    sourceCommit(),
  );
  run(process.execPath, ["scripts/native-consumer.mjs", "registry"], {
    stdio: "inherit",
  });
  console.log(
    `Verified public checksum and registry consumer: ${crateName}@${manifest.version}`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const handlers = { prepare, publish, verify };
  assert.ok(
    handlers[process.argv[2]],
    "Usage: native-release.mjs prepare|publish|verify",
  );
  await handlers[process.argv[2]]();
}
