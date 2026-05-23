import { normalizeCollaborationInbox, type CollaborationInboxRecord } from './collaborationAudit';
import { type ExecutionControlAuditEntry } from './executionControls';
import { type ExecutionGraph, type ExecutionNodeStatus } from './executionGraph';
import { type ExecutionTrail, type ExecutionTrailEvent, type ExecutionTrailEventKind } from './executionTrail';

export interface DemoWorkspaceSeed {
  schemaVersion: 'agent-hangar.demo-workspace-seed.v1';
  workspaceId: string;
  graph: ExecutionGraph;
  trail: ExecutionTrail;
  collaborationItems: CollaborationInboxRecord[];
  auditEntries: ExecutionControlAuditEntry[];
}

export interface DemoWorkspaceScenario {
  schemaVersion: 'agent-hangar.demo-workspace-scenario.v1';
  id: 'coordination-happy-path' | 'blocked-failure-recovery';
  label: string;
  description: string;
  seed: DemoWorkspaceSeed;
}

const WORKSPACE_ID = 'workspace-local-demo';
const DEMO_WORKSPACE_SEED: DemoWorkspaceSeed = {
  schemaVersion: 'agent-hangar.demo-workspace-seed.v1',
  workspaceId: WORKSPACE_ID,
  graph: {
    schemaVersion: 'agent-hangar.execution-graph.v1',
    workspaceId: WORKSPACE_ID,
    nodes: [
      demoNode('demo-planner', 'Planner', 'planner', 'completed', 'template-demo-planner', 'local-model-planner'),
      demoNode('demo-researcher', 'Researcher', 'researcher', 'queued', 'template-demo-researcher', 'local-model-researcher'),
      demoNode('demo-implementer', 'Implementer', 'implementer', 'queued', 'template-demo-implementer', 'local-model-implementer'),
      demoNode('demo-reviewer', 'Reviewer', 'reviewer', 'queued', 'template-demo-reviewer', 'local-model-reviewer'),
    ],
    edges: [
      { id: 'demo-planner->demo-researcher', from: 'demo-planner', to: 'demo-researcher', kind: 'handoff', label: 'research handoff' },
      { id: 'demo-researcher->demo-implementer', from: 'demo-researcher', to: 'demo-implementer', kind: 'dependency', label: 'evidence dependency' },
      { id: 'demo-planner->demo-implementer', from: 'demo-planner', to: 'demo-implementer', kind: 'handoff', label: 'implementation handoff' },
      { id: 'demo-implementer->demo-reviewer', from: 'demo-implementer', to: 'demo-reviewer', kind: 'handoff', label: 'review handoff' },
    ],
  },
  trail: {
    schemaVersion: 'agent-hangar.execution-trail.v1',
    workspaceId: WORKSPACE_ID,
    events: [
      event('evt-001', '2026-05-23T10:00:00.000Z', 'task-created', 'operator-demo', 'Task created', undefined, 'Prepare a local release-readiness brief from sanitized demo evidence.'),
      event('evt-002', '2026-05-23T10:01:00.000Z', 'plan-created', 'demo-planner', 'Plan created', 'demo-planner', 'Planner outlines research, implementation, and review checkpoints.'),
      event('evt-003', '2026-05-23T10:02:00.000Z', 'agent-assigned', 'operator-demo', 'Researcher assigned', 'demo-researcher', 'Researcher owns local evidence gathering from source-checkout fixtures only.'),
      event('evt-004', '2026-05-23T10:03:00.000Z', 'node-started', 'demo-researcher', 'Research started', 'demo-researcher', 'Researcher reviews deterministic local notes and fixture metadata.'),
      event('evt-005', '2026-05-23T10:04:00.000Z', 'node-completed', 'demo-researcher', 'Research completed', 'demo-researcher', 'Research notes are ready for planner and implementer handoff.'),
      event('evt-006', '2026-05-23T10:05:00.000Z', 'agent-assigned', 'demo-planner', 'Implementer assigned', 'demo-implementer', 'Planner delegates local UI and helper updates to the implementer.'),
      event('evt-007', '2026-05-23T10:06:00.000Z', 'node-started', 'demo-implementer', 'Implementation started', 'demo-implementer', 'Implementer applies deterministic workspace seed changes in local memory.'),
      event('evt-008', '2026-05-23T10:07:00.000Z', 'node-completed', 'demo-implementer', 'Implementation completed', 'demo-implementer', 'Implementer publishes sanitized local evidence for review.'),
      event('evt-009', '2026-05-23T10:08:00.000Z', 'handoff-requested', 'demo-implementer', 'Review handoff requested', 'demo-reviewer', 'Implementer sends deterministic local evidence to reviewer.'),
      event('evt-010', '2026-05-23T10:09:00.000Z', 'agent-assigned', 'operator-demo', 'Reviewer assigned', 'demo-reviewer', 'Reviewer checks acceptance criteria and secret safety.'),
      event('evt-011', '2026-05-23T10:10:00.000Z', 'review-completed', 'demo-reviewer', 'Review completed', 'demo-reviewer', 'Reviewer accepts the local demo workspace trail.'),
    ],
  },
  collaborationItems: normalizeCollaborationInbox([
    {
      schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
      id: 'collab-demo-delegation',
      type: 'delegation',
      priority: 'normal',
      status: 'open',
      assignedAgentId: 'demo-implementer',
      createdAt: '2026-05-23T10:10:00.000Z',
      title: 'Delegation ready for implementer',
      body: 'Planner delegates the compact workspace summary and local seed wiring to the implementer.',
    },
    {
      schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
      id: 'collab-demo-review',
      type: 'review',
      priority: 'high',
      status: 'acknowledged',
      assignedAgentId: 'demo-reviewer',
      createdAt: '2026-05-23T10:11:00.000Z',
      title: 'Review local evidence bundle',
      body: 'Reviewer checks graph, trail, collaboration mix, and audit preview for sanitized deterministic data.',
      note: 'Acknowledged by reviewer in the local demo.',
    },
    {
      schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
      id: 'collab-demo-broadcast',
      type: 'broadcast',
      priority: 'low',
      status: 'resolved',
      createdAt: '2026-05-23T10:09:00.000Z',
      title: 'Workspace broadcast sent',
      body: 'Planner broadcasts that the local demo uses placeholder evidence and source-checkout data only.',
      note: 'Broadcast completed before review.',
    },
    {
      schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
      id: 'collab-demo-escalation',
      type: 'escalation',
      priority: 'urgent',
      status: 'open',
      assignedAgentId: 'demo-reviewer',
      createdAt: '2026-05-23T10:12:00.000Z',
      title: 'Operator escalation requested',
      body: 'Reviewer asks the operator to confirm the demo evidence remains local-only before follow-up execution.',
    },
  ]).items,
  auditEntries: [
    {
      schemaVersion: 'agent-hangar.execution-control-audit.v1',
      id: 'audit-demo-pause-reviewer-confirmation',
      runId: `${WORKSPACE_ID}:demo-reviewer`,
      nodeId: 'demo-reviewer',
      actorId: 'operator-local-demo',
      action: 'pause',
      fromStatus: 'working',
      toStatus: 'paused',
      occurredAt: '2026-05-23T10:13:00.000Z',
      reason: 'Local deterministic demo pause before reviewer confirmation.',
      note: 'Operator confirms sanitized evidence before any follow-up local action.',
    },
  ],
};

const BLOCKED_WORKSPACE_ID = 'workspace-local-demo-blocked';
const BLOCKED_WORKSPACE_SEED: DemoWorkspaceSeed = {
  schemaVersion: 'agent-hangar.demo-workspace-seed.v1',
  workspaceId: BLOCKED_WORKSPACE_ID,
  graph: {
    schemaVersion: 'agent-hangar.execution-graph.v1',
    workspaceId: BLOCKED_WORKSPACE_ID,
    nodes: [
      demoNode('demo-recovery-planner', 'Recovery planner', 'planner', 'completed', 'template-recovery-planner', 'local-model-planner'),
      demoNode('demo-recovery-researcher', 'Recovery researcher', 'researcher', 'completed', 'template-recovery-researcher', 'local-model-researcher'),
      demoNode('demo-recovery-implementer', 'Recovery implementer', 'implementer', 'failed', 'template-recovery-implementer', 'local-model-implementer'),
      {
        ...demoNode('demo-recovery-reviewer', 'Recovery reviewer', 'reviewer', 'blocked', 'template-recovery-reviewer', 'local-model-reviewer'),
        blockedReason: 'Waiting for operator triage of local failed implementation evidence.',
      },
    ],
    edges: [
      { id: 'demo-recovery-planner->demo-recovery-researcher', from: 'demo-recovery-planner', to: 'demo-recovery-researcher', kind: 'handoff', label: 'risk research handoff' },
      { id: 'demo-recovery-researcher->demo-recovery-implementer', from: 'demo-recovery-researcher', to: 'demo-recovery-implementer', kind: 'dependency', label: 'local evidence dependency' },
      { id: 'demo-recovery-implementer->demo-recovery-reviewer', from: 'demo-recovery-implementer', to: 'demo-recovery-reviewer', kind: 'handoff', label: 'blocked review handoff' },
    ],
  },
  trail: {
    schemaVersion: 'agent-hangar.execution-trail.v1',
    workspaceId: BLOCKED_WORKSPACE_ID,
    events: [
      event('evt-blocked-001', '2026-05-23T11:00:00.000Z', 'task-created', 'operator-demo', 'Recovery task created', undefined, 'Prepare a local recovery plan for failed deterministic demo work.'),
      event('evt-blocked-002', '2026-05-23T11:01:00.000Z', 'plan-created', 'demo-recovery-planner', 'Recovery plan created', 'demo-recovery-planner', 'Planner defines retry gates, review checks, and operator triage steps.'),
      event('evt-blocked-003', '2026-05-23T11:02:00.000Z', 'agent-assigned', 'operator-demo', 'Researcher assigned', 'demo-recovery-researcher', 'Researcher inspects local placeholder evidence for blocked work.'),
      event('evt-blocked-004', '2026-05-23T11:03:00.000Z', 'node-started', 'demo-recovery-researcher', 'Recovery research started', 'demo-recovery-researcher', 'Researcher gathers deterministic failure notes from the local demo seed.'),
      event('evt-blocked-005', '2026-05-23T11:04:00.000Z', 'node-completed', 'demo-recovery-researcher', 'Recovery research completed', 'demo-recovery-researcher', 'Researcher confirms the failure is reproducible with placeholder data only.'),
      event('evt-blocked-006', '2026-05-23T11:05:00.000Z', 'agent-assigned', 'demo-recovery-planner', 'Implementer assigned', 'demo-recovery-implementer', 'Planner delegates a local retry patch with no provider execution.'),
      event('evt-blocked-007', '2026-05-23T11:06:00.000Z', 'node-started', 'demo-recovery-implementer', 'Recovery implementation started', 'demo-recovery-implementer', 'Implementer starts a deterministic local retry path.'),
      event('evt-blocked-008', '2026-05-23T11:07:00.000Z', 'node-failed', 'demo-recovery-implementer', 'Recovery implementation failed', 'demo-recovery-implementer', 'Implementer marks the retry failed and asks for operator triage.'),
      event('evt-blocked-009', '2026-05-23T11:08:00.000Z', 'handoff-requested', 'demo-recovery-implementer', 'Review handoff blocked', 'demo-recovery-reviewer', 'Reviewer receives the failed local evidence but waits for escalation handling.'),
      event('evt-blocked-010', '2026-05-23T11:09:00.000Z', 'agent-assigned', 'operator-demo', 'Reviewer assigned', 'demo-recovery-reviewer', 'Reviewer owns recovery validation after operator acknowledgement.'),
      event('evt-blocked-011', '2026-05-23T11:10:00.000Z', 'node-started', 'demo-recovery-reviewer', 'Recovery review started', 'demo-recovery-reviewer', 'Reviewer checks deterministic failed work evidence.'),
      event('evt-blocked-012', '2026-05-23T11:11:00.000Z', 'node-blocked', 'demo-recovery-reviewer', 'Recovery review blocked', 'demo-recovery-reviewer', 'Reviewer blocks until the operator resolves the local escalation.'),
    ],
  },
  collaborationItems: normalizeCollaborationInbox([
    {
      schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
      id: 'collab-recovery-escalation',
      type: 'escalation',
      priority: 'urgent',
      status: 'open',
      assignedAgentId: 'demo-recovery-reviewer',
      createdAt: '2026-05-23T11:12:00.000Z',
      title: 'Escalate failed implementation review',
      body: 'Reviewer asks the operator to choose retry, cancel, or keep the local recovery work blocked.',
    },
    {
      schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
      id: 'collab-recovery-review',
      type: 'review',
      priority: 'high',
      status: 'acknowledged',
      assignedAgentId: 'demo-recovery-reviewer',
      createdAt: '2026-05-23T11:11:00.000Z',
      title: 'Review failed local evidence',
      body: 'Reviewer checks the failure trail, guarded controls, and audit preview before retry.',
      note: 'Acknowledged by reviewer; waiting for operator escalation decision.',
    },
    {
      schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
      id: 'collab-recovery-delegation',
      type: 'delegation',
      priority: 'normal',
      status: 'open',
      assignedAgentId: 'demo-recovery-implementer',
      createdAt: '2026-05-23T11:10:00.000Z',
      title: 'Prepare local retry plan',
      body: 'Planner delegates a source-checkout friendly retry plan for the implementer.',
    },
    {
      schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
      id: 'collab-recovery-broadcast',
      type: 'broadcast',
      priority: 'low',
      status: 'resolved',
      createdAt: '2026-05-23T11:09:00.000Z',
      title: 'Recovery scenario stays local',
      body: 'Planner broadcasts that the recovery scenario uses deterministic placeholder evidence only.',
      note: 'Broadcast resolved before escalation triage.',
    },
    {
      schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
      id: 'collab-recovery-operator-note',
      type: 'escalation',
      priority: 'urgent',
      status: 'resolved',
      assignedAgentId: 'demo-recovery-planner',
      createdAt: '2026-05-23T11:08:00.000Z',
      title: 'Earlier recovery gate resolved',
      body: 'Operator already confirmed the scenario remains provider-free and local-only.',
      note: 'Resolved before the failed implementation review escalation.',
    },
  ]).items,
  auditEntries: [
    {
      schemaVersion: 'agent-hangar.execution-control-audit.v1',
      id: 'audit-recovery-retry-queued',
      runId: `${BLOCKED_WORKSPACE_ID}:demo-recovery-implementer`,
      nodeId: 'demo-recovery-implementer',
      actorId: 'operator-local-demo',
      action: 'retry',
      fromStatus: 'failed',
      toStatus: 'queued',
      occurredAt: '2026-05-23T11:13:00.000Z',
      reason: 'Operator previews a local retry after failed deterministic work.',
      note: 'Retry remains a local preview and does not invoke providers.',
    },
    {
      schemaVersion: 'agent-hangar.execution-control-audit.v1',
      id: 'audit-recovery-review-canceled',
      runId: `${BLOCKED_WORKSPACE_ID}:demo-recovery-reviewer`,
      nodeId: 'demo-recovery-reviewer',
      actorId: 'operator-local-demo',
      action: 'cancel',
      fromStatus: 'blocked',
      toStatus: 'canceled',
      occurredAt: '2026-05-23T11:14:00.000Z',
      reason: 'Operator previews holding blocked review until escalation is resolved.',
      note: 'Audit row uses placeholder local evidence only.',
    },
  ],
};

const DEMO_WORKSPACE_SCENARIOS: DemoWorkspaceScenario[] = [
  {
    schemaVersion: 'agent-hangar.demo-workspace-scenario.v1',
    id: 'coordination-happy-path',
    label: 'Coordination happy path',
    description: 'Planner, researcher, implementer, and reviewer coordinate through a successful local-only workflow.',
    seed: DEMO_WORKSPACE_SEED,
  },
  {
    schemaVersion: 'agent-hangar.demo-workspace-scenario.v1',
    id: 'blocked-failure-recovery',
    label: 'Blocked failure recovery',
    description: 'Failed implementation and blocked review data for guarded controls, escalation triage, and audit previews.',
    seed: BLOCKED_WORKSPACE_SEED,
  },
];

export function buildDemoWorkspaceSeed(): DemoWorkspaceSeed {
  return structuredClone(DEMO_WORKSPACE_SEED);
}

export function listDemoWorkspaceScenarios(): DemoWorkspaceScenario[] {
  return structuredClone(DEMO_WORKSPACE_SCENARIOS);
}

export function getDemoWorkspaceScenario(id: string): DemoWorkspaceScenario {
  return structuredClone(
    DEMO_WORKSPACE_SCENARIOS.find((scenario) => scenario.id === id) ?? DEMO_WORKSPACE_SCENARIOS[0]!,
  );
}

function demoNode(
  id: string,
  title: string,
  role: string,
  status: ExecutionNodeStatus,
  templateId: string,
  modelId: string,
): ExecutionGraph['nodes'][number] {
  return {
    id,
    title,
    role,
    status,
    templateBinding: {
      templateId,
      providerProfileId: 'local-provider-demo',
      modelId,
      escalationPolicyId: 'local-escalation-demo',
    },
  };
}

function event(
  id: string,
  occurredAt: string,
  kind: ExecutionTrailEventKind,
  actorId: string,
  title: string,
  nodeId: string | undefined,
  note: string,
): ExecutionTrailEvent {
  return { id, occurredAt, kind, actorId, title, nodeId, note };
}
