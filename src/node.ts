import { Worker } from "node:worker_threads";
import { open, realpath } from "node:fs/promises";
import { parse } from "dotenv";
import { RedactionScope } from "./sanitizer.js";
import { LIMITS, type Detector, type Policy, type Span } from "./types.js";
export { SynchronousRedaction } from "./sync.js";

export interface NodeDetector extends Detector {
  dispose(): void;
}
/** Explicit construction starts an isolated scanner. No worker starts on import. */
export function createNodeDetector(timeoutMs = 10_000): NodeDetector {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000)
    throw new Error("policy_invalid");
  let worker: Worker | undefined,
    next = 0,
    closed = false;
  const pending = new Map<
    number,
    {
      resolve(spans: readonly Span[]): void;
      reject(error: Error): void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const fail = () => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("detector_failure"));
    }
    pending.clear();
    const previous = worker;
    worker = undefined;
    void previous?.terminate();
  };
  const start = () => {
    if (worker) return worker;
    // Empty worker env prevents DEBUG and profiler settings from exposing source.
    const active = new Worker(new URL("./node-worker.js", import.meta.url), {
      env: {},
      stdout: true,
      stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    active.stdout?.resume();
    active.stderr?.resume();
    active.on(
      "message",
      (message: { id: number; spans?: readonly Span[]; failure?: boolean }) => {
        const entry = pending.get(message.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        pending.delete(message.id);
        if (message.failure || !Array.isArray(message.spans))
          entry.reject(new Error("detector_failure"));
        else entry.resolve(message.spans);
      },
    );
    active.on("error", () => {
      if (worker === active) fail();
    });
    active.on("exit", () => {
      if (worker === active) fail();
    });
    worker = active;
    return active;
  };
  return Object.freeze({
    id: "secretlint-13.0.5-explicit-27-v1",
    scan(text: string): Promise<readonly Span[]> {
      if (closed || pending.size >= 64)
        return Promise.reject(new Error("detector_failure"));
      return new Promise((resolve, reject) => {
        const id = ++next;
        const timer = setTimeout(fail, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        try {
          start().postMessage({ id, text });
        } catch {
          fail();
        }
      });
    },
    dispose() {
      closed = true;
      fail();
    },
  });
}

export interface SecretGrants {
  readonly environment?: readonly string[];
  readonly dotenvFiles?: readonly string[];
}
/** Only explicit names and canonical paths are read. No directory discovery. */
export async function refreshNodeSecrets(
  scope: Pick<RedactionScope, "registerSecrets" | "dispose">,
  grants: SecretGrants,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<boolean> {
  const values: string[] = [];
  try {
    if (
      (grants.environment?.length ?? 0) + (grants.dotenvFiles?.length ?? 0) >
      LIMITS.secrets
    )
      throw 0;
    for (const name of grants.environment ?? []) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw 0;
      const value = environment[name];
      if (value) values.push(value);
    }
    for (const path of grants.dotenvFiles ?? []) {
      const canonical = await realpath(path);
      if (canonical !== path) throw 0;
      const handle = await open(canonical, "r");
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > LIMITS.secretBytes) throw 0;
        const data = new Uint8Array(LIMITS.secretBytes + 1);
        const { bytesRead } = await handle.read(data, 0, data.length, 0);
        if (bytesRead > LIMITS.secretBytes) throw 0;
        const text = new TextDecoder("utf-8", { fatal: true }).decode(
          data.subarray(0, bytesRead),
        );
        values.push(...Object.values(parse(text)).filter(Boolean));
      } finally {
        await handle.close();
      }
    }
    return scope.registerSecrets(values);
  } catch {
    scope.dispose();
    return false;
  }
}

export function createNodeRedaction(policy: Omit<Policy, "detector"> = {}): {
  scope: RedactionScope;
  dispose(): void;
} {
  const detector = createNodeDetector();
  const scope = new RedactionScope({ ...policy, detector });
  return {
    scope,
    dispose() {
      scope.dispose();
      detector.dispose();
    },
  };
}
