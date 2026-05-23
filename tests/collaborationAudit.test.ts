import { describe, expect, it } from 'vitest';
import {
  applyCollaborationInboxMutation,
  buildAuditHistoryPreview,
  buildCollaborationTriageView,
  normalizeCollaborationInbox,
  sortCollaborationInboxItems,
  type CollaborationInboxRecord,
  type CollaborationMutationAuditEntry,
} from '../src/harness/collaborationAudit';
import { type ExecutionControlAuditEntry } from '../src/harness/executionControls';

describe('collaboration audit harness', () => {
  it('normalizes valid collaboration records, trims text, sorts unresolved high-priority recent items first, and redacts secrets', () => {
    const result = normalizeCollaborationInbox([
      collaborationRecord({
        id: 'low-open',
        type: 'broadcast',
        priority: 'low',
        status: 'open',
        createdAt: '2026-05-23T09:00:00.000Z',
        title: '  General note  ',
        body: '  No blockers.  ',
      }),
      collaborationRecord({
        id: 'urgent-old',
        type: 'escalation',
        priority: 'urgent',
        status: 'open',
        createdAt: '2026-05-23T09:30:00.000Z',
        title: '  Provider key leak  ',
        body: ' apiKey=sk-live-secret must be hidden ',
        note: ' encryptedKeyMaterial=abc123 and sk-note-secret are hidden ',
      }),
      collaborationRecord({
        id: 'urgent-new',
        type: 'review',
        priority: 'urgent',
        status: 'acknowledged',
        createdAt: '2026-05-23T10:00:00.000Z',
        title: 'Review draft',
        body: 'Reviewer needs final pass.',
      }),
      collaborationRecord({
        id: 'resolved-high',
        type: 'delegation',
        priority: 'high',
        status: 'resolved',
        createdAt: '2026-05-23T11:00:00.000Z',
        title: 'Resolved delegation',
      }),
    ]);

    expect(result.issues).toEqual([]);
    expect(result.items.map((item) => item.id)).toEqual(['urgent-new', 'urgent-old', 'low-open', 'resolved-high']);
    expect(result.items[0]).toMatchObject({
      schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
      title: 'Review draft',
      status: 'acknowledged',
    });
    expect(JSON.stringify(result.items)).toContain('[redacted]');
    expect(JSON.stringify(result.items)).not.toMatch(/apiKey|sk-live-secret|sk-note-secret|encryptedKeyMaterial|abc123/);
  });

  it('reports typed issues for invalid collaboration records instead of crashing', () => {
    const result = normalizeCollaborationInbox([
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'bad-record',
        type: 'page',
        priority: 'critical',
        status: 'waiting',
        assignedAgentId: 'reviewer',
        createdAt: 'not-a-date',
        title: ' ',
        body: 'body',
      },
    ]);

    expect(result.items).toEqual([]);
    expect(result.issues).toEqual([
      {
        code: 'invalid-type',
        severity: 'blocking',
        itemId: 'bad-record',
        field: 'type',
        message: 'Collaboration item bad-record has an invalid type.',
      },
      {
        code: 'invalid-priority',
        severity: 'blocking',
        itemId: 'bad-record',
        field: 'priority',
        message: 'Collaboration item bad-record has an invalid priority.',
      },
      {
        code: 'invalid-status',
        severity: 'blocking',
        itemId: 'bad-record',
        field: 'status',
        message: 'Collaboration item bad-record has an invalid status.',
      },
      {
        code: 'invalid-created-at',
        severity: 'blocking',
        itemId: 'bad-record',
        field: 'createdAt',
        message: 'Collaboration item bad-record must have an ISO createdAt timestamp.',
      },
      {
        code: 'missing-title',
        severity: 'blocking',
        itemId: 'bad-record',
        field: 'title',
        message: 'Collaboration item bad-record must have a title.',
      },
    ]);
  });

  it('keeps sorting semantics deterministic for status, priority, recency, and id ties', () => {
    const items = normalizeCollaborationInbox([
      collaborationRecord({ id: 'resolved-new', priority: 'urgent', status: 'resolved', createdAt: '2026-05-23T12:00:00.000Z' }),
      collaborationRecord({ id: 'open-low-new', priority: 'low', status: 'open', createdAt: '2026-05-23T12:00:00.000Z' }),
      collaborationRecord({ id: 'ack-high-old', priority: 'high', status: 'acknowledged', createdAt: '2026-05-23T10:00:00.000Z' }),
      collaborationRecord({ id: 'ack-high-new-b', priority: 'high', status: 'acknowledged', createdAt: '2026-05-23T11:00:00.000Z' }),
      collaborationRecord({ id: 'ack-high-new-a', priority: 'high', status: 'acknowledged', createdAt: '2026-05-23T11:00:00.000Z' }),
    ]).items;

    expect(sortCollaborationInboxItems(items).map((item) => item.id)).toEqual([
      'ack-high-new-a',
      'ack-high-new-b',
      'ack-high-old',
      'open-low-new',
      'resolved-new',
    ]);
  });

  it('builds deterministic audit-history counts, sanitized recent entries, next-action hints, and Markdown preview', () => {
    const collaboration = normalizeCollaborationInbox([
      collaborationRecord({
        id: 'esc-1',
        type: 'escalation',
        priority: 'urgent',
        status: 'open',
        createdAt: '2026-05-23T10:05:00.000Z',
        title: 'Secret escalation',
        body: 'sk-escalation-secret should not render',
      }),
      collaborationRecord({
        id: 'review-1',
        type: 'review',
        priority: 'high',
        status: 'acknowledged',
        createdAt: '2026-05-23T10:03:00.000Z',
        title: 'Review release note',
      }),
    ]).items;
    const preview = buildAuditHistoryPreview({
      auditEntries: [
        auditEntry({
          id: 'audit-1',
          action: 'pause',
          occurredAt: '2026-05-23T10:04:00.000Z',
          reason: 'apiKey=sk-audit-secret',
          note: 'customerRecord should be hidden',
        }),
      ],
      collaborationItems: collaboration,
    });

    expect(preview.schemaVersion).toBe('agent-hangar.audit-history-preview.v1');
    expect(preview.counts).toEqual({
      auditEntries: 1,
      collaborationItems: 2,
      openItems: 1,
      acknowledgedItems: 1,
      resolvedItems: 0,
      unresolvedEscalations: 1,
      urgentItems: 1,
      highPriorityItems: 1,
    });
    expect(preview.recentEntries.map((entry) => entry.id)).toEqual(['collab:esc-1', 'audit:audit-1', 'collab:review-1']);
    expect(preview.nextActionHints).toEqual([
      'Resolve 1 urgent escalation before starting more local execution.',
      'Review 2 unresolved collaboration items.',
      'Check the most recent guarded control audit entry before retrying or resuming work.',
    ]);
    expect(preview.markdown).toContain('schemaVersion: agent-hangar.audit-history-preview.v1');
    expect(preview.markdown).toContain('- Unresolved escalations: 1');
    expect(JSON.stringify(preview)).toContain('[redacted]');
    expect(JSON.stringify(preview)).not.toMatch(/apiKey|sk-audit-secret|sk-escalation-secret|customerRecord/);
  });

  it('filters collaboration triage rows and builds compact sanitized view data', () => {
    const items = normalizeCollaborationInbox([
      collaborationRecord({
        id: 'esc-secret',
        type: 'escalation',
        priority: 'urgent',
        status: 'open',
        createdAt: '2026-05-23T10:04:00.000Z',
        title: 'Provider key review',
        body: 'apiKey=sk-filter-secret must not leak while reviewer checks evidence.',
        note: 'customerRecord and encryptedKeyMaterial=abc123 stay hidden.',
      }),
      collaborationRecord({
        id: 'delegation-open',
        type: 'delegation',
        priority: 'normal',
        status: 'open',
        createdAt: '2026-05-23T10:03:00.000Z',
        title: 'Implementer handoff',
        body: 'Implementer owns the next local-only handoff.',
      }),
      collaborationRecord({
        id: 'review-ack',
        type: 'review',
        priority: 'high',
        status: 'acknowledged',
        createdAt: '2026-05-23T10:02:00.000Z',
        title: 'Review local audit',
        body: 'Reviewer checks audit history preview.',
      }),
      collaborationRecord({
        id: 'broadcast-done',
        type: 'broadcast',
        priority: 'low',
        status: 'resolved',
        createdAt: '2026-05-23T10:01:00.000Z',
        title: 'Broadcast done',
      }),
    ]).items;

    const triage = buildCollaborationTriageView(items, {
      status: 'unresolved',
      priority: 'high',
      type: 'escalation',
      query: 'provider reviewer',
    });

    expect(triage.schemaVersion).toBe('agent-hangar.collaboration-triage-view.v1');
    expect(triage.rows.map((row) => row.id)).toEqual(['esc-secret']);
    expect(triage.rows[0]).toMatchObject({
      id: 'esc-secret',
      type: 'escalation',
      priority: 'urgent',
      status: 'open',
      nextActionHint: 'Resolve or acknowledge this urgent escalation before starting more local execution.',
    });
    expect(triage.compact).toEqual({
      visibleCount: 1,
      hiddenCount: 3,
      activeFilterLabels: ['Status: unresolved', 'Priority: high/urgent', 'Type: escalation', 'Search: provider reviewer'],
      highPriorityUnresolvedCount: 1,
      unresolvedEscalationCount: 1,
      nextActionHints: ['Resolve or acknowledge this urgent escalation before starting more local execution.'],
    });
    expect(JSON.stringify(triage)).toContain('[redacted]');
    expect(JSON.stringify(triage)).not.toMatch(/apiKey|sk-filter-secret|encryptedKeyMaterial|abc123|customerRecord/);
  });

  it('acknowledges an open collaboration item with clone-safe sorted records, sanitized mutation audit, and persistence payload', () => {
    const sourceItems = normalizeCollaborationInbox([
      collaborationRecord({
        id: 'low-open',
        priority: 'low',
        status: 'open',
        createdAt: '2026-05-23T09:00:00.000Z',
      }),
      collaborationRecord({
        id: 'urgent-open',
        type: 'escalation',
        priority: 'urgent',
        status: 'open',
        createdAt: '2026-05-23T10:00:00.000Z',
        note: 'contains apiKey=sk-original-secret',
      }),
    ]).items;
    const result = applyCollaborationInboxMutation(sourceItems, {
      action: 'acknowledge',
      itemId: 'urgent-open',
      actorId: 'operator:test',
      clock: () => '2026-05-23T10:10:00.000Z',
      note: '  checking `provider` | apiKey=sk-live-secret  ',
    });

    expect(result.ok).toBe(true);
    expect(sourceItems.find((item) => item.id === 'urgent-open')?.status).toBe('open');
    expect(result.items).not.toBe(sourceItems);
    expect(result.items.find((item) => item.id === 'urgent-open')).toMatchObject({
      status: 'acknowledged',
      note: 'checking \\`provider\\` \\| [redacted]',
    });
    expect(result.items.map((item) => item.id)).toEqual(['urgent-open', 'low-open']);
    expect(result.auditEntries).toEqual([
      {
        schemaVersion: 'agent-hangar.collaboration-mutation-audit.v1',
        id: 'collaboration-mutation:urgent-open:acknowledge:2026-05-23T10:10:00.000Z',
        itemId: 'urgent-open',
        actorId: 'operator:test',
        action: 'acknowledge',
        fromStatus: 'open',
        toStatus: 'acknowledged',
        occurredAt: '2026-05-23T10:10:00.000Z',
        note: 'checking \\`provider\\` \\| [redacted]',
      },
    ]);
    expect(result.persistencePayload).toMatchObject({
      schemaVersion: 'agent-hangar.collaboration-persistence.v1',
      collaborationItems: result.items,
      mutationAuditEntries: result.auditEntries,
      auditHistoryPreview: {
        schemaVersion: 'agent-hangar.audit-history-preview.v1',
        counts: {
          collaborationItems: 2,
          acknowledgedItems: 1,
        },
      },
    });
    expect(JSON.stringify(result.persistencePayload)).not.toMatch(/apiKey|sk-live-secret|sk-original-secret/);
    expect(JSON.parse(JSON.stringify(result.persistencePayload))).toEqual(result.persistencePayload);
  });

  it('resolves an acknowledged collaboration item and appends mutation audit entries deterministically', () => {
    const existingAudit: CollaborationMutationAuditEntry = {
      schemaVersion: 'agent-hangar.collaboration-mutation-audit.v1',
      id: 'collaboration-mutation:review-1:acknowledge:2026-05-23T10:10:00.000Z',
      itemId: 'review-1',
      actorId: 'operator:test',
      action: 'acknowledge',
      fromStatus: 'open',
      toStatus: 'acknowledged',
      occurredAt: '2026-05-23T10:10:00.000Z',
    };
    const result = applyCollaborationInboxMutation([
      collaborationRecord({ id: 'review-1', priority: 'high', status: 'acknowledged' }),
    ], {
      action: 'resolve',
      itemId: 'review-1',
      actorId: 'operator:test',
      clock: () => '2026-05-23T10:12:00.000Z',
      reason: '  done with encryptedKeyMaterial=abc123  ',
      existingAuditEntries: [existingAudit],
    });

    expect(result.ok).toBe(true);
    expect(result.items[0]).toMatchObject({ id: 'review-1', status: 'resolved', note: 'done with [redacted]' });
    expect(result.auditEntries.map((entry) => entry.action)).toEqual(['acknowledge', 'resolve']);
    expect(result.auditEntries[1]).toMatchObject({
      itemId: 'review-1',
      action: 'resolve',
      fromStatus: 'acknowledged',
      toStatus: 'resolved',
      reason: 'done with [redacted]',
    });
    expect(result.persistencePayload.auditHistoryPreview.counts.resolvedItems).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/encryptedKeyMaterial|abc123/);
  });

  it('returns typed mutation issues for unknown ids and invalid resolved-item transitions without mutating records', () => {
    const sourceItems = normalizeCollaborationInbox([
      collaborationRecord({ id: 'resolved-1', status: 'resolved', note: 'done' }),
    ]).items;
    const unknown = applyCollaborationInboxMutation(sourceItems, {
      action: 'resolve',
      itemId: 'missing-1',
      actorId: 'operator:test',
      clock: () => '2026-05-23T10:15:00.000Z',
    });
    const invalid = applyCollaborationInboxMutation(sourceItems, {
      action: 'acknowledge',
      itemId: 'resolved-1',
      actorId: 'operator:test',
      clock: () => '2026-05-23T10:16:00.000Z',
    });

    expect(unknown.ok).toBe(false);
    expect(unknown.issue).toEqual({
      code: 'unknown-item-id',
      severity: 'blocking',
      itemId: 'missing-1',
      action: 'resolve',
      message: 'Collaboration item missing-1 was not found.',
    });
    expect(unknown.items).toEqual(sourceItems);
    expect(unknown.auditEntries).toEqual([]);
    expect(invalid.ok).toBe(false);
    expect(invalid.issue).toEqual({
      code: 'invalid-transition',
      severity: 'blocking',
      itemId: 'resolved-1',
      action: 'acknowledge',
      message: 'Collaboration item resolved-1 cannot transition from resolved to acknowledged.',
    });
    expect(invalid.items).toEqual(sourceItems);
    expect(invalid.auditEntries).toEqual([]);
    expect(sourceItems[0]).toMatchObject({ id: 'resolved-1', status: 'resolved', note: 'done' });
  });
});

function collaborationRecord(overrides: Partial<CollaborationInboxRecord> = {}): CollaborationInboxRecord {
  return {
    schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
    id: 'collab-1',
    type: 'delegation',
    priority: 'normal',
    status: 'open',
    assignedAgentId: 'demo-reviewer',
    createdAt: '2026-05-23T10:00:00.000Z',
    title: 'Review local evidence',
    body: 'Please review the local evidence.',
    ...overrides,
  };
}

function auditEntry(overrides: Partial<ExecutionControlAuditEntry> = {}): ExecutionControlAuditEntry {
  return {
    schemaVersion: 'agent-hangar.execution-control-audit.v1',
    id: 'audit-1',
    runId: 'run-1',
    nodeId: 'demo-reviewer',
    actorId: 'operator-local-demo',
    action: 'pause',
    fromStatus: 'working',
    toStatus: 'paused',
    occurredAt: '2026-05-23T10:00:00.000Z',
    ...overrides,
  };
}
