import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crateName, verifyNativeArtifact } from "./native-release-policy.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const mode = process.argv[2];
assert.ok(["archive", "registry"].includes(mode));
const artifacts = path.join(root, ".local/cargo-release");
const manifest = JSON.parse(
  await readFile(path.join(artifacts, "manifest.json"), "utf8"),
);
const archive = path.join(artifacts, manifest.filename);
verifyNativeArtifact(manifest, await readFile(archive), process.env.GITHUB_SHA);
const consumer = await mkdtemp(path.join(tmpdir(), "lapis-native-consumer-"));
try {
  execFileSync("tar", ["-xzf", archive, "-C", consumer]);
  const extracted = path.join(consumer, `${crateName}-${manifest.version}`);
  const dependency =
    mode === "registry"
      ? `"=${manifest.version}"`
      : `{ path = ${JSON.stringify(extracted)} }`;
  await mkdir(path.join(consumer, "tests"));
  await copyFile(
    path.join(extracted, "tests/native_privacy.rs"),
    path.join(consumer, "tests/native_privacy.rs"),
  );
  await writeFile(
    path.join(consumer, "Cargo.toml"),
    `[package]\nname = "lapis-native-release-consumer"\nversion = "0.0.0"\nedition = "2024"\n[workspace]\n[dependencies]\n${crateName} = ${dependency}\nserde_json = { version = "1", features = ["preserve_order"] }\ntempfile = "3"\n[profile.test]\ndebug = 0\n`,
  );
  const cargo = (args) =>
    execFileSync(
      process.execPath,
      [
        path.join(root, "scripts/dev-cargo.mjs"),
        ...args,
        "--manifest-path",
        path.join(consumer, "Cargo.toml"),
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          CARGO_TARGET_DIR: path.join(root, "target/native-consumer"),
        },
        stdio: "inherit",
      },
    );
  cargo(["generate-lockfile"]);
  const data = JSON.parse(
    execFileSync(
      "cargo",
      [
        "metadata",
        "--locked",
        "--format-version=1",
        "--manifest-path",
        path.join(consumer, "Cargo.toml"),
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
    ),
  );
  for (const pkg of data.packages) {
    if (pkg.name === "lapis-native-release-consumer") continue;
    if (pkg.name === crateName && mode === "archive") {
      assert.equal(pkg.manifest_path, path.join(extracted, "Cargo.toml"));
    } else
      assert.ok(
        pkg.source?.startsWith(
          "registry+https://github.com/rust-lang/crates.io-index",
        ),
        `Consumer used non-registry source: ${pkg.name}`,
      );
  }
  cargo(["test", "--locked"]);
} finally {
  await rm(consumer, { recursive: true, force: true });
}
console.log(`Isolated ${mode} consumer passed with serde_json preserve_order`);
