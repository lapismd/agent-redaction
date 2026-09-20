import { parentPort } from "node:worker_threads";
import { secretlintDetector } from "./secretlint.js";
parentPort!.on(
  "message",
  async ({ id, text }: { id: number; text: string }) => {
    try {
      parentPort!.postMessage({
        id,
        spans: await secretlintDetector.scan(text),
      });
    } catch {
      parentPort!.postMessage({ id, failure: true });
    }
  },
);
