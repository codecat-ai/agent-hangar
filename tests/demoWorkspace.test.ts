import { describe, expect, it } from 'vitest';
import { buildAuditHistoryPreview, type CollaborationInboxType } from '../src/harness/collaborationAudit';
import { buildDemoWorkspaceSeed } from '../src/harness/demoWorkspace';
import { replayExecutionTrail } from '../src/harness/executionTrail';
import { buildExecutionGraphSummary, validateExecutionGraph } from '../src/harness/executionGraph';

const SECRET_PATTERN = /apiKey|encryptedKeyMaterial|sk-[A-Za-z0-9._-]{8,}|token\s*=|Bearer\s+[A-Za-z0-9._-]+|customer[A-Za-z0-9_-]*|\bcurl\b|\bnpm\s+(?:run|install|exec|test|start)\b|\bpnpm\b|\byarn\b|\bbash\b|\bsh\s+-c\b/i;

describe('demo workspace seed', () => {
  it('covers planner, researcher, implementer, and reviewer coordination in graph and replay data', () => {
    const seed = buildDemoWorkspaceSeed();
    const roles = seed.graph.nodes.map((node) => node.role);
    const trailSummary = replayExecutionTrail(seed.graph, seed.trail);

    expect(seed.schemaVersion).toBe('agent-hangar.demo-workspace-seed.v1');
    expect(seed.workspaceId).toBe('workspace-local-demo');
    expect(seed.graph.workspaceId).toBe(seed.workspaceId);
    expect(seed.trail.workspaceId).toBe(seed.workspaceId);
    expect(new Set(roles)).toEqual(new Set(['planner', 'researcher', 'implementer', 'reviewer']));
    expect(seed.graph.nodes.map((node) => node.id)).toEqual([
      'demo-planner',
      'demo-researcher',
      'demo-implementer',
      'demo-reviewer',
    ]);
    expect(validateExecutionGraph(seed.graph)).toEqual([]);
    expect(buildExecutionGraphSummary(seed.graph)).toMatchObject({
      nodeCount: 4,
      edgeCount: 4,
      blockingIssueCount: 0,
    });
    expect(trailSummary.latestNodeStatuses).toEqual({
      'demo-implementer': 'completed',
      'demo-planner': 'completed',
      'demo-researcher': 'completed',
      'demo-reviewer': 'completed',
    });
  });

  it('seeds delegation, review, broadcast, and escalation collaboration items', () => {
    const seed = buildDemoWorkspaceSeed();
    const types = seed.collaborationItems.map((item) => item.type);
    const typeCounts = types.reduce<Record<CollaborationInboxType, number>>((counts, type) => {
      counts[type] += 1;
      return counts;
    }, { delegation: 0, review: 0, broadcast: 0, escalation: 0 });
    const preview = buildAuditHistoryPreview({
      collaborationItems: seed.collaborationItems,
      auditEntries: seed.auditEntries,
    });

    expect(typeCounts).toEqual({ delegation: 1, review: 1, broadcast: 1, escalation: 1 });
    expect(seed.collaborationItems.every((item) => item.schemaVersion === 'agent-hangar.collaboration-inbox-item.v1')).toBe(true);
    expect(seed.collaborationItems.map((item) => item.id)).toEqual([
      'collab-demo-escalation',
      'collab-demo-review',
      'collab-demo-delegation',
      'collab-demo-broadcast',
    ]);
    expect(preview.counts).toMatchObject({
      collaborationItems: 4,
      auditEntries: 1,
      unresolvedEscalations: 1,
      urgentItems: 1,
      highPriorityItems: 1,
    });
    expect(preview.nextActionHints[0]).toBe('Resolve 1 urgent escalation before starting more local execution.');
  });

  it('returns deterministic ordering and clone-safe nested data', () => {
    const first = buildDemoWorkspaceSeed();
    const second = buildDemoWorkspaceSeed();

    expect(first).toEqual(second);

    first.graph.nodes[0]!.title = 'Mutated title';
    first.graph.nodes[0]!.templateBinding.modelId = 'mutated-model';
    first.collaborationItems[0]!.title = 'Mutated item';
    first.auditEntries[0]!.reason = 'Mutated reason';

    const fresh = buildDemoWorkspaceSeed();
    expect(fresh.graph.nodes[0]!.title).toBe('Planner');
    expect(fresh.graph.nodes[0]!.templateBinding.modelId).toBe('local-model-planner');
    expect(fresh.collaborationItems[0]!.title).toBe('Operator escalation requested');
    expect(fresh.auditEntries[0]!.reason).toBe('Local deterministic demo pause before reviewer confirmation.');
  });

  it('keeps summaries and markdown secret-safe without raw command, network, token, or customer-looking text', () => {
    const seed = buildDemoWorkspaceSeed();
    const trailSummary = replayExecutionTrail(seed.graph, seed.trail);
    const auditPreview = buildAuditHistoryPreview({
      collaborationItems: seed.collaborationItems,
      auditEntries: seed.auditEntries,
    });
    const serialized = JSON.stringify({
      seed,
      graphSummary: buildExecutionGraphSummary(seed.graph),
      trailSummary,
      auditMarkdown: auditPreview.markdown,
      auditRecent: auditPreview.recentEntries,
    });

    expect(serialized).not.toMatch(SECRET_PATTERN);
    expect(auditPreview.markdown).not.toMatch(SECRET_PATTERN);
    expect(trailSummary.timeline.map((entry) => entry.note).join('\n')).not.toMatch(SECRET_PATTERN);
  });
});
