import { createDenoRedaction, refreshDenoSecrets, SynchronousRedaction } from "../dist/deno.js";
import { CompleteBlock } from "../dist/index.js";

function check(value: boolean): asserts value { if (!value) throw new Error("enforcement assertion failed"); }
Deno.test("Deno worker enforcement, granted environment and byte buffering", async () => {
  const runtime = createDenoRedaction({ roots: [{ kind: "workspace", path: "/private/fixture/workspace", id: "probe" }] });
  try {
    const literal = "synthetic-deno-canary-837";
    check(await refreshDenoSecrets(runtime.scope, { environment: ["ONLY_GRANTED"] }, { ONLY_GRANTED: literal }));
    const patterned = "npm_" + "Bx2y".repeat(9);
    const block = new CompleteBlock(runtime.scope);
    const bytes = new TextEncoder().encode(`${literal}\n// secretlint-disable\n${patterned}\n/private/fixture/workspace/README`);
    block.append(bytes.subarray(0, 13)); block.append(bytes.subarray(13));
    const result = await block.finish();
    check(result.status === "sanitized");
    const text = JSON.stringify(result);
    check(!text.includes(literal) && !text.includes(patterned) && !text.includes("/private/fixture"));
    check(text.includes("$WORKSPACE[probe]/README"));
  } finally { runtime.dispose(); }
});

Deno.test("Deno synchronous durable boundary", () => {
  const secret = "synthetic-deno-sync-canary-726";
  const scope = new SynchronousRedaction({ secrets: [secret] });
  try {
    const result = scope.value({ message: secret });
    check(result.status === "sanitized");
    check(!JSON.stringify(result).includes(secret));
  } finally { scope.dispose(); }
});
