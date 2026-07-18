import assert from 'node:assert/strict';
import test from 'node:test';

import { predictCompletion } from '../dist/analysis/analyze.js';
import { simulateMultiResolution } from '../dist/analysis/simulate.js';
import { evaluateAllRules } from '../dist/rules/engine.js';
import { createSeedStates } from '../dist/workflow/seed.js';

test('advanced deterministic rules fire from explicit vendor event evidence', () => {
  const vendor = createSeedStates().find((state) => state.workflowId === 'vendor-onboarding');
  const findings = evaluateAllRules(vendor);
  assert.deepEqual(
    ['R-008', 'R-009', 'R-010'].map((ruleId) => findings.find((finding) => finding.ruleId === ruleId)?.ruleId),
    ['R-008', 'R-009', 'R-010'],
  );
  assert.equal(findings.find((finding) => finding.ruleId === 'R-008').confidence, 'strong');
  assert.equal(findings.find((finding) => finding.ruleId === 'R-010').confidence, 'strong');
});

test('forecast returns deterministic critical-path delay drivers', () => {
  const priya = createSeedStates().find((state) => state.workflowId === 'onboard-priya');
  const forecast = predictCompletion(priya);
  assert.equal(forecast.estimatedCompletion?.toISOString(), '2025-01-19T10:00:00.000Z');
  assert.ok(forecast.delayDrivers.some((driver) => driver.nodeId === 'laptop-allocation'));
});

test('multi-node simulation isolates live state and reports combined changes', () => {
  const priya = createSeedStates().find((state) => state.workflowId === 'onboard-priya');
  const result = simulateMultiResolution(priya, ['laptop-allocation', 'identity-access'], new Date('2025-01-15T10:00:00Z'));
  assert.deepEqual(result.resolvedNodeIds, ['laptop-allocation', 'identity-access']);
  assert.equal(priya.nodes.find((node) => node.id === 'laptop-allocation').status, 'blocked');
  assert.ok(result.afterHealth > result.beforeHealth);
});
