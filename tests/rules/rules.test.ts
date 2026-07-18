import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSeedState } from '../../src/workflow/seed.js';
import { evaluateAllRules, computeCriticalPath, findRootBlocker, getDownstreamNodes, ALL_RULES, RISK_POINTS } from '../../src/rules/engine.js';
import { analyzeWorkflow, calculateHealth } from '../../src/analysis/analyze.js';
import { simulateResolution } from '../../src/analysis/simulate.js';
import { demoNow } from '../../src/domain/demo-clock.js';
import type { WorkflowState, Finding } from '../../src/domain/types.js';

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
  it('uses the documented calibrated risk policy without double-counting symptoms', () => {
    assert.deepEqual(RISK_POINTS, {
      missingOwner: 5,
      missingDependency: 10,
      slaOverdue: 9,
      missingDocument: 5,
      criticalPathBlocked: 5,
      approvalStale: 0,
      calendarMissing: 5,
    });
  });

  it('initial health is 62', () => {
    const state = seedState();
    const result = analyzeWorkflow(state);
    assert.equal(result.health, 62);
    assert.equal(
      result.healthBreakdown.reduce((total, item) => total + item.riskPoints, 0),
      38,
    );
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
    assert.equal(result.afterHealth - result.beforeHealth, 24);
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
  it('has exactly 7 rules', () => {
    assert.equal(ALL_RULES.length, 7);
  });

  it('covers R-001 through R-007', () => {
    const ids = ALL_RULES.map(r => r.id).sort();
    assert.deepEqual(ids, ['R-001', 'R-002', 'R-003', 'R-004', 'R-005', 'R-006', 'R-007']);
  });
});
