import { describe, expect, it } from "vitest";
import { nativeBoundaryErrors } from "./check-native-boundaries.mjs";

describe("native privacy boundary", () => {
  const inspect = (dependencies) =>
    nativeBoundaryErrors([{ name: "lapis-agent-redaction", dependencies }]);
  it("rejects application models, execution and detector default features", () => {
    expect(
      inspect([
        { name: "jj-agent" },
        { name: "lapis-ai-runtime" },
        { name: "tokio" },
        { name: "kingfisher-scanner", uses_default_features: true },
      ]),
    ).toHaveLength(4);
  });
  it("admits pinned scanner libraries and test-only temporary directories", () => {
    expect(
      inspect([
        { name: "serde_json" },
        { name: "kingfisher-scanner", uses_default_features: false },
        { name: "tempfile", kind: "dev" },
      ]),
    ).toEqual([]);
    expect(inspect([{ name: "tempfile" }])).toHaveLength(1);
  });
});
