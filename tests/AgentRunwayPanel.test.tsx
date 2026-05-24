import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentRunwayPanel } from '../src/AgentRunwayPanel';
import { createAgentRun, transitionRun } from '../src/harness/agentRuntime';

describe('AgentRunwayPanel', () => {
  it('renders accessible local-only runway shell guidance and redacts run errors', () => {
    render(
      <AgentRunwayPanel
        runs={[
          transitionRun(createAgentRun('task-1', 'planner'), 'working'),
          transitionRun(createAgentRun('task-1', 'reviewer'), 'failed', 'Bearer sk-runway-secret failed for ACME workspace'),
        ]}
        bindings={[
          { agentId: 'planner', providerProfileId: 'ready-provider', templateId: 'template-planner' },
          { agentId: 'reviewer', providerProfileId: 'ready-provider', templateId: 'template-reviewer' },
        ]}
        providerShellState={{ status: 'ready', affectedProfileIds: ['ready-provider'] }}
      />,
    );

    const region = screen.getByRole('region', { name: 'Agent runway' });
    expect(within(region).getByRole('status')).toHaveTextContent('Agent run failed');
    expect(within(region).getByText('Inspect the local run error and keep provider execution disabled until the binding is fixed.')).toBeInTheDocument();
    expect(within(region).getByTestId('agent-run-reviewer')).toHaveTextContent('[redacted]');
    expect(document.body.textContent).not.toContain('sk-runway-secret');
    expect(document.body.textContent).not.toContain('ACME');
  });

  it('shows blocked template/provider binding guidance before real execution exists', () => {
    render(
      <AgentRunwayPanel
        runs={[createAgentRun('task-1', 'planner')]}
        bindings={[{ agentId: 'planner', providerProfileId: 'missing-provider' }]}
        providerShellState={{ status: 'disconnected', affectedProfileIds: ['missing-provider'] }}
      />,
    );

    const region = screen.getByRole('region', { name: 'Agent runway' });
    expect(within(region).getByRole('status')).toHaveTextContent('Runway blocked');
    expect(within(region).getByText('Reconnect the provider profile or choose a template binding before previewing local runs.')).toBeInTheDocument();
  });
});
