import { parentPort, workerData } from "node:worker_threads";
import { RedactionScope } from "./sanitizer.js";
import { secretlintDetector } from "./secretlint.js";
import { omit } from "./types.js";
const scope = new RedactionScope({ ...workerData.policy, detector: secretlintDetector });
parentPort!.on("message", async ({ operation, input, buffer }: { operation: "text" | "value" | "register"; input: unknown; buffer: SharedArrayBuffer }) => {
  const state = new Int32Array(buffer, 0, 2);
  const bytes = new Uint8Array(buffer, 8);
  try {
    const result = operation === "register" ? scope.registerSecrets(input as string[]) : operation === "text" ? await scope.text(input as string) : await scope.value(input);
    const encoded = new TextEncoder().encode(JSON.stringify(result));
    if (encoded.byteLength > bytes.length) throw 0;
    bytes.set(encoded);
    Atomics.store(state, 1, encoded.byteLength);
    Atomics.store(state, 0, 1);
  } catch {
    const encoded = new TextEncoder().encode(JSON.stringify(omit("detector_failure")));
    bytes.set(encoded); Atomics.store(state, 1, encoded.byteLength); Atomics.store(state, 0, 1);
  } finally { Atomics.notify(state, 0); }
});
