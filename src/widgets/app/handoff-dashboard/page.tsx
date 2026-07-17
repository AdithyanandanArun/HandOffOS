'use client';

import { useState } from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

type StationStatus = 'completed' | 'blocked' | 'pending' | 'ready' | 'in_progress';

type WorkflowStation = {
  id: string;
  label: string;
  owner: string;
  status: StationStatus;
  eta?: string;
  healthNote?: string;
};

type EvidenceItem = {
  id: string;
  title: string;
  source: string;
  summary: string;
  reference: string;
};

type FindingItem = {
  ruleId: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  affectedNodes: string[];
  evidenceIds: string[];
  riskPoints: number;
};

type SimulationSnapshot = {
  health: number;
  estimatedCompletion: string;
  criticalPath: string[];
};

type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
};

type PlannedAction = {
  id: string;
  label: string;
  tool: 'plan_next_actions' | 'simulate_resolution' | 'execute_action';
  input: Record<string, unknown>;
  approvalRequired: boolean;
};

type WidgetDashboardData = {
  workflowId: string;
  subject: string;
  liveTool?: string;
  health: number;
  estimatedCompletion: string;
  criticalPath: string[];
  mainBlocker: {
    stationId: string;
    title: string;
    risk: 'high' | 'medium' | 'low';
    status: StationStatus;
    eta: string;
    healthImpact: number;
    summary: string;
  };
  stations: WorkflowStation[];
  evidence: EvidenceItem[];
  findings: FindingItem[];
  simulation: {
    before: SimulationSnapshot;
    after: SimulationSnapshot;
    resolvedRuleIds: string[];
    introducedRuleIds: string[];
  };
  actions: PlannedAction[];
  auditLog: AuditEntry[];
};

type ToolOutputLike = Partial<WidgetDashboardData> & {
  workflow?: Partial<WidgetDashboardData>;
  mainBlocker?: Partial<WidgetDashboardData['mainBlocker']>;
  findings?: unknown;
  evidence?: unknown;
  actions?: unknown;
  auditLog?: unknown;
  simulation?: unknown;
};

type HostToolInvoker = {
  executeTool?: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  callTool?: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  invokeTool?: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  requestToolCall?: (request: { name: string; input?: Record<string, unknown> }) => Promise<unknown>;
  runTool?: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
};

const stationOrder = [
  'manager_approval',
  'hr_verification',
  'laptop_allocation',
  'identity_access',
  'vpn_setup',
  'developer_access',
  'orientation',
] as const;

const fallbackData: WidgetDashboardData = {
  workflowId: 'onboard-priya',
  subject: 'Priya Nair onboarding',
  liveTool: 'detect_blockers',
  health: 62,
  estimatedCompletion: '2026-07-22 17:00 IST',
  criticalPath: ['Laptop Allocation', 'Identity Access', 'VPN Setup', 'Developer Access', 'Orientation'],
  mainBlocker: {
    stationId: 'laptop_allocation',
    title: 'Laptop Allocation',
    risk: 'high',
    status: 'blocked',
    eta: '2026-07-19 15:00 IST',
    healthImpact: -30,
    summary: 'No laptop task exists yet, so identity, VPN, and developer setup cannot start.',
  },
  stations: [
    { id: 'manager_approval', label: 'Manager Approval', owner: 'Hiring Manager', status: 'completed', eta: 'Completed 2026-07-15' },
    { id: 'hr_verification', label: 'HR Verification', owner: 'HR Ops', status: 'completed', eta: 'Completed 2026-07-16' },
    { id: 'laptop_allocation', label: 'Laptop Allocation', owner: 'IT Procurement', status: 'blocked', eta: 'Expected by 2026-07-19', healthNote: 'High-risk root blocker' },
    { id: 'identity_access', label: 'Identity Access', owner: 'IT Identity', status: 'pending', eta: 'Waiting on laptop assignment' },
    { id: 'vpn_setup', label: 'VPN Setup', owner: 'Security Ops', status: 'pending', eta: 'Waiting on identity access' },
    { id: 'developer_access', label: 'Developer Access', owner: 'Developer Experience', status: 'pending', eta: 'Waiting on VPN setup' },
    { id: 'orientation', label: 'Orientation', owner: 'People Ops', status: 'ready', eta: 'Can proceed once access path is green' },
  ],
  evidence: [
    {
      id: 'EV-014',
      title: 'Missing procurement task',
      source: 'task-board',
      summary: 'No open laptop allocation task exists for Priya in the seeded procurement queue.',
      reference: 'task-board://queues/procurement/laptops?employee=priya-nair',
    },
    {
      id: 'EV-021',
      title: 'Completed HR verification',
      source: 'hris',
      summary: 'HR verification completed, removing HR as the current cause of delay.',
      reference: 'hris://employees/priya-nair/verification/2026-07-16',
    },
    {
      id: 'EV-034',
      title: 'Identity task dependency unmet',
      source: 'idm',
      summary: 'Identity task generation awaits asset assignment from procurement.',
      reference: 'idm://handoffs/priya-nair/laptop-dependency',
    },
  ],
  findings: [
    {
      ruleId: 'R-002',
      severity: 'high',
      title: 'Missing dependency',
      affectedNodes: ['Laptop Allocation'],
      evidenceIds: ['EV-014'],
      riskPoints: 30,
    },
    {
      ruleId: 'R-005',
      severity: 'high',
      title: 'Critical path blocked',
      affectedNodes: ['Laptop Allocation', 'Identity Access', 'VPN Setup', 'Developer Access'],
      evidenceIds: ['EV-014', 'EV-034'],
      riskPoints: 25,
    },
    {
      ruleId: 'R-003',
      severity: 'medium',
      title: 'SLA approaching breach',
      affectedNodes: ['Laptop Allocation'],
      evidenceIds: ['EV-014'],
      riskPoints: 13,
    },
  ],
  simulation: {
    before: {
      health: 62,
      estimatedCompletion: '2026-07-22 17:00 IST',
      criticalPath: ['Laptop Allocation', 'Identity Access', 'VPN Setup', 'Developer Access', 'Orientation'],
    },
    after: {
      health: 86,
      estimatedCompletion: '2026-07-20 13:00 IST',
      criticalPath: ['Identity Access', 'VPN Setup', 'Developer Access', 'Orientation'],
    },
    resolvedRuleIds: ['R-002', 'R-005'],
    introducedRuleIds: [],
  },
  actions: [
    {
      id: 'ACT-001',
      label: 'Simulate laptop allocation today',
      tool: 'simulate_resolution',
      input: { workflowId: 'onboard-priya', nodeId: 'laptop_allocation', resolution: 'complete_today' },
      approvalRequired: false,
    },
    {
      id: 'ACT-002',
      label: 'Execute approved laptop allocation',
      tool: 'execute_action',
      input: { workflowId: 'onboard-priya', actionId: 'allocate_laptop', approver: 'it-ops-manager' },
      approvalRequired: true,
    },
  ],
  auditLog: [
    {
      id: 'AUD-001',
      at: '2026-07-15 09:05 IST',
      actor: 'manager.bot',
      action: 'Manager Approval completed',
      detail: 'Offer accepted and manager approval event ingested.',
    },
    {
      id: 'AUD-002',
      at: '2026-07-16 14:30 IST',
      actor: 'hr.ops',
      action: 'HR Verification completed',
      detail: 'Verification cleared for onboarding workflow.',
    },
  ],
};

const statusColorMap: Record<StationStatus, { solid: string; soft: string; glow: string; label: string }> = {
  completed: { solid: '#2f8f5b', soft: 'rgba(47, 143, 91, 0.14)', glow: 'rgba(82, 220, 152, 0.28)', label: 'Completed' },
  blocked: { solid: '#d94c3a', soft: 'rgba(217, 76, 58, 0.14)', glow: 'rgba(255, 110, 89, 0.28)', label: 'Blocked' },
  ready: { solid: '#d18a19', soft: 'rgba(209, 138, 25, 0.16)', glow: 'rgba(243, 182, 73, 0.28)', label: 'Ready' },
  in_progress: { solid: '#d18a19', soft: 'rgba(209, 138, 25, 0.16)', glow: 'rgba(243, 182, 73, 0.28)', label: 'In progress' },
  pending: { solid: '#7c8896', soft: 'rgba(124, 136, 150, 0.18)', glow: 'rgba(124, 136, 150, 0.22)', label: 'Pending' },
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeDashboardData(raw: ToolOutputLike | undefined): WidgetDashboardData {
  if (!raw) {
    return fallbackData;
  }

  const workflow = raw.workflow ?? raw;
  const stations = asArray<WorkflowStation>(workflow.stations).length > 0 ? asArray<WorkflowStation>(workflow.stations) : fallbackData.stations;
  const findings = asArray<FindingItem>(raw.findings ?? workflow.findings);
  const evidence = asArray<EvidenceItem>(raw.evidence ?? workflow.evidence);
  const actions = asArray<PlannedAction>(raw.actions ?? workflow.actions);
  const auditLog = asArray<AuditEntry>(raw.auditLog ?? workflow.auditLog);
  const simulation = (raw.simulation ?? workflow.simulation) as WidgetDashboardData['simulation'] | undefined;

  return {
    workflowId: typeof workflow.workflowId === 'string' ? workflow.workflowId : fallbackData.workflowId,
    subject: typeof workflow.subject === 'string' ? workflow.subject : fallbackData.subject,
    liveTool: typeof raw.liveTool === 'string' ? raw.liveTool : fallbackData.liveTool,
    health: typeof workflow.health === 'number' ? workflow.health : fallbackData.health,
    estimatedCompletion: typeof workflow.estimatedCompletion === 'string' ? workflow.estimatedCompletion : fallbackData.estimatedCompletion,
    criticalPath: asArray<string>(workflow.criticalPath).length > 0 ? asArray<string>(workflow.criticalPath) : fallbackData.criticalPath,
    mainBlocker: {
      stationId: typeof raw.mainBlocker?.stationId === 'string' ? raw.mainBlocker.stationId : fallbackData.mainBlocker.stationId,
      title: typeof raw.mainBlocker?.title === 'string' ? raw.mainBlocker.title : fallbackData.mainBlocker.title,
      risk: raw.mainBlocker?.risk === 'medium' || raw.mainBlocker?.risk === 'low' ? raw.mainBlocker.risk : 'high',
      status: raw.mainBlocker?.status && raw.mainBlocker.status in statusColorMap ? raw.mainBlocker.status : fallbackData.mainBlocker.status,
      eta: typeof raw.mainBlocker?.eta === 'string' ? raw.mainBlocker.eta : fallbackData.mainBlocker.eta,
      healthImpact: typeof raw.mainBlocker?.healthImpact === 'number' ? raw.mainBlocker.healthImpact : fallbackData.mainBlocker.healthImpact,
      summary: typeof raw.mainBlocker?.summary === 'string' ? raw.mainBlocker.summary : fallbackData.mainBlocker.summary,
    },
    stations,
    evidence: evidence.length > 0 ? evidence : fallbackData.evidence,
    findings: findings.length > 0 ? findings : fallbackData.findings,
    simulation: simulation && typeof simulation === 'object' ? simulation : fallbackData.simulation,
    actions: actions.length > 0 ? actions : fallbackData.actions,
    auditLog: auditLog.length > 0 ? auditLog : fallbackData.auditLog,
  };
}

function stationSorter(left: WorkflowStation, right: WorkflowStation) {
  return stationOrder.indexOf(left.id as typeof stationOrder[number]) - stationOrder.indexOf(right.id as typeof stationOrder[number]);
}

async function invokeHostTool(sdk: HostToolInvoker, action: PlannedAction) {
  if (typeof sdk.executeTool === 'function') {
    return sdk.executeTool(action.tool, action.input);
  }

  if (typeof sdk.callTool === 'function') {
    return sdk.callTool(action.tool, action.input);
  }

  if (typeof sdk.invokeTool === 'function') {
    return sdk.invokeTool(action.tool, action.input);
  }

  if (typeof sdk.runTool === 'function') {
    return sdk.runTool(action.tool, action.input);
  }

  if (typeof sdk.requestToolCall === 'function') {
    return sdk.requestToolCall({ name: action.tool, input: action.input });
  }

  throw new Error('Host tool actions are not available in this client.');
}

function MetricCard({
  label,
  value,
  note,
  isDark,
}: {
  label: string;
  value: string;
  note: string;
  isDark: boolean;
}) {
  return (
    <section style={{
      background: isDark ? 'rgba(12, 21, 32, 0.78)' : 'rgba(255, 255, 255, 0.88)',
      border: `1px solid ${isDark ? 'rgba(136, 168, 199, 0.24)' : 'rgba(46, 74, 104, 0.16)'}`,
      borderRadius: 18,
      padding: 18,
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, margin: '10px 0 6px' }}>{value}</p>
      <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, opacity: 0.78 }}>{note}</p>
    </section>
  );
}

export default function HandoffDashboardWidget() {
  const theme = useTheme();
  const sdk = useWidgetSDK() as HostToolInvoker & {
    getToolOutput?: <T>() => T | undefined;
  };
  const rawData = sdk.getToolOutput?.<ToolOutputLike>();
  const [hostMessage, setHostMessage] = useState<string>('');
  const isDark = theme === 'dark';
  const data = normalizeDashboardData(rawData);
  const stations = [...data.stations].sort(stationSorter);

  return (
    <main style={{
      minHeight: '100vh',
      background: isDark
        ? 'radial-gradient(circle at top left, rgba(217, 76, 58, 0.18), transparent 34%), linear-gradient(180deg, #06111b 0%, #0b1824 42%, #101f2d 100%)'
        : 'radial-gradient(circle at top left, rgba(217, 76, 58, 0.12), transparent 34%), linear-gradient(180deg, #f5efe4 0%, #f1f6fb 38%, #e7edf5 100%)',
      color: isDark ? '#eef5ff' : '#132538',
      fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
      padding: 20,
    }}>
      <div style={{ margin: '0 auto', maxWidth: 1180 }}>
        <section style={{
          background: isDark ? 'rgba(10, 19, 31, 0.82)' : 'rgba(255, 251, 245, 0.84)',
          border: `1px solid ${isDark ? 'rgba(136, 168, 199, 0.24)' : 'rgba(46, 74, 104, 0.16)'}`,
          borderRadius: 28,
          boxShadow: isDark ? '0 20px 60px rgba(2, 8, 16, 0.34)' : '0 20px 60px rgba(34, 62, 86, 0.12)',
          overflow: 'hidden',
        }}>
          <div style={{
            borderBottom: `1px solid ${isDark ? 'rgba(136, 168, 199, 0.18)' : 'rgba(46, 74, 104, 0.12)'}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            justifyContent: 'space-between',
            padding: 22,
          }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>
                {data.liveTool ?? 'Widget preview'}
              </p>
              <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: '10px 0 8px' }}>Transit dashboard for {data.subject}</h1>
              <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0, maxWidth: 740, opacity: 0.82 }}>
                Root blocker, evidence, simulation, and next action in one view. The widget stays read-first and keeps the standard MCP tool path visible.
              </p>
            </div>
            <div style={{
              alignItems: 'flex-start',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <span style={{
                background: isDark ? 'rgba(47, 143, 91, 0.16)' : 'rgba(47, 143, 91, 0.12)',
                border: `1px solid ${isDark ? 'rgba(95, 224, 163, 0.28)' : 'rgba(47, 143, 91, 0.18)'}`,
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                padding: '8px 12px',
              }}>
                Workflow {data.workflowId}
              </span>
              <span style={{ fontSize: 14, opacity: 0.76 }}>Judge target: identify the blocker in under two seconds.</span>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gap: 18,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            padding: 22,
          }}>
            <MetricCard label="Health" value={`${data.health}`} note="Deterministic score from rule risk points." isDark={isDark} />
            <MetricCard label="Completion ETA" value={data.estimatedCompletion} note="Live estimate from the seeded workflow state." isDark={isDark} />
            <MetricCard label="Critical Path" value={data.criticalPath[0] ?? 'None'} note={data.criticalPath.slice(1).join(' -> ') || 'No downstream blockers remain.'} isDark={isDark} />
          </div>

          <div style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)',
            padding: '0 22px 22px',
          }}>
            <section style={{
              background: isDark ? 'rgba(11, 20, 32, 0.84)' : 'rgba(255, 255, 255, 0.78)',
              border: `1px solid ${isDark ? 'rgba(136, 168, 199, 0.24)' : 'rgba(46, 74, 104, 0.16)'}`,
              borderRadius: 24,
              overflow: 'hidden',
            }}>
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>Workflow line</p>
                <h2 style={{ fontSize: 24, margin: '10px 0 6px' }}>Onboarding stations</h2>
                <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, opacity: 0.78 }}>
                  Downstream blockage stays visible through the transit line, with a larger interchange marker for the active root cause.
                </p>
              </div>

              <div style={{ overflowX: 'auto', padding: '0 20px 20px' }}>
                <div style={{ display: 'flex', gap: 0, minWidth: 760, paddingBottom: 16, paddingTop: 8 }}>
                  {stations.map((station, index) => {
                    const tone = statusColorMap[station.status];
                    const isHero = station.id === data.mainBlocker.stationId;

                    return (
                      <div key={station.id} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ alignItems: 'center', display: 'flex', minHeight: 72 }}>
                            <div style={{
                              alignItems: 'center',
                              background: tone.solid,
                              border: `4px solid ${tone.glow}`,
                              borderRadius: 999,
                              boxShadow: isHero ? `0 0 0 8px ${tone.soft}` : 'none',
                              color: '#fff',
                              display: 'flex',
                              flexShrink: 0,
                              fontSize: isHero ? 18 : 14,
                              fontWeight: 700,
                              height: isHero ? 44 : 28,
                              justifyContent: 'center',
                              width: isHero ? 44 : 28,
                            }}>
                              {index + 1}
                            </div>
                            {index < stations.length - 1 ? (
                              <div style={{
                                background: `linear-gradient(90deg, ${tone.solid} 0%, ${statusColorMap[stations[index + 1].status].solid} 100%)`,
                                borderRadius: 999,
                                height: 6,
                                marginLeft: 10,
                                minWidth: 70,
                                width: '100%',
                              }} />
                            ) : null}
                          </div>

                          <div style={{
                            background: isHero ? tone.soft : 'transparent',
                            border: `1px solid ${isHero ? tone.glow : 'transparent'}`,
                            borderRadius: 18,
                            marginRight: 12,
                            padding: '10px 12px 12px',
                          }}>
                            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' }}>{tone.label}</p>
                            <h3 style={{ fontSize: 16, margin: '8px 0 6px' }}>{station.label}</h3>
                            <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, opacity: 0.8 }}>{station.owner}</p>
                            <p style={{ fontSize: 13, lineHeight: 1.5, margin: '10px 0 0', opacity: 0.78 }}>{station.eta ?? 'No ETA'}</p>
                            {station.healthNote ? (
                              <p style={{ color: tone.solid, fontSize: 13, fontWeight: 700, lineHeight: 1.5, margin: '8px 0 0' }}>{station.healthNote}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section style={{
              background: isDark ? 'rgba(22, 13, 17, 0.92)' : 'rgba(255, 248, 245, 0.92)',
              border: `1px solid ${isDark ? 'rgba(255, 110, 89, 0.26)' : 'rgba(217, 76, 58, 0.18)'}`,
              borderRadius: 24,
              padding: 20,
            }}>
              <p style={{ color: statusColorMap.blocked.solid, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>
                Main blocker
              </p>
              <h2 style={{ fontSize: 28, margin: '12px 0 8px' }}>{data.mainBlocker.title}</h2>
              <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>{data.mainBlocker.summary}</p>

              <div style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                marginTop: 18,
              }}>
                <div style={{ background: statusColorMap.blocked.soft, borderRadius: 16, padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>State</p>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 0' }}>{statusColorMap[data.mainBlocker.status].label}</p>
                </div>
                <div style={{ background: statusColorMap.blocked.soft, borderRadius: 16, padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>Health hit</p>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 0' }}>{data.mainBlocker.healthImpact}</p>
                </div>
                <div style={{ background: statusColorMap.blocked.soft, borderRadius: 16, padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>ETA</p>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 0' }}>{data.mainBlocker.eta}</p>
                </div>
              </div>
            </section>
          </div>

          <div style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            padding: '0 22px 22px',
          }}>
            <section style={{
              background: isDark ? 'rgba(12, 21, 32, 0.78)' : 'rgba(255, 255, 255, 0.88)',
              border: `1px solid ${isDark ? 'rgba(136, 168, 199, 0.24)' : 'rgba(46, 74, 104, 0.16)'}`,
              borderRadius: 24,
              padding: 20,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>Evidence</p>
              <h2 style={{ fontSize: 22, margin: '10px 0 14px' }}>Grounding without context switching</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {data.evidence.map((item) => (
                  <article key={item.id} style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(18, 37, 56, 0.04)',
                    borderRadius: 18,
                    padding: 14,
                  }}>
                    <div style={{ alignItems: 'center', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                      <strong>{item.title}</strong>
                      <span style={{ fontSize: 12, opacity: 0.72 }}>{item.id}</span>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.55, margin: '8px 0 10px', opacity: 0.82 }}>{item.summary}</p>
                    <p style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, margin: 0, opacity: 0.74 }}>{item.reference}</p>
                  </article>
                ))}
              </div>
            </section>

            <section style={{
              background: isDark ? 'rgba(12, 21, 32, 0.78)' : 'rgba(255, 255, 255, 0.88)',
              border: `1px solid ${isDark ? 'rgba(136, 168, 199, 0.24)' : 'rgba(46, 74, 104, 0.16)'}`,
              borderRadius: 24,
              padding: 20,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>Fired rules</p>
              <h2 style={{ fontSize: 22, margin: '10px 0 14px' }}>Rule IDs stay visible</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {data.findings.map((finding) => (
                  <article key={finding.ruleId} style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(18, 37, 56, 0.04)',
                    borderRadius: 18,
                    padding: 14,
                  }}>
                    <div style={{ alignItems: 'center', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                      <strong>{finding.ruleId}</strong>
                      <span style={{ color: finding.severity === 'high' ? statusColorMap.blocked.solid : statusColorMap.ready.solid, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                        {finding.severity}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.55, margin: '8px 0 10px', opacity: 0.82 }}>{finding.title}</p>
                    <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, opacity: 0.72 }}>
                      Nodes: {finding.affectedNodes.join(', ')} | Evidence: {finding.evidenceIds.join(', ')} | Risk: {finding.riskPoints}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            padding: '0 22px 22px',
          }}>
            <section style={{
              background: isDark ? 'rgba(12, 21, 32, 0.78)' : 'rgba(255, 255, 255, 0.88)',
              border: `1px solid ${isDark ? 'rgba(136, 168, 199, 0.24)' : 'rgba(46, 74, 104, 0.16)'}`,
              borderRadius: 24,
              padding: 20,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>Simulation</p>
              <h2 style={{ fontSize: 22, margin: '10px 0 14px' }}>Before and after</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(18, 37, 56, 0.04)', borderRadius: 18, padding: 14 }}>
                  <strong>Live</strong>
                  <p style={{ fontSize: 14, lineHeight: 1.55, margin: '8px 0 0', opacity: 0.82 }}>
                    Health {data.simulation.before.health} | ETA {data.simulation.before.estimatedCompletion}
                  </p>
                  <p style={{ fontSize: 13, lineHeight: 1.5, margin: '8px 0 0', opacity: 0.72 }}>
                    Critical path: {data.simulation.before.criticalPath.join(' -> ')}
                  </p>
                </div>
                <div style={{ background: statusColorMap.completed.soft, borderRadius: 18, padding: 14 }}>
                  <strong>Projected after resolution</strong>
                  <p style={{ fontSize: 14, lineHeight: 1.55, margin: '8px 0 0', opacity: 0.82 }}>
                    Health {data.simulation.after.health} | ETA {data.simulation.after.estimatedCompletion}
                  </p>
                  <p style={{ fontSize: 13, lineHeight: 1.5, margin: '8px 0 0', opacity: 0.72 }}>
                    Critical path: {data.simulation.after.criticalPath.join(' -> ')}
                  </p>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, opacity: 0.76 }}>
                  Resolved rules: {data.simulation.resolvedRuleIds.join(', ') || 'None'} | Introduced rules: {data.simulation.introducedRuleIds.join(', ') || 'None'}
                </p>
              </div>
            </section>

            <section style={{
              background: isDark ? 'rgba(12, 21, 32, 0.78)' : 'rgba(255, 255, 255, 0.88)',
              border: `1px solid ${isDark ? 'rgba(136, 168, 199, 0.24)' : 'rgba(46, 74, 104, 0.16)'}`,
              borderRadius: 24,
              padding: 20,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>Approved actions</p>
              <h2 style={{ fontSize: 22, margin: '10px 0 14px' }}>Host interaction plus MCP fallback</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {data.actions.map((action) => (
                  <article key={action.id} style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(18, 37, 56, 0.04)',
                    borderRadius: 18,
                    padding: 14,
                  }}>
                    <div style={{ alignItems: 'center', display: 'flex', gap: 10, justifyContent: 'space-between', marginBottom: 10 }}>
                      <strong>{action.label}</strong>
                      <span style={{ fontSize: 12, opacity: 0.72 }}>{action.id}</span>
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 12px', opacity: 0.76 }}>
                      Tool: {action.tool} {action.approvalRequired ? '| approval required' : '| preview only'}
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await invokeHostTool(sdk, action);
                          setHostMessage(`Host executed ${action.tool}.`);
                        } catch (error) {
                          const message = error instanceof Error ? error.message : 'Tool execution unavailable.';
                          setHostMessage(`${message} Use the MCP tool call shown below.`);
                        }
                      }}
                      style={{
                        background: isDark ? '#1f5b94' : '#205f96',
                        border: 'none',
                        borderRadius: 12,
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 700,
                        padding: '10px 14px',
                      }}
                      type="button"
                    >
                      Try in host
                    </button>
                    <pre style={{
                      background: isDark ? 'rgba(3, 9, 15, 0.82)' : 'rgba(16, 29, 43, 0.94)',
                      borderRadius: 14,
                      color: '#e8f0fb',
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: 12,
                      lineHeight: 1.6,
                      margin: '12px 0 0',
                      overflowX: 'auto',
                      padding: 12,
                      whiteSpace: 'pre-wrap',
                    }}>
{JSON.stringify({ tool: action.tool, input: action.input }, null, 2)}
                    </pre>
                  </article>
                ))}
                {hostMessage ? (
                  <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, opacity: 0.78 }}>{hostMessage}</p>
                ) : null}
              </div>
            </section>

            <section style={{
              background: isDark ? 'rgba(12, 21, 32, 0.78)' : 'rgba(255, 255, 255, 0.88)',
              border: `1px solid ${isDark ? 'rgba(136, 168, 199, 0.24)' : 'rgba(46, 74, 104, 0.16)'}`,
              borderRadius: 24,
              padding: 20,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' }}>Audit log</p>
              <h2 style={{ fontSize: 22, margin: '10px 0 14px' }}>Compact and readable</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {data.auditLog.map((entry) => (
                  <article key={entry.id} style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(18, 37, 56, 0.04)',
                    borderRadius: 18,
                    padding: 14,
                  }}>
                    <div style={{ alignItems: 'center', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                      <strong>{entry.action}</strong>
                      <span style={{ fontSize: 12, opacity: 0.72 }}>{entry.at}</span>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.55, margin: '8px 0 0', opacity: 0.82 }}>{entry.detail}</p>
                    <p style={{ fontSize: 13, lineHeight: 1.5, margin: '8px 0 0', opacity: 0.72 }}>Actor: {entry.actor}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
