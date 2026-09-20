import { EXTERNAL, type LogicalPath, type TrustedRoot } from "./types.js";

interface Root { path: string; kind: TrustedRoot["kind"]; id?: string; repositoryId?: string; sensitive: boolean }
const safeId = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
function decodePath(value: string): string {
  if (/^file:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) throw 0;
    const decoded = decodeURIComponent(url.pathname);
    return url.hostname && url.hostname !== "localhost" ? `//${url.hostname}${decoded}` : decoded.replace(/^\/([A-Za-z]:\/)/, "$1");
  }
  return value;
}
function windows(value: string): boolean { return /^[A-Za-z]:[\\/]|^\\\\|^\/\/[^/]/.test(value); }
function normal(value: string): string { const decoded = decodePath(value); return windows(decoded) ? decoded.replace(/\\/g, "/") : decoded; }
function absolute(value: string): boolean { return /^(?:\/|[A-Za-z]:\/)/.test(value); }
function traversal(value: string): boolean { return value.split("/").some(part => part === ".." || part === ".") || /%2e|%2f|%5c/i.test(value); }
function escape(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export class PathRegistry {
  #roots: Root[] = [];
  #public: boolean;
  constructor(roots: readonly TrustedRoot[], destination: "public" | "private-portable") {
    this.#public = destination === "public";
    if (roots.length > 128) throw 0;
    for (const root of roots) {
      if (root.kind === "workspace" && (!root.id || !safeId.test(root.id))) throw 0;
      if (root.repositoryId && !safeId.test(root.repositoryId)) throw 0;
      for (const path of [root.path, ...(root.aliases ?? [])]) {
        const clean = normal(path).replace(/\/+$/, "");
        if (!absolute(clean) || traversal(clean) || !clean || /[\r\n\x00]/.test(clean)) throw 0;
        const item: Root = { path: clean, kind: root.kind, id: root.id, repositoryId: root.repositoryId, sensitive: root.caseSensitive ?? !windows(path) };
        if (this.#roots.some(existing => existing.path.toLowerCase() === clean.toLowerCase() && (existing.kind !== item.kind || existing.id !== item.id))) throw 0;
        this.#roots.push(item);
      }
    }
    this.#roots.sort((a, b) => b.path.length - a.path.length);
  }
  classify(value: string): LogicalPath {
    const external = (display = EXTERNAL): LogicalPath => Object.freeze({ kind: "external", display, resolvable: false });
    let path: string;
    try { path = normal(value); } catch { return external(); }
    if (!absolute(path) || traversal(path) || /\[REDACTED\]|[\x00-\x1f]/.test(path)) return external();
    for (const root of this.#roots) {
      const candidate = root.sensitive ? path : path.toLowerCase();
      const prefix = root.sensitive ? root.path : root.path.toLowerCase();
      if (candidate !== prefix && !candidate.startsWith(prefix + "/")) continue;
      const relativePath = path.slice(root.path.length).replace(/^\//, "");
      if (root.kind === "workspace") return Object.freeze({ kind: "workspace", workspaceId: root.id!, ...(root.repositoryId ? { repositoryId: root.repositoryId } : {}), relativePath, display: `$WORKSPACE[${root.id}]${relativePath ? "/" + relativePath : ""}`, resolvable: true });
      return external(this.#public ? EXTERNAL : `${root.kind === "home" ? "$HOME" : "$TMP"}${relativePath ? "/" + relativePath : ""}`);
    }
    return external();
  }
  text(value: string): string {
    if (this.#public) value = value.replace(/\$(?:HOME|TMP)(?:[\\/][^\s<>"'`,;)]*)?/g, EXTERNAL);
    // Skip web URLs as complete tokens; they are not local path capabilities.
    const trusted = this.#roots.map(root => escape(root.path).replace(/\//g, "[\\\\/]")).join("|");
    const candidate = `https?:\\/\\/[^\\s<>\"'\x60]+|file:\\/\\/[^\\s<>\"'\x60]+|(?:${trusted || "(?!)"})(?:[\\\\/][^\\s<>\"'\x60,;)]*)?|[A-Za-z]:[\\\\/][^\\s<>\"'\x60,;)]*|\\\\\\\\[^\\s<>\"'\x60,;)]*|\\/(?:[^\\s/<>\"'\x60,;)]*\\/)+[^\\s<>\"'\x60,;)]*`;
    const regex = new RegExp(candidate, "gi");
    return value.replace(regex, (match: string, offset: number) => {
      if (/^https?:\/\//i.test(match)) return match;
      // Do not match inside identifiers, URLs or already-portable placeholders.
      const before = value.slice(0, offset);
      if (offset > 0 && /[\w\/$\]]$/.test(before)) return match;
      const after = value[offset + match.length];
      if (after && /[\w.-]/.test(after)) return EXTERNAL;
      return this.classify(match).display;
    });
  }
}
