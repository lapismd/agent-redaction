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
      canonicalPattern:
        "^spec/src/(?:sanitization|spec-governance|architecture)\\.md$",
      ignore: [
        "(^|/)node_modules/",
        "^dist/",
        "^spec/book/",
        "\\.(?:test)\\.(?:ts|mjs)$",
      ],
      protected: [
        "^(?:\\.github/|pnpm-|crates/|Cargo\\.(?:toml|lock)$|rust-toolchain\\.toml$|vitest\\.config\\.ts$|src/|scripts/|docs/|package\\.json$|deno\\.json$|AGENTS\\.md$|spec-validator\\.config\\.mjs$|spec/book\\.toml$|\\.gitignore$|\\.prettierrc\\.json$|\\.prettierignore$)",
      ],
      rules: [
        {
          pattern:
            "^(?:\\.github/|scripts/(?:npm-release|native-release(?:-policy)?|native-consumer)\\.mjs$|crates/|Cargo\\.(?:toml|lock)$|rust-toolchain\\.toml$|vitest\\.config\\.ts$|src/|scripts/(?:check-boundaries|check-native-boundaries|dev-cargo)\\.mjs$|scripts/deno\\.test\\.ts$|docs/|package\\.json$|deno\\.json$)",
          chapters: ["spec/src/sanitization.md"],
        },
        {
          pattern: "^scripts/(?:check-architecture\\.mjs$|architecture)",
          chapters: ["spec/src/architecture.md"],
        },
        {
          pattern:
            "^(?:pnpm-|AGENTS\\.md$|spec-validator\\.config\\.mjs$|spec/book\\.toml$|\\.gitignore$|\\.prettierrc\\.json$|\\.prettierignore$)",
          chapters: ["spec/src/spec-governance.md"],
        },
      ],
    },
  },
  check: {
    build: true,
    first: true,
    lanes: [
      {
        name: "architecture",
        command: "node",
        args: ["scripts/check-architecture.mjs"],
      },
    ],
  },
});
