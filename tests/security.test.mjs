import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PolicyService,
  AuthorizationError,
  ALL_CAPABILITIES,
  SEED_PRINCIPALS,
} from '../dist/security/index.js';

test('seeds one principal per role', () => {
  const policy = new PolicyService();
  for (const principal of SEED_PRINCIPALS) {
    assert.deepEqual(policy.resolvePrincipal(principal.id), principal);
  }
});

test('resolvePrincipal throws a structured error for an unknown principal', () => {
  const policy = new PolicyService();
  assert.throws(
    () => policy.resolvePrincipal('ghost'),
    (error) => {
      assert.ok(error instanceof AuthorizationError);
      assert.equal(error.reason, 'unknown_principal');
      assert.equal(error.principalId, 'ghost');
      assert.equal(error.capability, undefined);
      assert.deepEqual(error.requiredRoles, []);
      return true;
    },
  );
});

test('authorize rejects an unknown principal on any capability', () => {
  const policy = new PolicyService();
  assert.equal(policy.can('ghost', 'read_workflow_analysis'), false);
  assert.throws(
    () => policy.authorize('ghost', 'read_workflow_analysis'),
    (error) => error instanceof AuthorizationError && error.reason === 'unknown_principal',
  );
});

test('denies a capability outside the principal roles with required-role detail', () => {
  const policy = new PolicyService();
  assert.equal(policy.can('demo-viewer', 'execute_action'), false);
  assert.throws(
    () => policy.authorize('demo-viewer', 'execute_action'),
    (error) => {
      assert.ok(error instanceof AuthorizationError);
      assert.equal(error.reason, 'capability_denied');
      assert.equal(error.principalId, 'demo-viewer');
      assert.equal(error.capability, 'execute_action');
      assert.deepEqual([...error.requiredRoles].sort(), ['admin', 'approver']);
      return true;
    },
  );
});

test('allows capabilities granted by each role', () => {
  const policy = new PolicyService();
  const allowed = [
    ['demo-viewer', 'read_workflow_analysis'],
    ['ops-analyst', 'simulate_resolution'],
    ['ops-analyst', 'compare_workflows'],
    ['it-operator', 'ingest_event'],
    ['it-director', 'execute_action'],
    ['it-director', 'rollback_action'],
    ['risk-auditor', 'export_audit_report'],
    ['risk-auditor', 'verify_integrity'],
  ];
  for (const [principalId, capability] of allowed) {
    assert.equal(policy.can(principalId, capability), true);
    assert.equal(policy.authorize(principalId, capability).id, principalId);
  }
});

test('admin override grants every capability, including demo reset', () => {
  const policy = new PolicyService();
  for (const capability of ALL_CAPABILITIES) {
    assert.equal(policy.can('workflow-admin', capability), true);
    assert.doesNotThrow(() => policy.authorize('workflow-admin', capability));
  }
  // reset_demo is admin-only — no other seeded role can reach it.
  assert.equal(policy.can('ops-analyst', 'reset_demo'), false);
  assert.equal(policy.can('it-director', 'reset_demo'), false);
});
