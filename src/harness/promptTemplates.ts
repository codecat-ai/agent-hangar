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
  requiredToolIds: string[];
  requiredToolNames: string[];
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
  requiredToolIds?: string[];
  requiredToolNames?: string[];
}

export interface UpdatePromptTemplateInput {
  title?: string;
  role?: string;
  body?: string;
  providerProfileId?: string;
  modelId?: string;
  escalationPolicyId?: string;
  policyBindings?: string[];
  requiredToolIds?: string[];
  requiredToolNames?: string[];
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

export interface WorkspaceToolRecord {
  id: string;
  name: string;
  enabled: boolean;
  [metadata: string]: unknown;
}

export interface EscalationPolicyCondition {
  expression?: string;
  variables?: string[];
}

export interface EscalationPolicyRecord {
  id: string;
  name?: string;
  label?: string;
  mode?: string;
  target?: {
    providerProfileId?: string;
    provider?: string;
    modelId?: string;
    model?: string;
    queue?: string;
  };
  providerProfileId?: string;
  provider?: string;
  modelId?: string;
  model?: string;
  queue?: string;
  conditions?: EscalationPolicyCondition[];
}

export type PromptTemplateReportIssueCode =
  | PromptTemplateValidationIssue['code']
  | 'missing-tool'
  | 'disabled-tool'
  | 'duplicate-tool-requirement'
  | 'invalid-escalation-mode'
  | 'missing-escalation-target';

export interface PromptTemplateReportIssue {
  code: PromptTemplateReportIssueCode;
  severity: 'blocking' | 'warning';
  message: string;
  detail?: Record<string, string>;
}

export interface PromptTemplateValidationReport {
  schemaVersion: 'agent-hangar.template-validation.v1';
  template: {
    id: string;
    title: string;
  };
  summary: {
    status: 'valid' | 'blocking';
    blockingIssueCount: number;
    warningIssueCount: number;
    requiredToolCount: number;
    missingToolCount: number;
    disabledToolCount: number;
    unknownPolicyVariableCount: number;
  };
  issues: PromptTemplateReportIssue[];
}

export interface PromptTemplateWorkspaceValidationInput {
  tools?: WorkspaceToolRecord[];
  escalationPolicies?: EscalationPolicyRecord[];
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
    requiredToolIds: normalizeRequirements(input.requiredToolIds ?? []),
    requiredToolNames: normalizeRequirements(input.requiredToolNames ?? []),
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
    requiredToolIds: changes.requiredToolIds !== undefined ? normalizeRequirements(changes.requiredToolIds) : template.requiredToolIds,
    requiredToolNames: changes.requiredToolNames !== undefined ? normalizeRequirements(changes.requiredToolNames) : template.requiredToolNames,
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

export function buildPromptTemplateValidationReport(
  template: PromptTemplateRecord,
  workspace: PromptTemplateWorkspaceValidationInput = {},
): PromptTemplateValidationReport {
  const issues: PromptTemplateReportIssue[] = validatePromptTemplate(template).map((issue) => ({
    code: issue.code,
    severity: 'blocking',
    message: issue.message,
  }));
  const tools = workspace.tools ?? [];
  const toolRequirements = collectToolRequirements(template);

  for (const requirement of toolRequirements.duplicates) {
    issues.push({
      code: 'duplicate-tool-requirement',
      severity: 'warning',
      message: `Tool requirement is duplicated: ${requirement}.`,
      detail: { requirement },
    });
  }

  for (const requirement of toolRequirements.unique) {
    const tool = findToolRequirement(requirement, tools);
    if (!tool) {
      issues.push({
        code: 'missing-tool',
        severity: 'blocking',
        message: `Required tool is not available in this workspace: ${requirement.value}.`,
        detail: { requirement: requirement.value },
      });
      continue;
    }
    if (!tool.enabled) {
      issues.push({
        code: 'disabled-tool',
        severity: 'blocking',
        message: `Required tool is disabled: ${tool.name}.`,
        detail: { toolId: tool.id, toolName: tool.name },
      });
    }
  }

  const escalationPolicy = (workspace.escalationPolicies ?? []).find((policy) => policy.id === template.escalationPolicyId);
  if (template.escalationPolicyId.trim() && !escalationPolicy) {
    issues.push({
      code: 'missing-escalation-policy',
      severity: 'blocking',
      message: `Escalation policy is not available in this workspace: ${template.escalationPolicyId}.`,
      detail: { policyId: template.escalationPolicyId },
    });
  } else if (escalationPolicy) {
    issues.push(...validateEscalationPolicy(escalationPolicy));
    issues.push(...validateEscalationVariables(template, escalationPolicy));
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'blocking').length;
  const warningIssueCount = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    schemaVersion: 'agent-hangar.template-validation.v1',
    template: {
      id: template.id,
      title: template.title,
    },
    summary: {
      status: blockingIssueCount === 0 ? 'valid' : 'blocking',
      blockingIssueCount,
      warningIssueCount,
      requiredToolCount: toolRequirements.unique.length,
      missingToolCount: issues.filter((issue) => issue.code === 'missing-tool').length,
      disabledToolCount: issues.filter((issue) => issue.code === 'disabled-tool').length,
      unknownPolicyVariableCount: issues.filter((issue) => issue.code === 'unknown-policy-variable').length,
    },
    issues,
  };
}

function normalizePolicyBindings(bindings: string[]): string[] {
  return [...new Set(bindings.map((binding) => binding.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function normalizeRequirements(requirements: string[]): string[] {
  return requirements.map((requirement) => requirement.trim()).filter(Boolean);
}

function collectToolRequirements(template: PromptTemplateRecord) {
  const requirements = [
    ...(template.requiredToolIds ?? []).map((value) => ({ kind: 'id' as const, value })),
    ...(template.requiredToolNames ?? []).map((value) => ({ kind: 'name' as const, value })),
  ];
  const seen = new Set<string>();
  const duplicateValues = new Set<string>();
  const unique = [];

  for (const requirement of requirements) {
    const key = `${requirement.kind}:${requirement.value.toLocaleLowerCase()}`;
    if (seen.has(key)) {
      duplicateValues.add(requirement.value);
      continue;
    }
    seen.add(key);
    unique.push(requirement);
  }

  return {
    unique,
    duplicates: [...duplicateValues].sort((left, right) => left.localeCompare(right)),
  };
}

function findToolRequirement(
  requirement: { kind: 'id' | 'name'; value: string },
  tools: WorkspaceToolRecord[],
): WorkspaceToolRecord | undefined {
  const normalized = requirement.value.toLocaleLowerCase();
  return tools.find((tool) => (
    requirement.kind === 'id'
      ? tool.id.toLocaleLowerCase() === normalized
      : tool.name.toLocaleLowerCase() === normalized
  ));
}

function validateEscalationPolicy(policy: EscalationPolicyRecord): PromptTemplateReportIssue[] {
  const issues: PromptTemplateReportIssue[] = [];
  const mode = policy.mode?.trim() ?? '';
  const validModes = ['manual', 'provider', 'queue'];

  if (!validModes.includes(mode)) {
    issues.push({
      code: 'invalid-escalation-mode',
      severity: 'blocking',
      message: `Escalation policy ${policy.id} has invalid mode: ${mode || 'missing'}.`,
      detail: { policyId: policy.id, mode: mode || 'missing' },
    });
    return issues;
  }

  if (mode === 'provider' && (!hasProviderTarget(policy) || !hasModelTarget(policy))) {
    issues.push({
      code: 'missing-escalation-target',
      severity: 'blocking',
      message: `Escalation policy ${policy.id} must define provider/model target fields.`,
      detail: { policyId: policy.id, mode },
    });
  }

  if (mode === 'queue' && !hasQueueTarget(policy)) {
    issues.push({
      code: 'missing-escalation-target',
      severity: 'blocking',
      message: `Escalation policy ${policy.id} must define a queue target.`,
      detail: { policyId: policy.id, mode },
    });
  }

  return issues;
}

function validateEscalationVariables(
  template: PromptTemplateRecord,
  policy: EscalationPolicyRecord,
): PromptTemplateReportIssue[] {
  const declaredVariables = new Set(template.variables);
  const referencedVariables = new Set<string>();

  for (const condition of policy.conditions ?? []) {
    for (const variable of condition.variables ?? []) {
      const normalized = variable.trim();
      if (normalized) {
        referencedVariables.add(normalized);
      }
    }
    for (const variable of extractTemplateVariables(condition.expression ?? '')) {
      referencedVariables.add(variable);
    }
  }

  return [...referencedVariables]
    .filter((variable) => !declaredVariables.has(variable))
    .sort((left, right) => left.localeCompare(right))
    .map((variable) => ({
      code: 'unknown-policy-variable',
      severity: 'blocking',
      message: `Policy binding references unknown template variable: ${variable}.`,
      detail: { variable },
    }));
}

function hasProviderTarget(policy: EscalationPolicyRecord): boolean {
  return Boolean(policy.providerProfileId?.trim() || policy.provider?.trim() || policy.target?.providerProfileId?.trim() || policy.target?.provider?.trim());
}

function hasModelTarget(policy: EscalationPolicyRecord): boolean {
  return Boolean(policy.modelId?.trim() || policy.model?.trim() || policy.target?.modelId?.trim() || policy.target?.model?.trim());
}

function hasQueueTarget(policy: EscalationPolicyRecord): boolean {
  return Boolean(policy.queue?.trim() || policy.target?.queue?.trim());
}
