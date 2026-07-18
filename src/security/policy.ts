import { AuthorizationError } from './errors.js';
import type { Principal } from './principals.js';
import { SEED_PRINCIPALS } from './principals.js';
import type { Capability } from './roles.js';
import { ROLE_CAPABILITIES, rolesForCapability } from './roles.js';

// Deterministic, framework-free authorization for HandoffOS capabilities.
//
// The service resolves a principal by id, then authorizes a named capability
// against the roles that principal holds. `admin` is a hard override: it passes
// every capability regardless of the role/capability map.
export class PolicyService {
  private readonly principals: Map<string, Principal>;

  constructor(principals: Principal[] = SEED_PRINCIPALS) {
    this.principals = new Map(principals.map((principal) => [principal.id, principal]));
  }

  // Resolve a principal by id, throwing a structured error when it is unknown.
  resolvePrincipal(principalId: string): Principal {
    const principal = this.principals.get(principalId);
    if (!principal) {
      throw new AuthorizationError({
        reason: 'unknown_principal',
        principalId,
        requiredRoles: [],
        message: `Unknown principal "${principalId}".`,
      });
    }
    return principal;
  }

  // Non-throwing check: true when the principal exists and holds the capability
  // (directly or via the admin override).
  can(principalId: string, capability: Capability): boolean {
    const principal = this.principals.get(principalId);
    if (!principal) return false;
    return this.grants(principal, capability);
  }

  // Authorize a capability. Returns the resolved principal on success; throws an
  // AuthorizationError (unknown_principal or capability_denied) otherwise.
  authorize(principalId: string, capability: Capability): Principal {
    const principal = this.resolvePrincipal(principalId);
    if (this.grants(principal, capability)) return principal;
    throw new AuthorizationError({
      reason: 'capability_denied',
      principalId,
      capability,
      requiredRoles: rolesForCapability(capability),
      message:
        `Principal "${principalId}" is not authorized for "${capability}". ` +
        `Required roles: ${rolesForCapability(capability).join(', ') || 'none'}.`,
    });
  }

  private grants(principal: Principal, capability: Capability): boolean {
    // Admin override: bypass the capability map entirely.
    if (principal.roles.includes('admin')) return true;
    return principal.roles.some((role) => ROLE_CAPABILITIES[role].includes(capability));
  }
}
