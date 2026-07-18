import type { Capability, Role } from './roles.js';

export type AuthorizationDenialReason = 'unknown_principal' | 'capability_denied';

export interface AuthorizationErrorInit {
  reason: AuthorizationDenialReason;
  principalId: string;
  capability?: Capability;
  requiredRoles: Role[];
  message: string;
}

// A structured denial. Carries the principal, the attempted capability, and which
// roles would have granted it, so callers can render a precise reason without
// re-deriving policy state.
export class AuthorizationError extends Error {
  readonly reason: AuthorizationDenialReason;
  readonly principalId: string;
  readonly capability?: Capability;
  readonly requiredRoles: Role[];

  constructor(init: AuthorizationErrorInit) {
    super(init.message);
    this.name = 'AuthorizationError';
    this.reason = init.reason;
    this.principalId = init.principalId;
    this.capability = init.capability;
    this.requiredRoles = init.requiredRoles;
    // Preserve the prototype chain so `instanceof AuthorizationError` holds after
    // the class is transpiled to ES2022 and thrown across module boundaries.
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}
