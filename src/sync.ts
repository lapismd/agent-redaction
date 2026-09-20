import { Worker } from "node:worker_threads";
import {
  LIMITS,
  omit,
  utf8Size,
  type Json,
  type Policy,
  type Result,
  type LogicalPath,
} from "./types.js";

/** Clone only plain DTO data before structured-clone could invoke accessors. */
function snapshot(input: unknown): Json {
  let bytes = 0,
    nodes = 0;
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number): Json => {
    if (++nodes > 100_000 || depth > LIMITS.depth) throw 0;
    if (typeof value === "string") {
      bytes += utf8Size(value);
      if (bytes > LIMITS.record) throw 0;
      return value;
    }
    if (
      value === null ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    )
      return value;
    if (
      typeof value !== "object" ||
      seen.has(value) ||
      Object.getOwnPropertySymbols(value).length
    )
      throw 0;
    const array = Array.isArray(value),
      prototype = Object.getPrototypeOf(value);
    if (
      array
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null
    )
      throw 0;
    seen.add(value);
    const result: Record<string, Json> = Object.create(null),
      items: Json[] = [];
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(value),
    )) {
      if (array && key === "length") continue;
      bytes += utf8Size(key) + 8;
      if (
        bytes > LIMITS.record ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        ["toJSON", "__proto__", "constructor", "prototype"].includes(key)
      )
        throw 0;
      if (array && key !== String(items.length)) throw 0;
      const next = visit(descriptor.value, depth + 1);
      if (array) items.push(next);
      else result[key] = next;
    }
    if (array && items.length !== (value as unknown[]).length) throw 0;
    seen.delete(value);
    return array ? items : result;
  };
  return visit(input, 0);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

/** For synchronous database adapters; ordinary capture should use async scopes. */
export class SynchronousRedaction {
  #worker?: Worker;
  #closed = false;
  readonly #buffer = new SharedArrayBuffer(LIMITS.record + 4104);
  constructor(
    private readonly policy: Omit<Policy, "detector"> = {},
    private readonly timeoutMs = 10_000,
  ) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000)
      throw new Error("policy_invalid");
  }
  get policyId(): string {
    return `agent-redaction/1/${this.policy.destination ?? "public"}/secretlint-13.0.5-explicit-27-v1`;
  }
  #call(
    operation: "text" | "value" | "register" | "path",
    input: unknown,
  ): unknown {
    if (this.#closed) return omit("policy_invalid");
    let safeInput: Json;
    try {
      safeInput = snapshot(input);
    } catch {
      return omit("invalid_input");
    }
    try {
      if (!this.#worker) {
        this.#worker = new Worker(
          new URL("./sync-worker.js", import.meta.url),
          {
            workerData: { policy: this.policy },
            env: {},
            stdout: true,
            stderr: true,
            resourceLimits: { maxOldGenerationSizeMb: 128 },
          },
        );
        this.#worker.stdout?.resume();
        this.#worker.stderr?.resume();
        this.#worker.on("error", () => this.dispose());
        this.#worker.unref();
      }
      const buffer = this.#buffer;
      const state = new Int32Array(buffer, 0, 2);
      Atomics.store(state, 0, 0);
      Atomics.store(state, 1, 0);
      this.#worker.postMessage({ operation, input: safeInput, buffer });
      if (
        Atomics.wait(state, 0, 0, this.timeoutMs) === "timed-out" ||
        Atomics.load(state, 0) !== 1
      ) {
        this.dispose();
        return omit("detector_failure");
      }
      return freeze(
        JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(
            new Uint8Array(buffer, 8, Atomics.load(state, 1)),
          ),
        ),
      );
    } catch {
      this.dispose();
      return omit("detector_failure");
    }
  }
  text(value: string): Result<string> {
    return this.#call("text", value) as Result<string>;
  }
  value(value: unknown): Result<Json> {
    return this.#call("value", value) as Result<Json>;
  }
  path(value: string): Result<LogicalPath> {
    return this.#call("path", value) as Result<LogicalPath>;
  }
  registerSecrets(values: readonly string[]): boolean {
    const result = this.#call("register", values);
    if (result !== true) {
      this.dispose();
      return false;
    }
    return true;
  }
  dispose(): void {
    this.#closed = true;
    void this.#worker?.terminate();
    this.#worker = undefined;
  }
}
