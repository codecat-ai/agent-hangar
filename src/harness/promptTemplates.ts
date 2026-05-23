export const promptTemplateRoles = ['planner', 'researcher', 'implementer', 'reviewer', 'operator'] as const;

export type PromptTemplateRole = typeof promptTemplateRoles[number];
export type PromptTemplateClock = () => string;
export type PromptTemplateIdSource = () => string;

export interface PromptRolePreset {
  role: PromptTemplateRole;
  title: string;
  body: string;
}

export interface PromptTemplateVersion {
  body: string;
  variables: string[];
  createdAt: string;
  supersededAt: string;
}

export interface PromptTemplateRecord {
  id: string;
  title: string;
  role: string;
  body: string;
  providerProfileId: string;
  modelId: string;
  escalationPolicyId: string;
  policyBindings: string[];
  variables: string[];
  createdAt: string;
  updatedAt: string;
  versions: PromptTemplateVersion[];
}

export interface CreatePromptTemplateInput {
  id: string;
  title: string;
  role: string;
  body: string;
  providerProfileId: string;
  modelId: string;
  escalationPolicyId: string;
  policyBindings?: string[];
}

export interface UpdatePromptTemplateInput {
  title?: string;
  role?: string;
  body?: string;
  providerProfileId?: string;
  modelId?: string;
  escalationPolicyId?: string;
  policyBindings?: string[];
}

export interface CreateTemplateFromPresetOptions {
  id: PromptTemplateIdSource;
  clock: PromptTemplateClock;
  providerProfileId: string;
  modelId: string;
  escalationPolicyId: string;
}

export interface PromptTemplateValidationIssue {
  code:
    | 'missing-title'
    | 'invalid-role'
    | 'missing-provider-binding'
    | 'missing-model-binding'
    | 'missing-escalation-policy'
    | 'unknown-policy-variable';
  message: string;
}

export const rolePresets: PromptRolePreset[] = [
  {
    role: 'planner',
    title: 'Planner template',
    body: 'Break down {{task}} into ordered steps, respect {{constraints}}, and identify review checkpoints.',
  },
  {
    role: 'researcher',
    title: 'Researcher template',
    body: 'Research {{task}} using the available sources, track evidence, and call out uncertainty.',
  },
  {
    role: 'implementer',
    title: 'Implementer template',
    body: 'Implement {{task}}, keep changes scoped, and report verification results.',
  },
  {
    role: 'reviewer',
    title: 'Reviewer template',
    body: 'Review {{artifact}} for correctness, regressions, missing tests, and operator risk.',
  },
  {
    role: 'operator',
    title: 'Operator template',
    body: 'Coordinate {{task}}, monitor blockers, and escalate according to {{escalation_policy}}.',
  },
];

const variablePattern = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

export function extractTemplateVariables(body: string): string[] {
  const variables = new Set<string>();
  for (const match of body.matchAll(variablePattern)) {
    variables.add(match[1]);
  }
  return [...variables].sort((left, right) => left.localeCompare(right));
}

export function createPromptTemplate(input: CreatePromptTemplateInput, clock: PromptTemplateClock): PromptTemplateRecord {
  const timestamp = clock();
  return {
    id: input.id.trim(),
    title: input.title.trim(),
    role: input.role.trim(),
    body: input.body,
    providerProfileId: input.providerProfileId.trim(),
    modelId: input.modelId.trim(),
    escalationPolicyId: input.escalationPolicyId.trim(),
    policyBindings: normalizePolicyBindings(input.policyBindings ?? []),
    variables: extractTemplateVariables(input.body),
    createdAt: timestamp,
    updatedAt: timestamp,
    versions: [],
  };
}

export function createTemplateFromPreset(
  role: PromptTemplateRole,
  options: CreateTemplateFromPresetOptions,
): PromptTemplateRecord {
  const preset = rolePresets.find((item) => item.role === role);
  if (!preset) {
    throw new Error(`Unknown prompt template role preset: ${role}`);
  }

  return createPromptTemplate({
    id: options.id(),
    title: preset.title,
    role: preset.role,
    body: preset.body,
    providerProfileId: options.providerProfileId,
    modelId: options.modelId,
    escalationPolicyId: options.escalationPolicyId,
  }, options.clock);
}

export function updatePromptTemplate(
  template: PromptTemplateRecord,
  changes: UpdatePromptTemplateInput,
  clock: PromptTemplateClock,
): PromptTemplateRecord {
  const timestamp = clock();
  const nextBody = changes.body ?? template.body;
  const bodyChanged = nextBody !== template.body;
  const versions = bodyChanged
    ? [
        ...template.versions,
        {
          body: template.body,
          variables: template.variables,
          createdAt: template.updatedAt,
          supersededAt: timestamp,
        },
      ]
    : template.versions;

  return {
    ...template,
    title: changes.title !== undefined ? changes.title.trim() : template.title,
    role: changes.role !== undefined ? changes.role.trim() : template.role,
    body: nextBody,
    providerProfileId: changes.providerProfileId !== undefined ? changes.providerProfileId.trim() : template.providerProfileId,
    modelId: changes.modelId !== undefined ? changes.modelId.trim() : template.modelId,
    escalationPolicyId: changes.escalationPolicyId !== undefined ? changes.escalationPolicyId.trim() : template.escalationPolicyId,
    policyBindings: changes.policyBindings !== undefined ? normalizePolicyBindings(changes.policyBindings) : template.policyBindings,
    variables: bodyChanged ? extractTemplateVariables(nextBody) : template.variables,
    updatedAt: timestamp,
    versions,
  };
}

export function deletePromptTemplateById(templates: PromptTemplateRecord[], id: string): PromptTemplateRecord[] {
  return templates.filter((template) => template.id !== id);
}

export function validatePromptTemplate(template: PromptTemplateRecord): PromptTemplateValidationIssue[] {
  const issues: PromptTemplateValidationIssue[] = [];

  if (!template.title.trim()) {
    issues.push({ code: 'missing-title', message: 'Template title is required.' });
  }
  if (!promptTemplateRoles.includes(template.role as PromptTemplateRole)) {
    issues.push({
      code: 'invalid-role',
      message: 'Template role must be one of planner, researcher, implementer, reviewer, or operator.',
    });
  }
  if (!template.providerProfileId.trim()) {
    issues.push({ code: 'missing-provider-binding', message: 'Template must bind to a provider profile.' });
  }
  if (!template.modelId.trim()) {
    issues.push({ code: 'missing-model-binding', message: 'Template must bind to a model.' });
  }
  if (!template.escalationPolicyId.trim()) {
    issues.push({ code: 'missing-escalation-policy', message: 'Template must bind to an escalation policy.' });
  }

  const variables = new Set(template.variables);
  for (const binding of template.policyBindings) {
    if (!variables.has(binding)) {
      issues.push({
        code: 'unknown-policy-variable',
        message: `Policy binding references unknown template variable: ${binding}.`,
      });
    }
  }

  return issues;
}

function normalizePolicyBindings(bindings: string[]): string[] {
  return [...new Set(bindings.map((binding) => binding.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
