import {
  buildAuditHistoryPreview,
  buildCollaborationTriageView,
  type CollaborationInboxRecord,
} from './collaborationAudit';
import { type DemoWorkspaceScenario } from './demoWorkspace';
import {
  buildExecutionGraphSummary,
  validateExecutionGraph,
  type ExecutionGraph,
  type ExecutionGraphSummary,
} from './executionGraph';
import { type NormalizedModel } from './providerCatalog';
import { toProviderCard, type ProviderProfile } from './providerProfiles';
import {
  buildPromptTemplateValidationReport,
  type EscalationPolicyRecord,
  type PromptTemplateRecord,
  type PromptTemplateValidationReport,
  type WorkspaceToolRecord,
} from './promptTemplates';

export interface WorkspaceManifestPreviewInput {
  manifest?: unknown;
  workspaceId?: string;
  providerProfiles?: ProviderProfile[];
  modelsByProvider?: Record<string, NormalizedModel[]>;
  promptTemplates?: PromptTemplateRecord[];
  workspaceTools?: WorkspaceToolRecord[];
  escalationPolicies?: EscalationPolicyRecord[];
  scenario?: DemoWorkspaceScenario;
  graph?: ExecutionGraph;
  collaborationItems?: CollaborationInboxRecord[];
}

export interface WorkspaceManifestProviderInventory {
  id: string;
  kind: string;
  displayName: string;
  keyConfigured: boolean;
  modelCount: number;
  modelIds: string[];
}

export type WorkspaceManifestBlockerCode =
  | 'malformed-manifest-input'
  | 'unsupported-manifest-schema'
  | 'missing-provider-binding'
  | 'disabled-tool'
  | 'missing-tool'
  | 'missing-escalation-policy'
  | 'graph-validation-issue'
  | 'unresolved-escalation'
  | 'high-priority-collaboration';

export interface WorkspaceManifestBlocker {
  code: WorkspaceManifestBlockerCode;
  severity: 'blocking';
  source: 'manifest' | 'provider' | 'template' | 'graph' | 'collaboration';
  message: string;
  detail?: Record<string, string>;
}

export interface WorkspaceManifestPreview {
  schemaVersion: 'agent-hangar.workspace-manifest-preview.v1';
  source: {
    mode: 'source-checkout-only';
    workspaceId: string;
    scenarioId?: string;
  };
  summary: {
    status: 'portable' | 'blocked';
    blockerCount: number;
  };
  providers: {
    total: number;
    configured: number;
    missingBindingIds: string[];
    inventories: WorkspaceManifestProviderInventory[];
  };
  templates: {
    summary: {
      total: number;
      blockingIssueCount: number;
      warningIssueCount: number;
      missingToolCount: number;
      disabledToolCount: number;
    };
    reports: PromptTemplateValidationReport[];
  };
  scenario?: {
    id: string;
    label: string;
    workspaceId: string;
  };
  execution: {
    graphAvailable: boolean;
    trailAvailable: boolean;
    evidenceAvailable: boolean;
    graphSummary?: ExecutionGraphSummary;
  };
  collaboration: {
    itemCount: number;
    unresolvedEscalationCount: number;
    highPriorityUnresolvedCount: number;
    nextActionHints: string[];
  };
  portabilityNotes: string[];
  blockers: WorkspaceManifestBlocker[];
  markdown: string;
}

export type WorkspaceManifestPreviewValidationIssueCode =
  | 'malformed-preview'
  | 'unsupported-schema-version'
  | 'missing-markdown'
  | 'missing-source';

export interface WorkspaceManifestPreviewValidationIssue {
  code: WorkspaceManifestPreviewValidationIssueCode;
  severity: 'blocking';
  field: string;
  message: string;
}

export interface WorkspaceManifestPreviewValidationResult {
  schemaVersion: 'agent-hangar.workspace-manifest-preview-validation.v1';
  issues: WorkspaceManifestPreviewValidationIssue[];
}

const SCHEMA_VERSION = 'agent-hangar.workspace-manifest-preview.v1';
const VALIDATION_SCHEMA_VERSION = 'agent-hangar.workspace-manifest-preview-validation.v1';
const TEXT_LIMIT = 140;

export function buildWorkspaceManifestPreview(input: WorkspaceManifestPreviewInput): WorkspaceManifestPreview {
  const graph = input.graph ?? input.scenario?.seed.graph;
  const collaborationItems = input.collaborationItems ?? input.scenario?.seed.collaborationItems ?? [];
  const providerProfiles = [...(input.providerProfiles ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  const templates = [...(input.promptTemplates ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  const providerIds = new Set(providerProfiles.map((profile) => profile.id));
  const referencedProviderIds = collectProviderBindings(templates, graph);
  const missingBindingIds = [...referencedProviderIds].filter((id) => !providerIds.has(id)).sort((left, right) => left.localeCompare(right));
  const templateReports = templates.map((template) => buildPromptTemplateValidationReport(template, {
    tools: input.workspaceTools ?? [],
    escalationPolicies: input.escalationPolicies ?? [],
  }));
  const graphIssues = graph ? validateExecutionGraph(graph) : [];
  const graphSummary = graph ? buildExecutionGraphSummary(graph) : undefined;
  const triage = buildCollaborationTriageView(collaborationItems);
  const auditPreview = buildAuditHistoryPreview({
    auditEntries: input.scenario?.seed.auditEntries ?? [],
    collaborationItems: triage.rows,
  });
  const blockers = [
    ...validateManifestInput(input.manifest),
    ...missingBindingIds.map((providerId): WorkspaceManifestBlocker => ({
      code: 'missing-provider-binding',
      severity: 'blocking',
      source: 'provider',
      message: `Provider binding ${providerId} is referenced but not available in this source checkout.`,
      detail: { providerId },
    })),
    ...templateReports.flatMap(templateReportToBlockers),
    ...graphIssues.map((issue): WorkspaceManifestBlocker => ({
      code: 'graph-validation-issue',
      severity: 'blocking',
      source: 'graph',
      message: issue.message,
      detail: {
        code: issue.code,
        ...(issue.nodeId ? { nodeId: issue.nodeId } : {}),
        ...(issue.edgeId ? { edgeId: issue.edgeId } : {}),
      },
    })),
    ...(triage.compact.unresolvedEscalationCount > 0 ? [{
      code: 'unresolved-escalation' as const,
      severity: 'blocking' as const,
      source: 'collaboration' as const,
      message: `${triage.compact.unresolvedEscalationCount} unresolved escalation${triage.compact.unresolvedEscalationCount === 1 ? '' : 's'} must be resolved before portable handoff.`,
    }] : []),
    ...(triage.compact.highPriorityUnresolvedCount > 0 ? [{
      code: 'high-priority-collaboration' as const,
      severity: 'blocking' as const,
      source: 'collaboration' as const,
      message: `${triage.compact.highPriorityUnresolvedCount} high-priority collaboration item${triage.compact.highPriorityUnresolvedCount === 1 ? '' : 's'} must be resolved before portable handoff.`,
    }] : []),
  ];
  const providerInventories = providerProfiles.map((profile) => {
    const models = [...(input.modelsByProvider?.[profile.id] ?? [])].sort((left, right) => left.id.localeCompare(right.id));
    const card = toProviderCard(profile, models);
    return {
      id: safeText(card.id, TEXT_LIMIT),
      kind: safeText(card.kind, TEXT_LIMIT),
      displayName: safeText(card.displayName, TEXT_LIMIT),
      keyConfigured: card.apiKeyConfigured,
      modelCount: card.modelCount,
      modelIds: models.map((model) => safeText(model.id, TEXT_LIMIT)),
    };
  });
  const preview: Omit<WorkspaceManifestPreview, 'markdown'> = {
    schemaVersion: SCHEMA_VERSION,
    source: {
      mode: 'source-checkout-only',
      workspaceId: safeText(input.workspaceId ?? input.scenario?.seed.workspaceId ?? graph?.workspaceId ?? 'workspace-local', TEXT_LIMIT),
      scenarioId: input.scenario ? safeText(input.scenario.id, TEXT_LIMIT) : undefined,
    },
    summary: {
      status: blockers.length > 0 ? 'blocked' : 'portable',
      blockerCount: blockers.length,
    },
    providers: {
      total: providerInventories.length,
      configured: providerInventories.filter((provider) => provider.keyConfigured).length,
      missingBindingIds: missingBindingIds.map((id) => safeText(id, TEXT_LIMIT)),
      inventories: providerInventories,
    },
    templates: {
      summary: summarizeTemplateReports(templateReports),
      reports: templateReports,
    },
    ...(input.scenario ? {
      scenario: {
        id: safeText(input.scenario.id, TEXT_LIMIT),
        label: safeText(input.scenario.label, TEXT_LIMIT),
        workspaceId: safeText(input.scenario.seed.workspaceId, TEXT_LIMIT),
      },
    } : {}),
    execution: {
      graphAvailable: Boolean(graph),
      trailAvailable: Boolean(input.scenario?.seed.trail),
      evidenceAvailable: Boolean(input.scenario?.seed.trail),
      ...(graphSummary ? { graphSummary } : {}),
    },
    collaboration: {
      itemCount: triage.rows.length,
      unresolvedEscalationCount: triage.compact.unresolvedEscalationCount,
      highPriorityUnresolvedCount: triage.compact.highPriorityUnresolvedCount,
      nextActionHints: auditPreview.nextActionHints.map((hint) => safeText(hint, TEXT_LIMIT * 2)),
    },
    portabilityNotes: [
      'Source checkout only: recreate this workspace from local files and configured desktop state, not npm/npx/package registry commands.',
      'Provider credentials are represented only as configured/missing status; raw keys and encrypted key material are omitted.',
      'Preview generation is deterministic and does not call providers, package registries, shells, networks, or Tauri APIs.',
    ],
    blockers: blockers.map(sanitizeBlocker).sort(compareBlockers),
  };
  const sanitizedPreview = deepSanitize(preview) as Omit<WorkspaceManifestPreview, 'markdown'>;

  return {
    ...sanitizedPreview,
    markdown: redactSecretLikeMarkdown(renderMarkdown(sanitizedPreview)),
  };
}

export function validateWorkspaceManifestPreview(preview: unknown): WorkspaceManifestPreviewValidationResult {
  if (!isRecord(preview)) {
    return {
      schemaVersion: VALIDATION_SCHEMA_VERSION,
      issues: [validationIssue('malformed-preview', 'preview', 'Workspace manifest preview must be an object.')],
    };
  }

  const issues: WorkspaceManifestPreviewValidationIssue[] = [];
  if (preview.schemaVersion !== SCHEMA_VERSION) {
    issues.push(validationIssue('unsupported-schema-version', 'schemaVersion', 'Workspace manifest preview uses an unsupported schema version.'));
  }
  if (preview.schemaVersion === SCHEMA_VERSION && !isRecord(preview.source)) {
    issues.push(validationIssue('missing-source', 'source', 'Workspace manifest preview must include source metadata.'));
  }
  if (typeof preview.markdown !== 'string' || !preview.markdown.trim()) {
    issues.push(validationIssue('missing-markdown', 'markdown', 'Workspace manifest preview must include Markdown preview text.'));
  }

  return {
    schemaVersion: VALIDATION_SCHEMA_VERSION,
    issues,
  };
}

function validateManifestInput(manifest: unknown): WorkspaceManifestBlocker[] {
  if (manifest === undefined) {
    return [];
  }
  if (!isRecord(manifest)) {
    return [{
      code: 'malformed-manifest-input',
      severity: 'blocking',
      source: 'manifest',
      message: 'Workspace manifest input must be an object when provided.',
    }];
  }
  if (manifest.schemaVersion !== undefined && manifest.schemaVersion !== SCHEMA_VERSION) {
    return [{
      code: 'unsupported-manifest-schema',
      severity: 'blocking',
      source: 'manifest',
      message: 'Workspace manifest input uses an unsupported schema version.',
    }];
  }
  return [];
}

function collectProviderBindings(templates: PromptTemplateRecord[], graph?: ExecutionGraph): Set<string> {
  const providerIds = new Set<string>();
  for (const template of templates) {
    if (template.providerProfileId.trim()) {
      providerIds.add(template.providerProfileId.trim());
    }
  }
  for (const node of graph?.nodes ?? []) {
    if (node.templateBinding.providerProfileId.trim()) {
      providerIds.add(node.templateBinding.providerProfileId.trim());
    }
  }
  return providerIds;
}

function templateReportToBlockers(report: PromptTemplateValidationReport): WorkspaceManifestBlocker[] {
  return report.issues
    .filter((issue) => issue.severity === 'blocking')
    .filter((issue) => issue.code === 'disabled-tool' || issue.code === 'missing-tool' || issue.code === 'missing-escalation-policy')
    .map((issue): WorkspaceManifestBlocker => ({
      code: toTemplateBlockerCode(issue.code),
      severity: 'blocking',
      source: 'template',
      message: issue.message,
      detail: {
        templateId: report.template.id,
        ...Object.fromEntries(Object.entries(issue.detail ?? {}).map(([key, value]) => [key, String(value)])),
      },
    }));
}

function toTemplateBlockerCode(code: string): 'disabled-tool' | 'missing-tool' | 'missing-escalation-policy' {
  if (code === 'disabled-tool' || code === 'missing-tool' || code === 'missing-escalation-policy') {
    return code;
  }
  throw new Error(`Unsupported template portability blocker code: ${code}`);
}

function summarizeTemplateReports(reports: PromptTemplateValidationReport[]): WorkspaceManifestPreview['templates']['summary'] {
  return {
    total: reports.length,
    blockingIssueCount: reports.reduce((sum, report) => sum + report.summary.blockingIssueCount, 0),
    warningIssueCount: reports.reduce((sum, report) => sum + report.summary.warningIssueCount, 0),
    missingToolCount: reports.reduce((sum, report) => sum + report.summary.missingToolCount, 0),
    disabledToolCount: reports.reduce((sum, report) => sum + report.summary.disabledToolCount, 0),
  };
}

function renderMarkdown(preview: Omit<WorkspaceManifestPreview, 'markdown'>): string {
  return `---
schemaVersion: ${preview.schemaVersion}
workspaceId: ${preview.source.workspaceId}
sourceMode: ${preview.source.mode}
---

# Workspace Portability Manifest Preview

## Source
- Source mode: ${preview.source.mode}
- Workspace: ${preview.source.workspaceId}
- Scenario: ${preview.source.scenarioId ?? 'None'}
- Status: ${preview.summary.status}
- Blockers: ${preview.summary.blockerCount}

## Providers
- Provider inventories: ${preview.providers.total}
- Configured providers: ${preview.providers.configured}
- Missing provider bindings: ${preview.providers.missingBindingIds.length > 0 ? preview.providers.missingBindingIds.join(', ') : 'None'}
${preview.providers.inventories.length > 0 ? preview.providers.inventories.map(renderProvider).join('\n') : '- None'}

## Templates
- Templates: ${preview.templates.summary.total}
- Template blocking issues: ${preview.templates.summary.blockingIssueCount}
- Missing tools: ${preview.templates.summary.missingToolCount}
- Disabled tools: ${preview.templates.summary.disabledToolCount}

## Execution And Evidence
- Graph available: ${preview.execution.graphAvailable ? 'yes' : 'no'}
- Trail available: ${preview.execution.trailAvailable ? 'yes' : 'no'}
- Evidence available: ${preview.execution.evidenceAvailable ? 'yes' : 'no'}
- Graph nodes: ${preview.execution.graphSummary?.nodeCount ?? 0}
- Graph edges: ${preview.execution.graphSummary?.edgeCount ?? 0}

## Collaboration
- Items: ${preview.collaboration.itemCount}
- Unresolved escalations: ${preview.collaboration.unresolvedEscalationCount}
- High-priority unresolved: ${preview.collaboration.highPriorityUnresolvedCount}
${preview.collaboration.nextActionHints.map((hint) => `- ${hint}`).join('\n')}

## Portability Notes
${preview.portabilityNotes.map((note) => `- ${note}`).join('\n')}

## Blockers
${preview.blockers.length > 0 ? preview.blockers.map(renderBlocker).join('\n') : '- None'}
`;
}

function renderProvider(provider: WorkspaceManifestProviderInventory): string {
  return `- ${provider.id} | ${provider.kind} | ${provider.displayName} | key: ${provider.keyConfigured ? 'configured' : 'missing'} | models: ${provider.modelCount}`;
}

function renderBlocker(blocker: WorkspaceManifestBlocker): string {
  return `- ${blocker.code} | ${blocker.severity} | ${blocker.message}`;
}

function sanitizeBlocker(blocker: WorkspaceManifestBlocker): WorkspaceManifestBlocker {
  return {
    code: blocker.code,
    severity: blocker.severity,
    source: blocker.source,
    message: safeText(blocker.message, TEXT_LIMIT * 2),
    ...(blocker.detail ? {
      detail: Object.fromEntries(Object.entries(blocker.detail).map(([key, value]) => [key, safeText(value, TEXT_LIMIT)])),
    } : {}),
  };
}

function compareBlockers(left: WorkspaceManifestBlocker, right: WorkspaceManifestBlocker): number {
  const order: WorkspaceManifestBlockerCode[] = [
    'malformed-manifest-input',
    'unsupported-manifest-schema',
    'missing-provider-binding',
    'disabled-tool',
    'missing-tool',
    'missing-escalation-policy',
    'graph-validation-issue',
    'unresolved-escalation',
    'high-priority-collaboration',
  ];
  return order.indexOf(left.code) - order.indexOf(right.code)
    || left.source.localeCompare(right.source)
    || left.message.localeCompare(right.message);
}

function validationIssue(
  code: WorkspaceManifestPreviewValidationIssueCode,
  field: string,
  message: string,
): WorkspaceManifestPreviewValidationIssue {
  return { code, severity: 'blocking', field, message };
}

function deepSanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return safeText(value, Number.POSITIVE_INFINITY);
  }
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/^(encryptedApiKey|apiKey|encryptedKeyMaterial)$/i.test(key))
        .map(([key, entry]) => [key, deepSanitize(entry)]),
    );
  }
  return value;
}

function safeText(value: string, limit: number): string {
  return truncate(escapeMarkdown(redactSecretLikeText(value)), limit);
}

function redactSecretLikeText(value: string): string {
  return value
    .trim()
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedApiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, '[redacted]')
    .replace(/\b(?:sk|sk-ant|sk-proj)-[A-Za-z0-9._-]+/g, '[redacted]')
    .replace(/\bAPI\s+token\s+\S+/gi, '[redacted]')
    .replace(/\bsecret(?:\s*[:=]\s*\S+)?/gi, '[redacted]')
    .replace(/\bprivate\s+note\b/gi, '[redacted]')
    .replace(/\bexample\s+customer\b/gi, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]')
    .replace(/\s+/g, ' ');
}

function redactSecretLikeMarkdown(value: string): string {
  return value
    .trim()
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedApiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, '[redacted]')
    .replace(/\b(?:sk|sk-ant|sk-proj)-[A-Za-z0-9._-]+/g, '[redacted]')
    .replace(/\bAPI\s+token\s+\S+/gi, '[redacted]')
    .replace(/\bsecret(?:\s*[:=]\s*\S+)?/gi, '[redacted]')
    .replace(/\bprivate\s+note\b/gi, '[redacted]')
    .replace(/\bexample\s+customer\b/gi, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]');
}

function escapeMarkdown(value: string): string {
  return value.replace(/(?<!\\)([|`])/g, '\\$1');
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
