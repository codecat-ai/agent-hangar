import {
  buildExecutionGraphSummary,
  validateExecutionGraph,
  type ExecutionGraph,
  type ExecutionNodeStatus,
} from './executionGraph';

export type ExecutionTrailEventKind =
  | 'task-created'
  | 'plan-created'
  | 'agent-assigned'
  | 'node-started'
  | 'handoff-requested'
  | 'review-completed'
  | 'node-completed';

export type ExecutionTrailEventStatus = 'accepted' | 'issue';

export interface ExecutionTrailEvent {
  id: string;
  occurredAt: string;
  kind: ExecutionTrailEventKind;
  actorId: string;
  title: string;
  nodeId?: string;
  note?: string;
  sequence?: number;
  details?: Record<string, unknown>;
}

export interface ExecutionTrail {
  schemaVersion: 'agent-hangar.execution-trail.v1';
  workspaceId: string;
  events: ExecutionTrailEvent[];
}

export interface ExecutionTrailTimelineEntry {
  id: string;
  occurredAt: string;
  kind: ExecutionTrailEventKind;
  status: ExecutionTrailEventStatus;
  actorId: string;
  title: string;
  nodeId?: string;
  note?: string;
}

export type ExecutionTrailIssueCode = 'unknown-node-event';

export interface ExecutionTrailIssue {
  code: ExecutionTrailIssueCode;
  severity: 'warning';
  message: string;
  eventId: string;
  nodeId: string;
}

export interface ExecutionTrailSummary {
  schemaVersion: 'agent-hangar.execution-trail-summary.v1';
  workspaceId: string;
  eventCount: number;
  issueCount: number;
  eventKindCounts: Record<ExecutionTrailEventKind, number>;
  eventStatusCounts: Record<ExecutionTrailEventStatus, number>;
  latestNodeStatuses: Record<string, ExecutionNodeStatus>;
  nextRunnableNodeIds: string[];
  timeline: ExecutionTrailTimelineEntry[];
  issues?: ExecutionTrailIssue[];
}

const NOTE_LIMIT = 120;

export function replayExecutionTrail(graph: ExecutionGraph, trail: ExecutionTrail): ExecutionTrailSummary {
  const replayGraph: ExecutionGraph = structuredClone(graph);
  const nodeById = new Map(replayGraph.nodes.map((node) => [node.id, node]));
  const issues: ExecutionTrailIssue[] = [];
  const eventKindCounts = createEmptyEventKindCounts();
  const eventStatusCounts: Record<ExecutionTrailEventStatus, number> = { accepted: 0, issue: 0 };
  const timeline: ExecutionTrailTimelineEntry[] = [];

  for (const event of sortTrailEvents(trail.events)) {
    eventKindCounts[event.kind] += 1;
    const issue = event.nodeId && !nodeById.has(event.nodeId)
      ? {
        code: 'unknown-node-event' as const,
        severity: 'warning' as const,
        message: `Execution trail event ${event.id} references unknown node ${event.nodeId}.`,
        eventId: event.id,
        nodeId: event.nodeId,
      }
      : undefined;

    const status: ExecutionTrailEventStatus = issue ? 'issue' : 'accepted';
    eventStatusCounts[status] += 1;
    if (issue) {
      issues.push(issue);
    } else if (event.nodeId) {
      applyEventToNode(nodeById.get(event.nodeId)!, event.kind);
    }

    timeline.push({
      id: event.id.trim(),
      occurredAt: event.occurredAt.trim(),
      kind: event.kind,
      status,
      actorId: sanitizeText(event.actorId),
      title: sanitizeText(event.title),
      nodeId: event.nodeId?.trim(),
      note: event.note ? sanitizeNote(event.note) : undefined,
    });
  }

  const graphIssues = validateExecutionGraph(replayGraph);
  const graphSummary = buildExecutionGraphSummary(replayGraph);

  return {
    schemaVersion: 'agent-hangar.execution-trail-summary.v1',
    workspaceId: trail.workspaceId,
    eventCount: trail.events.length,
    issueCount: graphIssues.length + issues.length,
    eventKindCounts,
    eventStatusCounts,
    latestNodeStatuses: Object.fromEntries(
      replayGraph.nodes
        .map((node) => [node.id, node.status] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
    nextRunnableNodeIds: graphSummary.nextRunnableNodeIds,
    timeline,
    ...(issues.length > 0 ? { issues } : {}),
  };
}

export function buildDemoExecutionTrail(): { graph: ExecutionGraph; trail: ExecutionTrail } {
  const graph: ExecutionGraph = {
    schemaVersion: 'agent-hangar.execution-graph.v1',
    workspaceId: 'workspace-local-demo',
    nodes: [
      demoNode('demo-planner', 'Planner', 'planner', 'completed', 'template-demo-planner', 'local-model-planner'),
      demoNode('demo-researcher', 'Researcher', 'researcher', 'queued', 'template-demo-researcher', 'local-model-researcher'),
      demoNode('demo-reviewer', 'Reviewer', 'reviewer', 'queued', 'template-demo-reviewer', 'local-model-reviewer'),
    ],
    edges: [
      { id: 'demo-planner->demo-researcher', from: 'demo-planner', to: 'demo-researcher', kind: 'handoff', label: 'research handoff' },
      { id: 'demo-researcher->demo-reviewer', from: 'demo-researcher', to: 'demo-reviewer', kind: 'handoff', label: 'review handoff' },
    ],
  };

  return {
    graph,
    trail: {
      schemaVersion: 'agent-hangar.execution-trail.v1',
      workspaceId: 'workspace-local-demo',
      events: [
        event('evt-001', '2026-05-23T10:00:00.000Z', 'task-created', 'operator-demo', 'Task created', undefined, 'Prepare a local release-readiness brief.'),
        event('evt-002', '2026-05-23T10:01:00.000Z', 'plan-created', 'demo-planner', 'Plan created', 'demo-planner', 'Planner outlines research, implementation, and review checkpoints.'),
        event('evt-003', '2026-05-23T10:02:00.000Z', 'agent-assigned', 'operator-demo', 'Researcher assigned', 'demo-researcher', 'Researcher owns local evidence gathering.'),
        event('evt-004', '2026-05-23T10:03:00.000Z', 'node-started', 'demo-researcher', 'Research started', 'demo-researcher', 'Researcher starts from source-checkout fixtures only.'),
        event('evt-005', '2026-05-23T10:04:00.000Z', 'node-completed', 'demo-researcher', 'Research completed', 'demo-researcher', 'Research notes are ready for planner handoff.'),
        event('evt-006', '2026-05-23T10:05:00.000Z', 'handoff-requested', 'demo-planner', 'Review handoff requested', 'demo-reviewer', 'Planner sends deterministic local evidence to review.'),
        event('evt-007', '2026-05-23T10:06:00.000Z', 'agent-assigned', 'operator-demo', 'Reviewer assigned', 'demo-reviewer', 'Reviewer checks acceptance criteria and secret safety.'),
        event('evt-008', '2026-05-23T10:07:00.000Z', 'review-completed', 'demo-reviewer', 'Review completed', 'demo-reviewer', 'Reviewer accepts the local demo trail.'),
      ],
    },
  };
}

function sortTrailEvents(events: ExecutionTrailEvent[]): ExecutionTrailEvent[] {
  return [...events].sort((left, right) => (
    left.occurredAt.localeCompare(right.occurredAt)
    || (left.sequence ?? 0) - (right.sequence ?? 0)
    || left.id.localeCompare(right.id)
  ));
}

function applyEventToNode(node: { status: ExecutionNodeStatus }, kind: ExecutionTrailEventKind): void {
  if (kind === 'agent-assigned') {
    node.status = 'runnable';
  }
  if (kind === 'node-started') {
    node.status = 'working';
  }
  if (kind === 'node-completed' || kind === 'review-completed') {
    node.status = 'completed';
  }
}

function sanitizeNote(value: string): string {
  return truncate(sanitizeText(value), NOTE_LIMIT);
}

function sanitizeText(value: string): string {
  return value
    .trim()
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bsk-[A-Za-z0-9._-]+/g, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, 'workspace');
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

function createEmptyEventKindCounts(): Record<ExecutionTrailEventKind, number> {
  return {
    'task-created': 0,
    'plan-created': 0,
    'agent-assigned': 0,
    'node-started': 0,
    'handoff-requested': 0,
    'review-completed': 0,
    'node-completed': 0,
  };
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
