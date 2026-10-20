import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function nativeBoundaryErrors(packages) {
  const allowed = new Set([
    "serde_json",
    "thiserror",
    "kingfisher-core",
    "kingfisher-rules",
    "kingfisher-scanner",
  ]);
  return packages.flatMap((pkg) =>
    (pkg.dependencies ?? []).flatMap((dep) => {
      if (dep.kind === "dev" && dep.name === "tempfile") return [];
      if (!allowed.has(dep.name))
        return [`${pkg.name}: forbidden native dependency ${dep.name}`];
      if (dep.name.startsWith("kingfisher-") && dep.uses_default_features)
        return [`${pkg.name}: detector default features must remain disabled`];
      return [];
    }),
  );
}
if (
  process.argv[1]?.endsWith("/check-native-boundaries.mjs") ||
  process.argv[1] === "scripts/check-native-boundaries.mjs"
) {
  const data = JSON.parse(
    execFileSync(
      "cargo",
      ["metadata", "--no-deps", "--locked", "--format-version=1"],
      { encoding: "utf8", cwd: fileURLToPath(new URL("..", import.meta.url)) },
    ),
  );
  const errors = nativeBoundaryErrors(data.packages);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Native privacy dependency boundary passed");
}
