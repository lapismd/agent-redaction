import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNodeDetector, createNodeRedaction, refreshNodeSecrets } from "../dist/node.js";
import { RULE_INVENTORY } from "../dist/secretlint.js";
import { RedactionScope } from "./index.js";

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0)) await fn(); });
describe("Node enforcement", () => {
  it("runs pinned rules in isolation and ignores suppression directives", async () => {
    expect(RULE_INVENTORY).toHaveLength(27);
    expect(RULE_INVENTORY).not.toContain("filter-comments");
    const runtime = createNodeRedaction(); cleanup.push(runtime.dispose);
    const canary = "npm_" + "Ab9x".repeat(9);
    const result = await runtime.scope.text(`// secretlint-disable\n${canary}\n// secretlint-enable`);
    expect(result.status).toBe("sanitized");
    expect(JSON.stringify(result).includes(canary)).toBe(false);
    expect(result.status === "sanitized" && result.summary.coverage).toBe("credential-detectors");
  });
  it("removes tokens even when a rule reports a partial assignment range", async () => {
    const runtime = createNodeRedaction(); cleanup.push(runtime.dispose);
    const canary = "npm_" + "Xy7p".repeat(9);
    const result = await runtime.scope.text(`_authToken=${canary}`);
    expect(result.status === "sanitized" && result.value).toBe("[REDACTED]");
  });
  it("terminates timed-out scans and never forwards stderr or exception text", async () => {
    const detector = createNodeDetector(1); cleanup.push(() => detector.dispose());
    const result = await new RedactionScope({ detector }).text("synthetic-only-private-payload");
    expect(result).toEqual({ status: "omitted", reason: "detector_failure" });
  });
  it("reads only explicitly granted names and files and retains rotations", async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), "redaction-fixture-")));
    cleanup.push(() => rm(directory, { recursive: true, force: true }));
    const path = join(directory, ".env");
    await writeFile(path, "API_KEY=dotenv-canary-552\n");
    const scope = new RedactionScope();
    expect(await refreshNodeSecrets(scope, { environment: ["GRANTED"], dotenvFiles: [path] }, { GRANTED: "granted-canary-881", NOT_GRANTED: "ungranted-canary-990" })).toBe(true);
    expect(await refreshNodeSecrets(scope, { environment: ["GRANTED"] }, { GRANTED: "rotated-canary-222" })).toBe(true);
    for (const value of ["dotenv-canary-552", "granted-canary-881", "rotated-canary-222"]) {
      const result = await scope.text(value); expect(result.status === "sanitized" && result.value).toBe("[REDACTED]");
    }
    const ungranted = await scope.text("ungranted-canary-990");
    expect(ungranted.status === "sanitized" && ungranted.value).toBe("ungranted-canary-990");
  });
  it("failed source refresh poisons the scope instead of continuing with stale policy", async () => {
    const scope = new RedactionScope();
    expect(await refreshNodeSecrets(scope, { dotenvFiles: ["/nonexistent-test-fixture-redaction"] })).toBe(false);
    expect(await scope.text("text")).toMatchObject({ status: "omitted", reason: "policy_invalid" });
  });
});
