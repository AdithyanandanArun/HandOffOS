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
  confidence?: 'strong' | 'weak';
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

type Escalation = {
  nodeLabel: string;
  owningTeam: string;
  slaDeadline?: string;
  breachHours: number;
  evidenceIds: string[];
  summary: string;
};

type Forecast = {
  estimatedCompletion: string;
  criticalPath: string[];
  delayDrivers: Array<{ nodeId: string; reasons: string[]; sla?: string }>;
};

type WorkflowComparison = {
  workflowId: string;
  subject: string;
  healthScore: number;
  mainBlocker?: string;
  estimatedCompletion: string;
  criticalPath: string[];
};

type OwnerWorkload = {
  ownerId: string;
  openNodeIds: string[];
  activeFindingIds: string[];
};

type Rollback = {
  principalId: string;
  summary: string;
};

type Authorization = {
  principalId: string;
  displayName: string;
  roles: string[];
  capability: string;
};

type MultiSimulation = {
  resolvedNodeIds: string[];
};

type WidgetDashboardData = {
  workflowId: string;
  subject: string;
  liveTool?: string;
  authorization?: Authorization;
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
  advanced: {
    escalation?: Escalation;
    forecast?: Forecast;
    comparisons: WorkflowComparison[];
    workload?: OwnerWorkload;
    rollback?: Rollback;
    multiSimulation?: MultiSimulation;
    executiveDigest?: string;
  };
};

type ToolOutputLike = Partial<WidgetDashboardData> & {
  workflow?: Partial<WidgetDashboardData>;
  mainBlocker?: Partial<WidgetDashboardData['mainBlocker']>;
  findings?: unknown;
  evidence?: unknown;
  actions?: unknown;
  auditLog?: unknown;
  simulation?: unknown;
  escalation?: unknown;
  forecast?: unknown;
  comparisons?: unknown;
  workload?: unknown;
  rollback?: unknown;
  multiSimulation?: unknown;
  executiveDigest?: unknown;
  authorization?: unknown;
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
      input: { workflowId: 'onboard-priya', actionId: 'allocate_laptop', principalId: 'it-director' },
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
  advanced: {
    comparisons: [],
  },
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

function asObject<T>(value: unknown): T | undefined {
  return value && typeof value === 'object' ? value as T : undefined;
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
    authorization: asObject<Authorization>(raw.authorization),
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
    advanced: {
      escalation: asObject<Escalation>(raw.escalation),
      forecast: asObject<Forecast>(raw.forecast),
      comparisons: asArray<WorkflowComparison>(raw.comparisons),
      workload: asObject<OwnerWorkload>(raw.workload),
      rollback: asObject<Rollback>(raw.rollback),
      multiSimulation: asObject<MultiSimulation>(raw.multiSimulation),
      executiveDigest: typeof raw.executiveDigest === 'string' ? raw.executiveDigest : undefined,
    },
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

function statusClass(status: StationStatus) {
  return `status-${status.replace('_', '-')}`;
}

export default function HandoffDashboardWidget() {
  const theme = useTheme();
  const sdk = useWidgetSDK() as HostToolInvoker & { getToolOutput?: <T>() => T | undefined };
  const rawData = sdk.getToolOutput?.<ToolOutputLike>();
  const [hostMessage, setHostMessage] = useState('');
  const data = normalizeDashboardData(rawData);
  const stations = [...data.stations].sort(stationSorter);
  const isDark = theme === 'dark';
  const healthTone = data.health < 70 ? '#ff6b5e' : data.health < 86 ? '#f4b740' : '#53d496';
  const healthDelta = data.simulation.after.health - data.simulation.before.health;
  const themeStyle = {
    '--canvas': isDark ? '#07111b' : '#f3f5f2',
    '--surface': isDark ? '#0d1b29' : '#ffffff',
    '--surface-raised': isDark ? '#102334' : '#f8faf8',
    '--ink': isDark ? '#f1f6f5' : '#10251f',
    '--muted': isDark ? '#9bb0aa' : '#5e716c',
    '--line': isDark ? 'rgba(178, 213, 200, 0.16)' : '#dce5df',
    '--route': isDark ? '#274238' : '#d4dfd7',
    '--brand': '#0a8a67',
    '--brand-soft': isDark ? 'rgba(47, 213, 157, 0.12)' : '#e0f5eb',
    '--danger': '#e7544b',
    '--danger-soft': isDark ? 'rgba(231, 84, 75, 0.16)' : '#fff0ed',
    '--warning': '#c77a0a',
    '--shadow': isDark ? '0 24px 80px rgba(0, 0, 0, 0.28)' : '0 24px 70px rgba(25, 55, 43, 0.12)',
  } as React.CSSProperties;

  const runAction = async (action: PlannedAction) => {
    try {
      await invokeHostTool(sdk, action);
      setHostMessage(`${action.tool} was sent to the connected MCP host.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution is unavailable.';
      setHostMessage(`${message} Run ${action.tool} from the client instead.`);
    }
  };

  return (
    <main className="handoff-dashboard" style={themeStyle}>
      <style>{`
        .handoff-dashboard { background: var(--canvas); color: var(--ink); font-family: "Space Grotesk", "Avenir Next", sans-serif; min-height: 100vh; padding: clamp(14px, 3vw, 34px); }
        .handoff-dashboard * { box-sizing: border-box; }
        .handoff-dashboard button { font: inherit; }
        .handoff-dashboard .shell { margin: 0 auto; max-width: 1280px; }
        .handoff-dashboard .eyebrow { color: var(--muted); font-family: "IBM Plex Mono", "SFMono-Regular", monospace; font-size: 11px; font-weight: 700; letter-spacing: .13em; margin: 0; text-transform: uppercase; }
        .handoff-dashboard .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; box-shadow: 0 10px 30px rgba(15, 42, 33, .035); }
        .handoff-dashboard .masthead { align-items: flex-start; display: flex; gap: 28px; justify-content: space-between; padding: 8px 2px 24px; }
        .handoff-dashboard .brand { align-items: center; display: flex; gap: 11px; }
        .handoff-dashboard .brand-mark { background: var(--brand); border-radius: 8px; box-shadow: 8px 8px 0 var(--brand-soft); height: 25px; position: relative; width: 25px; }
        .handoff-dashboard .brand-mark::after { border: 2px solid #fff; border-radius: 50%; content: ""; height: 7px; left: 7px; position: absolute; top: 7px; width: 7px; }
        .handoff-dashboard .brand-name { font-size: 15px; font-weight: 800; letter-spacing: -.03em; margin: 0; }
        .handoff-dashboard .context { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
        .handoff-dashboard .chip { border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-family: "IBM Plex Mono", "SFMono-Regular", monospace; font-size: 11px; padding: 7px 10px; }
        .handoff-dashboard .chip-live { background: var(--brand-soft); border-color: transparent; color: var(--brand); font-weight: 800; }
        .handoff-dashboard .hero { background: linear-gradient(135deg, var(--surface) 0%, var(--surface) 64%, var(--brand-soft) 170%); display: grid; gap: 26px; grid-template-columns: minmax(0, 1.5fr) minmax(220px, .7fr); overflow: hidden; padding: clamp(22px, 4vw, 42px); position: relative; }
        .handoff-dashboard .hero::before { background: repeating-linear-gradient(90deg, transparent 0 18px, rgba(10, 138, 103, .04) 18px 19px); content: ""; inset: 0 0 0 auto; pointer-events: none; position: absolute; width: 44%; }
        .handoff-dashboard .hero-copy, .handoff-dashboard .hero-metric { position: relative; z-index: 1; }
        .handoff-dashboard .hero h1 { font-size: clamp(32px, 5vw, 62px); letter-spacing: -.065em; line-height: .96; margin: 12px 0 18px; max-width: 720px; }
        .handoff-dashboard .hero h1 span { color: var(--danger); display: block; }
        .handoff-dashboard .hero-summary { color: var(--muted); font-size: 16px; line-height: 1.65; margin: 0; max-width: 620px; }
        .handoff-dashboard .signal-row { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 22px; }
        .handoff-dashboard .signal { align-items: center; background: var(--surface-raised); border: 1px solid var(--line); border-radius: 10px; display: inline-flex; font-size: 12px; gap: 8px; padding: 8px 10px; }
        .handoff-dashboard .signal-dot { background: var(--danger); border-radius: 50%; box-shadow: 0 0 0 4px var(--danger-soft); height: 7px; width: 7px; }
        .handoff-dashboard .hero-metric { align-items: flex-end; display: flex; flex-direction: column; justify-content: space-between; min-height: 220px; }
        .handoff-dashboard .health-ring { align-items: center; background: conic-gradient(${healthTone} ${Math.max(0, Math.min(100, data.health)) * 3.6}deg, var(--route) 0); border-radius: 50%; display: flex; height: 156px; justify-content: center; padding: 10px; width: 156px; }
        .handoff-dashboard .health-center { align-items: center; background: var(--surface); border-radius: 50%; display: flex; flex-direction: column; height: 100%; justify-content: center; width: 100%; }
        .handoff-dashboard .health-center strong { font-size: 39px; letter-spacing: -.08em; line-height: 1; }
        .handoff-dashboard .health-center span { color: var(--muted); font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .09em; margin-top: 6px; text-transform: uppercase; }
        .handoff-dashboard .eta { color: var(--muted); font-size: 13px; margin: 0; text-align: right; }
        .handoff-dashboard .eta strong { color: var(--ink); display: block; font-size: 16px; margin-top: 4px; }
        .handoff-dashboard .metrics { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 16px 0; }
        .handoff-dashboard .metric { padding: 17px; }
        .handoff-dashboard .metric-value { font-size: 21px; font-weight: 750; letter-spacing: -.045em; line-height: 1.1; margin: 8px 0 4px; overflow-wrap: anywhere; }
        .handoff-dashboard .metric-note { color: var(--muted); font-size: 12px; line-height: 1.45; margin: 0; }
        .handoff-dashboard .content-grid { display: grid; gap: 16px; grid-template-columns: minmax(0, 1.55fr) minmax(320px, .8fr); }
        .handoff-dashboard .route-panel { padding: 23px; }
        .handoff-dashboard .panel-head { align-items: flex-start; display: flex; gap: 16px; justify-content: space-between; margin-bottom: 20px; }
        .handoff-dashboard h2 { font-size: 21px; letter-spacing: -.045em; margin: 7px 0 0; }
        .handoff-dashboard .route { display: grid; grid-template-columns: repeat(7, minmax(104px, 1fr)); overflow-x: auto; padding: 16px 0 9px; }
        .handoff-dashboard .station { min-width: 104px; padding-right: 10px; position: relative; }
        .handoff-dashboard .station:not(:last-child)::after { background: var(--route); content: ""; height: 2px; left: 27px; position: absolute; right: -2px; top: 17px; }
        .handoff-dashboard .station-node { align-items: center; background: var(--surface); border: 2px solid var(--route); border-radius: 50%; display: flex; height: 36px; justify-content: center; position: relative; width: 36px; z-index: 1; }
        .handoff-dashboard .station-node::after { background: currentColor; border-radius: 50%; content: ""; height: 10px; width: 10px; }
        .handoff-dashboard .station-card { margin-top: 14px; }
        .handoff-dashboard .station-card strong { display: block; font-size: 13px; line-height: 1.18; }
        .handoff-dashboard .station-card span { color: var(--muted); display: block; font-size: 11px; line-height: 1.35; margin-top: 5px; }
        .handoff-dashboard .station-card em { color: currentColor; display: block; font-family: "IBM Plex Mono", monospace; font-size: 10px; font-style: normal; font-weight: 800; letter-spacing: .07em; margin-top: 7px; text-transform: uppercase; }
        .handoff-dashboard .status-completed { color: #209b66; }
        .handoff-dashboard .status-blocked { color: var(--danger); }
        .handoff-dashboard .status-ready, .handoff-dashboard .status-in-progress { color: var(--warning); }
        .handoff-dashboard .status-pending { color: #7d8e88; }
        .handoff-dashboard .station-blocker .station-node { border-color: var(--danger); box-shadow: 0 0 0 7px var(--danger-soft); transform: scale(1.16); }
        .handoff-dashboard .blocker-panel { background: var(--danger-soft); border-color: rgba(231, 84, 75, .28); overflow: hidden; padding: 23px; position: relative; }
        .handoff-dashboard .blocker-panel::after { border: 1px solid rgba(231, 84, 75, .22); border-radius: 50%; content: ""; height: 210px; position: absolute; right: -80px; top: -82px; width: 210px; }
        .handoff-dashboard .blocker-panel > * { position: relative; z-index: 1; }
        .handoff-dashboard .blocker-title { font-size: 29px; letter-spacing: -.055em; line-height: 1; margin: 10px 0 12px; max-width: 280px; }
        .handoff-dashboard .blocker-copy { font-size: 14px; line-height: 1.6; margin: 0; max-width: 340px; }
        .handoff-dashboard .blocker-stats { border-top: 1px solid rgba(231, 84, 75, .2); display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); margin-top: 20px; padding-top: 17px; }
        .handoff-dashboard .blocker-stats strong { display: block; font-size: 17px; letter-spacing: -.04em; margin-top: 5px; }
        .handoff-dashboard .section-grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
        .handoff-dashboard .list-panel { padding: 22px; }
        .handoff-dashboard .evidence-list, .handoff-dashboard .rules-list, .handoff-dashboard .audit-list { display: grid; gap: 10px; margin-top: 17px; }
        .handoff-dashboard .evidence-item, .handoff-dashboard .rule-item, .handoff-dashboard .audit-item { border-top: 1px solid var(--line); padding-top: 11px; }
        .handoff-dashboard .evidence-item:first-child, .handoff-dashboard .rule-item:first-child, .handoff-dashboard .audit-item:first-child { border-top: 0; padding-top: 0; }
        .handoff-dashboard .item-top { align-items: baseline; display: flex; gap: 10px; justify-content: space-between; }
        .handoff-dashboard .item-top strong { font-size: 13px; }
        .handoff-dashboard .item-code { color: var(--muted); font-family: "IBM Plex Mono", monospace; font-size: 10px; white-space: nowrap; }
        .handoff-dashboard .item-copy { color: var(--muted); font-size: 12px; line-height: 1.5; margin: 6px 0 0; }
        .handoff-dashboard .rule-risk { color: var(--danger); font-family: "IBM Plex Mono", monospace; font-size: 10px; font-weight: 800; }
        .handoff-dashboard .action-grid { display: grid; gap: 16px; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); margin-top: 16px; }
        .handoff-dashboard .projection { background: linear-gradient(135deg, var(--surface) 0%, var(--brand-soft) 180%); padding: 23px; }
        .handoff-dashboard .projection-row { align-items: end; display: flex; gap: 12px; margin: 22px 0 14px; }
        .handoff-dashboard .projection-number { font-size: 42px; font-weight: 800; letter-spacing: -.09em; line-height: .9; }
        .handoff-dashboard .projection-arrow { color: var(--brand); font-size: 20px; padding-bottom: 5px; }
        .handoff-dashboard .projection-meta { color: var(--muted); font-size: 12px; line-height: 1.5; margin: 0; }
        .handoff-dashboard .action-panel { padding: 23px; }
        .handoff-dashboard .action-card { border: 1px solid var(--line); border-radius: 14px; margin-top: 12px; padding: 14px; }
        .handoff-dashboard .action-card strong { display: block; font-size: 14px; line-height: 1.3; }
        .handoff-dashboard .action-meta { color: var(--muted); font-family: "IBM Plex Mono", monospace; font-size: 10px; margin: 7px 0 11px; }
        .handoff-dashboard .action-button { background: var(--ink); border: 0; border-radius: 9px; color: var(--surface); cursor: pointer; font-size: 12px; font-weight: 800; min-height: 40px; padding: 10px 13px; transition: opacity 180ms ease, transform 180ms ease; }
        .handoff-dashboard .action-button:hover { opacity: .88; transform: translateY(-1px); }
        .handoff-dashboard .action-button:focus-visible { outline: 3px solid var(--brand); outline-offset: 3px; }
        .handoff-dashboard .action-message { color: var(--muted); font-size: 12px; line-height: 1.45; margin: 12px 0 0; }
        .handoff-dashboard .footer-grid { display: grid; gap: 16px; grid-template-columns: 1.15fr .85fr; margin-top: 16px; }
        .handoff-dashboard .audit-panel, .handoff-dashboard .portfolio-panel { padding: 22px; }
        .handoff-dashboard .audit-time { color: var(--muted); font-family: "IBM Plex Mono", monospace; font-size: 10px; white-space: nowrap; }
        .handoff-dashboard .portfolio-row { align-items: center; border-top: 1px solid var(--line); display: flex; gap: 12px; justify-content: space-between; padding: 11px 0; }
        .handoff-dashboard .portfolio-row:first-of-type { margin-top: 14px; }
        .handoff-dashboard .portfolio-row strong { font-size: 13px; }
        .handoff-dashboard .portfolio-score { color: var(--brand); font-family: "IBM Plex Mono", monospace; font-size: 12px; font-weight: 800; }
        .handoff-dashboard .auth-line { color: var(--muted); font-size: 11px; margin-top: 18px; }
        @media (max-width: 760px) { .handoff-dashboard { padding: 14px; } .handoff-dashboard .masthead { display: block; } .handoff-dashboard .context { justify-content: flex-start; margin-top: 17px; } .handoff-dashboard .hero { grid-template-columns: 1fr; } .handoff-dashboard .hero-metric { align-items: flex-start; flex-direction: row; min-height: 0; } .handoff-dashboard .eta { text-align: left; } .handoff-dashboard .metrics, .handoff-dashboard .content-grid, .handoff-dashboard .section-grid, .handoff-dashboard .action-grid, .handoff-dashboard .footer-grid { grid-template-columns: 1fr; } .handoff-dashboard .route { grid-template-columns: 1fr; overflow: visible; padding-left: 8px; } .handoff-dashboard .station { min-height: 71px; padding: 0 0 12px 49px; } .handoff-dashboard .station:not(:last-child)::after { height: calc(100% - 25px); left: 17px; right: auto; top: 34px; width: 2px; } .handoff-dashboard .station-node { left: 0; position: absolute; top: 0; } .handoff-dashboard .station-card { margin-top: 0; } .handoff-dashboard .station-card strong { font-size: 15px; } }
        @media (prefers-reduced-motion: reduce) { .handoff-dashboard *, .handoff-dashboard *::before, .handoff-dashboard *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; } }
      `}</style>
      <div className="shell">
        <header className="masthead">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <p className="brand-name">HandoffOS <span style={{ color: 'var(--muted)', fontWeight: 500 }}>/ control room</span></p>
          </div>
          <div className="context">
            <span className="chip chip-live">LIVE WORKFLOW</span>
            <span className="chip">{data.workflowId}</span>
            <span className="chip">{data.liveTool ?? 'widget preview'}</span>
          </div>
        </header>

        <section className="panel hero">
          <div className="hero-copy">
            <p className="eyebrow">Priority intervention</p>
            <h1>{data.subject}<span>{data.mainBlocker.title} is holding the line.</span></h1>
            <p className="hero-summary">{data.mainBlocker.summary}</p>
            <div className="signal-row">
              <span className="signal"><span className="signal-dot" aria-hidden="true" />Root blocker confirmed</span>
              <span className="signal">{data.findings.length} deterministic rules fired</span>
              <span className="signal">{data.evidence.length} evidence signals</span>
            </div>
          </div>
          <div className="hero-metric">
            <div className="health-ring" aria-label={`Workflow health ${data.health} out of 100`}>
              <div className="health-center"><strong>{data.health}</strong><span>health / 100</span></div>
            </div>
            <p className="eta">Forecasted completion<strong>{data.estimatedCompletion}</strong></p>
          </div>
        </section>

        <section className="metrics" aria-label="Workflow summary">
          <article className="panel metric"><p className="eyebrow">Impact</p><p className="metric-value">{data.mainBlocker.healthImpact} health</p><p className="metric-note">Root cause penalty from deterministic risk scoring.</p></article>
          <article className="panel metric"><p className="eyebrow">Critical path</p><p className="metric-value">{data.criticalPath.length} stations</p><p className="metric-note">{data.criticalPath.join('  /  ')}</p></article>
          <article className="panel metric"><p className="eyebrow">Authority</p><p className="metric-value">{data.authorization?.displayName ?? 'Demo policy'}</p><p className="metric-note">{data.authorization ? `${data.authorization.capability} · ${data.authorization.roles.join(', ')}` : 'Use a policy-backed principal to act.'}</p></article>
        </section>

        {data.advanced.escalation ? <section className="panel blocker-panel" style={{ marginBottom: 16 }}><p className="eyebrow" style={{ color: 'var(--danger)' }}>Escalation ready</p><strong className="blocker-title" style={{ fontSize: 22 }}>{data.advanced.escalation.nodeLabel} · {data.advanced.escalation.owningTeam}</strong><p className="blocker-copy">{data.advanced.escalation.summary}</p></section> : null}

        <section className="content-grid">
          <article className="panel route-panel">
            <div className="panel-head"><div><p className="eyebrow">Workflow transit line</p><h2>Where work stops moving</h2></div><span className="chip">{stations.length} stations</span></div>
            <div className="route">
              {stations.map((station) => {
                const tone = statusColorMap[station.status];
                const isBlocker = station.id === data.mainBlocker.stationId;
                return <div className={`station ${statusClass(station.status)} ${isBlocker ? 'station-blocker' : ''}`} key={station.id}>
                  <div className="station-node" aria-label={`${station.label}: ${tone.label}`} />
                  <div className="station-card"><strong>{station.label}</strong><span>{station.owner}</span><em>{tone.label}</em></div>
                </div>;
              })}
            </div>
          </article>

          <aside className="panel blocker-panel">
            <p className="eyebrow" style={{ color: 'var(--danger)' }}>Main blocker</p>
            <h2 className="blocker-title">{data.mainBlocker.title}</h2>
            <p className="blocker-copy">{data.mainBlocker.summary}</p>
            <div className="blocker-stats"><div><p className="eyebrow">Status</p><strong>{statusColorMap[data.mainBlocker.status].label}</strong></div><div><p className="eyebrow">SLA point</p><strong>{data.mainBlocker.eta}</strong></div></div>
          </aside>
        </section>

        <section className="section-grid">
          <article className="panel list-panel"><p className="eyebrow">Evidence ledger</p><h2>Why this is true</h2><div className="evidence-list">{data.evidence.slice(0, 3).map((item) => <div className="evidence-item" key={item.id}><div className="item-top"><strong>{item.title}</strong><span className="item-code">{item.id}</span></div><p className="item-copy">{item.summary}</p></div>)}</div></article>
          <article className="panel list-panel"><p className="eyebrow">Rule engine</p><h2>Risk that is currently firing</h2><div className="rules-list">{data.findings.map((finding) => <div className="rule-item" key={finding.ruleId}><div className="item-top"><strong>{finding.ruleId} · {finding.title}</strong><span className="rule-risk">+{finding.riskPoints}</span></div><p className="item-copy">{finding.affectedNodes.join(', ')} · evidence {finding.evidenceIds.join(', ')}</p></div>)}</div></article>
        </section>

        <section className="action-grid">
          <article className="panel projection"><p className="eyebrow">Resolution simulation</p><h2>Remove the blocker. Recalculate the outcome.</h2><div className="projection-row"><span className="projection-number">{data.simulation.before.health}</span><span className="projection-arrow" aria-hidden="true">→</span><span className="projection-number" style={{ color: 'var(--brand)' }}>{data.simulation.after.health}</span></div><p className="projection-meta">Health improves by {healthDelta} points. Completion shifts from {data.simulation.before.estimatedCompletion} to {data.simulation.after.estimatedCompletion}.</p></article>
          <article className="panel action-panel"><p className="eyebrow">Recommended next action</p><h2>Act through MCP</h2>{data.actions.slice(0, 2).map((action) => <div className="action-card" key={action.id}><strong>{action.label}</strong><p className="action-meta">{action.tool} · {action.approvalRequired ? 'approval required' : 'preview only'}</p><button className="action-button" type="button" onClick={() => void runAction(action)}>{action.approvalRequired ? 'Request approved action' : 'Run simulation'}</button></div>)}{hostMessage ? <p className="action-message" role="status">{hostMessage}</p> : null}</article>
        </section>

        <section className="footer-grid">
          <article className="panel audit-panel"><p className="eyebrow">Audit trail</p><h2>Every state change stays attributable</h2><div className="audit-list">{data.auditLog.slice(-3).reverse().map((entry) => <div className="audit-item" key={entry.id}><div className="item-top"><strong>{entry.action}</strong><span className="audit-time">{entry.at}</span></div><p className="item-copy">{entry.actor} · {entry.detail}</p></div>)}</div>{data.advanced.rollback ? <p className="auth-line">Rollback recorded by {data.advanced.rollback.principalId}: {data.advanced.rollback.summary}</p> : null}</article>
          <article className="panel portfolio-panel"><p className="eyebrow">Portfolio pulse</p><h2>Cross-workflow context</h2>{(data.advanced.comparisons.length ? data.advanced.comparisons : [{ workflowId: data.workflowId, subject: data.subject, healthScore: data.health, mainBlocker: data.mainBlocker.title, estimatedCompletion: data.estimatedCompletion, criticalPath: data.criticalPath }]).slice(0, 3).map((workflow) => <div className="portfolio-row" key={workflow.workflowId}><div><strong>{workflow.subject}</strong><p className="item-copy">{workflow.mainBlocker ?? 'No active blocker'}</p></div><span className="portfolio-score">{workflow.healthScore}/100</span></div>)}{data.advanced.workload ? <p className="auth-line">{data.advanced.workload.ownerId}: {data.advanced.workload.openNodeIds.length} open stations · {data.advanced.workload.activeFindingIds.length} active findings</p> : null}</article>
        </section>
      </div>
    </main>
  );
}
