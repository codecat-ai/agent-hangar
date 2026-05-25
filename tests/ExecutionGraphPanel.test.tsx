import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionGraphPanel } from '../src/ExecutionGraphPanel';
import { normalizeCollaborationInbox } from '../src/harness/collaborationAudit';
import { getDemoWorkspaceScenario, listDemoWorkspaceScenarios, buildDemoWorkspaceSeed } from '../src/harness/demoWorkspace';
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

    expect(screen.getByText('No runnable nodes are ready.')).toHaveAttribute('role', 'status');
  });

  it('renders deterministic local execution trail counts and timeline without secrets', () => {
    const { graph, trail } = buildDemoExecutionTrail();
    const trailSummary = replayExecutionTrail(graph, trail);

    render(<ExecutionGraphPanel graph={graph} trailSummary={trailSummary} secretPreview="sk-ui-secret" />);

    expect(screen.getByRole('heading', { name: 'Local execution trail' })).toBeInTheDocument();
    expect(screen.getByText('11 events')).toBeInTheDocument();
    expect(screen.getByText('0 trail issues')).toBeInTheDocument();
    expect(screen.getByText('4 completed')).toBeInTheDocument();
    expect(screen.getByText('Task created')).toBeInTheDocument();
    expect(screen.getByText('Implementation completed')).toBeInTheDocument();
    expect(screen.getByText('Review completed')).toBeInTheDocument();
    expect(screen.getByText('review-completed · accepted')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('sk-ui-secret');
  });

  it('renders an accessible compact demo workspace coordination summary', () => {
    const seed = buildDemoWorkspaceSeed();
    const trailSummary = replayExecutionTrail(seed.graph, seed.trail);

    render(<ExecutionGraphPanel graph={seed.graph} trailSummary={trailSummary} collaborationItems={seed.collaborationItems} />);

    const demoSummary = screen.getByRole('region', { name: 'Demo workspace summary' });
    expect(within(demoSummary).getByRole('heading', { name: 'Demo workspace summary' })).toBeInTheDocument();
    expect(within(demoSummary).getByText('4 roles')).toBeInTheDocument();
    expect(within(demoSummary).getByText('planner, researcher, implementer, reviewer')).toBeInTheDocument();
    expect(within(demoSummary).getByText('delegation 1 · review 1 · broadcast 1 · escalation 1')).toBeInTheDocument();
    expect(within(demoSummary).getByText('Next operator action')).toBeInTheDocument();
    expect(within(demoSummary).getByText('Resolve 1 urgent escalation before starting more local execution.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/apiKey|encryptedKeyMaterial|sk-[A-Za-z0-9._-]{8,}|customer[A-Za-z0-9_-]*|\bcurl\b|\bnpm\s+(?:run|install|exec|test|start)\b/);
  });

  it('switches local demo scenarios with an accessible selector and refreshes graph, trail, collaboration, audit, and next-action summaries', () => {
    const scenarios = listDemoWorkspaceScenarios();

    render(<ExecutionGraphPanel demoScenarios={scenarios} initialDemoScenarioId="coordination-happy-path" />);

    expect(screen.getByLabelText('Local demo scenario')).toHaveValue('coordination-happy-path');
    expect(screen.getByText('Coordination happy path')).toBeInTheDocument();
    expect(screen.getByText('11 events')).toBeInTheDocument();
    expect(screen.getByText('4 completed')).toBeInTheDocument();
    expect(screen.getByText('demo-planner · completed')).toBeInTheDocument();
    expect(screen.getByText('delegation 1 · review 1 · broadcast 1 · escalation 1')).toBeInTheDocument();
    expect(screen.getAllByText('Resolve 1 urgent escalation before starting more local execution.').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Local demo scenario'), { target: { value: 'blocked-failure-recovery' } });

    expect(screen.getByLabelText('Local demo scenario')).toHaveValue('blocked-failure-recovery');
    expect(screen.getByText('Blocked failure recovery')).toBeInTheDocument();
    expect(screen.getByText('Recovery implementer')).toBeInTheDocument();
    expect(screen.getByText('implementer · failed')).toBeInTheDocument();
    expect(screen.getByText('12 events')).toBeInTheDocument();
    expect(screen.getAllByText('2 completed').length).toBeGreaterThan(0);
    expect(screen.getByText('demo-recovery-implementer · failed')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText('delegation 1 · review 1 · broadcast 1 · escalation 2')).toBeInTheDocument();
    expect(screen.getByText('2 urgent')).toBeInTheDocument();
    expect(screen.getByText('2 audit entries')).toBeInTheDocument();
    expect(screen.getAllByText('- Unresolved escalations: 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Escalate failed implementation review')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/apiKey|encryptedKeyMaterial|sk-[A-Za-z0-9._-]{8,}|customer[A-Za-z0-9_-]*|\bcurl\b|\bnpm\s+(?:run|install|exec|test|start)\b/);
  });

  it('renders local run evidence export preview text and copies through an injected side effect', async () => {
    const { graph, trail } = buildDemoExecutionTrail();
    const trailSummary = replayExecutionTrail(graph, trail);
    const copyRunEvidence = vi.fn();

    render(<ExecutionGraphPanel graph={graph} trailSummary={trailSummary} copyRunEvidence={copyRunEvidence} />);

    expect(screen.getByRole('heading', { name: 'Run evidence export' })).toBeInTheDocument();
    expect(screen.getByText('agent-hangar.run-evidence-export.v1')).toBeInTheDocument();
    expect(screen.getByText('workspace-local-demo')).toBeInTheDocument();
    expect(screen.getByText('- Events: 11')).toBeInTheDocument();
    expect(screen.getByText('- Graph issues: 0')).toBeInTheDocument();
    expect(screen.getByText('- 2026-05-23T10:10:00.000Z | review-completed | accepted | demo-reviewer | Review completed | node: demo-reviewer | Reviewer accepts the local demo workspace trail.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy run evidence export' }));

    expect(copyRunEvidence).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('Copied run evidence export.')).toHaveAttribute('role', 'status'));
    expect(copyRunEvidence.mock.calls[0]![0]).toContain('schemaVersion: agent-hangar.run-evidence-export.v1');
    expect(copyRunEvidence.mock.calls[0]![0]).toContain('## Timeline');
  });

  it('renders local scenario evidence bundle preview text and copies through an injected side effect', async () => {
    const scenarios = listDemoWorkspaceScenarios();
    const copyScenarioEvidenceBundle = vi.fn();

    render(
      <ExecutionGraphPanel
        demoScenarios={scenarios}
        initialDemoScenarioId="blocked-failure-recovery"
        copyScenarioEvidenceBundle={copyScenarioEvidenceBundle}
      />,
    );

    const bundle = screen.getByRole('region', { name: 'Scenario evidence bundle' });
    expect(within(bundle).getByRole('heading', { name: 'Scenario evidence bundle' })).toBeInTheDocument();
    expect(within(bundle).getByText('agent-hangar.scenario-evidence-bundle.v1')).toBeInTheDocument();
    expect(within(bundle).getByText('blocked-failure-recovery')).toBeInTheDocument();
    expect(within(bundle).getByText('- Scenario: Blocked failure recovery (`blocked-failure-recovery`)')).toBeInTheDocument();
    expect(within(bundle).getByText('- Unresolved escalations: 1')).toBeInTheDocument();
    expect(within(bundle).getByText('## Run Evidence Export')).toBeInTheDocument();

    fireEvent.click(within(bundle).getByRole('button', { name: 'Copy scenario evidence bundle' }));

    expect(copyScenarioEvidenceBundle).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(bundle).getByRole('status')).toHaveTextContent('Copied scenario evidence bundle.'));
    expect(copyScenarioEvidenceBundle.mock.calls[0]![0]).toContain('schemaVersion: agent-hangar.scenario-evidence-bundle.v1');
    expect(copyScenarioEvidenceBundle.mock.calls[0]![0]).toContain('## Run Evidence Export');
    expect(document.body.textContent).not.toMatch(/apiKey|encryptedKeyMaterial|\bsk-[A-Za-z0-9._-]+|Bearer/i);
  });

  it('renders source-checkout workspace manifest preview and copies Markdown through an injected side effect', async () => {
    const scenarios = listDemoWorkspaceScenarios();
    const copyWorkspaceManifest = vi.fn();

    render(
      <ExecutionGraphPanel
        demoScenarios={scenarios}
        initialDemoScenarioId="blocked-failure-recovery"
        workspaceManifestProviders={[
          {
            id: 'local-provider-demo',
            kind: 'openai-compatible',
            displayName: 'Local Demo Provider',
            baseUrl: 'http://localhost:11434/v1',
            createdAt: '2026-05-23T10:00:00.000Z',
            updatedAt: '2026-05-23T10:00:00.000Z',
            encryptedApiKey: 'local-demo:v1:redaction-fixture',
          },
        ]}
        workspaceManifestModelsByProvider={{
          'local-provider-demo': [{ id: 'local-model-reviewer', displayName: 'Local Reviewer', providerKind: 'openai-compatible' }],
        }}
        workspaceManifestTools={[{ id: 'browser', name: 'Browser', enabled: true }]}
        workspaceManifestEscalationPolicies={[{ id: 'local-escalation-demo', label: 'Local escalation', mode: 'manual' }]}
        copyWorkspaceManifest={copyWorkspaceManifest}
      />,
    );

    const manifest = screen.getByRole('region', { name: 'Workspace portability manifest preview' });
    expect(within(manifest).getByRole('heading', { name: 'Workspace portability manifest preview' })).toBeInTheDocument();
    expect(within(manifest).getByText('agent-hangar.workspace-manifest-preview.v1')).toBeInTheDocument();
    expect(within(manifest).getByText('source-checkout-only')).toBeInTheDocument();
    expect(within(manifest).getByText('blocked')).toBeInTheDocument();
    expect(within(manifest).getByText('1 provider')).toBeInTheDocument();
    expect(within(manifest).getByText('1 unresolved escalation')).toBeInTheDocument();
    expect(within(manifest).getByText('- Source mode: source-checkout-only')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/apiKey|encryptedApiKey|redaction-fixture|encryptedKeyMaterial|Bearer/i);

    fireEvent.click(within(manifest).getByRole('button', { name: 'Copy workspace portability manifest preview' }));

    expect(copyWorkspaceManifest).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(manifest).getByRole('status')).toHaveTextContent('Copied workspace portability manifest preview.'));
    expect(copyWorkspaceManifest.mock.calls[0]![0]).toContain('schemaVersion: agent-hangar.workspace-manifest-preview.v1');
    expect(copyWorkspaceManifest.mock.calls[0]![0]).toContain('# Workspace Portability Manifest Preview');
    expect(copyWorkspaceManifest.mock.calls[0]![0]).not.toMatch(/apiKey|encryptedApiKey|sk-ui-secret|encryptedKeyMaterial|Bearer/i);
  });

  it('renders source-checkout import/export dry-run preview and copies the selected scenario report through an injected side effect', async () => {
    const scenarios = listDemoWorkspaceScenarios();
    const copyWorkspaceDryRun = vi.fn();

    render(
      <ExecutionGraphPanel
        demoScenarios={scenarios}
        initialDemoScenarioId="coordination-happy-path"
        workspaceManifestProviders={[
          {
            id: 'local-provider-demo',
            kind: 'openai-compatible',
            displayName: 'Local Demo Provider',
            baseUrl: 'http://localhost:11434/v1',
            createdAt: '2026-05-23T10:00:00.000Z',
            updatedAt: '2026-05-23T10:00:00.000Z',
            encryptedApiKey: 'local-demo:v1:sk-ui-secret',
          },
        ]}
        workspaceManifestModelsByProvider={{
          'local-provider-demo': [{ id: 'local-model-planner', displayName: 'Local Planner', providerKind: 'openai-compatible' }],
        }}
        copyWorkspaceDryRun={copyWorkspaceDryRun}
      />,
    );

    const dryRun = screen.getByRole('region', { name: 'Workspace import/export dry run' });
    expect(within(dryRun).getByRole('heading', { name: 'Workspace import/export dry run' })).toBeInTheDocument();
    expect(within(dryRun).getByText('agent-hangar.workspace-import-export-dry-run.v1')).toBeInTheDocument();
    expect(within(dryRun).getByText('export')).toBeInTheDocument();
    expect(within(dryRun).getByText('source-checkout-only')).toBeInTheDocument();
    expect(within(dryRun).getByText('workspace-local-demo')).toBeInTheDocument();
    expect(within(dryRun).getByText('- Accepted files: 3')).toBeInTheDocument();
    expect(within(dryRun).getByText('No local provider secrets, encrypted key material, saved desktop state, or localStorage records were mutated.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/apiKey|encryptedApiKey|sk-ui-secret|encryptedKeyMaterial|Bearer/i);

    fireEvent.click(within(dryRun).getByRole('button', { name: 'Copy workspace import/export dry run' }));

    expect(copyWorkspaceDryRun).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(dryRun).getByRole('status')).toHaveTextContent('Copied workspace import/export dry run.'));
    expect(copyWorkspaceDryRun.mock.calls[0]![0]).toContain('schemaVersion: agent-hangar.workspace-import-export-dry-run.v1');
    expect(copyWorkspaceDryRun.mock.calls[0]![0]).toContain('## Export Readiness');
    expect(copyWorkspaceDryRun.mock.calls[0]![0]).not.toMatch(/apiKey|encryptedApiKey|redaction-fixture|encryptedKeyMaterial|Bearer/i);
  });

  it('renders a guided source-checkout walkthrough region and copies Markdown through an injected side effect', async () => {
    const scenarios = listDemoWorkspaceScenarios();
    const copySourceCheckoutWalkthrough = vi.fn();

    render(
      <ExecutionGraphPanel
        demoScenarios={scenarios}
        initialDemoScenarioId="blocked-failure-recovery"
        workspaceManifestProviders={[
          {
            id: 'local-provider-demo',
            kind: 'openai-compatible',
            displayName: 'Local Demo Provider',
            baseUrl: 'http://localhost:11434/v1',
            createdAt: '2026-05-23T10:00:00.000Z',
            updatedAt: '2026-05-23T10:00:00.000Z',
            encryptedApiKey: 'local-demo:v1:sk-ui-secret',
          },
        ]}
        copySourceCheckoutWalkthrough={copySourceCheckoutWalkthrough}
      />,
    );

    const walkthrough = screen.getByRole('region', { name: 'Source-checkout operator walkthrough' });
    expect(within(walkthrough).getByRole('heading', { name: 'Source-checkout operator walkthrough' })).toBeInTheDocument();
    expect(within(walkthrough).getByText('agent-hangar.source-checkout-operator-walkthrough.v1')).toBeInTheDocument();
    expect(within(walkthrough).getByText('source-checkout-only')).toBeInTheDocument();
    expect(within(walkthrough).getByText('7 steps')).toBeInTheDocument();
    expect(within(walkthrough).getByText('Provider profiles and discovery gate')).toBeInTheDocument();
    expect(within(walkthrough).getByText('Workspace portability manifest')).toBeInTheDocument();
    expect(within(walkthrough).getByText('Import/export dry run')).toBeInTheDocument();
    expect(within(walkthrough).getByText('Add local discovery dry-run preview data before treating provider readiness as reviewed.')).toBeInTheDocument();
    expect(within(walkthrough).getByText('- Source mode: source-checkout-only')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/apiKey|encryptedApiKey|sk-ui-secret|encryptedKeyMaterial|Bearer|\bnpm\s+(?:install|ci|run|exec)\b/i);

    fireEvent.click(within(walkthrough).getByRole('button', { name: 'Copy source-checkout operator walkthrough' }));

    expect(copySourceCheckoutWalkthrough).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(walkthrough).getByRole('status')).toHaveTextContent('Copied source-checkout operator walkthrough.'));
    expect(copySourceCheckoutWalkthrough.mock.calls[0]![0]).toContain('schemaVersion: agent-hangar.source-checkout-operator-walkthrough.v1');
    expect(copySourceCheckoutWalkthrough.mock.calls[0]![0]).toContain('## Steps');
    expect(copySourceCheckoutWalkthrough.mock.calls[0]![0]).not.toMatch(/apiKey|encryptedApiKey|sk-ui-secret|encryptedKeyMaterial|Bearer/i);
  });

  it('renders source-checkout evidence quality gate preview and copies Markdown through an injected side effect', async () => {
    const scenarios = listDemoWorkspaceScenarios();
    const copySourceCheckoutQualityGate = vi.fn();

    render(
      <ExecutionGraphPanel
        demoScenarios={scenarios}
        initialDemoScenarioId="coordination-happy-path"
        workspaceManifestProviders={[
          {
            id: 'local-provider-demo',
            kind: 'openai-compatible',
            displayName: 'Local Demo Provider',
            baseUrl: 'http://localhost:11434/v1',
            createdAt: '2026-05-23T10:00:00.000Z',
            updatedAt: '2026-05-23T10:00:00.000Z',
            encryptedApiKey: 'local-demo:v1:sk-ui-secret',
          },
        ]}
        copySourceCheckoutQualityGate={copySourceCheckoutQualityGate}
      />,
    );

    const qualityGate = screen.getByRole('region', { name: 'Source-checkout evidence quality gate' });
    expect(within(qualityGate).getByRole('heading', { name: 'Source-checkout evidence quality gate' })).toBeInTheDocument();
    expect(within(qualityGate).getByText('agent-hangar.source-checkout-evidence-quality-gate.v1')).toBeInTheDocument();
    expect(within(qualityGate).getByText('source-checkout-only')).toBeInTheDocument();
    expect(within(qualityGate).getByText('8 surfaces')).toBeInTheDocument();
    expect(within(qualityGate).getByText('- Checked surfaces: 8')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/apiKey|encryptedApiKey|sk-ui-secret|encryptedKeyMaterial|Bearer|\bnpm\s+(?:install|ci|run|exec)\b/i);

    fireEvent.click(within(qualityGate).getByRole('button', { name: 'Copy source-checkout evidence quality gate' }));

    expect(copySourceCheckoutQualityGate).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(qualityGate).getByRole('status')).toHaveTextContent('Copied source-checkout evidence quality gate.'));
    expect(copySourceCheckoutQualityGate.mock.calls[0]![0]).toContain('schemaVersion: agent-hangar.source-checkout-evidence-quality-gate.v1');
    expect(copySourceCheckoutQualityGate.mock.calls[0]![0]).toContain('## Surfaces');
    expect(copySourceCheckoutQualityGate.mock.calls[0]![0]).not.toMatch(/apiKey|encryptedApiKey|sk-ui-secret|encryptedKeyMaterial|Bearer/i);
  });

  it('renders source-checkout onboarding as the primary accessible review path without leaking secrets', () => {
    const scenarios = listDemoWorkspaceScenarios();

    render(
      <ExecutionGraphPanel
        demoScenarios={scenarios}
        initialDemoScenarioId="coordination-happy-path"
        workspaceManifestProviders={[
          {
            id: 'local-provider-demo',
            kind: 'openai-compatible',
            displayName: 'Local Demo Provider',
            baseUrl: 'http://localhost:11434/v1',
            createdAt: '2026-05-23T10:00:00.000Z',
            updatedAt: '2026-05-23T10:00:00.000Z',
            encryptedApiKey: 'local-demo:v1:sk-ui-secret',
          },
        ]}
      />,
    );

    const onboarding = screen.getByRole('region', { name: 'Source-checkout onboarding' });
    expect(within(onboarding).getByRole('heading', { name: 'Source-checkout onboarding' })).toBeInTheDocument();
    expect(within(onboarding).getByText('agent-hangar.source-checkout-onboarding.v1')).toBeInTheDocument();
    expect(within(onboarding).getByText('Start with the guided source-checkout walkthrough')).toBeInTheDocument();
    expect(within(onboarding).getByText('Keyboard start')).toBeInTheDocument();
    expect(within(onboarding).getByText('Tab to Source-checkout onboarding, then continue through provider, template, execution, collaboration, and portability evidence in order.')).toBeInTheDocument();
    expect(within(onboarding).getByText('Use a local source checkout or cloned repository workspace.')).toBeInTheDocument();
    expect(within(onboarding).getByRole('status')).toHaveTextContent('Source-checkout onboarding ready.');
    expect(within(onboarding).getByRole('link', { name: 'Provider evidence' })).toBeInTheDocument();
    expect(within(onboarding).getByRole('link', { name: 'Template evidence' })).toBeInTheDocument();
    expect(within(onboarding).getByRole('link', { name: 'Execution evidence' })).toBeInTheDocument();
    expect(within(onboarding).getByRole('link', { name: 'Collaboration evidence' })).toBeInTheDocument();
    expect(within(onboarding).getByRole('link', { name: 'Portability evidence' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/apiKey|encryptedApiKey|sk-ui-secret|encryptedKeyMaterial|Bearer|\bnpm\s+(?:install|ci|run|exec)\b/i);
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

  it('renders collaboration inbox and audit-history preview regions without leaking secret-like content', async () => {
    const { graph, trail } = buildDemoExecutionTrail();
    const trailSummary = replayExecutionTrail(graph, trail);
    const copyAuditHistory = vi.fn();
    const collaborationItems = normalizeCollaborationInbox([
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'esc-ui',
        type: 'escalation',
        priority: 'urgent',
        status: 'open',
        assignedAgentId: 'demo-reviewer',
        createdAt: '2026-05-23T10:09:00.000Z',
        title: 'Provider handoff blocked',
        body: 'apiKey=sk-ui-secret must never render',
        note: 'encryptedKeyMaterial=abc123 must never render',
      },
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'review-ui',
        type: 'review',
        priority: 'high',
        status: 'acknowledged',
        assignedAgentId: 'demo-reviewer',
        createdAt: '2026-05-23T10:08:00.000Z',
        title: 'Review local evidence',
      },
    ]).items;

    render(
      <ExecutionGraphPanel
        graph={graph}
        trailSummary={trailSummary}
        collaborationItems={collaborationItems}
        copyAuditHistory={copyAuditHistory}
      />,
    );

    const inbox = screen.getByRole('region', { name: 'Collaboration inbox' });
    expect(within(inbox).getByRole('heading', { name: 'Collaboration inbox' })).toBeInTheDocument();
    expect(within(inbox).getByText('2 unresolved')).toBeInTheDocument();
    expect(within(inbox).getByText('1 urgent')).toBeInTheDocument();
    expect(within(inbox).getByText('Provider handoff blocked')).toBeInTheDocument();
    expect(within(inbox).getByText('escalation · urgent · open · demo-reviewer')).toBeInTheDocument();

    const history = screen.getByRole('region', { name: 'Audit history preview' });
    expect(within(history).getByRole('heading', { name: 'Audit history preview' })).toBeInTheDocument();
    expect(within(history).getByText('1 unresolved escalation')).toBeInTheDocument();
    expect(within(history).getByText('Resolve 1 urgent escalation before starting more local execution.')).toBeInTheDocument();
    expect(within(history).getByText('- Unresolved escalations: 1')).toBeInTheDocument();

    fireEvent.click(within(history).getByRole('button', { name: 'Copy audit history preview' }));

    expect(copyAuditHistory).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(history).getByRole('status')).toHaveTextContent('Copied audit history preview.'));
    expect(copyAuditHistory.mock.calls[0]![0]).toContain('schemaVersion: agent-hangar.audit-history-preview.v1');
    expect(document.body.textContent).not.toMatch(/apiKey|sk-ui-secret|encryptedKeyMaterial|abc123/);
    expect(copyAuditHistory.mock.calls[0]![0]).not.toMatch(/apiKey|sk-ui-secret|encryptedKeyMaterial|abc123/);
  });

  it('filters collaboration triage with accessible controls and renders compact sanitized audit preview', () => {
    const { graph, trail } = buildDemoExecutionTrail();
    const trailSummary = replayExecutionTrail(graph, trail);
    const collaborationItems = normalizeCollaborationInbox([
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'esc-filter',
        type: 'escalation',
        priority: 'urgent',
        status: 'open',
        assignedAgentId: 'demo-reviewer',
        createdAt: '2026-05-23T10:09:00.000Z',
        title: 'Provider evidence blocked',
        body: 'apiKey=sk-filter-ui-secret must never render in compact triage.',
        note: 'encryptedKeyMaterial=abc123 stays hidden.',
      },
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'review-filter',
        type: 'review',
        priority: 'high',
        status: 'acknowledged',
        assignedAgentId: 'demo-reviewer',
        createdAt: '2026-05-23T10:08:00.000Z',
        title: 'Review local audit',
        body: 'Reviewer checks audit history.',
      },
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'delegation-filter',
        type: 'delegation',
        priority: 'normal',
        status: 'open',
        assignedAgentId: 'demo-implementer',
        createdAt: '2026-05-23T10:07:00.000Z',
        title: 'Implementer handoff',
      },
    ]).items;

    render(<ExecutionGraphPanel graph={graph} trailSummary={trailSummary} collaborationItems={collaborationItems} />);

    const inbox = screen.getByRole('region', { name: 'Collaboration inbox' });
    fireEvent.change(within(inbox).getByLabelText('Collaboration status filter'), { target: { value: 'unresolved' } });
    fireEvent.change(within(inbox).getByLabelText('Collaboration priority filter'), { target: { value: 'high' } });
    fireEvent.change(within(inbox).getByLabelText('Collaboration type filter'), { target: { value: 'escalation' } });
    fireEvent.change(within(inbox).getByLabelText('Search collaboration text'), { target: { value: 'provider render' } });

    expect(within(inbox).getByText('1 visible')).toBeInTheDocument();
    expect(within(inbox).getByText('2 hidden')).toBeInTheDocument();
    expect(within(inbox).getByText('1 high-priority unresolved')).toBeInTheDocument();
    expect(within(inbox).getByText('1 unresolved escalation')).toBeInTheDocument();
    expect(within(inbox).getByText('Status: unresolved')).toBeInTheDocument();
    expect(within(inbox).getByText('Priority: high/urgent')).toBeInTheDocument();
    expect(within(inbox).getByText('Type: escalation')).toBeInTheDocument();
    expect(within(inbox).getByText('Search: provider render')).toBeInTheDocument();
    expect(within(inbox).getByText('Provider evidence blocked')).toBeInTheDocument();
    expect(within(inbox).queryByText('Review local audit')).not.toBeInTheDocument();
    expect(within(inbox).getByText('Resolve or acknowledge this urgent escalation before starting more local execution.')).toBeInTheDocument();

    const history = screen.getByRole('region', { name: 'Audit history preview' });
    expect(within(history).getByText('- Collaboration items: 1')).toBeInTheDocument();
    expect(within(history).getByText('- Unresolved escalations: 1')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/apiKey|sk-filter-ui-secret|encryptedKeyMaterial|abc123/);
  });

  it('shows relevant collaboration actions, persists acknowledgements, and refreshes the audit preview', async () => {
    const { graph, trail } = buildDemoExecutionTrail();
    const trailSummary = replayExecutionTrail(graph, trail);
    const copyAuditHistory = vi.fn();
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };
    const collaborationItems = normalizeCollaborationInbox([
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'esc-action',
        type: 'escalation',
        priority: 'urgent',
        status: 'open',
        assignedAgentId: 'demo-reviewer',
        createdAt: '2026-05-23T10:09:00.000Z',
        title: 'Provider handoff blocked',
      },
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'done-action',
        type: 'review',
        priority: 'high',
        status: 'resolved',
        assignedAgentId: 'demo-reviewer',
        createdAt: '2026-05-23T10:08:00.000Z',
        title: 'Resolved review',
      },
    ]).items;

    render(
      <ExecutionGraphPanel
        graph={graph}
        trailSummary={trailSummary}
        collaborationItems={collaborationItems}
        collaborationStorage={storage}
        collaborationClock={() => '2026-05-23T10:11:00.000Z'}
        collaborationActorId="operator:test"
        copyAuditHistory={copyAuditHistory}
      />,
    );

    const inbox = screen.getByRole('region', { name: 'Collaboration inbox' });
    expect(within(inbox).getByRole('button', { name: 'Acknowledge collaboration item esc-action' })).toBeInTheDocument();
    expect(within(inbox).getByRole('button', { name: 'Resolve collaboration item esc-action' })).toBeInTheDocument();
    expect(within(inbox).queryByRole('button', { name: /done-action/ })).not.toBeInTheDocument();

    fireEvent.click(within(inbox).getByRole('button', { name: 'Acknowledge collaboration item esc-action' }));

    await waitFor(() => expect(within(inbox).getByRole('status')).toHaveTextContent('Acknowledged esc-action.'));
    expect(within(inbox).queryByRole('button', { name: 'Acknowledge collaboration item esc-action' })).not.toBeInTheDocument();
    expect(within(inbox).getByRole('button', { name: 'Resolve collaboration item esc-action' })).toBeInTheDocument();
    expect(within(inbox).getByText('escalation · urgent · acknowledged · demo-reviewer')).toBeInTheDocument();
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(
      'agent-hangar:workspace-local-demo:collaboration-persistence:v1',
      expect.stringContaining('"schemaVersion":"agent-hangar.collaboration-persistence.v1"'),
    );

    const history = screen.getByRole('region', { name: 'Audit history preview' });
    expect(within(history).getByText('1 audit entry')).toBeInTheDocument();
    expect(within(history).getByText('- Acknowledged items: 1')).toBeInTheDocument();
    expect(within(history).getByText(/acknowledge open -> acknowledged/)).toBeInTheDocument();

    fireEvent.click(within(history).getByRole('button', { name: 'Copy audit history preview' }));
    await waitFor(() => expect(copyAuditHistory).toHaveBeenCalledTimes(1));
    expect(copyAuditHistory.mock.calls[0]![0]).toContain('acknowledge open -> acknowledged');
  });

  it('resolves collaboration items with safe storage fallback and no secret-looking UI text', async () => {
    const { graph, trail } = buildDemoExecutionTrail();
    const trailSummary = replayExecutionTrail(graph, trail);
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('localStorage unavailable');
      }),
    };
    const collaborationItems = normalizeCollaborationInbox([
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'review-secret',
        type: 'review',
        priority: 'high',
        status: 'acknowledged',
        assignedAgentId: 'demo-reviewer',
        createdAt: '2026-05-23T10:09:00.000Z',
        title: 'Review provider note',
        body: 'sk-ui-secret and apiKey=sk-ui-secret should be hidden',
      },
    ]).items;

    render(
      <ExecutionGraphPanel
        graph={graph}
        trailSummary={trailSummary}
        collaborationItems={collaborationItems}
        collaborationStorage={storage}
        collaborationClock={() => '2026-05-23T10:12:00.000Z'}
        collaborationActorId="operator:test"
      />,
    );

    const inbox = screen.getByRole('region', { name: 'Collaboration inbox' });
    expect(within(inbox).queryByRole('button', { name: 'Acknowledge collaboration item review-secret' })).not.toBeInTheDocument();
    expect(within(inbox).getByRole('button', { name: 'Resolve collaboration item review-secret' })).toBeInTheDocument();

    fireEvent.click(within(inbox).getByRole('button', { name: 'Resolve collaboration item review-secret' }));

    await waitFor(() => expect(within(inbox).getByRole('status')).toHaveTextContent('Resolved review-secret. Local persistence is unavailable.'));
    expect(within(inbox).queryByRole('button', { name: /review-secret/ })).not.toBeInTheDocument();
    expect(within(inbox).getByText('review · high · resolved · demo-reviewer')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/apiKey|sk-ui-secret|encryptedKeyMaterial/);
  });
});
