import { describe, expect, it } from 'vitest';
import {
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
});
