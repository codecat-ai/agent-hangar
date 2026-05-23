import {
  type ExecutionGraphIssue,
  type ExecutionGraphSummary,
  type ExecutionNodeStatus,
} from './executionGraph';
import {
  type ExecutionTrailIssue,
  type ExecutionTrailSummary,
  type ExecutionTrailTimelineEntry,
} from './executionTrail';

export interface RunEvidenceExportInput {
  trailSummary: ExecutionTrailSummary;
  graphSummary?: ExecutionGraphSummary;
  graphIssues?: ExecutionGraphIssue[];
}

export interface RunEvidenceTimelineEntry {
  id: string;
  occurredAt: string;
  kind: string;
  status: string;
  actorId: string;
  title: string;
  nodeId?: string;
  note?: string;
}

export interface RunEvidenceIssueSummary {
  source: 'graph' | 'trail';
  severity: string;
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  eventId?: string;
}

export interface RunEvidenceExportPreview {
  schemaVersion: 'agent-hangar.run-evidence-export.v1';
  workspaceId: string;
  counts: {
    events: number;
    trailIssues: number;
    graphIssues: number;
    blockingGraphIssues: number;
    nodes: number;
    edges: number;
  };
  statusCounts: Record<'accepted' | 'issue' | ExecutionNodeStatus, number>;
  nextRunnableNodeIds: string[];
  timeline: RunEvidenceTimelineEntry[];
  issues: RunEvidenceIssueSummary[];
  markdown: string;
}

const EXPORT_SCHEMA_VERSION = 'agent-hangar.run-evidence-export.v1';
const TEXT_LIMIT = 96;
const NOTE_LIMIT = 128;
const MESSAGE_LIMIT = 180;
const STATUS_KEYS: ExecutionNodeStatus[] = ['queued', 'runnable', 'blocked', 'working', 'completed', 'failed'];

export function formatRunEvidenceExport(input: RunEvidenceExportInput): RunEvidenceExportPreview {
  const workspaceId = safeText(input.trailSummary.workspaceId, TEXT_LIMIT);
  const graphIssues = [...(input.graphIssues ?? [])].sort(compareGraphIssues);
  const timeline = input.trailSummary.timeline
    .map(formatTimelineEntry)
    .sort((left, right) => (
      left.occurredAt.localeCompare(right.occurredAt)
      || left.id.localeCompare(right.id)
    ));
  const issues = [
    ...graphIssues.map(formatGraphIssue),
    ...(input.trailSummary.issues ?? []).map(formatTrailIssue),
  ].sort(compareIssueSummaries);
  const nextRunnableNodeIds = (input.graphSummary?.nextRunnableNodeIds ?? input.trailSummary.nextRunnableNodeIds)
    .map((nodeId) => safeText(nodeId, TEXT_LIMIT))
    .sort((left, right) => left.localeCompare(right));
  const statusCounts = {
    accepted: input.trailSummary.eventStatusCounts.accepted,
    issue: input.trailSummary.eventStatusCounts.issue,
    ...Object.fromEntries(STATUS_KEYS.map((status) => [status, input.graphSummary?.statusCounts[status] ?? 0])),
  } as Record<'accepted' | 'issue' | ExecutionNodeStatus, number>;

  const preview: Omit<RunEvidenceExportPreview, 'markdown'> = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    workspaceId,
    counts: {
      events: input.trailSummary.eventCount,
      trailIssues: input.trailSummary.issues?.length ?? Math.max(0, input.trailSummary.issueCount - graphIssues.length),
      graphIssues: graphIssues.length || input.graphSummary?.issueCount || 0,
      blockingGraphIssues: input.graphSummary?.blockingIssueCount ?? graphIssues.filter((issue) => issue.severity === 'blocking').length,
      nodes: input.graphSummary?.nodeCount ?? 0,
      edges: input.graphSummary?.edgeCount ?? 0,
    },
    statusCounts,
    nextRunnableNodeIds,
    timeline,
    issues,
  };

  return {
    ...preview,
    markdown: renderMarkdown(preview),
  };
}

function formatTimelineEntry(entry: ExecutionTrailTimelineEntry): RunEvidenceTimelineEntry {
  return {
    id: safeText(entry.id, TEXT_LIMIT),
    occurredAt: safeText(entry.occurredAt, TEXT_LIMIT),
    kind: safeText(entry.kind, TEXT_LIMIT),
    status: safeText(entry.status, TEXT_LIMIT),
    actorId: safeText(entry.actorId, TEXT_LIMIT),
    title: safeText(entry.title, TEXT_LIMIT),
    ...(entry.nodeId ? { nodeId: safeText(entry.nodeId, TEXT_LIMIT) } : {}),
    ...(entry.note ? { note: safeText(entry.note, NOTE_LIMIT) } : {}),
  };
}

function formatGraphIssue(issue: ExecutionGraphIssue): RunEvidenceIssueSummary {
  return {
    source: 'graph',
    severity: safeText(issue.severity, TEXT_LIMIT),
    code: safeText(issue.code, TEXT_LIMIT),
    message: safeText(issue.message, MESSAGE_LIMIT),
    ...(issue.nodeId ? { nodeId: safeText(issue.nodeId, TEXT_LIMIT) } : {}),
    ...(issue.edgeId ? { edgeId: safeText(issue.edgeId, TEXT_LIMIT) } : {}),
  };
}

function formatTrailIssue(issue: ExecutionTrailIssue): RunEvidenceIssueSummary {
  return {
    source: 'trail',
    severity: safeText(issue.severity, TEXT_LIMIT),
    code: safeText(issue.code, TEXT_LIMIT),
    message: safeText(issue.message, MESSAGE_LIMIT),
    eventId: safeText(issue.eventId, TEXT_LIMIT),
    nodeId: safeText(issue.nodeId, TEXT_LIMIT),
  };
}

function renderMarkdown(preview: Omit<RunEvidenceExportPreview, 'markdown'>): string {
  return `---
schemaVersion: ${preview.schemaVersion}
workspaceId: ${preview.workspaceId}
---

# Run Evidence Export

## Counts
- Events: ${preview.counts.events}
- Trail issues: ${preview.counts.trailIssues}
- Graph issues: ${preview.counts.graphIssues}
- Blocking graph issues: ${preview.counts.blockingGraphIssues}
- Nodes: ${preview.counts.nodes}
- Edges: ${preview.counts.edges}

## Status Counts
- accepted: ${preview.statusCounts.accepted}
- issue: ${preview.statusCounts.issue}
${STATUS_KEYS.map((status) => `- ${status}: ${preview.statusCounts[status]}`).join('\n')}

## Next Runnable Nodes
${renderList(preview.nextRunnableNodeIds)}

## Timeline
${preview.timeline.length > 0 ? preview.timeline.map(renderTimelineEntry).join('\n') : '- None'}

## Issues
${preview.issues.length > 0 ? preview.issues.map(renderIssue).join('\n') : '- None'}
`;
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return '- None';
  }
  return items.map((item) => `- ${item}`).join('\n');
}

function renderTimelineEntry(entry: RunEvidenceTimelineEntry): string {
  return [
    `- ${entry.occurredAt}`,
    entry.kind,
    entry.status,
    entry.actorId,
    entry.title,
    entry.nodeId ? `node: ${entry.nodeId}` : undefined,
    entry.note,
  ].filter(Boolean).join(' | ');
}

function renderIssue(issue: RunEvidenceIssueSummary): string {
  return [
    `- ${issue.source}`,
    issue.severity,
    issue.code,
    issue.nodeId ? `node: ${issue.nodeId}` : undefined,
    issue.edgeId ? `edge: ${issue.edgeId}` : undefined,
    issue.message,
  ].filter(Boolean).join(' | ');
}

function compareGraphIssues(left: ExecutionGraphIssue, right: ExecutionGraphIssue): number {
  return left.severity.localeCompare(right.severity)
    || left.code.localeCompare(right.code)
    || (left.nodeId ?? '').localeCompare(right.nodeId ?? '')
    || (left.edgeId ?? '').localeCompare(right.edgeId ?? '')
    || left.message.localeCompare(right.message);
}

function compareIssueSummaries(left: RunEvidenceIssueSummary, right: RunEvidenceIssueSummary): number {
  return left.source.localeCompare(right.source)
    || left.severity.localeCompare(right.severity)
    || left.code.localeCompare(right.code)
    || (left.nodeId ?? '').localeCompare(right.nodeId ?? '')
    || (left.edgeId ?? '').localeCompare(right.edgeId ?? '')
    || left.message.localeCompare(right.message);
}

function safeText(value: string, limit: number): string {
  return truncate(escapeMarkdown(redactSecretLikeText(value)), limit);
}

function redactSecretLikeText(value: string): string {
  return value
    .trim()
    .replace(/\bapiKey(?:\s*=\s*[A-Za-z0-9_-]+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*[A-Za-z0-9_-]+)?/gi, '[redacted]')
    .replace(/\bsk-[A-Za-z0-9._-]+/g, '[redacted]')
    .replace(/\bexample\s+customer\b/gi, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]')
    .replace(/\s+/g, ' ');
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\|`]/g, '\\$&');
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 3).trimEnd()}...`;
}
