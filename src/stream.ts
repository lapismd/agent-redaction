import { RedactionScope } from "./sanitizer.js";
import {
  LIMITS,
  omit,
  utf8Size,
  type Result,
  type Omission,
  type OmissionReason,
} from "./types.js";

export class CompleteBlock {
  #decoder = new TextDecoder("utf-8", { fatal: true });
  #parts: string[] = [];
  #bytes = 0;
  #result?: Result<string>;
  #pending?: Promise<Result<string>>;
  #mode?: "text" | "bytes";
  constructor(private readonly scope: RedactionScope) {}
  append(chunk: string | Uint8Array): void {
    if (this.#result || this.#pending) return;
    try {
      const mode = typeof chunk === "string" ? "text" : "bytes";
      if (this.#mode && this.#mode !== mode) {
        this.cancel("invalid_input");
        return;
      }
      this.#mode = mode;
      this.#bytes +=
        typeof chunk === "string" ? utf8Size(chunk) : chunk.byteLength;
      if (this.#bytes > LIMITS.text || this.#parts.length >= 65536) {
        this.cancel("limit_exceeded");
        return;
      }
      this.#parts.push(
        typeof chunk === "string"
          ? chunk
          : this.#decoder.decode(chunk, { stream: true }),
      );
    } catch {
      this.cancel("invalid_input");
    }
  }
  cancel(reason: OmissionReason = "cancelled"): Omission {
    this.#parts = [];
    this.#decoder = new TextDecoder("utf-8", { fatal: true });
    const result = omit(reason);
    if (!this.#result) this.#result = result;
    return this.#result.status === "omitted" ? this.#result : result;
  }
  async finish(): Promise<Result<string>> {
    if (this.#result) return this.#result;
    if (this.#pending) return this.#pending;
    try {
      const text = this.#parts.join("") + this.#decoder.decode();
      this.#parts = [];
      this.#pending = this.scope
        .text(text)
        .then((result) => (this.#result ??= result));
      return await this.#pending;
    } catch {
      return this.cancel("invalid_input");
    }
  }
}
