#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { createNodeRedaction } from "./node.js";
import {
  omit,
  type Json,
  type Policy,
  type Result,
  type TrustedRoot,
} from "./types.js";

const MAX_INPUT_BYTES = 6 * 1024 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function roots(value: unknown): readonly TrustedRoot[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  const result: TrustedRoot[] = [];
  for (const item of value) {
    if (!record(item)) return null;
    const allowed = new Set([
      "kind",
      "path",
      "id",
      "repositoryId",
      "aliases",
      "caseSensitive",
    ]);
    if (Object.keys(item).some((key) => !allowed.has(key))) return null;
    if (
      !["workspace", "home", "temp"].includes(String(item.kind)) ||
      typeof item.path !== "string" ||
      (item.id !== undefined && typeof item.id !== "string") ||
      (item.repositoryId !== undefined &&
        typeof item.repositoryId !== "string") ||
      (item.caseSensitive !== undefined &&
        typeof item.caseSensitive !== "boolean") ||
      (item.aliases !== undefined &&
        (!Array.isArray(item.aliases) ||
          item.aliases.some((alias) => typeof alias !== "string")))
    )
      return null;
    result.push(item as unknown as TrustedRoot);
  }
  return result;
}

function policy(value: unknown): Omit<Policy, "detector"> | undefined {
  if (value === undefined) return {};
  if (!record(value)) return undefined;
  if (
    Object.keys(value).some(
      (key) => !["secrets", "roots", "destination"].includes(key),
    )
  )
    return undefined;
  const trusted = roots(value.roots);
  if (trusted === null) return undefined;
  if (
    value.secrets !== undefined &&
    (!Array.isArray(value.secrets) ||
      value.secrets.some((secret) => typeof secret !== "string"))
  )
    return undefined;
  if (
    value.destination !== undefined &&
    value.destination !== "public" &&
    value.destination !== "private-portable"
  )
    return undefined;
  return {
    ...(value.secrets ? { secrets: value.secrets as string[] } : {}),
    ...(trusted ? { roots: trusted } : {}),
    ...(value.destination ? { destination: value.destination } : {}),
  } as Omit<Policy, "detector">;
}

export async function sanitizeStdioRequest(
  input: unknown,
): Promise<Result<Json>> {
  if (!record(input) || input.version !== 1 || !("value" in input))
    return omit("invalid_input");
  if (
    Object.keys(input).some(
      (key) => !["version", "value", "policy"].includes(key),
    )
  )
    return omit("invalid_input");
  const selected = policy(input.policy);
  if (!selected) return omit("policy_invalid");
  let runtime: ReturnType<typeof createNodeRedaction> | undefined;
  try {
    runtime = createNodeRedaction(selected);
    return await runtime.scope.value(input.value);
  } catch {
    return omit("invalid_input");
  } finally {
    runtime?.dispose();
  }
}

async function readInput(): Promise<
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly result: Result<Json> }
> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += next.byteLength;
    if (bytes > MAX_INPUT_BYTES) {
      chunks.length = 0;
      continue;
    }
    chunks.push(next);
  }
  if (bytes > MAX_INPUT_BYTES)
    return { ok: false, result: omit("limit_exceeded") };
  try {
    return {
      ok: true,
      value: JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      ),
    };
  } catch {
    return { ok: false, result: omit("invalid_input") };
  }
}

async function main() {
  const input = await readInput();
  const result = input.ok
    ? await sanitizeStdioRequest(input.value)
    : input.result;
  process.stdout.write(JSON.stringify(result));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main().catch(() => {
    process.stdout.write(JSON.stringify(omit("invalid_input")));
  });
}
