import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TemplateStudioPanel } from '../src/TemplateStudioPanel';
import { createPromptTemplate } from '../src/harness/promptTemplates';

const clock = () => '2026-05-23T10:00:00.000Z';
const laterClock = () => '2026-05-23T10:30:00.000Z';

describe('TemplateStudioPanel', () => {
  it('renders presets and creates a template from a role preset without raw secrets', () => {
    render(
      <TemplateStudioPanel
        clock={clock}
        idSource={() => 'template-planner-ui'}
        initialTemplates={[]}
        providerOptions={[{ id: 'openai-main', label: 'OpenAI Main', modelIds: ['gpt-4.1'], secretPreview: 'masked-demo-secret' }]}
        escalationPolicies={[{ id: 'default-escalation', label: 'Default escalation' }]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Template studio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create planner template' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create planner template' }));

    const card = screen.getByTestId('template-card-template-planner-ui');
    expect(within(card).getByText('Planner template')).toBeInTheDocument();
    expect(within(card).getByText('planner · openai-main · gpt-4.1')).toBeInTheDocument();
    expect(within(card).getByText('Variables: constraints, task')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('masked-demo-secret');
    expect(document.body.textContent).not.toContain('fake:');
  });

  it('edits and saves a template with version and validation status', () => {
    const template = createPromptTemplate({
      id: 'template-reviewer',
      title: 'Reviewer',
      role: 'reviewer',
      body: 'Review {{diff}}.',
      providerProfileId: 'anthropic-main',
      modelId: 'claude-sonnet-4-5',
      escalationPolicyId: 'review-escalation',
    }, clock);

    render(
      <TemplateStudioPanel
        clock={laterClock}
        idSource={() => 'unused'}
        initialTemplates={[template]}
        providerOptions={[{ id: 'anthropic-main', label: 'Anthropic Main', modelIds: ['claude-sonnet-4-5'] }]}
        escalationPolicies={[{ id: 'review-escalation', label: 'Review escalation' }]}
      />,
    );

    expect(within(screen.getByTestId('template-card-template-reviewer')).getByText('Valid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Reviewer' }));
    fireEvent.change(screen.getByLabelText('Template title'), { target: { value: 'Senior reviewer' } });
    fireEvent.change(screen.getByLabelText('Prompt body'), { target: { value: 'Review {{diff}} for {{risk_area}}.' } });
    fireEvent.change(screen.getByLabelText('Policy variables'), { target: { value: 'risk_area' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));

    const card = screen.getByTestId('template-card-template-reviewer');
    expect(within(card).getByText('Senior reviewer')).toBeInTheDocument();
    expect(within(card).getByText('Variables: diff, risk_area')).toBeInTheDocument();
    expect(within(card).getByText('Versions: 1')).toBeInTheDocument();
    expect(within(card).getByText('Valid')).toBeInTheDocument();
  });

  it('shows validation issues for incomplete templates', () => {
    const template = createPromptTemplate({
      id: 'template-invalid',
      title: '',
      role: 'operator',
      body: 'Handle {{incident}}.',
      providerProfileId: '',
      modelId: '',
      escalationPolicyId: '',
      policyBindings: ['missing_variable'],
    }, clock);

    render(
      <TemplateStudioPanel
        clock={clock}
        idSource={() => 'unused'}
        initialTemplates={[template]}
        providerOptions={[]}
        escalationPolicies={[]}
      />,
    );

    const card = screen.getByTestId('template-card-template-invalid');
    expect(within(card).getByText('Needs attention')).toBeInTheDocument();
    expect(within(card).getByText('Template title is required.')).toBeInTheDocument();
    expect(within(card).getByText('Template must bind to a provider profile.')).toBeInTheDocument();
    expect(within(card).getByText('Template must bind to a model.')).toBeInTheDocument();
    expect(within(card).getByText('Template must bind to an escalation policy.')).toBeInTheDocument();
    expect(within(card).getByText('Policy binding references unknown template variable: missing_variable.')).toBeInTheDocument();
  });

  it('renders workspace validation summary for missing tools, disabled tools, and unknown policy variables without secrets', () => {
    const template = createPromptTemplate({
      id: 'template-workspace-validation',
      title: 'Workspace operator',
      role: 'operator',
      body: 'Handle {{incident}}.',
      providerProfileId: 'openai-main',
      modelId: 'gpt-4.1',
      escalationPolicyId: 'policy-workspace',
      requiredToolIds: ['browser', 'shell'],
      requiredToolNames: ['Missing Console'],
    }, clock);

    render(
      <TemplateStudioPanel
        clock={clock}
        idSource={() => 'unused'}
        initialTemplates={[template]}
        providerOptions={[{ id: 'openai-main', label: 'OpenAI Main', modelIds: ['gpt-4.1'], secretPreview: 'sk-ui-secret' }]}
        escalationPolicies={[
          {
            id: 'policy-workspace',
            label: 'Workspace escalation',
            mode: 'queue',
            queue: 'ops-review',
            conditions: [{ expression: '{{undeclared_gate}} == true' }],
          },
        ]}
        toolRecords={[
          { id: 'browser', name: 'Browser', enabled: true },
          { id: 'shell', name: 'Shell', enabled: false, encryptedKeyMaterial: 'encrypted-secret-material' },
        ]}
      />,
    );

    const card = screen.getByTestId('template-card-template-workspace-validation');
    expect(within(card).getByText('Validation: blocking')).toBeInTheDocument();
    expect(within(card).getByText('Tools: 3 required · 1 missing · 1 disabled')).toBeInTheDocument();
    expect(within(card).getByText('Policy variables: 1 unknown')).toBeInTheDocument();
    expect(within(card).getByText('Required tool is disabled: Shell.')).toBeInTheDocument();
    expect(within(card).getByText('Required tool is not available in this workspace: Missing Console.')).toBeInTheDocument();
    expect(within(card).getByText('Policy binding references unknown template variable: undeclared_gate.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('sk-ui-secret');
    expect(document.body.textContent).not.toContain('encrypted-secret-material');
  });
});
