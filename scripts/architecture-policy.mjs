/** Counted-line limits, file kinds, and generic dump-name conventions. */

export const LIMIT_KEYS = {
  production: "newProductionCountedLines",
  test: "newTestCountedLines",
  story: "newStoryCountedLines",
  script: "newScriptCountedLines",
};

export const DEFAULT_LIMITS = {
  newProductionCountedLines: 300,
  newTestCountedLines: 500,
  newStoryCountedLines: 400,
  newScriptCountedLines: 300,
};

export const DUMP_NAMES = new Set(["utils", "helpers", "common", "services"]);

const SOURCE_EXT = /\.(?:[cm]?[jt]sx?|svelte|rs)$/u;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const TEST_SPECIFIER = /\.(?:test|spec)(?:\.[cm]?[jt]sx?)?$/u;

export function isSourceFile(name) {
  return SOURCE_EXT.test(name);
}

export function toPosix(relativePath) {
  return relativePath.split("\\").join("/");
}

export function fileKind(posixPath) {
  if (TEST_FILE.test(posixPath) || /(?:^|\/)tests\/.*\.rs$/u.test(posixPath))
    return "test";
  if (/\.stories\.(?:svelte|[cm]?[jt]sx?)$/u.test(posixPath)) return "story";
  if (
    posixPath.startsWith("scripts/") ||
    posixPath.startsWith("dev/") ||
    posixPath.startsWith(".storybook/")
  )
    return "script";
  return "production";
}

export function isDumpPath(posixPath) {
  const parts = posixPath.split("/");
  const base = (parts.at(-1) ?? "").replace(
    /\.(?:[cm]?[jt]sx?|svelte|rs)$/u,
    "",
  );
  if (DUMP_NAMES.has(base)) return true;
  return parts.slice(0, -1).some((part) => DUMP_NAMES.has(part));
}

export function isTestSpecifier(specifier) {
  return TEST_SPECIFIER.test(specifier);
}
