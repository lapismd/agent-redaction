export type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [key: string]: Json };
export type OmissionReason =
  | "invalid_input"
  | "limit_exceeded"
  | "detector_failure"
  | "policy_invalid"
  | "cancelled"
  | "incomplete";
export interface SanitizationSummary {
  readonly version: 1;
  readonly policy: string;
  readonly coverage: "portable" | "credential-detectors";
  readonly redacted: boolean;
  readonly pathsNormalized: boolean;
}
export interface Sanitized<T> {
  readonly status: "sanitized";
  readonly value: T;
  readonly summary: SanitizationSummary;
}
export interface Omission {
  readonly status: "omitted";
  readonly reason: OmissionReason;
}
export type Result<T> = Sanitized<T> | Omission;
export interface Span {
  readonly start: number;
  readonly end: number;
}
export interface Detector {
  /** Static reviewed inventory identity, never source or runtime diagnostics. */
  readonly id: string;
  scan(text: string): Promise<readonly Span[]>;
}
export interface TrustedRoot {
  readonly kind: "workspace" | "home" | "temp";
  readonly path: string;
  readonly id?: string;
  readonly repositoryId?: string;
  readonly aliases?: readonly string[];
  readonly caseSensitive?: boolean;
}
export type LogicalPath =
  | Readonly<{
      kind: "workspace";
      workspaceId: string;
      repositoryId?: string;
      relativePath: string;
      display: string;
      resolvable: true;
    }>
  | Readonly<{ kind: "external"; display: string; resolvable: false }>;
export interface Policy {
  readonly secrets?: readonly string[];
  readonly roots?: readonly TrustedRoot[];
  readonly destination?: "private-portable" | "public";
  readonly detector?: Detector;
}
export const LIMITS = Object.freeze({
  text: 2 * 1024 * 1024,
  record: 4 * 1024 * 1024,
  depth: 32,
  secrets: 1024,
  secretBytes: 1024 * 1024,
});
export const REDACTED = "[REDACTED]";
export const EXTERNAL = "[EXTERNAL_PATH]";
export function omit(reason: OmissionReason): Omission {
  return Object.freeze({ status: "omitted", reason });
}
export function utf8Size(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}
export function validUnicode(text: string): boolean {
  return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
    text,
  );
}
