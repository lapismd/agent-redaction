import { PathRegistry } from "./paths.js";
import {
  formatSpans,
  maskSpans,
  SecretRegistry,
  sensitiveKey,
  stripTerminalControls,
} from "./secrets.js";
import {
  EXTERNAL,
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
  #revision = 0;
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
    this.#revision++;
    return this.#registry.add(values);
  }
  dispose(): void {
    this.#revision++;
    this.#registry.dispose();
    this.#paths = undefined;
    this.#valid = false;
  }
  async #redact(text: string): Promise<string> {
    const spans = [...this.#registry.spans(text), ...formatSpans(text)];
    if (this.#detector) {
      try {
        spans.push(...(await this.#detector.scan(text)));
      } catch {
        throw new Failure("detector_failure");
      }
    }
    try {
      return maskSpans(text, spans);
    } catch {
      throw new Failure("detector_failure");
    }
  }
  async #scan(
    raw: string,
    metadata: { redacted: boolean; pathsNormalized: boolean },
  ): Promise<string> {
    const paths = this.#paths;
    if (!this.#valid || !this.#registry.valid || !paths)
      throw new Failure("policy_invalid");
    if (typeof raw !== "string" || !validUnicode(raw))
      throw new Failure("invalid_input");
    if (utf8Size(raw) > LIMITS.text) throw new Failure("limit_exceeded");
    const text = stripTerminalControls(raw);
    const redacted = await this.#redact(text);
    const portable = paths.text(redacted);
    if (utf8Size(portable) > LIMITS.text) throw new Failure("limit_exceeded");
    // Path projection may introduce text that was encoded in the input.
    const result =
      portable === redacted ? portable : await this.#redact(portable);
    if (utf8Size(result) > LIMITS.text) throw new Failure("limit_exceeded");
    metadata.redacted ||= text !== redacted || result !== portable;
    metadata.pathsNormalized ||= portable !== redacted;
    return result;
  }
  #result<T>(
    value: T,
    metadata: { redacted: boolean; pathsNormalized: boolean },
    revision: number,
  ): Result<T> {
    if (revision !== this.#revision) throw new Failure("policy_invalid");
    const summary: SanitizationSummary = Object.freeze({
      version: 1,
      policy: this.policyId,
      coverage: this.#detector ? "credential-detectors" : "portable",
      ...metadata,
    });
    return Object.freeze({ status: "sanitized", value, summary });
  }
  async text(raw: string): Promise<Result<string>> {
    const revision = this.#revision;
    const metadata = { redacted: false, pathsNormalized: false };
    try {
      return this.#result(await this.#scan(raw, metadata), metadata, revision);
    } catch (error) {
      return omit(error instanceof Failure ? error.reason : "invalid_input");
    }
  }
  async path(raw: string): Promise<Result<LogicalPath>> {
    const revision = this.#revision;
    const paths = this.#paths;
    const metadata = { redacted: false, pathsNormalized: false };
    try {
      const text = await this.#scan(raw, metadata);
      let path = paths!.classify(raw);
      // A standalone logical path can include characters outside a free-text token.
      if (
        !metadata.redacted &&
        path.display !== text &&
        path.display !== EXTERNAL
      )
        metadata.redacted = (await this.#redact(path.display)) !== path.display;
      if (metadata.redacted)
        path = Object.freeze({
          kind: "external",
          display: EXTERNAL,
          resolvable: false,
        });
      return this.#result(path, metadata, revision);
    } catch (error) {
      return omit(error instanceof Failure ? error.reason : "invalid_input");
    }
  }
  async value(raw: unknown): Promise<Result<Json>> {
    const revision = this.#revision;
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
      return this.#result(value, metadata, revision);
    } catch (error) {
      return omit(error instanceof Failure ? error.reason : "invalid_input");
    }
  }
}
