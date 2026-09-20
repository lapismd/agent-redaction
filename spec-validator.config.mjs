import {
  defineConfig,
  singleIdVerification,
  tableRequirements,
} from "@lapismd/spec-validator";
export default defineConfig(tableRequirements(), {
  name: "agent-redaction",
  idPattern: /^AR-[A-Z]+-\d{3}$/,
  tableSection: "Requirements",
  ruleIds: {
    summary: "AR-GOV-001",
    governance: "AR-GOV-003",
    verification: "AR-GOV-003",
    book: "AR-GOV-001",
    bookIgnore: "AR-GOV-001",
    specFirst: "AR-GOV-002",
    internal: "AR-GOV-003",
  },
  validators: {
    summary: true,
    governance: {
      extras: ["AGENTS.md", "README.md"],
      normative: true,
      proseLimits: true,
      acceptance: false,
      references: true,
      changeMap: true,
    },
    verification: singleIdVerification({
      headers: {
        ids: ["ID"],
        status: ["Status"],
        evidence: ["Evidence"],
        required: [],
      },
      statuses: ["Implemented", "Planned"],
    }),
    book: true,
    specFirst: {
      mode: "mapped",
      canonicalPattern: "^spec/src/(?:sanitization|spec-governance)\\.md$",
      ignore: ["(^|/)node_modules/", "^dist/", "^spec/book/", "\\.test\\.ts$"],
      protected: [
        "^(?:src/|scripts/|docs/|package\\.json$|deno\\.json$|AGENTS\\.md$|spec-validator\\.config\\.mjs$|spec/book\\.toml$|\\.gitignore$)",
      ],
      rules: [
        {
          pattern: "^(?:src/|scripts/|docs/|package\\.json$|deno\\.json$)",
          chapters: ["spec/src/sanitization.md"],
        },
        {
          pattern:
            "^(?:AGENTS\\.md$|spec-validator\\.config\\.mjs$|spec/book\\.toml$|\\.gitignore$)",
          chapters: ["spec/src/spec-governance.md"],
        },
      ],
    },
  },
  check: { build: true, first: true },
});
