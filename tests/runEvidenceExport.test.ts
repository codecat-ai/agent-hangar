import { describe, expect, it } from 'vitest';
import { formatRunEvidenceExport } from '../src/harness/runEvidenceExport';
import { type ExecutionGraphIssue, type ExecutionGraphSummary } from '../src/harness/executionGraph';
import { type ExecutionTrailSummary } from '../src/harness/executionTrail';

describe('run evidence export formatter', () => {
  it('builds deterministic schema-versioned markdown and preview data without leaking secrets', () => {
    const trailSummary: ExecutionTrailSummary = {
      schemaVersion: 'agent-hangar.execution-trail-summary.v1',
      workspaceId: 'workspace-customer-123',
      eventCount: 2,
      issueCount: 1,
      eventKindCounts: {
        'task-created': 1,
        'plan-created': 0,
        'agent-assigned': 0,
        'node-started': 1,
        'handoff-requested': 0,
        'review-completed': 0,
        'node-completed': 0,
      },
      eventStatusCounts: {
        accepted: 1,
        issue: 1,
      },
      latestNodeStatuses: {
        'planner-sk-node': 'working',
        'reviewer': 'queued',
      },
      nextRunnableNodeIds: ['reviewer', 'planner-sk-node'],
      timeline: [
        {
          id: 'evt-002',
          occurredAt: '2026-05-23T10:01:00.000Z',
          kind: 'node-started',
          status: 'issue',
          actorId: 'operator apiKey=sk-actor-secret',
          title: 'Planner started with encryptedKeyMaterial=abc123',
          nodeId: 'planner-sk-node',
          note: 'Uses sk-live-secret for Example Customer. This long note should be truncated before it can dominate the preview output for local export review.',
        },
        {
          id: 'evt-001',
          occurredAt: '2026-05-23T10:00:00.000Z',
          kind: 'task-created',
          status: 'accepted',
          actorId: 'operator',
          title: 'Task created',
          note: 'Local-only kickoff.',
        },
      ],
      issues: [
        {
          code: 'unknown-node-event',
          severity: 'warning',
          message: 'Execution trail event evt-002 references unknown node planner-sk-node for customer-123.',
          eventId: 'evt-002',
          nodeId: 'planner-sk-node',
        },
      ],
    };
    const graphSummary: ExecutionGraphSummary = {
      schemaVersion: 'agent-hangar.execution-summary.v1',
      workspaceId: 'workspace-customer-123',
      nodeCount: 2,
      edgeCount: 1,
      issueCount: 1,
      blockingIssueCount: 1,
      statusCounts: {
        queued: 1,
        runnable: 0,
        blocked: 0,
        working: 1,
        completed: 0,
        failed: 0,
      },
      nextRunnableNodeIds: ['reviewer'],
    };
    const graphIssues: ExecutionGraphIssue[] = [
      {
        code: 'missing-provider-binding',
        severity: 'blocking',
        message: 'Execution graph node planner-sk-node must bind to customer-123 provider apiKey=sk-graph-secret.',
        nodeId: 'planner-sk-node',
      },
    ];

    const exportPreview = formatRunEvidenceExport({ trailSummary, graphSummary, graphIssues });

    expect(exportPreview).toMatchObject({
      schemaVersion: 'agent-hangar.run-evidence-export.v1',
      workspaceId: 'workspace-[redacted]',
      counts: {
        events: 2,
        trailIssues: 1,
        graphIssues: 1,
        blockingGraphIssues: 1,
        nodes: 2,
        edges: 1,
      },
      nextRunnableNodeIds: ['reviewer'],
    });
    expect(exportPreview.statusCounts).toEqual({
      accepted: 1,
      issue: 1,
      queued: 1,
      runnable: 0,
      blocked: 0,
      working: 1,
      completed: 0,
      failed: 0,
    });
    expect(exportPreview.timeline.map((entry) => entry.id)).toEqual(['evt-001', 'evt-002']);
    expect(exportPreview.issues.map((issue) => issue.source)).toEqual(['graph', 'trail']);
    expect(exportPreview.markdown).toBe(`---
schemaVersion: agent-hangar.run-evidence-export.v1
workspaceId: workspace-[redacted]
---

# Run Evidence Export

## Counts
- Events: 2
- Trail issues: 1
- Graph issues: 1
- Blocking graph issues: 1
- Nodes: 2
- Edges: 1

## Status Counts
- accepted: 1
- issue: 1
- queued: 1
- runnable: 0
- blocked: 0
- working: 1
- completed: 0
- failed: 0

## Next Runnable Nodes
- reviewer

## Timeline
- 2026-05-23T10:00:00.000Z | task-created | accepted | operator | Task created | Local-only kickoff.
- 2026-05-23T10:01:00.000Z | node-started | issue | operator [redacted] | Planner started with [redacted] | node: planner-[redacted] | Uses [redacted] for [redacted]. This long note should be truncated before it can dominate the preview output for local export...

## Issues
- graph | blocking | missing-provider-binding | node: planner-[redacted] | Execution graph node planner-[redacted] must bind to [redacted] provider [redacted].
- trail | warning | unknown-node-event | node: planner-[redacted] | Execution trail event evt-002 references unknown node planner-[redacted] for [redacted].
`);
    expect(JSON.stringify(exportPreview)).not.toMatch(/apiKey|encryptedKeyMaterial|sk-live-secret|sk-graph-secret|sk-actor-secret|Example Customer|customer-123/i);
  });
});
