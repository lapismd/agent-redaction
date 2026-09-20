import { expect, it } from "vitest";
import { SynchronousRedaction } from "../dist/node.js";

it("sanitizes before a synchronous sink observes its first value", () => {
  const secret = "synthetic-sync-canary-982";
  const scope = new SynchronousRedaction({
    secrets: [secret],
    roots: [
      { kind: "workspace", id: "probe", path: "/private/test/workspace" },
    ],
  });
  try {
    const writes: string[] = [];
    const result = scope.value({
      text: `${secret}\n/private/test/workspace/README`,
    });
    expect(result.status).toBe("sanitized");
    if (result.status === "sanitized")
      writes.push(JSON.stringify(result.value));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.includes(secret)).toBe(false);
    expect(writes[0]?.includes("/private/test")).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(scope.path("/private/test/workspace/README")).toMatchObject({
      status: "sanitized",
      value: {
        kind: "workspace",
        workspaceId: "probe",
        relativePath: "README",
        resolvable: true,
      },
    });
    expect(scope.registerSecrets(["rotated-sync-canary-432"])).toBe(true);
    expect(scope.text("rotated-sync-canary-432")).toMatchObject({
      value: "[REDACTED]",
    });
    let touched = false;
    expect(
      scope.value({
        get text() {
          touched = true;
          return secret;
        },
      }).status,
    ).toBe("omitted");
    expect(touched).toBe(false);
  } finally {
    scope.dispose();
  }
});
it("synchronous deadlines fail closed without waiting on the blocked event loop", () => {
  const scope = new SynchronousRedaction({}, 1);
  try {
    expect(scope.text("private input")).toEqual({
      status: "omitted",
      reason: "detector_failure",
    });
  } finally {
    scope.dispose();
  }
});
it("keeps the durable boundary healthy over a journal replay sized burst", () => {
  const scope = new SynchronousRedaction();
  try {
    for (let index = 0; index < 1500; index++) {
      expect(
        scope.value({
          index,
          id: "90cf149a-5927-41cd-b0f3-0059464285ab",
          provider: "fake",
          workspace: "root",
          owner: "owner",
          payloadPolicy: "durable",
          createdAt: 178990241,
          memoryEndpoint: "memory",
          version: 1,
          contextSources: ["context.test"],
        }),
      ).toMatchObject({ status: "sanitized", value: { index } });
    }
  } finally {
    scope.dispose();
  }
}, 30_000);
