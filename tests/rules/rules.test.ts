import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../../src/workflow/seed.ts';
import { evaluateAllRules, computeCriticalPath, findRootBlocker, getDownstreamNodes, ALL_RULES, RISK_POINTS } from '../../src/rules/engine.ts';
import { analyzeWorkflow, calculateHealth, predictCompletion } from '../../src/analysis/analyze.ts';
import { simulateResolution, simulateMultiResolution } from '../../src/analysis/simulate.ts';
import { demoNow } from '../../src/domain/demo-clock.ts';
import type { WorkflowState, Finding, SourceEvent, Evidence } from '../../src/domain/types.ts';

function seedState(): WorkflowState {
  return createSeedState();
}

describe('Rules Engine', () => {
  describe('R-001: Missing Owner', () => {
    it('does not fire when all nodes have owners', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-001');
      assert.equal(findings.length, 0);
    });

    it('fires when a node has no owner', () => {
      const state = seedState();
      state.nodes.find(n => n.id === 'vpn-setup')!.owner = '';
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-001');
      assert.equal(findings.length, 1);
      assert.equal(findings[0].affectedNodeIds[0], 'vpn-setup');
    });

    it('skips completed nodes', () => {
      const state = seedState();
      state.nodes.find(n => n.id === 'manager-approval')!.owner = '';
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-001');
      assert.equal(findings.length, 0);
    });
  });

  describe('R-002: Missing Dependency', () => {
    it('fires for laptop-allocation (blocked with completed deps)', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-002');
      assert.equal(findings.length, 1);
      assert.equal(findings[0].affectedNodeIds[0], 'laptop-allocation');
    });

    it('includes evidence IDs', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-002');
      assert.ok(findings[0].evidenceIds.length > 0);
    });

    it('does not fire for transitively blocked nodes', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-002');
      const affectedIds = findings.flatMap(f => f.affectedNodeIds);
      assert.ok(!findings.some(f => f.id === 'R-002::identity-access'));
      assert.ok(!findings.some(f => f.id === 'R-002::vpn-setup'));
    });
  });

  describe('R-003: SLA Overdue', () => {
    it('fires for nodes with expired SLAs', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-003');
      assert.equal(findings.length, 2);
      const nodeIds = findings.map(f => f.affectedNodeIds[0]);
      assert.ok(nodeIds.includes('laptop-allocation'));
      assert.ok(nodeIds.includes('orientation'));
    });

    it('does not fire for completed nodes', () => {
      const state = seedState();
      state.nodes.find(n => n.id === 'manager-approval')!.sla = new Date('2025-01-01');
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-003');
      assert.ok(!findings.some(f => f.affectedNodeIds.includes('manager-approval')));
    });
  });

  describe('R-004: Missing Document', () => {
    it('does not fire in seed state (no document-specific absence)', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-004');
      assert.equal(findings.length, 0);
    });

    it('fires when document absence evidence exists', () => {
      const state = seedState();
      state.evidence.push({
        id: 'EVD-DOC',
        sourceEventId: null,
        type: 'absence',
        description: 'Missing onboarding document checklist',
        timestamp: demoNow(),
      });
      state.nodes.find(n => n.id === 'laptop-allocation')!.evidenceIds.push('EVD-DOC');
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-004');
      assert.equal(findings.length, 1);
    });
  });

  describe('R-005: Critical Path Blocked', () => {
    it('fires for laptop-allocation on the critical path', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-005');
      assert.equal(findings.length, 1);
      assert.equal(findings[0].affectedNodeIds[0], 'laptop-allocation');
    });

    it('includes downstream nodes in affected list', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-005');
      assert.ok(findings[0].affectedNodeIds.length > 1);
    });
  });

  describe('R-006: Approval Stale', () => {
    it('fires for stale approvals with zero risk', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-006');
      assert.ok(findings.length > 0);
      assert.equal(findings[0].riskPoints, 0);
    });
  });

  describe('R-007: Calendar Missing', () => {
    it('fires for orientation without calendar event', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-007');
      assert.equal(findings.length, 1);
      assert.equal(findings[0].affectedNodeIds[0], 'orientation');
    });

    it('has evidence ID pointing to absence check', () => {
      const state = seedState();
      const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-007');
      assert.ok(findings[0].evidenceIds.length > 0);
    });
  });
});

describe('Critical Path', () => {
  it('computes the longest path through the graph', () => {
    const state = seedState();
    const cp = computeCriticalPath(state);
    assert.ok(cp.length >= 6);
    assert.equal(cp[0], 'manager-approval');
    assert.ok(cp.includes('laptop-allocation'));
    assert.ok(cp.includes('orientation'));
  });
});

describe('Root Blocker', () => {
  it('identifies laptop-allocation as root blocker', () => {
    const state = seedState();
    const blocker = findRootBlocker(state);
    assert.equal(blocker, 'laptop-allocation');
  });

  it('returns null when no nodes are blocked', () => {
    const state = seedState();
    for (const node of state.nodes) {
      node.status = 'completed';
    }
    const blocker = findRootBlocker(state);
    assert.equal(blocker, null);
  });
});

describe('Downstream Nodes', () => {
  it('finds all downstream nodes from laptop-allocation', () => {
    const state = seedState();
    const downstream = getDownstreamNodes(state, 'laptop-allocation');
    assert.ok(downstream.includes('identity-access'));
    assert.ok(downstream.includes('vpn-setup'));
    assert.ok(downstream.includes('developer-access'));
    assert.ok(downstream.includes('orientation'));
    assert.equal(downstream.length, 4);
  });
});

describe('Health Calculation', () => {
  it('initial health is 62', () => {
    const state = seedState();
    const result = analyzeWorkflow(state);
    assert.equal(result.health, 62);
  });

  it('health formula is max(0, 100 - total risk)', () => {
    const findings: Finding[] = [
      { id: 'test-1', ruleId: 'R-002', title: 'test', severity: 'critical', explanation: '', evidenceIds: [], affectedNodeIds: [], riskPoints: 120 },
    ];
    const { health } = calculateHealth(findings);
    assert.equal(health, 0);
  });

  it('health is 100 when no findings have risk', () => {
    const { health } = calculateHealth([]);
    assert.equal(health, 100);
  });

  it('provides a breakdown of risk contributors', () => {
    const state = seedState();
    const result = analyzeWorkflow(state);
    assert.ok(result.healthBreakdown.length > 0);
    const totalFromBreakdown = result.healthBreakdown.reduce((s, b) => s + b.riskPoints, 0);
    assert.equal(100 - totalFromBreakdown, result.health);
  });
});

describe('Evidence Traceability', () => {
  it('every finding has at least one evidence ID or is an informational finding', () => {
    const state = seedState();
    const result = analyzeWorkflow(state);
    for (const finding of result.findings) {
      if (finding.riskPoints > 0) {
        assert.ok(
          finding.evidenceIds.length > 0,
          `Finding ${finding.id} has risk points but no evidence`
        );
      }
    }
  });
});

describe('analyzeWorkflow', () => {
  it('returns findings, root blocker, critical path, and health', () => {
    const state = seedState();
    const result = analyzeWorkflow(state);
    assert.ok(Array.isArray(result.findings));
    assert.equal(result.rootBlocker, 'laptop-allocation');
    assert.ok(result.criticalPath.length > 0);
    assert.equal(result.health, 62);
    assert.ok(result.estimatedCompletion instanceof Date);
  });

  it('identifies missing-dependency and critical-path findings', () => {
    const state = seedState();
    const result = analyzeWorkflow(state);
    assert.ok(result.findings.some(f => f.ruleId === 'R-002'));
    assert.ok(result.findings.some(f => f.ruleId === 'R-005'));
  });
});

describe('simulateResolution', () => {
  it('produces health 62 -> 86 for laptop-allocation', () => {
    const state = seedState();
    const result = simulateResolution(state, 'laptop-allocation', demoNow());
    assert.equal(result.beforeHealth, 62);
    assert.equal(result.afterHealth, 86);
  });

  it('leaves the original state unchanged', () => {
    const state = seedState();
    const originalNodes = JSON.stringify(state.nodes);
    simulateResolution(state, 'laptop-allocation', demoNow());
    assert.equal(JSON.stringify(state.nodes), originalNodes);
  });

  it('returns resolved findings', () => {
    const state = seedState();
    const result = simulateResolution(state, 'laptop-allocation', demoNow());
    assert.ok(result.findingsDelta.resolved.length > 0);
    assert.ok(result.findingsDelta.resolved.some(f => f.ruleId === 'R-002'));
    assert.ok(result.findingsDelta.resolved.some(f => f.ruleId === 'R-005'));
  });

  it('returns a completion estimate', () => {
    const state = seedState();
    const result = simulateResolution(state, 'laptop-allocation', demoNow());
    assert.ok(result.completionEstimate instanceof Date);
  });

  it('returns a critical path', () => {
    const state = seedState();
    const result = simulateResolution(state, 'laptop-allocation', demoNow());
    assert.ok(result.criticalPath.length > 0);
  });

  it('throws for unknown node', () => {
    const state = seedState();
    assert.throws(
      () => simulateResolution(state, 'nonexistent', demoNow()),
      /not found/
    );
  });
});

describe('Finding Stability', () => {
  it('produces identical finding IDs for the same input state', () => {
    const state1 = seedState();
    const state2 = seedState();
    const findings1 = evaluateAllRules(state1);
    const findings2 = evaluateAllRules(state2);
    const ids1 = findings1.map(f => f.id).sort();
    const ids2 = findings2.map(f => f.id).sort();
    assert.deepEqual(ids1, ids2);
  });
});

describe('All Rules Registered', () => {
  it('has exactly 10 rules', () => {
    assert.equal(ALL_RULES.length, 10);
  });

  it('covers R-001 through R-010', () => {
    const ids = ALL_RULES.map(r => r.id).sort();
    assert.deepEqual(ids, ['R-001', 'R-002', 'R-003', 'R-004', 'R-005', 'R-006', 'R-007', 'R-008', 'R-009', 'R-010']);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 Tests
// ---------------------------------------------------------------------------

function addDuplicateTaskEvents(state: WorkflowState): void {
  const evtA: SourceEvent = {
    id: 'EVT-DUP-A',
    source: 'hr-system',
    timestamp: new Date('2025-01-09T10:00:00Z'),
    actor: 'HR System',
    type: 'task_created',
    payload: { taskNodeId: 'laptop-allocation', description: 'Create laptop task' },
    evidenceId: 'EVD-DUP-A',
  };
  const evtB: SourceEvent = {
    id: 'EVT-DUP-B',
    source: 'task-board',
    timestamp: new Date('2025-01-09T10:05:00Z'),
    actor: 'Manager Bot',
    type: 'task_created',
    payload: { taskNodeId: 'laptop-allocation', description: 'Auto-create laptop task' },
    evidenceId: 'EVD-DUP-B',
  };
  state.events.push(evtA, evtB);
  state.evidence.push(
    { id: 'EVD-DUP-A', sourceEventId: 'EVT-DUP-A', type: 'event', description: 'HR system created laptop task', timestamp: evtA.timestamp },
    { id: 'EVD-DUP-B', sourceEventId: 'EVT-DUP-B', type: 'event', description: 'Task board auto-created laptop task', timestamp: evtB.timestamp },
  );
}

function addConflictingStatusEvents(state: WorkflowState): void {
  const evtA: SourceEvent = {
    id: 'EVT-CONFLICT-A',
    source: 'hr-system',
    timestamp: new Date('2025-01-09T11:00:00Z'),
    actor: 'HR System',
    type: 'status_update',
    payload: { taskNodeId: 'laptop-allocation', status: 'in_progress' },
    evidenceId: 'EVD-CONFLICT-A',
  };
  const evtB: SourceEvent = {
    id: 'EVT-CONFLICT-B',
    source: 'task-board',
    timestamp: new Date('2025-01-09T11:05:00Z'),
    actor: 'IT Dashboard',
    type: 'status_update',
    payload: { taskNodeId: 'laptop-allocation', status: 'blocked' },
    evidenceId: 'EVD-CONFLICT-B',
  };
  state.events.push(evtA, evtB);
  state.evidence.push(
    { id: 'EVD-CONFLICT-A', sourceEventId: 'EVT-CONFLICT-A', type: 'event', description: 'HR reports laptop in progress', timestamp: evtA.timestamp },
    { id: 'EVD-CONFLICT-B', sourceEventId: 'EVT-CONFLICT-B', type: 'event', description: 'IT dashboard reports laptop blocked', timestamp: evtB.timestamp },
  );
}

describe('R-008: Duplicate Task Detected', () => {
  it('does not fire on clean seed state', () => {
    const state = seedState();
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-008');
    assert.equal(findings.length, 0);
  });

  it('fires when duplicate task_created events exist', () => {
    const state = seedState();
    addDuplicateTaskEvents(state);
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-008');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].affectedNodeIds[0], 'laptop-allocation');
    assert.equal(findings[0].riskPoints, RISK_POINTS.duplicateTask);
  });

  it('includes evidence from both duplicate events', () => {
    const state = seedState();
    addDuplicateTaskEvents(state);
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-008');
    assert.ok(findings[0].evidenceIds.includes('EVD-DUP-A'));
    assert.ok(findings[0].evidenceIds.includes('EVD-DUP-B'));
  });

  it('has strong confidence with 2+ evidence entries', () => {
    const state = seedState();
    addDuplicateTaskEvents(state);
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-008');
    assert.equal(findings[0].confidence, 'strong');
  });
});

describe('R-009: Owner Unresponsive', () => {
  it('does not fire on seed state (blocked nodes skipped)', () => {
    const state = seedState();
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-009');
    assert.equal(findings.length, 0);
  });

  it('fires for ready nodes with SLA and no owner activity', () => {
    const state = seedState();
    const node = state.nodes.find(n => n.id === 'laptop-allocation')!;
    node.status = 'ready';
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-009');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].affectedNodeIds[0], 'laptop-allocation');
    assert.equal(findings[0].riskPoints, RISK_POINTS.ownerUnresponsive);
  });

  it('does not fire when owner has recent activity', () => {
    const state = seedState();
    const node = state.nodes.find(n => n.id === 'laptop-allocation')!;
    node.status = 'ready';
    state.events.push({
      id: 'EVT-OWNER-ACT',
      source: 'task-board',
      timestamp: new Date('2025-01-14T09:00:00Z'),
      actor: 'IT Ops',
      type: 'status_update',
      payload: { note: 'Working on it' },
      evidenceId: 'EVD-OWNER-ACT',
    });
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-009');
    assert.equal(findings.length, 0);
  });

  it('does not fire for nodes without SLA', () => {
    const state = seedState();
    const node = state.nodes.find(n => n.id === 'identity-access')!;
    node.status = 'ready';
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-009');
    assert.equal(findings.length, 0);
  });
});

describe('R-010: Conflicting Status', () => {
  it('does not fire on clean seed state', () => {
    const state = seedState();
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-010');
    assert.equal(findings.length, 0);
  });

  it('fires when conflicting status events exist', () => {
    const state = seedState();
    addConflictingStatusEvents(state);
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-010');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].affectedNodeIds[0], 'laptop-allocation');
    assert.equal(findings[0].riskPoints, RISK_POINTS.conflictingStatus);
  });

  it('includes evidence from both conflicting events', () => {
    const state = seedState();
    addConflictingStatusEvents(state);
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-010');
    assert.ok(findings[0].evidenceIds.includes('EVD-CONFLICT-A'));
    assert.ok(findings[0].evidenceIds.includes('EVD-CONFLICT-B'));
  });

  it('has strong confidence with corroborating evidence', () => {
    const state = seedState();
    addConflictingStatusEvents(state);
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-010');
    assert.equal(findings[0].confidence, 'strong');
  });

  it('does not fire when statuses agree', () => {
    const state = seedState();
    state.events.push(
      {
        id: 'EVT-AGREE-A', source: 'hr-system', timestamp: new Date('2025-01-09T11:00:00Z'),
        actor: 'HR', type: 'status_update',
        payload: { taskNodeId: 'laptop-allocation', status: 'blocked' }, evidenceId: 'EVD-AGREE-A',
      },
      {
        id: 'EVT-AGREE-B', source: 'task-board', timestamp: new Date('2025-01-09T11:05:00Z'),
        actor: 'IT', type: 'status_update',
        payload: { taskNodeId: 'laptop-allocation', status: 'blocked' }, evidenceId: 'EVD-AGREE-B',
      },
    );
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-010');
    assert.equal(findings.length, 0);
  });
});

describe('Finding Confidence Classification', () => {
  it('classifies findings with 2+ event evidence as strong', () => {
    const state = seedState();
    addDuplicateTaskEvents(state);
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-008');
    assert.equal(findings[0].confidence, 'strong');
  });

  it('classifies findings with single evidence as weak', () => {
    const state = seedState();
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-007');
    assert.equal(findings[0].confidence, 'weak');
  });

  it('classifies absence-based findings as weak', () => {
    const state = seedState();
    state.evidence.push({
      id: 'EVD-DOC', sourceEventId: null, type: 'absence',
      description: 'Missing onboarding document checklist', timestamp: demoNow(),
    });
    state.nodes.find(n => n.id === 'laptop-allocation')!.evidenceIds.push('EVD-DOC');
    const findings = evaluateAllRules(state).filter(f => f.ruleId === 'R-004');
    assert.equal(findings[0].confidence, 'weak');
  });

  it('every finding in seed state has a confidence field', () => {
    const state = seedState();
    const result = analyzeWorkflow(state);
    for (const f of result.findings) {
      assert.ok(f.confidence === 'strong' || f.confidence === 'weak', `Finding ${f.id} missing confidence`);
    }
  });
});

describe('predictCompletion', () => {
  it('returns a forecast with estimated completion date', () => {
    const state = seedState();
    const forecast = predictCompletion(state);
    assert.ok(forecast.estimatedCompletion instanceof Date);
    assert.ok(forecast.totalDaysRemaining > 0);
  });

  it('lists delay-driving nodes on the critical path', () => {
    const state = seedState();
    const forecast = predictCompletion(state);
    assert.ok(forecast.delayDrivers.length > 0);
    assert.ok(forecast.delayDrivers.some(d => d.nodeId === 'laptop-allocation'));
  });

  it('includes blocked nodes with SLA overdue contributing extra days', () => {
    const state = seedState();
    const forecast = predictCompletion(state);
    const laptopDriver = forecast.delayDrivers.find(d => d.nodeId === 'laptop-allocation');
    assert.ok(laptopDriver!.daysContributed > 1);
    assert.ok(laptopDriver!.reason.includes('past SLA'));
  });

  it('returns the critical path', () => {
    const state = seedState();
    const forecast = predictCompletion(state);
    assert.ok(forecast.criticalPath.length > 0);
    assert.ok(forecast.criticalPath.includes('laptop-allocation'));
  });

  it('is deterministic', () => {
    const forecast1 = predictCompletion(seedState());
    const forecast2 = predictCompletion(seedState());
    assert.equal(forecast1.totalDaysRemaining, forecast2.totalDaysRemaining);
    assert.equal(forecast1.estimatedCompletion.getTime(), forecast2.estimatedCompletion.getTime());
  });
});

describe('simulateMultiResolution', () => {
  it('resolves multiple nodes in a single pass', () => {
    const state = seedState();
    const result = simulateMultiResolution(
      state,
      ['laptop-allocation', 'identity-access'],
      demoNow()
    );
    assert.ok(result.afterHealth > result.beforeHealth);
    assert.deepEqual(result.resolvedNodeIds, ['laptop-allocation', 'identity-access']);
  });

  it('leaves live state unchanged', () => {
    const state = seedState();
    const originalNodes = JSON.stringify(state.nodes);
    simulateMultiResolution(state, ['laptop-allocation'], demoNow());
    assert.equal(JSON.stringify(state.nodes), originalNodes);
  });

  it('returns combined before/after health', () => {
    const state = seedState();
    const result = simulateMultiResolution(state, ['laptop-allocation'], demoNow());
    assert.equal(result.beforeHealth, 62);
    assert.equal(result.afterHealth, 86);
  });

  it('returns findings delta', () => {
    const state = seedState();
    const result = simulateMultiResolution(state, ['laptop-allocation'], demoNow());
    assert.ok(result.findingsDelta.resolved.length > 0);
  });

  it('returns critical path and completion estimate', () => {
    const state = seedState();
    const result = simulateMultiResolution(state, ['laptop-allocation'], demoNow());
    assert.ok(result.criticalPath.length > 0);
    assert.ok(result.completionEstimate instanceof Date);
  });

  it('throws for unknown node', () => {
    const state = seedState();
    assert.throws(
      () => simulateMultiResolution(state, ['nonexistent'], demoNow()),
      /not found/
    );
  });

  it('resolving more nodes yields better health than fewer', () => {
    const state = seedState();
    const single = simulateMultiResolution(state, ['laptop-allocation'], demoNow());
    const multi = simulateMultiResolution(
      state,
      ['laptop-allocation', 'identity-access', 'vpn-setup'],
      demoNow()
    );
    assert.ok(multi.afterHealth >= single.afterHealth);
  });
});
