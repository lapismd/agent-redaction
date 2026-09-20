import { describe, expect, it } from "vitest";
import { RedactionScope, CompleteBlock } from "./index.js";

const secret = "synthetic-only-canary=4711!";
const roots = [{ kind: "workspace" as const, id: "probe", repositoryId: "repo", path: "/Users/test/project" }];
const scope = () => new RedactionScope({ secrets: [secret], roots });

describe("protected representations", () => {
  it("redacts unlabelled known values and portable roots before release", async () => {
    const output = await scope().text(`value ${secret}, file /Users/test/project/README`);
    expect(output.status).toBe("sanitized");
    expect(JSON.stringify(output)).not.toContain(secret);
    expect(JSON.stringify(output)).not.toContain("/Users/test");
    expect(output.status === "sanitized" && output.value).toContain("$WORKSPACE[probe]/README");
  });
  it("merges overlapping literal matches and retains rotated values", async () => {
    const s = new RedactionScope({ secrets: ["abca", "cabd"] });
    s.registerSecrets([secret]);
    const result = await s.text(`abcabd ${secret}`);
    expect(result.status === "sanitized" && result.value).toBe("[REDACTED] [REDACTED]");
  });
  it("redacts sensitive fields regardless of value type without changing input", async () => {
    const input = { password: { data: secret }, nested: [{ authorization: 123 }], text: "safe" };
    const before = JSON.stringify(input);
    const result = await scope().value(input);
    expect(result.status === "sanitized" && result.value).toEqual({ password: "[REDACTED]", nested: [{ authorization: "[REDACTED]" }], text: "safe" });
    expect(JSON.stringify(input)).toBe(before);
    expect(result.status === "sanitized" && Object.isFrozen(result.value)).toBe(true);
  });
  it("never calls accessors, toJSON, or returns a detector diagnostic", async () => {
    let accessed = false;
    expect((await scope().value({ get text() { accessed = true; return secret; } })).status).toBe("omitted");
    expect((await scope().value({ toJSON() { accessed = true; return secret; } })).status).toBe("omitted");
    expect(accessed).toBe(false);
    const failing = new RedactionScope({ detector: { id: "test", async scan() { throw new Error(secret); } } });
    expect(await failing.text(secret)).toMatchObject({ status: "omitted", reason: "detector_failure" });
    expect(JSON.stringify(await failing.text(secret))).not.toContain(secret);
  });
  it("discards cancelled raw blocks", async () => {
    const block = new CompleteBlock(scope());
    block.append(secret);
    expect(block.cancel()).toMatchObject({ status: "omitted", reason: "cancelled" });
    expect(await block.finish()).toMatchObject({ status: "omitted", reason: "cancelled" });
  });
  it("is invariant across every UTF-8 split, with no intermediate text", async () => {
    const s = scope();
    const text = `🙂 ${secret} /Users/test/project/README`;
    const bytes = new TextEncoder().encode(text);
    const expected = await s.text(text);
    for (let i = 0; i <= bytes.length; i++) {
      const block = new CompleteBlock(s);
      expect(block.append(bytes.slice(0, i))).toBeUndefined();
      expect(block.append(bytes.slice(i))).toBeUndefined();
      expect(await block.finish()).toEqual(expected);
    }
  });
});

it("does not reinterpret WebSocket relay URLs as filesystem paths", async () => {
  const urls = "wss://relay.example/channel ws://127.0.0.1:1234/path";
  const result = await scope().text(urls);
  expect(result.status === "sanitized" && result.value).toBe(urls);
});
