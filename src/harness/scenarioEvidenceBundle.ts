import {
  buildAuditHistoryPreview,
  buildCollaborationTriageView,
  type AuditHistoryPreview,
  type AuditHistoryRecentEntry,
  type CollaborationTriageView,
} from './collaborationAudit';
import { type DemoWorkspaceScenario } from './demoWorkspace';
import { buildExecutionGraphSummary, validateExecutionGraph, type ExecutionNodeStatus } from './executionGraph';
import { replayExecutionTrail, type ExecutionTrailEventStatus } from './executionTrail';
import { formatRunEvidenceExport, type RunEvidenceExportPreview, type RunEvidenceIssueSummary } from './runEvidenceExport';

export interface ScenarioEvidenceBundleInput {
  scenario: DemoWorkspaceScenario;
  collaborationTriage?: CollaborationTriageView;
  auditHistoryPreview?: AuditHistoryPreview;
}

export interface ScenarioEvidenceBundlePreview {
  schemaVersion: 'agent-hangar.scenario-evidence-bundle.v1';
  scenario: {
    id: string;
    name: string;
    workspaceId: string;
  };
  graphStatusCounts: Record<ExecutionNodeStatus, number>;
  trailStatusCounts: Record<ExecutionTrailEventStatus, number>;
  nextRunnableNodeIds: string[];
  collaboration: {
    visibleCount: number;
    hiddenCount: number;
    activeFilterLabels: string[];
    highPriorityUnresolvedCount: number;
    unresolvedEscalationCount: number;
    nextActionHints: string[];
    unresolvedEscalationCountFromAudit: number;
    highPriorityCountFromAudit: number;
  };
  recentAuditEntries: AuditHistoryRecentEntry[];
  issueSummaries: RunEvidenceIssueSummary[];
  runEvidence: RunEvidenceExportPreview;
  markdown: string;
}

export type ScenarioEvidenceBundleIssueCode =
  | 'malformed-bundle'
  | 'unsupported-schema-version'
  | 'missing-markdown'
  | 'missing-scenario';

export interface ScenarioEvidenceBundleIssue {
  code: ScenarioEvidenceBundleIssueCode;
  severity: 'blocking';
  field: string;
  message: string;
}

export interface ScenarioEvidenceBundleValidationResult {
  schemaVersion: 'agent-hangar.scenario-evidence-bundle-validation.v1';
  issues: ScenarioEvidenceBundleIssue[];
}

const SCHEMA_VERSION = 'agent-hangar.scenario-evidence-bundle.v1';
const VALIDATION_SCHEMA_VERSION = 'agent-hangar.scenario-evidence-bundle-validation.v1';
const TEXT_LIMIT = 120;
const RECENT_AUDIT_LIMIT = 4;

export function formatScenarioEvidenceBundle(input: ScenarioEvidenceBundleInput): ScenarioEvidenceBundlePreview {
  const graphIssues = validateExecutionGraph(input.scenario.seed.graph);
  const graphSummary = buildExecutionGraphSummary(input.scenario.seed.graph);
  const trailSummary = replayExecutionTrail(input.scenario.seed.graph, input.scenario.seed.trail);
  const runEvidence = formatRunEvidenceExport({ trailSummary, graphSummary, graphIssues });
  const collaborationTriage = input.collaborationTriage ?? buildCollaborationTriageView(input.scenario.seed.collaborationItems);
  const auditHistoryPreview = input.auditHistoryPreview ?? buildAuditHistoryPreview({
    auditEntries: input.scenario.seed.auditEntries,
    collaborationItems: collaborationTriage.rows,
  });

  const preview: Omit<ScenarioEvidenceBundlePreview, 'markdown'> = {
    schemaVersion: SCHEMA_VERSION,
    scenario: {
      id: safeText(input.scenario.id, TEXT_LIMIT),
      name: safeText(input.scenario.label, TEXT_LIMIT),
      workspaceId: safeText(input.scenario.seed.workspaceId, TEXT_LIMIT),
    },
    graphStatusCounts: graphSummary.statusCounts,
    trailStatusCounts: trailSummary.eventStatusCounts,
    nextRunnableNodeIds: [...runEvidence.nextRunnableNodeIds].sort((left, right) => left.localeCompare(right)),
    collaboration: {
      visibleCount: collaborationTriage.compact.visibleCount,
      hiddenCount: collaborationTriage.compact.hiddenCount,
      activeFilterLabels: [...collaborationTriage.compact.activeFilterLabels].map((label) => safeText(label, TEXT_LIMIT)),
      highPriorityUnresolvedCount: collaborationTriage.compact.highPriorityUnresolvedCount,
      unresolvedEscalationCount: collaborationTriage.compact.unresolvedEscalationCount,
      nextActionHints: [...collaborationTriage.compact.nextActionHints].map((hint) => safeText(hint, TEXT_LIMIT * 2)),
      unresolvedEscalationCountFromAudit: auditHistoryPreview.counts.unresolvedEscalations,
      highPriorityCountFromAudit: auditHistoryPreview.counts.highPriorityItems + auditHistoryPreview.counts.urgentItems,
    },
    recentAuditEntries: auditHistoryPreview.recentEntries
      .slice(0, RECENT_AUDIT_LIMIT)
      .map(sanitizeRecentAuditEntry),
    issueSummaries: [...runEvidence.issues].map(sanitizeIssueSummary).sort(compareIssueSummaries),
    runEvidence: sanitizeRunEvidence(runEvidence),
  };

  const sanitizedPreview = deepSanitize(preview) as Omit<ScenarioEvidenceBundlePreview, 'markdown'>;
  return {
    ...sanitizedPreview,
    markdown: redactSecretLikeMarkdown(renderMarkdown(sanitizedPreview)),
  };
}

export function validateScenarioEvidenceBundle(bundle: unknown): ScenarioEvidenceBundleValidationResult {
  if (!isRecord(bundle)) {
    return {
      schemaVersion: VALIDATION_SCHEMA_VERSION,
      issues: [issue('malformed-bundle', 'bundle', 'Scenario evidence bundle must be an object.')],
    };
  }

  const issues: ScenarioEvidenceBundleIssue[] = [];
  if (bundle.schemaVersion !== SCHEMA_VERSION) {
    issues.push(issue('unsupported-schema-version', 'schemaVersion', 'Scenario evidence bundle uses an unsupported schema version.'));
  }
  if (!isRecord(bundle.scenario)) {
    issues.push(issue('missing-scenario', 'scenario', 'Scenario evidence bundle must include scenario metadata.'));
  }
  if (typeof bundle.markdown !== 'string' || !bundle.markdown.trim()) {
    issues.push(issue('missing-markdown', 'markdown', 'Scenario evidence bundle must include Markdown preview text.'));
  }

  return {
    schemaVersion: VALIDATION_SCHEMA_VERSION,
    issues,
  };
}

function renderMarkdown(preview: Omit<ScenarioEvidenceBundlePreview, 'markdown'>): string {
  return `---
schemaVersion: ${preview.schemaVersion}
scenarioId: ${preview.scenario.id}
workspaceId: ${preview.scenario.workspaceId}
---

# Scenario Evidence Bundle

## Scenario
- Scenario: ${preview.scenario.name} (\`${preview.scenario.id}\`)
- Workspace: ${preview.scenario.workspaceId}

## Graph Status Counts
${renderStatusCounts(preview.graphStatusCounts)}

## Trail Status Counts
- accepted: ${preview.trailStatusCounts.accepted}
- issue: ${preview.trailStatusCounts.issue}

## Next Runnable Nodes
${renderList(preview.nextRunnableNodeIds)}

## Collaboration Summary
- Visible items: ${preview.collaboration.visibleCount}
- Hidden items: ${preview.collaboration.hiddenCount}
- High-priority unresolved: ${preview.collaboration.highPriorityUnresolvedCount}
- Unresolved escalations: ${preview.collaboration.unresolvedEscalationCount}
- Audit unresolved escalations: ${preview.collaboration.unresolvedEscalationCountFromAudit}
- Audit high/urgent priority: ${preview.collaboration.highPriorityCountFromAudit}
- Active filters: ${preview.collaboration.activeFilterLabels.length > 0 ? preview.collaboration.activeFilterLabels.join(', ') : 'None'}

## Collaboration Next Actions
${renderList(preview.collaboration.nextActionHints)}

## Recent Audit Entries
${preview.recentAuditEntries.length > 0 ? preview.recentAuditEntries.map(renderRecentAuditEntry).join('\n') : '- None'}

## Issue Summaries
${preview.issueSummaries.length > 0 ? preview.issueSummaries.map(renderIssueSummary).join('\n') : '- None'}

## Run Evidence Export

${preview.runEvidence.markdown}`;
}

function renderStatusCounts(counts: Record<ExecutionNodeStatus, number>): string {
  return (['queued', 'runnable', 'blocked', 'working', 'completed', 'failed'] as ExecutionNodeStatus[])
    .map((status) => `- ${status}: ${counts[status]}`)
    .join('\n');
}

function renderList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- None';
}

function renderRecentAuditEntry(entry: AuditHistoryRecentEntry): string {
  return `- ${entry.occurredAt} | ${entry.source} | ${entry.title} | ${entry.detail}`;
}

function renderIssueSummary(issueSummary: RunEvidenceIssueSummary): string {
  return [
    `- ${issueSummary.source}`,
    issueSummary.severity,
    issueSummary.code,
    issueSummary.nodeId ? `node: ${issueSummary.nodeId}` : undefined,
    issueSummary.edgeId ? `edge: ${issueSummary.edgeId}` : undefined,
    issueSummary.message,
  ].filter(Boolean).join(' | ');
}

function sanitizeRunEvidence(runEvidence: RunEvidenceExportPreview): RunEvidenceExportPreview {
  const sanitized = deepSanitize({
    ...runEvidence,
    nextRunnableNodeIds: [...runEvidence.nextRunnableNodeIds].sort((left, right) => left.localeCompare(right)),
    timeline: [...runEvidence.timeline].sort((left, right) => (
      left.occurredAt.localeCompare(right.occurredAt)
      || left.id.localeCompare(right.id)
    )),
    issues: [...runEvidence.issues].map(sanitizeIssueSummary).sort(compareIssueSummaries),
  }) as RunEvidenceExportPreview;
  return {
    ...sanitized,
    markdown: redactSecretLikeMarkdown(runEvidence.markdown),
  };
}

function sanitizeRecentAuditEntry(entry: AuditHistoryRecentEntry): AuditHistoryRecentEntry {
  return {
    id: safeText(entry.id, TEXT_LIMIT),
    source: entry.source,
    occurredAt: safeText(entry.occurredAt, TEXT_LIMIT),
    title: safeText(entry.title, TEXT_LIMIT),
    detail: safeText(entry.detail, TEXT_LIMIT * 2),
    ...(entry.priority ? { priority: entry.priority } : {}),
    ...(entry.status ? { status: entry.status } : {}),
  };
}

function sanitizeIssueSummary(issueSummary: RunEvidenceIssueSummary): RunEvidenceIssueSummary {
  return {
    source: issueSummary.source,
    severity: safeText(issueSummary.severity, TEXT_LIMIT),
    code: safeText(issueSummary.code, TEXT_LIMIT),
    message: safeText(issueSummary.message, TEXT_LIMIT * 2),
    ...(issueSummary.nodeId ? { nodeId: safeText(issueSummary.nodeId, TEXT_LIMIT) } : {}),
    ...(issueSummary.edgeId ? { edgeId: safeText(issueSummary.edgeId, TEXT_LIMIT) } : {}),
    ...(issueSummary.eventId ? { eventId: safeText(issueSummary.eventId, TEXT_LIMIT) } : {}),
  };
}

function compareIssueSummaries(left: RunEvidenceIssueSummary, right: RunEvidenceIssueSummary): number {
  return left.source.localeCompare(right.source)
    || left.severity.localeCompare(right.severity)
    || left.code.localeCompare(right.code)
    || (left.nodeId ?? '').localeCompare(right.nodeId ?? '')
    || (left.edgeId ?? '').localeCompare(right.edgeId ?? '')
    || left.message.localeCompare(right.message);
}

function issue(
  code: ScenarioEvidenceBundleIssueCode,
  field: string,
  message: string,
): ScenarioEvidenceBundleIssue {
  return { code, severity: 'blocking', field, message };
}

function deepSanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return safeText(value, Number.POSITIVE_INFINITY);
  }
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, deepSanitize(entry)]));
  }
  return value;
}

function safeText(value: string, limit: number): string {
  return truncate(escapeMarkdown(redactSecretLikeText(value)), limit);
}

function redactSecretLikeText(value: string): string {
  return value
    .trim()
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, '[redacted]')
    .replace(/\b(?:sk|sk-ant|sk-proj)-[A-Za-z0-9._-]+/g, '[redacted]')
    .replace(/\bAPI\s+token\s+\S+/gi, '[redacted]')
    .replace(/\bsecret(?:\s*[:=]\s*\S+)?/gi, '[redacted]')
    .replace(/\bprivate\s+note\b/gi, '[redacted]')
    .replace(/\bexample\s+customer\b/gi, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]')
    .replace(/\s+/g, ' ');
}

function redactSecretLikeMarkdown(value: string): string {
  return value
    .trim()
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, '[redacted]')
    .replace(/\b(?:sk|sk-ant|sk-proj)-[A-Za-z0-9._-]+/g, '[redacted]')
    .replace(/\bAPI\s+token\s+\S+/gi, '[redacted]')
    .replace(/\bsecret(?:\s*[:=]\s*\S+)?/gi, '[redacted]')
    .replace(/\bprivate\s+note\b/gi, '[redacted]')
    .replace(/\bexample\s+customer\b/gi, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]');
}

function escapeMarkdown(value: string): string {
  return value.replace(/(?<!\\)([|`])/g, '\\$1');
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
