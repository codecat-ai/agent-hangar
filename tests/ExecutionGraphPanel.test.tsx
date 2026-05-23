import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExecutionGraphPanel } from '../src/ExecutionGraphPanel';
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
});
