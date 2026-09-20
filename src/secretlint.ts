import { lintSource } from "@secretlint/core";
import { secretLintProfiler } from "@secretlint/profiler";
import type { Detector, Span } from "./types.js";
import { creator as rule0 } from "@secretlint/secretlint-rule-aws";
import { creator as rule1 } from "@secretlint/secretlint-rule-gcp";
import { creator as rule2 } from "@secretlint/secretlint-rule-privatekey";
import { creator as rule3 } from "@secretlint/secretlint-rule-npm";
import { creator as rule4 } from "@secretlint/secretlint-rule-basicauth";
import { creator as rule5 } from "@secretlint/secretlint-rule-slack";
import { creator as rule6 } from "@secretlint/secretlint-rule-sendgrid";
import { creator as rule7 } from "@secretlint/secretlint-rule-shopify";
import { creator as rule8 } from "@secretlint/secretlint-rule-stripe";
import { creator as rule9 } from "@secretlint/secretlint-rule-github";
import { creator as rule10 } from "@secretlint/secretlint-rule-gitlab";
import { creator as rule11 } from "@secretlint/secretlint-rule-grafana";
import { creator as rule12 } from "@secretlint/secretlint-rule-openai";
import { creator as rule13 } from "@secretlint/secretlint-rule-anthropic";
import { creator as rule14 } from "@secretlint/secretlint-rule-groq";
import { creator as rule15 } from "@secretlint/secretlint-rule-huggingface";
import { creator as rule16 } from "@secretlint/secretlint-rule-linear";
import { creator as rule17 } from "@secretlint/secretlint-rule-notion";
import { creator as rule18 } from "@secretlint/secretlint-rule-1password";
import { creator as rule19 } from "@secretlint/secretlint-rule-database-connection-string";
import { creator as rule20 } from "@secretlint/secretlint-rule-hashicorp-vault";
import { creator as rule21 } from "@secretlint/secretlint-rule-vercel";
import { creator as rule22 } from "@secretlint/secretlint-rule-databricks";
import { creator as rule23 } from "@secretlint/secretlint-rule-docker";
import { creator as rule24 } from "@secretlint/secretlint-rule-figma";
import { creator as rule25 } from "@secretlint/secretlint-rule-cloudflare";
import { creator as rule26 } from "@secretlint/secretlint-rule-tailscale";

export const RULE_INVENTORY = Object.freeze(["aws", "gcp", "privatekey", "npm", "basicauth", "slack", "sendgrid", "shopify", "stripe", "github", "gitlab", "grafana", "openai", "anthropic", "groq", "huggingface", "linear", "notion", "1password", "database-connection-string", "hashicorp-vault", "vercel", "databricks", "docker", "figma", "cloudflare", "tailscale"]);
// No config loader, preset, filter-comments, allows, or producer options.
const rules = [rule0, rule1, rule2, rule3, rule4, rule5, rule6, rule7, rule8, rule9, rule10, rule11, rule12, rule13, rule14, rule15, rule16, rule17, rule18, rule19, rule20, rule21, rule22, rule23, rule24, rule25, rule26];
secretLintProfiler.setEnabled(false);
export const secretlintDetector: Detector = Object.freeze({
  id: "secretlint-13.0.5-explicit-27-v1",
  async scan(text: string): Promise<readonly Span[]> {
    try {
      const result = await lintSource({
        source: { content: text, filePath: "transcript.txt", ext: ".txt", contentType: "text" },
        options: { noPhysicFilePath: true, maskSecrets: true, config: { rules: rules.map(rule => ({ id: rule.meta.id, rule })) } },
      });
      // Some rules report an assignment prefix with a credential-length range.
      // Mask the complete affected lines so a misaligned range cannot retain a suffix.
      return result.messages.map(message => {
        const [start, end] = message.range;
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) throw 0;
        const lineEnd = text.indexOf("\n", end);
        return Object.freeze({ start: text.lastIndexOf("\n", Math.max(0, start - 1)) + 1, end: lineEnd === -1 ? text.length : lineEnd });
      });
    } catch { throw new Error("detector_failure"); }
  },
});
