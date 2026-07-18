// Public surface of the framework-independent HandoffOS security module.
export { PolicyService } from './policy.js';
export { AuthorizationError } from './errors.js';
export type { AuthorizationDenialReason, AuthorizationErrorInit } from './errors.js';
export { SEED_PRINCIPALS } from './principals.js';
export type { Principal } from './principals.js';
export {
  ALL_CAPABILITIES,
  ROLE_CAPABILITIES,
  rolesForCapability,
} from './roles.js';
export type { Capability, Role } from './roles.js';
