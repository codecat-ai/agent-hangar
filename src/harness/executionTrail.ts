import {
  buildExecutionGraphSummary,
  validateExecutionGraph,
  type ExecutionGraph,
  type ExecutionNodeStatus,
} from './executionGraph';
import { buildDemoWorkspaceSeed } from './demoWorkspace';

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
  const seed = buildDemoWorkspaceSeed();
  return { graph: seed.graph, trail: seed.trail };
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
