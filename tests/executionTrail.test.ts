import { describe, expect, it } from 'vitest';
import {
  buildDemoExecutionTrail,
  replayExecutionTrail,
  type ExecutionTrail,
} from '../src/harness/executionTrail';
import { type ExecutionGraph } from '../src/harness/executionGraph';

describe('execution trail harness', () => {
  it('replays demo events into a deterministic secret-safe summary', () => {
    const { graph, trail } = buildDemoExecutionTrail();

    const summary = replayExecutionTrail(graph, trail);

    expect(summary).toMatchObject({
      schemaVersion: 'agent-hangar.execution-trail-summary.v1',
      workspaceId: 'workspace-local-demo',
      eventCount: 11,
      issueCount: 0,
      eventKindCounts: {
        'task-created': 1,
        'plan-created': 1,
        'agent-assigned': 3,
        'node-started': 2,
        'handoff-requested': 1,
        'review-completed': 1,
        'node-completed': 2,
      },
      eventStatusCounts: {
        accepted: 11,
        issue: 0,
      },
      latestNodeStatuses: {
        'demo-implementer': 'completed',
        'demo-planner': 'completed',
        'demo-researcher': 'completed',
        'demo-reviewer': 'completed',
      },
      nextRunnableNodeIds: [],
    });
    expect(summary.timeline.map((entry) => entry.id)).toEqual([
      'evt-001',
      'evt-002',
      'evt-003',
      'evt-004',
      'evt-005',
      'evt-006',
      'evt-007',
      'evt-008',
      'evt-009',
      'evt-010',
      'evt-011',
    ]);
    expect(summary.timeline[5]).toMatchObject({
      kind: 'agent-assigned',
      actorId: 'demo-planner',
      title: 'Implementer assigned',
      nodeId: 'demo-implementer',
    });
    expect(summary.timeline.at(-1)).toMatchObject({
      kind: 'review-completed',
      actorId: 'demo-reviewer',
      note: 'Reviewer accepts the local demo workspace trail.',
    });
    expect(JSON.stringify(summary)).not.toMatch(/sk-source-secret|apiKey|encryptedKeyMaterial|Example Customer/i);
  });

  it('turns unknown node events into issues instead of throwing', () => {
    const graph = graphFixture();
    const trail: ExecutionTrail = {
      schemaVersion: 'agent-hangar.execution-trail.v1',
      workspaceId: 'workspace-trail',
      events: [
        {
          id: 'evt-known',
          occurredAt: '2026-05-23T10:00:00.000Z',
          kind: 'node-started',
          actorId: 'planner',
          title: 'Planner started',
          nodeId: 'planner',
          note: 'Known node.',
        },
        {
          id: 'evt-unknown',
          occurredAt: '2026-05-23T10:01:00.000Z',
          kind: 'node-completed',
          actorId: 'operator',
          title: 'Ghost completed',
          nodeId: 'ghost',
          note: 'Unknown node should not crash.',
        },
      ],
    };

    const summary = replayExecutionTrail(graph, trail);

    expect(summary.issueCount).toBe(1);
    expect(summary.issues).toEqual([
      {
        code: 'unknown-node-event',
        severity: 'warning',
        message: 'Execution trail event evt-unknown references unknown node ghost.',
        eventId: 'evt-unknown',
        nodeId: 'ghost',
      },
    ]);
    expect(summary.eventStatusCounts).toEqual({ accepted: 1, issue: 1 });
    expect(summary.latestNodeStatuses).toEqual({ planner: 'working', reviewer: 'queued' });
  });

  it('sorts out-of-order input and trims secret-like notes from timeline output', () => {
    const graph = graphFixture();
    const trail: ExecutionTrail = {
      schemaVersion: 'agent-hangar.execution-trail.v1',
      workspaceId: 'workspace-trail',
      events: [
        {
          id: 'evt-003',
          occurredAt: '2026-05-23T10:02:00.000Z',
          kind: 'node-completed',
          actorId: 'planner',
          title: 'Planner completed',
          nodeId: 'planner',
          note: '  Completed with apiKey=sk-local-secret and encryptedKeyMaterial=hidden. This note is intentionally very long so the timeline preview must truncate it before display. It also includes customer record 12345 that should be removed.  ',
          details: {
            apiKey: 'sk-detail-secret',
            encryptedKeyMaterial: 'encrypted-detail-secret',
            customerName: 'Example Customer',
          },
        },
        {
          id: 'evt-001',
          occurredAt: '2026-05-23T10:00:00.000Z',
          kind: 'task-created',
          actorId: 'operator',
          title: 'Task created',
          note: 'Start.',
        },
        {
          id: 'evt-002',
          occurredAt: '2026-05-23T10:00:00.000Z',
          kind: 'agent-assigned',
          actorId: 'operator',
          title: 'Planner assigned',
          nodeId: 'planner',
          note: 'Same timestamp sorts by sequence.',
          sequence: 2,
        },
      ],
    };

    const summary = replayExecutionTrail(graph, trail);

    expect(summary.timeline.map((entry) => entry.id)).toEqual(['evt-001', 'evt-002', 'evt-003']);
    expect(summary.timeline[2]!.note!.length).toBeLessThanOrEqual(120);
    expect(summary.latestNodeStatuses).toEqual({ planner: 'completed', reviewer: 'queued' });
    expect(summary.nextRunnableNodeIds).toEqual(['reviewer']);
    expect(JSON.stringify(summary.timeline)).not.toMatch(/sk-local-secret|sk-detail-secret|apiKey|encryptedKeyMaterial|Example Customer/i);
  });
});

function graphFixture(): ExecutionGraph {
  return {
    schemaVersion: 'agent-hangar.execution-graph.v1',
    workspaceId: 'workspace-trail',
    nodes: [
      node('planner', 'queued'),
      node('reviewer', 'queued'),
    ],
    edges: [{ id: 'planner->reviewer', from: 'planner', to: 'reviewer', kind: 'handoff' }],
  };
}

function node(id: string, status: ExecutionGraph['nodes'][number]['status']): ExecutionGraph['nodes'][number] {
  return {
    id,
    role: id,
    title: id,
    status,
    templateBinding: {
      templateId: `template-${id}`,
      providerProfileId: 'local-provider-demo',
      modelId: 'local-model-demo',
      escalationPolicyId: 'local-escalation-demo',
    },
  };
}
