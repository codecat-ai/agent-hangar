import { type ExecutionControlAuditEntry } from './executionControls';

export type CollaborationInboxType = 'delegation' | 'review' | 'broadcast' | 'escalation';
export type CollaborationInboxPriority = 'low' | 'normal' | 'high' | 'urgent';
export type CollaborationInboxStatus = 'open' | 'acknowledged' | 'resolved';
export type CollaborationMutationAction = 'acknowledge' | 'resolve';

export interface CollaborationInboxRecord {
  schemaVersion: 'agent-hangar.collaboration-inbox-item.v1';
  id: string;
  type: CollaborationInboxType;
  priority: CollaborationInboxPriority;
  status: CollaborationInboxStatus;
  assignedAgentId?: string;
  createdAt: string;
  title: string;
  body?: string;
  note?: string;
}

export type CollaborationInboxIssueCode =
  | 'invalid-schema-version'
  | 'missing-id'
  | 'invalid-type'
  | 'invalid-priority'
  | 'invalid-status'
  | 'invalid-created-at'
  | 'missing-title';

export interface CollaborationInboxIssue {
  code: CollaborationInboxIssueCode;
  severity: 'blocking';
  itemId: string;
  field: string;
  message: string;
}

export interface CollaborationInboxNormalizationResult {
  schemaVersion: 'agent-hangar.collaboration-inbox-normalization.v1';
  items: CollaborationInboxRecord[];
  issues: CollaborationInboxIssue[];
}

export interface CollaborationMutationAuditEntry {
  schemaVersion: 'agent-hangar.collaboration-mutation-audit.v1';
  id: string;
  itemId: string;
  actorId: string;
  action: CollaborationMutationAction;
  fromStatus: CollaborationInboxStatus;
  toStatus: CollaborationInboxStatus;
  occurredAt: string;
  reason?: string;
  note?: string;
}

export type AuditHistoryInputEntry = ExecutionControlAuditEntry | CollaborationMutationAuditEntry;

export interface CollaborationPersistencePayload {
  schemaVersion: 'agent-hangar.collaboration-persistence.v1';
  collaborationItems: CollaborationInboxRecord[];
  mutationAuditEntries: CollaborationMutationAuditEntry[];
  auditHistoryPreview: AuditHistoryPreview;
}

export type CollaborationMutationIssueCode = 'unknown-item-id' | 'invalid-transition';

export interface CollaborationMutationIssue {
  code: CollaborationMutationIssueCode;
  severity: 'blocking';
  itemId: string;
  action: CollaborationMutationAction;
  message: string;
}

export interface CollaborationMutationOptions {
  action: CollaborationMutationAction;
  itemId: string;
  actorId: string;
  clock: () => string;
  reason?: string;
  note?: string;
  existingAuditEntries?: CollaborationMutationAuditEntry[];
  auditHistoryEntries?: ExecutionControlAuditEntry[];
}

export interface CollaborationMutationResult {
  schemaVersion: 'agent-hangar.collaboration-mutation-result.v1';
  ok: boolean;
  items: CollaborationInboxRecord[];
  auditEntries: CollaborationMutationAuditEntry[];
  persistencePayload: CollaborationPersistencePayload;
  issue?: CollaborationMutationIssue;
}

export interface AuditHistoryPreviewInput {
  auditEntries: AuditHistoryInputEntry[];
  collaborationItems: CollaborationInboxRecord[];
  recentLimit?: number;
}

export interface AuditHistoryRecentEntry {
  id: string;
  source: 'audit' | 'collaboration';
  occurredAt: string;
  title: string;
  detail: string;
  priority?: CollaborationInboxPriority;
  status?: CollaborationInboxStatus;
}

export interface AuditHistoryPreview {
  schemaVersion: 'agent-hangar.audit-history-preview.v1';
  counts: {
    auditEntries: number;
    collaborationItems: number;
    openItems: number;
    acknowledgedItems: number;
    resolvedItems: number;
    unresolvedEscalations: number;
    urgentItems: number;
    highPriorityItems: number;
  };
  recentEntries: AuditHistoryRecentEntry[];
  nextActionHints: string[];
  markdown: string;
}

const COLLABORATION_SCHEMA_VERSION = 'agent-hangar.collaboration-inbox-item.v1';
const NORMALIZATION_SCHEMA_VERSION = 'agent-hangar.collaboration-inbox-normalization.v1';
const AUDIT_HISTORY_SCHEMA_VERSION = 'agent-hangar.audit-history-preview.v1';
const COLLABORATION_MUTATION_AUDIT_SCHEMA_VERSION = 'agent-hangar.collaboration-mutation-audit.v1';
const COLLABORATION_PERSISTENCE_SCHEMA_VERSION = 'agent-hangar.collaboration-persistence.v1';
const COLLABORATION_MUTATION_RESULT_SCHEMA_VERSION = 'agent-hangar.collaboration-mutation-result.v1';
const COLLABORATION_TYPES: CollaborationInboxType[] = ['delegation', 'review', 'broadcast', 'escalation'];
const PRIORITIES: CollaborationInboxPriority[] = ['low', 'normal', 'high', 'urgent'];
const STATUSES: CollaborationInboxStatus[] = ['open', 'acknowledged', 'resolved'];
const PRIORITY_RANK: Record<CollaborationInboxPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};
const TEXT_LIMIT = 96;
const BODY_LIMIT = 180;

export function normalizeCollaborationInbox(records: unknown[]): CollaborationInboxNormalizationResult {
  const items: CollaborationInboxRecord[] = [];
  const issues: CollaborationInboxIssue[] = [];

  for (const record of records) {
    const source = isRecord(record) ? record : {};
    const rawId = typeof source.id === 'string' ? source.id.trim() : '';
    const itemId = rawId || 'unknown-item';
    const itemIssues = validateRecord(source, itemId);

    if (itemIssues.length > 0) {
      issues.push(...itemIssues);
      continue;
    }

    items.push({
      schemaVersion: COLLABORATION_SCHEMA_VERSION,
      id: sanitizeIdentifier(rawId),
      type: source.type as CollaborationInboxType,
      priority: source.priority as CollaborationInboxPriority,
      status: source.status as CollaborationInboxStatus,
      ...(typeof source.assignedAgentId === 'string' && source.assignedAgentId.trim()
        ? { assignedAgentId: sanitizeIdentifier(source.assignedAgentId) }
        : {}),
      createdAt: (source.createdAt as string).trim(),
      title: safeText(source.title as string, TEXT_LIMIT),
      ...(typeof source.body === 'string' && source.body.trim() ? { body: safeText(source.body, BODY_LIMIT) } : {}),
      ...(typeof source.note === 'string' && source.note.trim() ? { note: safeText(source.note, BODY_LIMIT) } : {}),
    });
  }

  return {
    schemaVersion: NORMALIZATION_SCHEMA_VERSION,
    items: sortCollaborationInboxItems(items),
    issues,
  };
}

export function sortCollaborationInboxItems(items: CollaborationInboxRecord[]): CollaborationInboxRecord[] {
  return [...items].sort((left, right) => {
    const leftResolved = left.status === 'resolved' ? 1 : 0;
    const rightResolved = right.status === 'resolved' ? 1 : 0;
    return leftResolved - rightResolved
      || PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority]
      || right.createdAt.localeCompare(left.createdAt)
      || left.id.localeCompare(right.id);
  });
}

export function applyCollaborationInboxMutation(
  items: CollaborationInboxRecord[],
  options: CollaborationMutationOptions,
): CollaborationMutationResult {
  const clonedItems = sortCollaborationInboxItems(items.map(cloneCollaborationItem));
  const existingAuditEntries = (options.existingAuditEntries ?? []).map(sanitizeMutationAuditEntry);
  const itemId = sanitizeIdentifier(options.itemId);
  const actorId = sanitizeIdentifier(options.actorId);
  const itemIndex = clonedItems.findIndex((item) => item.id === itemId);

  if (itemIndex === -1) {
    return mutationResult({
      ok: false,
      items: clonedItems,
      auditEntries: existingAuditEntries,
      issue: {
        code: 'unknown-item-id',
        severity: 'blocking',
        itemId,
        action: options.action,
        message: `Collaboration item ${itemId} was not found.`,
      },
      auditHistoryEntries: options.auditHistoryEntries,
    });
  }

  const item = clonedItems[itemIndex]!;
  const toStatus = statusForMutationAction(options.action);
  if (!canTransitionCollaborationItem(item.status, options.action)) {
    return mutationResult({
      ok: false,
      items: clonedItems,
      auditEntries: existingAuditEntries,
      issue: {
        code: 'invalid-transition',
        severity: 'blocking',
        itemId,
        action: options.action,
        message: `Collaboration item ${itemId} cannot transition from ${item.status} to ${toStatus}.`,
      },
      auditHistoryEntries: options.auditHistoryEntries,
    });
  }

  const occurredAt = safeText(options.clock(), TEXT_LIMIT);
  const reason = options.reason;
  const note = options.note ?? options.reason;
  const updatedItem: CollaborationInboxRecord = {
    ...item,
    status: toStatus,
    ...(note ? { note } : {}),
  };
  const updatedItems = sortCollaborationInboxItems([
    ...clonedItems.slice(0, itemIndex),
    updatedItem,
    ...clonedItems.slice(itemIndex + 1),
  ]);
  const auditEntry: CollaborationMutationAuditEntry = {
    schemaVersion: COLLABORATION_MUTATION_AUDIT_SCHEMA_VERSION,
    id: `collaboration-mutation:${itemId}:${options.action}:${occurredAt}`,
    itemId,
    actorId,
    action: options.action,
    fromStatus: item.status,
    toStatus,
    occurredAt,
    ...(reason ? { reason } : {}),
    ...(note ? { note } : {}),
  };
  const auditEntries = [...existingAuditEntries, auditEntry];

  return mutationResult({
    ok: true,
    items: updatedItems,
    auditEntries,
    auditHistoryEntries: options.auditHistoryEntries,
  });
}

export function buildAuditHistoryPreview(input: AuditHistoryPreviewInput): AuditHistoryPreview {
  const sortedCollaborationItems = sortCollaborationInboxItems(input.collaborationItems);
  const sanitizedAuditEntries = input.auditEntries.map(sanitizeAuditHistoryInputEntry);
  const counts = {
    auditEntries: sanitizedAuditEntries.length,
    collaborationItems: sortedCollaborationItems.length,
    openItems: sortedCollaborationItems.filter((item) => item.status === 'open').length,
    acknowledgedItems: sortedCollaborationItems.filter((item) => item.status === 'acknowledged').length,
    resolvedItems: sortedCollaborationItems.filter((item) => item.status === 'resolved').length,
    unresolvedEscalations: sortedCollaborationItems.filter((item) => item.type === 'escalation' && item.status !== 'resolved').length,
    urgentItems: sortedCollaborationItems.filter((item) => item.priority === 'urgent').length,
    highPriorityItems: sortedCollaborationItems.filter((item) => item.priority === 'high').length,
  };
  const recentEntries = [
    ...sortedCollaborationItems.map(collaborationToRecentEntry),
    ...sanitizedAuditEntries.map(auditToRecentEntry),
  ]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id))
    .slice(0, input.recentLimit ?? 6);
  const nextActionHints = buildNextActionHints(counts, sanitizedAuditEntries.length);
  const preview: Omit<AuditHistoryPreview, 'markdown'> = {
    schemaVersion: AUDIT_HISTORY_SCHEMA_VERSION,
    counts,
    recentEntries,
    nextActionHints,
  };

  return {
    ...preview,
    markdown: renderMarkdown(preview),
  };
}

function validateRecord(source: Record<string, unknown>, itemId: string): CollaborationInboxIssue[] {
  const issues: CollaborationInboxIssue[] = [];
  if (source.schemaVersion !== COLLABORATION_SCHEMA_VERSION) {
    issues.push(issue('invalid-schema-version', itemId, 'schemaVersion', `Collaboration item ${itemId} has an invalid schema version.`));
  }
  if (!itemId || itemId === 'unknown-item') {
    issues.push(issue('missing-id', itemId, 'id', `Collaboration item ${itemId} must have an id.`));
  }
  if (!COLLABORATION_TYPES.includes(source.type as CollaborationInboxType)) {
    issues.push(issue('invalid-type', itemId, 'type', `Collaboration item ${itemId} has an invalid type.`));
  }
  if (!PRIORITIES.includes(source.priority as CollaborationInboxPriority)) {
    issues.push(issue('invalid-priority', itemId, 'priority', `Collaboration item ${itemId} has an invalid priority.`));
  }
  if (!STATUSES.includes(source.status as CollaborationInboxStatus)) {
    issues.push(issue('invalid-status', itemId, 'status', `Collaboration item ${itemId} has an invalid status.`));
  }
  if (typeof source.createdAt !== 'string' || Number.isNaN(Date.parse(source.createdAt))) {
    issues.push(issue('invalid-created-at', itemId, 'createdAt', `Collaboration item ${itemId} must have an ISO createdAt timestamp.`));
  }
  if (typeof source.title !== 'string' || !source.title.trim()) {
    issues.push(issue('missing-title', itemId, 'title', `Collaboration item ${itemId} must have a title.`));
  }
  return issues;
}

function issue(code: CollaborationInboxIssueCode, itemId: string, field: string, message: string): CollaborationInboxIssue {
  return { code, severity: 'blocking', itemId, field, message };
}

function collaborationToRecentEntry(item: CollaborationInboxRecord): AuditHistoryRecentEntry {
  return {
    id: `collab:${item.id}`,
    source: 'collaboration',
    occurredAt: item.createdAt,
    title: item.title,
    detail: safeText([
      item.type,
      item.priority,
      item.status,
      item.assignedAgentId,
      item.body,
      item.note,
    ].filter(Boolean).join(' · '), BODY_LIMIT),
    priority: item.priority,
    status: item.status,
  };
}

function auditToRecentEntry(entry: AuditHistoryInputEntry): AuditHistoryRecentEntry {
  if (isCollaborationMutationAuditEntry(entry)) {
    return {
      id: `collaboration-audit:${entry.id}`,
      source: 'audit',
      occurredAt: entry.occurredAt,
      title: `${entry.action} ${entry.fromStatus} -> ${entry.toStatus}`,
      detail: safeText([
        entry.actorId,
        `item: ${entry.itemId}`,
        entry.reason,
        entry.note,
      ].filter(Boolean).join(' · '), BODY_LIMIT),
    };
  }

  return {
    id: `audit:${entry.id}`,
    source: 'audit',
    occurredAt: entry.occurredAt,
    title: `${entry.action} ${entry.fromStatus} -> ${entry.toStatus}`,
    detail: safeText([
      entry.actorId,
      entry.nodeId ? `node: ${entry.nodeId}` : entry.runId,
      entry.reason,
      entry.note,
    ].filter(Boolean).join(' · '), BODY_LIMIT),
  };
}

function buildNextActionHints(counts: AuditHistoryPreview['counts'], auditEntryCount: number): string[] {
  const hints: string[] = [];
  const unresolvedItems = counts.openItems + counts.acknowledgedItems;
  if (counts.unresolvedEscalations > 0) {
    hints.push(`Resolve ${counts.unresolvedEscalations} urgent escalation${counts.unresolvedEscalations === 1 ? '' : 's'} before starting more local execution.`);
  }
  if (unresolvedItems > 0) {
    hints.push(`Review ${unresolvedItems} unresolved collaboration item${unresolvedItems === 1 ? '' : 's'}.`);
  }
  if (auditEntryCount > 0) {
    hints.push('Check the most recent guarded control audit entry before retrying or resuming work.');
  }
  if (hints.length === 0) {
    hints.push('No unresolved collaboration or guarded control follow-up is pending.');
  }
  return hints;
}

function renderMarkdown(preview: Omit<AuditHistoryPreview, 'markdown'>): string {
  return `---
schemaVersion: ${preview.schemaVersion}
---

# Audit History Preview

## Counts
- Audit entries: ${preview.counts.auditEntries}
- Collaboration items: ${preview.counts.collaborationItems}
- Open items: ${preview.counts.openItems}
- Acknowledged items: ${preview.counts.acknowledgedItems}
- Resolved items: ${preview.counts.resolvedItems}
- Unresolved escalations: ${preview.counts.unresolvedEscalations}
- Urgent items: ${preview.counts.urgentItems}
- High priority items: ${preview.counts.highPriorityItems}

## Next Actions
${preview.nextActionHints.map((hint) => `- ${hint}`).join('\n')}

## Recent Entries
${preview.recentEntries.length > 0 ? preview.recentEntries.map(renderRecentEntry).join('\n') : '- None'}
`;
}

function renderRecentEntry(entry: AuditHistoryRecentEntry): string {
  return `- ${entry.occurredAt} | ${entry.source} | ${entry.title} | ${entry.detail}`;
}

function sanitizeAuditHistoryInputEntry(entry: AuditHistoryInputEntry): AuditHistoryInputEntry {
  return isCollaborationMutationAuditEntry(entry) ? sanitizeMutationAuditEntry(entry) : sanitizeAuditEntry(entry);
}

function sanitizeAuditEntry(entry: ExecutionControlAuditEntry): ExecutionControlAuditEntry {
  return {
    schemaVersion: 'agent-hangar.execution-control-audit.v1',
    id: sanitizeIdentifier(entry.id),
    runId: sanitizeIdentifier(entry.runId),
    ...(entry.nodeId ? { nodeId: sanitizeIdentifier(entry.nodeId) } : {}),
    actorId: sanitizeIdentifier(entry.actorId),
    action: entry.action,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    occurredAt: safeText(entry.occurredAt, TEXT_LIMIT),
    ...(entry.reason ? { reason: safeText(entry.reason, BODY_LIMIT) } : {}),
    ...(entry.note ? { note: safeText(entry.note, BODY_LIMIT) } : {}),
  };
}

function sanitizeMutationAuditEntry(entry: CollaborationMutationAuditEntry): CollaborationMutationAuditEntry {
  return {
    schemaVersion: COLLABORATION_MUTATION_AUDIT_SCHEMA_VERSION,
    id: sanitizeIdentifier(entry.id),
    itemId: sanitizeIdentifier(entry.itemId),
    actorId: sanitizeIdentifier(entry.actorId),
    action: entry.action,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    occurredAt: safeText(entry.occurredAt, TEXT_LIMIT),
    ...(entry.reason ? { reason: safeText(entry.reason, BODY_LIMIT) } : {}),
    ...(entry.note ? { note: safeText(entry.note, BODY_LIMIT) } : {}),
  };
}

function mutationResult(input: {
  ok: boolean;
  items: CollaborationInboxRecord[];
  auditEntries: CollaborationMutationAuditEntry[];
  issue?: CollaborationMutationIssue;
  auditHistoryEntries?: ExecutionControlAuditEntry[];
}): CollaborationMutationResult {
  const items = sortCollaborationInboxItems(input.items.map(cloneCollaborationItem));
  const auditEntries = input.auditEntries.map(sanitizeMutationAuditEntry);
  const persistencePayload = buildCollaborationPersistencePayload({
    items,
    mutationAuditEntries: auditEntries,
    auditHistoryEntries: input.auditHistoryEntries ?? [],
  });
  return {
    schemaVersion: COLLABORATION_MUTATION_RESULT_SCHEMA_VERSION,
    ok: input.ok,
    items,
    auditEntries,
    persistencePayload,
    ...(input.issue ? { issue: input.issue } : {}),
  };
}

function buildCollaborationPersistencePayload(input: {
  items: CollaborationInboxRecord[];
  mutationAuditEntries: CollaborationMutationAuditEntry[];
  auditHistoryEntries: ExecutionControlAuditEntry[];
}): CollaborationPersistencePayload {
  const collaborationItems = sortCollaborationInboxItems(input.items.map(cloneCollaborationItem));
  const mutationAuditEntries = input.mutationAuditEntries.map(sanitizeMutationAuditEntry);
  const auditHistoryEntries = input.auditHistoryEntries.map(sanitizeAuditEntry);
  return {
    schemaVersion: COLLABORATION_PERSISTENCE_SCHEMA_VERSION,
    collaborationItems,
    mutationAuditEntries,
    auditHistoryPreview: buildAuditHistoryPreview({
      auditEntries: [...auditHistoryEntries, ...mutationAuditEntries],
      collaborationItems,
    }),
  };
}

function cloneCollaborationItem(item: CollaborationInboxRecord): CollaborationInboxRecord {
  return {
    schemaVersion: COLLABORATION_SCHEMA_VERSION,
    id: sanitizeIdentifier(item.id),
    type: item.type,
    priority: item.priority,
    status: item.status,
    ...(item.assignedAgentId ? { assignedAgentId: sanitizeIdentifier(item.assignedAgentId) } : {}),
    createdAt: safeText(item.createdAt, TEXT_LIMIT),
    title: safeText(item.title, TEXT_LIMIT),
    ...(item.body ? { body: safeText(item.body, BODY_LIMIT) } : {}),
    ...(item.note ? { note: safeText(item.note, BODY_LIMIT) } : {}),
  };
}

function statusForMutationAction(action: CollaborationMutationAction): CollaborationInboxStatus {
  return action === 'acknowledge' ? 'acknowledged' : 'resolved';
}

function canTransitionCollaborationItem(status: CollaborationInboxStatus, action: CollaborationMutationAction): boolean {
  if (action === 'acknowledge') {
    return status === 'open';
  }
  return status === 'open' || status === 'acknowledged';
}

function isCollaborationMutationAuditEntry(entry: AuditHistoryInputEntry): entry is CollaborationMutationAuditEntry {
  return entry.schemaVersion === COLLABORATION_MUTATION_AUDIT_SCHEMA_VERSION;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeIdentifier(value: string): string {
  return safeText(value, TEXT_LIMIT).replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
}

function safeText(value: string, limit: number): string {
  return truncate(escapeMarkdown(redactSecretLikeText(value)), limit);
}

function redactSecretLikeText(value: string): string {
  return value
    .trim()
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\b(?:sk|sk-ant|sk-proj)-[A-Za-z0-9._-]+/g, '[redacted]')
    .replace(/\bexample\s+customer\b/gi, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]')
    .replace(/\s+/g, ' ');
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
