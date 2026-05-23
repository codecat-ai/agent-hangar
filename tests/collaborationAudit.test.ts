import { describe, expect, it } from 'vitest';
import {
  buildAuditHistoryPreview,
  normalizeCollaborationInbox,
  sortCollaborationInboxItems,
  type CollaborationInboxRecord,
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
