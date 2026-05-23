import { type PromptTemplateRecord } from './promptTemplates';

export type ExecutionNodeStatus = 'queued' | 'runnable' | 'blocked' | 'working' | 'completed' | 'failed';
export type ExecutionEdgeKind = 'dependency' | 'handoff';

export interface ExecutionTemplateBinding {
  templateId: string;
  providerProfileId: string;
  modelId: string;
  escalationPolicyId: string;
}

export interface ExecutionGraphNode {
  id: string;
  role: string;
  title: string;
  status: ExecutionNodeStatus;
  templateBinding: ExecutionTemplateBinding;
  blockedReason?: string;
  [metadata: string]: unknown;
}

export interface ExecutionGraphEdge {
  id: string;
  from: string;
  to: string;
  kind: ExecutionEdgeKind;
  label?: string;
}

export interface ExecutionGraph {
  schemaVersion: 'agent-hangar.execution-graph.v1';
  workspaceId: string;
  nodes: ExecutionGraphNode[];
  edges: ExecutionGraphEdge[];
}

export interface ExecutionGraphTemplateInput {
  workspaceId: string;
  templates: PromptTemplateRecord[];
  handoffs?: Array<{
    fromTemplateId: string;
    toTemplateId: string;
    label?: string;
  }>;
}

export type ExecutionGraphIssueCode =
  | 'duplicate-node-id'
  | 'missing-edge-source'
  | 'missing-edge-target'
  | 'self-cycle'
  | 'cycle'
  | 'unreachable-node'
  | 'missing-template-binding'
  | 'missing-provider-binding'
  | 'missing-model-binding'
  | 'missing-escalation-policy';

export interface ExecutionGraphIssue {
  code: ExecutionGraphIssueCode;
  severity: 'blocking' | 'warning';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ExecutionGraphSummary {
  schemaVersion: 'agent-hangar.execution-summary.v1';
  workspaceId: string;
  nodeCount: number;
  edgeCount: number;
  issueCount: number;
  blockingIssueCount: number;
  statusCounts: Record<ExecutionNodeStatus, number>;
  nextRunnableNodeIds: string[];
}

export function createExecutionGraphFromTemplates(input: ExecutionGraphTemplateInput): ExecutionGraph {
  const nodes = input.templates.map((template) => ({
    id: template.id.trim(),
    role: template.role.trim(),
    title: template.title.trim() || template.id.trim(),
    status: 'queued' as const,
    templateBinding: {
      templateId: template.id.trim(),
      providerProfileId: template.providerProfileId.trim(),
      modelId: template.modelId.trim(),
      escalationPolicyId: template.escalationPolicyId.trim(),
    },
  }));
  const edges = (input.handoffs ?? []).map((handoff) => ({
    id: `${handoff.fromTemplateId.trim()}->${handoff.toTemplateId.trim()}`,
    from: handoff.fromTemplateId.trim(),
    to: handoff.toTemplateId.trim(),
    kind: 'handoff' as const,
    label: handoff.label,
  }));

  return {
    schemaVersion: 'agent-hangar.execution-graph.v1',
    workspaceId: input.workspaceId,
    nodes,
    edges,
  };
}

export function validateExecutionGraph(graph: ExecutionGraph): ExecutionGraphIssue[] {
  const issues: ExecutionGraphIssue[] = [];
  const nodeCounts = countNodeIds(graph.nodes);
  const uniqueNodeIds = new Set([...nodeCounts.keys()]);

  for (const [nodeId, count] of nodeCounts) {
    if (count > 1) {
      issues.push({
        code: 'duplicate-node-id',
        severity: 'blocking',
        message: `Execution graph contains a duplicate node id: ${nodeId}.`,
        nodeId,
      });
    }
  }

  for (const edge of graph.edges) {
    if (!uniqueNodeIds.has(edge.from)) {
      issues.push({
        code: 'missing-edge-source',
        severity: 'blocking',
        message: `Execution graph edge ${edge.id} references missing source node ${edge.from}.`,
        edgeId: edge.id,
        nodeId: edge.from,
      });
    }
    if (!uniqueNodeIds.has(edge.to)) {
      issues.push({
        code: 'missing-edge-target',
        severity: 'blocking',
        message: `Execution graph edge ${edge.id} references missing target node ${edge.to}.`,
        edgeId: edge.id,
        nodeId: edge.to,
      });
    }
    if (edge.from === edge.to) {
      issues.push({
        code: 'self-cycle',
        severity: 'blocking',
        message: `Execution graph edge ${edge.id} creates a self cycle on ${edge.from}.`,
        edgeId: edge.id,
        nodeId: edge.from,
      });
    }
  }

  issues.push(...detectCycles(graph, uniqueNodeIds));
  issues.push(...detectUnreachableNodes(graph, uniqueNodeIds));

  for (const node of graph.nodes) {
    const binding = node.templateBinding;
    if (!binding.templateId.trim()) {
      issues.push({
        code: 'missing-template-binding',
        severity: 'blocking',
        message: `Execution graph node ${node.id} must bind to a prompt template.`,
        nodeId: node.id,
      });
    }
    if (!binding.providerProfileId.trim()) {
      issues.push({
        code: 'missing-provider-binding',
        severity: 'blocking',
        message: `Execution graph node ${node.id} must bind to a provider profile.`,
        nodeId: node.id,
      });
    }
    if (!binding.modelId.trim()) {
      issues.push({
        code: 'missing-model-binding',
        severity: 'blocking',
        message: `Execution graph node ${node.id} must bind to a model.`,
        nodeId: node.id,
      });
    }
    if (!binding.escalationPolicyId.trim()) {
      issues.push({
        code: 'missing-escalation-policy',
        severity: 'blocking',
        message: `Execution graph node ${node.id} must bind to an escalation policy.`,
        nodeId: node.id,
      });
    }
  }

  return issues;
}

export function buildExecutionGraphSummary(graph: ExecutionGraph): ExecutionGraphSummary {
  const issues = validateExecutionGraph(graph);
  const blockingIssueCount = issues.filter((issue) => issue.severity === 'blocking').length;
  const statusCounts = createEmptyStatusCounts();

  for (const node of graph.nodes) {
    statusCounts[node.status] += 1;
  }

  return {
    schemaVersion: 'agent-hangar.execution-summary.v1',
    workspaceId: graph.workspaceId,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    issueCount: issues.length,
    blockingIssueCount,
    statusCounts,
    nextRunnableNodeIds: deriveNextRunnableNodeIds(graph, issues),
  };
}

function countNodeIds(nodes: ExecutionGraphNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
  }
  return counts;
}

function detectCycles(graph: ExecutionGraph, nodeIds: Set<string>): ExecutionGraphIssue[] {
  const adjacency = buildAdjacency(graph, nodeIds);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: ExecutionGraphIssue[] = [];
  const recorded = new Set<string>();

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) {
      if (!recorded.has(nodeId)) {
        recorded.add(nodeId);
        cycles.push({
          code: 'cycle',
          severity: 'blocking',
          message: `Execution graph contains a dependency cycle involving ${nodeId}.`,
          nodeId,
        });
      }
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (next !== nodeId) {
        visit(next);
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  for (const nodeId of nodeIds) {
    visit(nodeId);
  }

  return cycles;
}

function detectUnreachableNodes(graph: ExecutionGraph, nodeIds: Set<string>): ExecutionGraphIssue[] {
  const validEdges = graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to);
  const incoming = new Map<string, number>();
  for (const nodeId of nodeIds) {
    incoming.set(nodeId, 0);
  }
  for (const edge of validEdges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  const startNodes = [...incoming].filter(([, count]) => count === 0).map(([nodeId]) => nodeId);
  const reachable = new Set<string>();
  const adjacency = buildAdjacency({ ...graph, edges: validEdges }, nodeIds);
  const queue = [...startNodes];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) {
      continue;
    }
    reachable.add(nodeId);
    queue.push(...(adjacency.get(nodeId) ?? []));
  }

  return [...nodeIds]
    .filter((nodeId) => (incoming.get(nodeId) ?? 0) > 0 && !reachable.has(nodeId))
    .sort((left, right) => left.localeCompare(right))
    .map((nodeId) => ({
      code: 'unreachable-node' as const,
      severity: 'warning' as const,
      message: `Execution graph node ${nodeId} is not reachable from a start node.`,
      nodeId,
    }));
}

function deriveNextRunnableNodeIds(graph: ExecutionGraph, issues: ExecutionGraphIssue[]): string[] {
  const blockingNodeIds = new Set(issues.filter((issue) => issue.severity === 'blocking' && issue.nodeId).map((issue) => issue.nodeId!));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  return graph.nodes
    .filter((node) => (node.status === 'queued' || node.status === 'runnable') && !blockingNodeIds.has(node.id))
    .filter((node) => dependenciesAreComplete(node, graph.edges, nodeById))
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));
}

function dependenciesAreComplete(
  node: ExecutionGraphNode,
  edges: ExecutionGraphEdge[],
  nodeById: Map<string, ExecutionGraphNode>,
): boolean {
  return edges
    .filter((edge) => edge.to === node.id)
    .every((edge) => nodeById.get(edge.from)?.status === 'completed');
}

function buildAdjacency(graph: ExecutionGraph, nodeIds: Set<string>): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, []);
  }
  for (const edge of graph.edges) {
    if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
      adjacency.get(edge.from)!.push(edge.to);
    }
  }
  for (const next of adjacency.values()) {
    next.sort((left, right) => left.localeCompare(right));
  }
  return adjacency;
}

function createEmptyStatusCounts(): Record<ExecutionNodeStatus, number> {
  return {
    queued: 0,
    runnable: 0,
    blocked: 0,
    working: 0,
    completed: 0,
    failed: 0,
  };
}
