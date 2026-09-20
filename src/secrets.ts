import { EXTERNAL, LIMITS, REDACTED, utf8Size, validUnicode, type Span } from "./types.js";

const markers = [REDACTED, EXTERNAL, "$WORKSPACE[", "$HOME", "$TMP"];
export class SecretRegistry {
  #values = new Set<string>();
  #variants: string[] = [];
  #valid = true;
  get valid(): boolean { return this.#valid; }
  add(values: readonly string[]): boolean {
    if (!this.#valid) return false;
    try {
      const next = new Set(this.#values);
      for (const value of values) {
        if (typeof value !== "string" || !value || !validUnicode(value) || markers.some(m => m.includes(value) || value.includes(m))) throw 0;
        next.add(value);
        if (next.size > LIMITS.secrets) throw 0;
      }
      if ([...next].reduce((n, value) => n + utf8Size(value), 0) > LIMITS.secretBytes) throw 0;
      const variants = new Set<string>();
      for (const value of next) {
        const bytes = new TextEncoder().encode(value);
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        const encoded = btoa(binary);
        for (const candidate of [value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1), encoded, encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")]) variants.add(candidate);
      }
      this.#values = next;
      this.#variants = [...variants].sort((a, b) => b.length - a.length);
      return true;
    } catch { this.clear(); this.#valid = false; return false; }
  }
  spans(text: string): Span[] {
    const spans: Span[] = [];
    const uriNormalized = text.replace(/%[a-f0-9]{2}/gi, match => match.toUpperCase());
    for (const value of this.#variants) {
      const source = /%[A-F0-9]{2}/.test(value) ? uriNormalized : text;
      let start = source.indexOf(value);
      while (start !== -1) {
        spans.push({ start, end: start + value.length });
        if (spans.length > LIMITS.text) throw 0;
        start = source.indexOf(value, start + 1);
      }
    }
    return spans;
  }
  clear(): void { this.#values.clear(); this.#variants = []; }
  dispose(): void { this.clear(); this.#valid = false; }
}

export function maskSpans(text: string, spans: readonly Span[]): string {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: { start: number; end: number }[] = [];
  for (const span of sorted) {
    if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end > text.length || span.end <= span.start) throw 0;
    const previous = merged.at(-1);
    if (previous && span.start < previous.end) previous.end = Math.max(previous.end, span.end);
    else merged.push({ ...span });
  }
  let cursor = 0, output = "";
  for (const span of merged) { output += text.slice(cursor, span.start) + REDACTED; cursor = span.end; }
  return output + text.slice(cursor);
}

// These are context rules, not entropy detection. Public identifiers remain intact.
const patterns = [
  /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----|$)/g,
  /\bnsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}\b/gi,
  /\b(?:Bearer|Basic)\s+[^\s"'<>]+/gi,
  /\b(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|authorization|cookie)\s*[=:]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;]+)/gi,
  /\b(?:bunker|nostrconnect):\/\/[^\s<>"']+/gi,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/gi,
  /[?&](?:access_token|refresh_token|api_key|token|secret|password)=[^&#\s"']+/gi,
];
export function formatSpans(text: string): Span[] {
  return patterns.flatMap(pattern => [...text.matchAll(pattern)].map(match => ({ start: match.index!, end: match.index! + match[0].length })));
}
export function sensitiveKey(key: string): boolean {
  return /(?:^|[_\-.])(?:password|passwd|secret|secrets|token|credentials?|authorization|cookie|cookies|env|environment|privatekey|apikey|accesskey|signingkey)(?:$|[_\-.])/i.test(key.replace(/([a-z])([A-Z])/g, "$1_$2")) || /^(?:api|private|access|refresh|signing)[_\-.]?(?:key|token)$/i.test(key);
}
export function stripTerminalControls(text: string): string {
  return text.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\|$)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, "");
}
