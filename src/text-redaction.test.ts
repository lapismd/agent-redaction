import { describe, expect, it } from "vitest";
import { createNodeRedaction } from "../dist/node.js";
import { CompleteBlock, RedactionScope } from "./index.js";

const canary = 'synthetic words with "quotes" and \\slashes';
const json = JSON.stringify({ password: canary, environment: "production" });
const cleanJson = JSON.stringify({
  password: "[REDACTED]",
  environment: "production",
});

describe("quoted text redaction", () => {
  it.each([
    "password",
    "PaSsWd",
    "secret",
    "token",
    "api-key",
    "API_KEY",
    "privateKey",
    "authorization",
    "cookie",
  ])("masks the string value of %s", async (key) => {
    const input = JSON.stringify({ [key]: canary, note: "safe" });
    expect(await new RedactionScope().text(input)).toMatchObject({
      status: "sanitized",
      value: JSON.stringify({ [key]: "[REDACTED]", note: "safe" }),
      summary: { redacted: true },
    });
  });

  it("handles single-quoted assignments alongside bare assignments", async () => {
    expect(
      await new RedactionScope().text(
        "token: synthetic, 'secret' = 'two words'",
      ),
    ).toMatchObject({ value: "[REDACTED], 'secret' = '[REDACTED]'" });
  });

  it("masks the remainder of an unfinished quoted value", async () => {
    const scope = new RedactionScope();
    expect(await scope.text('secret="synthetic value')).toMatchObject({
      value: "[REDACTED]",
    });
    expect(await scope.text('"secret": "synthetic value')).toMatchObject({
      value: '"secret": "[REDACTED]',
    });
  });

  it("uses the same rule for serialized objects inside DTO strings", async () => {
    expect(
      await new RedactionScope().value({ toolResult: json }),
    ).toMatchObject({
      value: { toolResult: cleanJson },
    });
  });

  it("masks buffered byte and string blocks at every split", async () => {
    const scope = new RedactionScope();
    const text = "tool 🙂 " + json;
    for (const input of [text, new TextEncoder().encode(text)]) {
      for (let offset = 0; offset <= input.length; offset++) {
        const block = new CompleteBlock(scope);
        block.append(input.slice(0, offset));
        block.append(input.slice(offset));
        expect(await block.finish()).toMatchObject({
          value: "tool 🙂 " + cleanJson,
          summary: { redacted: true },
        });
      }
    }
  });

  it("applies portable quoted-field redaction with the Node detector enabled", async () => {
    const runtime = createNodeRedaction();
    try {
      const block = new CompleteBlock(runtime.scope);
      block.append(json);
      expect(await block.finish()).toMatchObject({
        value: cleanJson,
        summary: { coverage: "credential-detectors", redacted: true },
      });
    } finally {
      runtime.dispose();
    }
  });
});

describe("registered values and scope changes", () => {
  it("keeps literal percent escapes case-sensitive and accepts URI hex case", async () => {
    const literal = "synthetic%2Fmarker";
    const uri = "synthetic/other";
    const scope = new RedactionScope({ secrets: [literal, uri] });
    expect(await scope.text(literal + " synthetic%2fother")).toMatchObject({
      value: "[REDACTED] [REDACTED]",
    });
    expect(await scope.text("synthetic%2fmarker")).toMatchObject({
      value: "synthetic%2fmarker",
      summary: { redacted: false },
    });
    expect(
      await new RedactionScope({ secrets: ["synthetic%2fmarker"] }).text(
        "synthetic%2fmarker",
      ),
    ).toMatchObject({ value: "[REDACTED]" });
  });

  it("matches the visible form of registered values after control stripping", async () => {
    const literal = "synthetic\x1b[31m-marker";
    const scope = new RedactionScope({ secrets: [literal] });
    expect(await scope.text(literal)).toMatchObject({ value: "[REDACTED]" });
  });

  it.each(["register", "invalidate", "dispose"])(
    "omits a scan when a concurrent policy change can %s",
    async (change) => {
      let release!: () => void;
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      const scope = new RedactionScope({
        detector: {
          id: "paused",
          async scan() {
            await paused;
            return [];
          },
        },
      });
      const result = scope.text(canary);
      if (change === "dispose") scope.dispose();
      else scope.registerSecrets([change === "register" ? canary : ""]);
      release();
      expect(await result).toEqual({
        status: "omitted",
        reason: "policy_invalid",
      });
      if (change === "register")
        expect(await scope.text(canary)).toMatchObject({ value: "[REDACTED]" });
    },
  );
});

describe("file URL normalization", () => {
  const scope = new RedactionScope({
    roots: [{ kind: "workspace", path: "/fixture/repo", id: "repo" }],
    secrets: ["synthetic-filename"],
  });

  it("checks a decoded filename before either text or path delivery", async () => {
    const url = "file:///fixture/repo/%73ynthetic-filename";
    expect(await scope.text(url)).toMatchObject({
      status: "sanitized",
      value: "$WORKSPACE[repo]/[REDACTED]",
      summary: { redacted: true, pathsNormalized: true },
    });
    expect(await scope.path(url)).toMatchObject({
      value: {
        kind: "external",
        resolvable: false,
        display: "[EXTERNAL_PATH]",
      },
    });
  });

  it.each(["..", "%2e%2E", "."])(
    "rejects a file URL with a %s path segment before URL parsing",
    async (segment) => {
      const url = `file:///fixture/repo/${segment}/repo/example.txt`;
      expect(await scope.path(url)).toMatchObject({
        value: { kind: "external", resolvable: false },
      });
      expect(await scope.text(url)).toMatchObject({ value: "[EXTERNAL_PATH]" });
    },
  );
});
