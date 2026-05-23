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

export function buildDemoWorkspaceSeed(): DemoWorkspaceSeed {
  return structuredClone(DEMO_WORKSPACE_SEED);
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
