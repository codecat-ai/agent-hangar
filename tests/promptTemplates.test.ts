import { describe, expect, it } from 'vitest';
import {
  buildPromptTemplateValidationReport,
  createTemplateFromPreset,
  createPromptTemplate,
  deletePromptTemplateById,
  extractTemplateVariables,
  rolePresets,
  updatePromptTemplate,
  validatePromptTemplate,
  type PromptTemplateIdSource,
} from '../src/harness/promptTemplates';

const clock = () => '2026-05-23T10:00:00.000Z';
const laterClock = () => '2026-05-23T10:15:00.000Z';

function idSource(...ids: string[]): PromptTemplateIdSource {
  let index = 0;
  return () => ids[index++] ?? `generated-${index}`;
}

describe('prompt template harness', () => {
  it('creates deterministic templates from role presets without provider secrets', () => {
    const template = createTemplateFromPreset('planner', {
      id: idSource('template-planner-1'),
      clock,
      providerProfileId: 'openai-main',
      modelId: 'gpt-4.1',
      escalationPolicyId: 'default-escalation',
    });

    expect(rolePresets.map((preset) => preset.role)).toEqual(['planner', 'researcher', 'implementer', 'reviewer', 'operator']);
    expect(template).toMatchObject({
      id: 'template-planner-1',
      title: 'Planner template',
      role: 'planner',
      providerProfileId: 'openai-main',
      modelId: 'gpt-4.1',
      escalationPolicyId: 'default-escalation',
      createdAt: '2026-05-23T10:00:00.000Z',
      updatedAt: '2026-05-23T10:00:00.000Z',
      variables: ['constraints', 'task'],
      versions: [],
    });
    expect(JSON.stringify(template)).not.toContain('sk-');
  });

  it('extracts sorted unique variables from double-brace prompt syntax', () => {
    expect(extractTemplateVariables('Use {{ task }} for {{agent_name}}. Ignore {bad} and {{ 123bad }}. Repeat {{task}}.')).toEqual([
      'agent_name',
      'task',
    ]);
  });

  it('creates, updates, and deletes templates immutably', () => {
    const template = createPromptTemplate({
      id: 'template-reviewer',
      title: 'Reviewer',
      role: 'reviewer',
      body: 'Review {{diff}} for {{risk_area}}.',
      providerProfileId: 'anthropic-main',
      modelId: 'claude-sonnet-4-5',
      escalationPolicyId: 'review-escalation',
      policyBindings: ['risk_area'],
    }, clock);
    const collection = [template];

    const updated = updatePromptTemplate(template, { title: 'Senior reviewer' }, laterClock);
    const deleted = deletePromptTemplateById(collection, 'template-reviewer');

    expect(updated).not.toBe(template);
    expect(updated.title).toBe('Senior reviewer');
    expect(updated.body).toBe(template.body);
    expect(updated.variables).toEqual(['diff', 'risk_area']);
    expect(updated.versions).toEqual([]);
    expect(collection).toEqual([template]);
    expect(deleted).toEqual([]);
  });

  it('records version history only when the prompt body changes', () => {
    const template = createPromptTemplate({
      id: 'template-implementer',
      title: 'Implementer',
      role: 'implementer',
      body: 'Implement {{task}}.',
      providerProfileId: 'openai-main',
      modelId: 'gpt-4.1',
      escalationPolicyId: 'default-escalation',
    }, clock);

    const titleOnly = updatePromptTemplate(template, { title: 'Implementation template' }, laterClock);
    const bodyChanged = updatePromptTemplate(template, { body: 'Implement {{task}} with {{test_plan}}.' }, laterClock);

    expect(titleOnly.versions).toEqual([]);
    expect(bodyChanged.variables).toEqual(['task', 'test_plan']);
    expect(bodyChanged.versions).toEqual([
      {
        body: 'Implement {{task}}.',
        variables: ['task'],
        createdAt: '2026-05-23T10:00:00.000Z',
        supersededAt: '2026-05-23T10:15:00.000Z',
      },
    ]);
  });

  it('validates required fields, role values, bindings, and policy references', () => {
    const invalid = createPromptTemplate({
      id: 'template-invalid',
      title: ' ',
      role: 'navigator',
      body: 'Escalate about {{incident}}.',
      providerProfileId: ' ',
      modelId: '',
      escalationPolicyId: '',
      policyBindings: ['missing_variable'],
    }, clock);

    expect(validatePromptTemplate(invalid)).toEqual([
      { code: 'missing-title', message: 'Template title is required.' },
      { code: 'invalid-role', message: 'Template role must be one of planner, researcher, implementer, reviewer, or operator.' },
      { code: 'missing-provider-binding', message: 'Template must bind to a provider profile.' },
      { code: 'missing-model-binding', message: 'Template must bind to a model.' },
      { code: 'missing-escalation-policy', message: 'Template must bind to an escalation policy.' },
      { code: 'unknown-policy-variable', message: 'Policy binding references unknown template variable: missing_variable.' },
    ]);
  });

  it('builds a deterministic workspace validation report for tool and escalation policy requirements', () => {
    const template = createPromptTemplate({
      id: 'template-operator',
      title: 'Operator',
      role: 'operator',
      body: 'Handle {{incident}} with {{severity}}.',
      providerProfileId: 'openai-main',
      modelId: 'gpt-4.1',
      escalationPolicyId: 'policy-invalid',
      policyBindings: ['severity'],
      requiredToolIds: ['browser', 'browser', 'shell'],
      requiredToolNames: ['Deploy Console', 'Unknown Tool'],
    }, clock);

    const report = buildPromptTemplateValidationReport(template, {
      tools: [
        { id: 'browser', name: 'Browser', enabled: true },
        { id: 'shell', name: 'Shell', enabled: false },
        { id: 'deploy-console', name: 'Deploy Console', enabled: true },
      ],
      escalationPolicies: [
        {
          id: 'policy-invalid',
          name: 'Invalid escalation',
          mode: 'provider',
          conditions: [
            { expression: '{{incident}} == "p0"', variables: ['undeclared_policy_flag'] },
            { expression: '{{missing_from_condition}} == true' },
          ],
        },
      ],
    });

    expect(report).toEqual({
      schemaVersion: 'agent-hangar.template-validation.v1',
      template: { id: 'template-operator', title: 'Operator' },
      summary: {
        status: 'blocking',
        blockingIssueCount: 5,
        warningIssueCount: 1,
        requiredToolCount: 4,
        missingToolCount: 1,
        disabledToolCount: 1,
        unknownPolicyVariableCount: 2,
      },
      issues: [
        {
          code: 'duplicate-tool-requirement',
          severity: 'warning',
          message: 'Tool requirement is duplicated: browser.',
          detail: { requirement: 'browser' },
        },
        {
          code: 'disabled-tool',
          severity: 'blocking',
          message: 'Required tool is disabled: Shell.',
          detail: { toolId: 'shell', toolName: 'Shell' },
        },
        {
          code: 'missing-tool',
          severity: 'blocking',
          message: 'Required tool is not available in this workspace: Unknown Tool.',
          detail: { requirement: 'Unknown Tool' },
        },
        {
          code: 'missing-escalation-target',
          severity: 'blocking',
          message: 'Escalation policy policy-invalid must define provider/model target fields.',
          detail: { policyId: 'policy-invalid', mode: 'provider' },
        },
        {
          code: 'unknown-policy-variable',
          severity: 'blocking',
          message: 'Policy binding references unknown template variable: missing_from_condition.',
          detail: { variable: 'missing_from_condition' },
        },
        {
          code: 'unknown-policy-variable',
          severity: 'blocking',
          message: 'Policy binding references unknown template variable: undeclared_policy_flag.',
          detail: { variable: 'undeclared_policy_flag' },
        },
      ],
    });
    expect(JSON.stringify(report)).not.toContain('sk-');
  });

  it('returns a safe compact report for valid workspace-backed templates', () => {
    const template = createPromptTemplate({
      id: 'template-valid',
      title: 'Valid operator',
      role: 'operator',
      body: 'Handle {{incident}} and {{severity}}.',
      providerProfileId: 'openai-main',
      modelId: 'gpt-4.1',
      escalationPolicyId: 'policy-valid',
      policyBindings: ['severity'],
      requiredToolIds: ['browser'],
      requiredToolNames: ['Shell'],
    }, clock);

    const report = buildPromptTemplateValidationReport(template, {
      tools: [
        { id: 'browser', name: 'Browser', enabled: true, secretPreview: 'sk-should-not-render' },
        { id: 'shell', name: 'Shell', enabled: true },
      ],
      escalationPolicies: [
        {
          id: 'policy-valid',
          name: 'Valid escalation',
          mode: 'provider',
          providerProfileId: 'openai-main',
          modelId: 'gpt-4.1',
          conditions: [{ expression: '{{incident}} == "p0"', variables: ['severity'] }],
        },
      ],
    });

    expect(report.summary).toEqual({
      status: 'valid',
      blockingIssueCount: 0,
      warningIssueCount: 0,
      requiredToolCount: 2,
      missingToolCount: 0,
      disabledToolCount: 0,
      unknownPolicyVariableCount: 0,
    });
    expect(report.issues).toEqual([]);
    expect(JSON.stringify(report)).not.toContain('sk-should-not-render');
  });
});
