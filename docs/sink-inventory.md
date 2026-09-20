# Capture boundary inventory

Audited local sibling source on 2026-09-20. This inventory records integration
work; the standalone package passing its tests does not prove consumer coverage.

| Boundary                                    | Owner                                                                  | Prior behavior                                           | Required gate and evidence                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Prompts, preparations, events, interactions | `ai-controller/src/persistence/store.ts`                               | Durable JSON before filtering; metadata-only is volatile | Sanitize before SQL binding; inspect every first write, WAL and replay                   |
| Provider output and tools                   | `ai-controller/src/domain/engine.ts`                                   | Raw chunks and tool data enter storage                   | Whole logical blocks, scanned intent before execution, scanned result/context copy       |
| acpx snapshots                              | `ai-host/src/executor.ts`                                              | File session store under workspace                       | Bounded volatile session store; external native agent journals remain outside guarantee  |
| Managed process logs                        | `ai-controller/src/managed.ts`                                         | One token replaced per stderr chunk                      | Bounded complete diagnostic records or fixed omission; never partial previews            |
| Signed evidence and run accumulation        | `nostr-agent-controller/src/controller.ts`, `src/store.ts`             | Raw signed content and public chunks retained            | Verify in memory, retain sanitized derived evidence and original references              |
| Outgoing replies and approved tools         | `nostr-agent-controller/src/controller.ts`, `src/public-transcript.ts` | Inconsistent per-field filters before signing            | One destination gate before signing/encryption; exact signed retry bytes                 |
| Owner Activity                              | Nostr controller owner journal                                         | Encrypted local journal, ephemeral relay telemetry       | Sanitize before encryption and durable acknowledgment; authorized replay                 |
| Memory, summaries, embeddings               | Shared memory services and consumer storage ports                      | Unfiltered evidence/context may enter derived data       | Gate ingest and model export; preserve consumer authorization                            |
| Checkpoint activity                         | `jj-checkpoint` RPC / capture database                                 | Trusts producer records                                  | New managed version requires completed sanitized records; native archive bytes unchanged |
| Direct Rust annotations                     | `jj-nostr mark`                                                        | Independent Rust producer                                | Deferred adapter; no sanitization guarantee                                              |

acpx 0.17.1 exposes normalized plan entries, tool content, input/output and file
locations. It still has no general public raw observation hook. Unknown exposed
events can be sanitized extensions; absent upstream detail must be an explicit
coverage gap. Do not parse its session files or implement ACP in a consumer.

Legacy durable data is not erased by enabling this package. Consumers must
re-sanitize authorized replay/model exports, mark legacy coverage and use a fresh
context handoff when native state is incompatible. Cleanup and publication of
historical material are separate operations.
