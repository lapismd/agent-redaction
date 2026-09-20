import { readFile } from "node:fs/promises";
const seen = new Set();
async function visit(url) {
  if (seen.has(url.href)) return;
  seen.add(url.href);
  const source = await readFile(url, "utf8");
  for (const match of source.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
    if (!match[1].startsWith("./"))
      throw new Error("Portable entry imported runtime dependency");
    await visit(new URL(match[1].replace(/\.js$/, ".ts"), url));
  }
  if (/\b(?:process|Deno|require)\b|eval\s*\(/.test(source))
    throw new Error("Portable entry uses runtime state");
}
await visit(new URL("../src/index.ts", import.meta.url));
console.log("Portable import boundary passed");
