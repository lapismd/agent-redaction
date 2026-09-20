# Verification

| ID             | Status      | Evidence                                                                              |
| -------------- | ----------- | ------------------------------------------------------------------------------------- |
| AR-CORE-001    | Implemented | src/sanitizer.test.ts; src/corpus.test.ts                                             |
| AR-CORE-002    | Implemented | src/corpus.test.ts literal, overlap, encoded and registry cases                       |
| AR-CORE-003    | Implemented | src/corpus.test.ts adversarial plain DTOs                                             |
| AR-CORE-004    | Implemented | src/corpus.test.ts; src/adapters.test.ts worker timeout                               |
| AR-PATH-001    | Implemented | src/corpus.test.ts portable paths                                                     |
| AR-PATH-002    | Implemented | src/corpus.test.ts private/public/external paths, isolation and network URL exclusion |
| AR-STREAM-001  | Implemented | src/sanitizer.test.ts every UTF-8 split; src/corpus.test.ts cancellation              |
| AR-ADAPTER-001 | Implemented | src/adapters.test.ts; scripts/deno.test.ts                                            |
| AR-ADAPTER-002 | Implemented | src/adapters.test.ts grants and rotation; scripts/deno.test.ts                        |
| AR-ADAPTER-003 | Implemented | src/sync.test.ts first-write and deadline checks; scripts/deno.test.ts                |
| AR-PKG-001     | Implemented | scripts/check-boundaries.mjs; pnpm publint                                            |
| AR-ARCH-001    | Implemented | scripts/architecture.test.mjs; pnpm check:architecture                                |
| AR-GOV-001     | Implemented | pnpm spec:check                                                                       |
| AR-GOV-002     | Implemented | pnpm spec:check                                                                       |
| AR-GOV-003     | Implemented | pnpm spec:check                                                                       |
| AR-GOV-004     | Implemented | pnpm check:format                                                                     |
