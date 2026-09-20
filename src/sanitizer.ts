import { PathRegistry } from "./paths.js";
import {
  formatSpans,
  maskSpans,
  SecretRegistry,
  sensitiveKey,
  stripTerminalControls,
} from "./secrets.js";
import {
  LIMITS,
  REDACTED,
  omit,
  utf8Size,
  validUnicode,
  type Json,
  type LogicalPath,
  type OmissionReason,
  type Policy,
  type Result,
  type SanitizationSummary,
} from "./types.js";

class Failure {
  constructor(readonly reason: OmissionReason) {}
}
export class RedactionScope {
  #registry = new SecretRegistry();
  #paths?: PathRegistry;
  #detector: Policy["detector"];
  #destination: NonNullable<Policy["destination"]>;
  #valid = true;
  constructor(policy: Policy = {}) {
    this.#destination = policy.destination ?? "public";
    this.#detector = policy.detector;
    if (this.#detector && !/^[a-zA-Z0-9._:/-]{1,160}$/.test(this.#detector.id))
      this.#valid = false;
    this.#registry.add(policy.secrets ?? []);
    try {
      this.#paths = new PathRegistry(policy.roots ?? [], this.#destination);
    } catch {
      this.#valid = false;
    }
  }
  get policyId(): string {
    return `agent-redaction/1/${this.#destination}/${this.#detector?.id ?? "portable"}`;
  }
  registerSecrets(values: readonly string[]): boolean {
    return this.#registry.add(values);
  }
  dispose(): void {
    this.#registry.dispose();
    this.#paths = undefined;
    this.#valid = false;
  }
  async #scan(
    raw: string,
    metadata: { redacted: boolean; pathsNormalized: boolean },
  ): Promise<string> {
    if (!this.#valid || !this.#registry.valid || !this.#paths)
      throw new Failure("policy_invalid");
    if (typeof raw !== "string" || !validUnicode(raw))
      throw new Failure("invalid_input");
    if (utf8Size(raw) > LIMITS.text) throw new Failure("limit_exceeded");
    const text = stripTerminalControls(raw);
    const spans = [...this.#registry.spans(text), ...formatSpans(text)];
    if (this.#detector) {
      try {
        spans.push(...(await this.#detector.scan(text)));
      } catch {
        throw new Failure("detector_failure");
      }
    }
    let redacted: string;
    try {
      redacted = maskSpans(text, spans);
    } catch {
      throw new Failure("detector_failure");
    }
    const portable = this.#paths.text(redacted);
    if (utf8Size(portable) > LIMITS.text) throw new Failure("limit_exceeded");
    metadata.redacted ||= text !== redacted;
    metadata.pathsNormalized ||= portable !== redacted;
    return portable;
  }
  #result<T>(
    value: T,
    metadata: { redacted: boolean; pathsNormalized: boolean },
  ): Result<T> {
    const summary: SanitizationSummary = Object.freeze({
      version: 1,
      policy: this.policyId,
      coverage: this.#detector ? "credential-detectors" : "portable",
      ...metadata,
    });
    return Object.freeze({ status: "sanitized", value, summary });
  }
  async text(raw: string): Promise<Result<string>> {
    const metadata = { redacted: false, pathsNormalized: false };
    try {
      return this.#result(await this.#scan(raw, metadata), metadata);
    } catch (error) {
      return omit(error instanceof Failure ? error.reason : "invalid_input");
    }
  }
  async path(raw: string): Promise<Result<LogicalPath>> {
    const result = await this.text(raw);
    if (result.status === "omitted") return result;
    // A secret-bearing path may be displayed, but cannot be resolved.
    const path: LogicalPath = result.summary.redacted
      ? Object.freeze({
          kind: "external",
          display: "[EXTERNAL_PATH]",
          resolvable: false,
        })
      : this.#paths!.classify(raw);
    return Object.freeze({ ...result, value: path });
  }
  async value(raw: unknown): Promise<Result<Json>> {
    const metadata = { redacted: false, pathsNormalized: false };
    let size = 0,
      nodes = 0;
    const seen = new Set<object>();
    const charge = (value: string) => {
      size += utf8Size(JSON.stringify(value));
      if (size > LIMITS.record) throw new Failure("limit_exceeded");
    };
    const visit = async (value: unknown, depth: number): Promise<Json> => {
      if (++nodes > 100_000 || depth > LIMITS.depth)
        throw new Failure("limit_exceeded");
      if (typeof value === "string") {
        charge(value);
        return this.#scan(value, metadata);
      }
      if (
        value === null ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value))
      ) {
        size += 32;
        if (size > LIMITS.record) throw new Failure("limit_exceeded");
        return value;
      }
      if (typeof value !== "object" || seen.has(value))
        throw new Failure("invalid_input");
      const array = Array.isArray(value);
      const prototype = Object.getPrototypeOf(value);
      if (
        (!array && prototype !== Object.prototype && prototype !== null) ||
        (array && prototype !== Array.prototype) ||
        Object.getOwnPropertySymbols(value).length
      )
        throw new Failure("invalid_input");
      seen.add(value);
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const keys = Object.keys(descriptors).filter(
        (key) => !(array && key === "length"),
      );
      if (keys.length > 100_000) throw new Failure("limit_exceeded");
      const target: Record<string, Json> = Object.create(null);
      const entries: Json[] = [];
      for (const key of keys) {
        const descriptor = descriptors[key]!;
        if (
          !descriptor.enumerable ||
          !Object.hasOwn(descriptor, "value") ||
          key === "toJSON" ||
          key === "__proto__" ||
          key === "constructor" ||
          key === "prototype"
        )
          throw new Failure("invalid_input");
        charge(key);
        if (array && key !== String(entries.length))
          throw new Failure("invalid_input");
        const cleanKey = await this.#scan(key, metadata);
        if (cleanKey !== key) throw new Failure("invalid_input");
        let next: Json;
        if (sensitiveKey(key)) {
          next = REDACTED;
          metadata.redacted = true;
        } else next = await visit(descriptor.value, depth + 1);
        if (array) entries.push(next);
        else target[key] = next;
      }
      if (array && entries.length !== (value as unknown[]).length)
        throw new Failure("invalid_input");
      seen.delete(value);
      return Object.freeze(array ? entries : target);
    };
    try {
      if (!this.#valid || !this.#registry.valid)
        throw new Failure("policy_invalid");
      const value = await visit(raw, 0);
      if (utf8Size(JSON.stringify(value)) > LIMITS.record)
        throw new Failure("limit_exceeded");
      return this.#result(value, metadata);
    } catch (error) {
      return omit(error instanceof Failure ? error.reason : "invalid_input");
    }
  }
}
