import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionGraphPanel } from '../src/ExecutionGraphPanel';
import { buildDemoExecutionTrail, replayExecutionTrail } from '../src/harness/executionTrail';
import { createExecutionGraphFromTemplates } from '../src/harness/executionGraph';
import { createPromptTemplate } from '../src/harness/promptTemplates';

const clock = () => '2026-05-23T10:00:00.000Z';

describe('ExecutionGraphPanel', () => {
  it('renders graph preview, issue summary, and next runnable nodes without secrets', () => {
    const graph = createExecutionGraphFromTemplates({
      workspaceId: 'workspace-ui',
      templates: [
        createPromptTemplate({
          id: 'planner',
          title: 'Planner',
          role: 'planner',
          body: 'Plan {{task}}.',
          providerProfileId: 'openai-main',
          modelId: 'gpt-4.1',
          escalationPolicyId: 'default-escalation',
        }, clock),
        createPromptTemplate({
          id: 'reviewer',
          title: 'Reviewer',
          role: 'reviewer',
          body: 'Review {{task}}.',
          providerProfileId: '',
          modelId: 'claude-sonnet-4-5',
          escalationPolicyId: 'review-escalation',
        }, clock),
      ],
      handoffs: [{ fromTemplateId: 'planner', toTemplateId: 'reviewer' }],
    });

    render(<ExecutionGraphPanel graph={graph} secretPreview="sk-ui-secret" />);

    expect(screen.getByRole('heading', { name: 'Execution graph' })).toBeInTheDocument();
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
    expect(screen.getByText('1 edge')).toBeInTheDocument();
    expect(screen.getByText('1 blocking issue')).toBeInTheDocument();
    expect(screen.getByText('Next runnable')).toBeInTheDocument();
    expect(screen.getByText('planner')).toBeInTheDocument();

    const issues = screen.getByRole('list', { name: 'Execution graph issues' });
    expect(within(issues).getByText('Execution graph node reviewer must bind to a provider profile.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('sk-ui-secret');
  });

  it('announces an empty next-runnable state accessibly', () => {
    const graph = createExecutionGraphFromTemplates({
      workspaceId: 'workspace-empty',
      templates: [
        createPromptTemplate({
          id: 'planner',
          title: 'Planner',
          role: 'planner',
          body: 'Plan {{task}}.',
          providerProfileId: 'openai-main',
          modelId: 'gpt-4.1',
          escalationPolicyId: 'default-escalation',
        }, clock),
      ],
    });
    graph.nodes[0] = { ...graph.nodes[0], status: 'completed' };

    render(<ExecutionGraphPanel graph={graph} />);

    expect(screen.getByRole('status')).toHaveTextContent('No runnable nodes are ready.');
  });

  it('renders deterministic local execution trail counts and timeline without secrets', () => {
    const { graph, trail } = buildDemoExecutionTrail();
    const trailSummary = replayExecutionTrail(graph, trail);

    render(<ExecutionGraphPanel graph={graph} trailSummary={trailSummary} secretPreview="sk-ui-secret" />);

    expect(screen.getByRole('heading', { name: 'Local execution trail' })).toBeInTheDocument();
    expect(screen.getByText('8 events')).toBeInTheDocument();
    expect(screen.getByText('0 trail issues')).toBeInTheDocument();
    expect(screen.getByText('3 completed')).toBeInTheDocument();
    expect(screen.getByText('Task created')).toBeInTheDocument();
    expect(screen.getByText('Review completed')).toBeInTheDocument();
    expect(screen.getByText('review-completed · accepted')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('sk-ui-secret');
  });

  it('renders local run evidence export preview text and copies through an injected side effect', async () => {
    const { graph, trail } = buildDemoExecutionTrail();
    const trailSummary = replayExecutionTrail(graph, trail);
    const copyRunEvidence = vi.fn();

    render(<ExecutionGraphPanel graph={graph} trailSummary={trailSummary} copyRunEvidence={copyRunEvidence} />);

    expect(screen.getByRole('heading', { name: 'Run evidence export' })).toBeInTheDocument();
    expect(screen.getByText('agent-hangar.run-evidence-export.v1')).toBeInTheDocument();
    expect(screen.getByText('workspace-local-demo')).toBeInTheDocument();
    expect(screen.getByText('- Events: 8')).toBeInTheDocument();
    expect(screen.getByText('- Graph issues: 0')).toBeInTheDocument();
    expect(screen.getByText('- 2026-05-23T10:07:00.000Z | review-completed | accepted | demo-reviewer | Review completed | node: demo-reviewer | Reviewer accepts the local demo trail.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy run evidence export' }));

    expect(copyRunEvidence).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copied run evidence export.'));
    expect(copyRunEvidence.mock.calls[0]![0]).toContain('schemaVersion: agent-hangar.run-evidence-export.v1');
    expect(copyRunEvidence.mock.calls[0]![0]).toContain('## Timeline');
  });

  it('shows guarded controls for a working local demo node and records pause audit text', () => {
    const { graph, trail } = buildDemoExecutionTrail();
    graph.nodes[1] = { ...graph.nodes[1]!, status: 'working' };
    const trailSummary = {
      ...replayExecutionTrail(graph, trail),
      latestNodeStatuses: {
        'demo-planner': 'completed' as const,
        'demo-researcher': 'working' as const,
        'demo-reviewer': 'queued' as const,
      },
    };

    render(<ExecutionGraphPanel graph={graph} trailSummary={trailSummary} />);

    const controls = screen.getByRole('region', { name: 'Guarded execution controls' });
    expect(within(controls).getByText('demo-researcher · working')).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: 'Pause local run demo-researcher' })).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: 'Cancel local run demo-researcher' })).toBeInTheDocument();
    expect(within(controls).queryByRole('button', { name: /Resume local run/i })).not.toBeInTheDocument();

    fireEvent.click(within(controls).getByRole('button', { name: 'Pause local run demo-researcher' }));

    expect(within(controls).getByRole('status')).toHaveTextContent('demo-researcher is paused.');
    expect(within(controls).getByText('operator-local-demo · pause · working -> paused · 2026-05-23T10:08:00.000Z')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/apiKey|sk-[A-Za-z0-9._-]{8,}|encryptedKeyMaterial/);
  });

  it('does not expose active guarded control actions for completed local demo nodes', () => {
    const { graph, trail } = buildDemoExecutionTrail();
    const trailSummary = replayExecutionTrail(graph, trail);

    render(<ExecutionGraphPanel graph={graph} trailSummary={trailSummary} />);

    const controls = screen.getByRole('region', { name: 'Guarded execution controls' });
    expect(within(controls).getByText('demo-planner · completed')).toBeInTheDocument();
    expect(within(controls).getByText('No guarded actions are available for this local state.')).toBeInTheDocument();
    expect(within(controls).queryByRole('button', { name: /Pause local run/i })).not.toBeInTheDocument();
    expect(within(controls).queryByRole('button', { name: /Cancel local run/i })).not.toBeInTheDocument();
    expect(within(controls).queryByRole('button', { name: /Retry local run/i })).not.toBeInTheDocument();
  });
});
