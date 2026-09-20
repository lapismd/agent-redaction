// Deno's node compatibility is an explicit, separately tested enforcement adapter.
// Permissions remain enforced by Deno; nothing is discovered on module import.
export {
  createNodeDetector as createDenoDetector,
  createNodeRedaction as createDenoRedaction,
  refreshNodeSecrets as refreshDenoSecrets,
} from "./node.js";
export type { SecretGrants } from "./node.js";
export { SynchronousRedaction } from "./sync.js";
