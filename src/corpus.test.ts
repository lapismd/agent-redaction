import { describe, expect, it } from "vitest";
import { CompleteBlock, LIMITS, RedactionScope } from "./index.js";

const canary = "canary-not-a-real-key:af03490";
const getText = async (scope: RedactionScope, text: string) => { const result = await scope.text(text); expect(result.status).toBe("sanitized"); return result.status === "sanitized" ? result.value : ""; };
describe("conformance corpus", () => {
  it("covers encoded known values, short values, rotation, and stable markers", async () => {
    const s = new RedactionScope({ secrets: [canary, "xz"] });
    for (const text of [canary, encodeURIComponent(canary), btoa(canary), "xz"]) expect(await getText(s, text)).toBe("[REDACTED]");
    s.registerSecrets(["new-canary:123"]);
    expect(await getText(s, canary)).toBe("[REDACTED]");
    expect(await getText(s, "new-canary:123")).toBe("[REDACTED]");
    expect(await getText(s, "[REDACTED]")).toBe("[REDACTED]");
  });
  it("matches overlapping spans independent of rule ordering", async () => {
    expect(await getText(new RedactionScope({ secrets: ["abc123", "123xyz", "bc123x"] }), "abc123xyz")).toBe("[REDACTED]");
  });
  it("does not classify public IDs by entropy", async () => {
    const id = "abcdef0123456789".repeat(4);
    expect(await getText(new RedactionScope(), id)).toBe(id);
  });
  it("detects private keys, bearer credentials, nsec and URL userinfo", async () => {
    for (const text of ["-----BEGIN PRIVATE KEY-----\n" + canary + "\n-----END PRIVATE KEY-----", "Bearer " + canary, "nsec1" + "q".repeat(59), "https://user:pass@example.test/path", "secret=\"" + canary + "\""]) {
      expect(await getText(new RedactionScope(), text)).not.toContain(canary);
      expect(await getText(new RedactionScope(), text)).toContain("[REDACTED]");
    }
  });
  it("sanitizes ANSI-obscured secrets and removes OSC payloads", async () => {
    const s = new RedactionScope({ secrets: [canary] });
    const text = canary.slice(0, 5) + "\x1b[31m" + canary.slice(5);
    expect(await getText(s, text)).toBe("[REDACTED]");
    expect(await getText(s, "safe\x1b]0;" + canary + "\x07")).toBe("safe");
  });
  it("fails closed for registry limits and reserved-marker conflicts", async () => {
    for (const secrets of [["REDACTED"], ["x".repeat(LIMITS.secretBytes + 1)], Array.from({ length: 1025 }, (_, i) => `canary-${i}-unique`)]) {
      expect((await new RedactionScope({ secrets }).text("unscanned")).status).toBe("omitted");
    }
  });
  it("enforces text, DTO, depth, malformed Unicode and cycle bounds", async () => {
    const s = new RedactionScope();
    expect(await s.text("x".repeat(LIMITS.text + 1))).toMatchObject({ reason: "limit_exceeded" });
    expect(await s.text("\ud800")).toMatchObject({ reason: "invalid_input" });
    expect(await s.value(Array(5).fill("x".repeat(1024 * 1024)))).toMatchObject({ reason: "limit_exceeded" });
    let deep: unknown = "leaf";
    for (let i = 0; i < 34; i++) deep = { child: deep };
    expect(await s.value(deep)).toMatchObject({ reason: "limit_exceeded" });
    const cycle: { self?: unknown } = {}; cycle.self = cycle;
    expect(await s.value(cycle)).toMatchObject({ reason: "invalid_input" });
  });
  it("rejects source keys that change, exotic values, and prototype pollution", async () => {
    const s = new RedactionScope({ secrets: [canary] });
    for (const value of [{ [canary]: "value" }, new Date(), new Map(), JSON.parse('{"__proto__":{"polluted":true}}'), [undefined], Number.NaN, () => "value"]) {
      expect((await s.value(value)).status).toBe("omitted");
    }
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });
  it("redacts all structured credential forms", async () => {
    for (const key of ["PASSWORD", "privateKey", "api-key", "refresh_token", "Authorization", "environment", "clientSecret"]) {
      for (const value of [canary, [canary], { [canary]: canary }, 53, false]) {
        const result = await new RedactionScope().value({ [key]: value });
        expect(result.status === "sanitized" && result.value).toEqual({ [key]: "[REDACTED]" });
      }
    }
  });
  it("does not leak source values through malformed detector spans", async () => {
    const s = new RedactionScope({ detector: { id: "broken", async scan() { return [{ start: -1, end: 3 }]; } } });
    expect(await s.text(canary)).toEqual({ status: "omitted", reason: "detector_failure" });
  });
  it("fails closed on byte decoding, overflow and post-cancel appends", async () => {
    const broken = new CompleteBlock(new RedactionScope());
    broken.append(new Uint8Array([255]));
    expect(await broken.finish()).toMatchObject({ reason: "invalid_input" });
    const overflow = new CompleteBlock(new RedactionScope());
    overflow.append("x".repeat(LIMITS.text + 1)); overflow.append(canary);
    expect(await overflow.finish()).toEqual({ status: "omitted", reason: "limit_exceeded" });
  });
  it("cancellation while scanning cannot release completed text", async () => {
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const s = new RedactionScope({ detector: { id: "delayed", async scan() { await wait; return []; } } });
    const block = new CompleteBlock(s); block.append(canary);
    const result = block.finish(); block.cancel(); release();
    expect(await result).toMatchObject({ reason: "cancelled" });
  });
});

describe("portable paths", () => {
  const make = (destination: "public" | "private-portable" = "public") => new RedactionScope({ destination, secrets: [canary], roots: [
    { kind: "home", path: "/Users/test" },
    { kind: "temp", path: "/private/tmp", aliases: ["/tmp"] },
    { kind: "workspace", path: "/Users/test/project", id: "one", repositoryId: "repo" },
    { kind: "workspace", path: "/Users/test/project/nested", id: "two", repositoryId: "repo" },
    { kind: "workspace", path: "C:\\Users\\Test\\My Project", id: "win" },
    { kind: "workspace", path: "\\\\server\\share\\repo", id: "unc" },
  ] });
  it.each([
    ["/Users/test/project/a.ts", "$WORKSPACE[one]/a.ts"],
    ["/Users/test/project/nested/a.ts", "$WORKSPACE[two]/a.ts"],
    ["file:///Users/test/project/a.ts", "$WORKSPACE[one]/a.ts"],
    ["C:\\Users\\Test\\My Project\\a.ts", "$WORKSPACE[win]/a.ts"],
    ["file:///C:/Users/Test/My%20Project/a.ts", "$WORKSPACE[win]/a.ts"],
    ["\\\\server\\share\\repo\\a.ts", "$WORKSPACE[unc]/a.ts"],
    ["file://server/share/repo/a.ts", "$WORKSPACE[unc]/a.ts"],
    ["/Users/test/project/../private", "[EXTERNAL_PATH]"],
    ["/Users/test/private", "[EXTERNAL_PATH]"],
    ["/tmp/private", "[EXTERNAL_PATH]"],
    ["/another/private/file", "[EXTERNAL_PATH]"],
  ])("classifies %s", async (path, expected) => {
    const result = await make().path(path);
    expect(result.status === "sanitized" && result.value.display).toBe(expected);
    expect(await getText(make(), `read "${path}"`)).toBe(`read "${expected}"`);
  });
  it("retains only private portable suffixes", async () => {
    expect(await getText(make("private-portable"), "/Users/test/private /tmp/cache")).toBe("$HOME/private $TMP/cache");
  });
  it("removes private portable suffixes when projecting for public sharing", async () => {
    expect(await getText(make(), "$HOME/private/file $TMP/cache $WORKSPACE[one]/README")).toBe("[EXTERNAL_PATH] [EXTERNAL_PATH] $WORKSPACE[one]/README");
  });
  it("preserves web routes and already-portable paths", async () => {
    const text = "https://example.test/api/users $WORKSPACE[one]/README";
    expect(await getText(make(), text)).toBe(text);
  });
  it("does not turn secret filenames into resolvable references", async () => {
    const result = await make().path(`/Users/test/project/${canary}`);
    expect(result.status === "sanitized" && result.value).toMatchObject({ kind: "external", resolvable: false });
  });
  it("isolates concurrent scope roots and secrets", async () => {
    const a = new RedactionScope({ secrets: [canary], roots: [{ kind: "workspace", id: "a", path: "/a/repo" }] });
    const b = new RedactionScope({ roots: [{ kind: "workspace", id: "b", path: "/b/repo" }] });
    const [one, two] = await Promise.all([getText(a, `/a/repo/a ${canary}`), getText(b, "/b/repo/b")]);
    expect(one).toBe("$WORKSPACE[a]/a [REDACTED]"); expect(two).toBe("$WORKSPACE[b]/b");
  });
});
