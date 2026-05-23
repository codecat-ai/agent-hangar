import { describe, expect, it } from 'vitest';
import {
  buildExecutionGraphSummary,
  createExecutionGraphFromTemplates,
  validateExecutionGraph,
  type ExecutionGraph,
} from '../src/harness/executionGraph';
import { createPromptTemplate } from '../src/harness/promptTemplates';

const clock = () => '2026-05-23T10:00:00.000Z';

function template(id: string, role: string, overrides = {}) {
  return createPromptTemplate({
    id,
    title: `${role} template`,
    role,
    body: 'Handle {{task}}.',
    providerProfileId: 'openai-main',
    modelId: 'gpt-4.1',
    escalationPolicyId: 'default-escalation',
    ...overrides,
  }, clock);
}

describe('execution graph harness', () => {
  it('creates a deterministic graph from templates without mutating source records or leaking secrets', () => {
    const planner = {
      ...template('template-planner', 'planner'),
      apiKey: 'sk-source-secret',
      encryptedKeyMaterial: 'encrypted-source-secret',
    };
    const reviewer = template('template-reviewer', 'reviewer');
    const source = [planner, reviewer];
    const snapshot = structuredClone(source);

    const graph = createExecutionGraphFromTemplates({
      workspaceId: 'workspace-demo',
      templates: source,
      handoffs: [{ fromTemplateId: 'template-planner', toTemplateId: 'template-reviewer', label: 'review handoff' }],
    });

    expect(source).toEqual(snapshot);
    expect(graph).toMatchObject({
      schemaVersion: 'agent-hangar.execution-graph.v1',
      workspaceId: 'workspace-demo',
      nodes: [
        {
          id: 'template-planner',
          role: 'planner',
          title: 'planner template',
          templateBinding: {
            templateId: 'template-planner',
            providerProfileId: 'openai-main',
            modelId: 'gpt-4.1',
            escalationPolicyId: 'default-escalation',
          },
          status: 'queued',
        },
        {
          id: 'template-reviewer',
          role: 'reviewer',
          title: 'reviewer template',
          templateBinding: {
            templateId: 'template-reviewer',
            providerProfileId: 'openai-main',
            modelId: 'gpt-4.1',
            escalationPolicyId: 'default-escalation',
          },
          status: 'queued',
        },
      ],
      edges: [{ id: 'template-planner->template-reviewer', from: 'template-planner', to: 'template-reviewer', kind: 'handoff', label: 'review handoff' }],
    });
    expect(JSON.stringify(graph)).not.toContain('sk-source-secret');
    expect(JSON.stringify(graph)).not.toContain('encrypted-source-secret');
  });

  it('validates duplicate nodes, invalid edges, cycles, unreachable nodes, and missing template bindings', () => {
    const graph: ExecutionGraph = {
      schemaVersion: 'agent-hangar.execution-graph.v1',
      workspaceId: 'workspace-invalid',
      nodes: [
        node('planner', 'completed'),
        node('planner', 'queued'),
        node('reviewer', 'queued'),
        node('isolated-worker', 'queued'),
        { ...node('missing-binding', 'queued'), templateBinding: { templateId: '', providerProfileId: '', modelId: '', escalationPolicyId: '' } },
      ],
      edges: [
        { id: 'missing-source', from: 'ghost', to: 'reviewer', kind: 'dependency' },
        { id: 'missing-target', from: 'planner', to: 'ghost', kind: 'dependency' },
        { id: 'self-cycle', from: 'reviewer', to: 'reviewer', kind: 'handoff' },
        { id: 'detached-edge', from: 'missing-binding', to: 'isolated-worker', kind: 'dependency' },
        { id: 'cycle-a', from: 'isolated-worker', to: 'missing-binding', kind: 'dependency' },
      ],
    };

    expect(validateExecutionGraph(graph)).toEqual([
      { code: 'duplicate-node-id', severity: 'blocking', message: 'Execution graph contains a duplicate node id: planner.', nodeId: 'planner' },
      { code: 'missing-edge-source', severity: 'blocking', message: 'Execution graph edge missing-source references missing source node ghost.', edgeId: 'missing-source', nodeId: 'ghost' },
      { code: 'missing-edge-target', severity: 'blocking', message: 'Execution graph edge missing-target references missing target node ghost.', edgeId: 'missing-target', nodeId: 'ghost' },
      { code: 'self-cycle', severity: 'blocking', message: 'Execution graph edge self-cycle creates a self cycle on reviewer.', edgeId: 'self-cycle', nodeId: 'reviewer' },
      { code: 'cycle', severity: 'blocking', message: 'Execution graph contains a dependency cycle involving isolated-worker.', nodeId: 'isolated-worker' },
      { code: 'unreachable-node', severity: 'warning', message: 'Execution graph node isolated-worker is not reachable from a start node.', nodeId: 'isolated-worker' },
      { code: 'unreachable-node', severity: 'warning', message: 'Execution graph node missing-binding is not reachable from a start node.', nodeId: 'missing-binding' },
      { code: 'missing-template-binding', severity: 'blocking', message: 'Execution graph node missing-binding must bind to a prompt template.', nodeId: 'missing-binding' },
      { code: 'missing-provider-binding', severity: 'blocking', message: 'Execution graph node missing-binding must bind to a provider profile.', nodeId: 'missing-binding' },
      { code: 'missing-model-binding', severity: 'blocking', message: 'Execution graph node missing-binding must bind to a model.', nodeId: 'missing-binding' },
      { code: 'missing-escalation-policy', severity: 'blocking', message: 'Execution graph node missing-binding must bind to an escalation policy.', nodeId: 'missing-binding' },
    ]);
  });

  it('derives a secret-safe operator summary with next runnable nodes', () => {
    const graph: ExecutionGraph = {
      schemaVersion: 'agent-hangar.execution-graph.v1',
      workspaceId: 'workspace-summary',
      nodes: [
        node('planner', 'completed'),
        node('researcher', 'queued'),
        node('implementer', 'queued'),
        node('reviewer', 'blocked', { blockedReason: 'Waiting on missing escalation policy sk-hidden' }),
        { ...node('operator', 'queued'), encryptedKeyMaterial: 'encrypted-hidden' },
      ],
      edges: [
        { id: 'planner->researcher', from: 'planner', to: 'researcher', kind: 'handoff' },
        { id: 'researcher->implementer', from: 'researcher', to: 'implementer', kind: 'dependency' },
        { id: 'planner->reviewer', from: 'planner', to: 'reviewer', kind: 'dependency' },
      ],
    };

    const summary = buildExecutionGraphSummary(graph);

    expect(summary).toEqual({
      schemaVersion: 'agent-hangar.execution-summary.v1',
      workspaceId: 'workspace-summary',
      nodeCount: 5,
      edgeCount: 3,
      issueCount: 0,
      blockingIssueCount: 0,
      statusCounts: {
        queued: 3,
        runnable: 0,
        blocked: 1,
        working: 0,
        completed: 1,
        failed: 0,
      },
      nextRunnableNodeIds: ['operator', 'researcher'],
    });
    expect(JSON.stringify(summary)).not.toContain('sk-hidden');
    expect(JSON.stringify(summary)).not.toContain('encrypted-hidden');
  });
});

function node(id: string, status: ExecutionGraph['nodes'][number]['status'], extra = {}): ExecutionGraph['nodes'][number] {
  return {
    id,
    role: id,
    title: id,
    status,
    templateBinding: {
      templateId: `template-${id}`,
      providerProfileId: 'openai-main',
      modelId: 'gpt-4.1',
      escalationPolicyId: 'default-escalation',
    },
    ...extra,
  };
}
