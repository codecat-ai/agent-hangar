import { type AuditHistoryPreview, type CollaborationTriageView } from './collaborationAudit';
import { type DemoWorkspaceScenario } from './demoWorkspace';
import { type ProviderDiscoveryDryRunSummary } from './providerDiscoveryDryRun';
import { type PromptTemplateValidationReport } from './promptTemplates';
import { type RunEvidenceExportPreview } from './runEvidenceExport';
import { type ScenarioEvidenceBundlePreview } from './scenarioEvidenceBundle';
import { type WorkspaceImportExportDryRun } from './workspaceImportExportDryRun';
import { type WorkspaceManifestPreview } from './workspaceManifestPreview';

export type SourceCheckoutWalkthroughStepId =
  | 'provider-readiness'
  | 'template-validation'
  | 'demo-scenario'
  | 'execution-evidence'
  | 'collaboration-triage'
  | 'workspace-portability'
  | 'import-export-dry-run';

export type SourceCheckoutWalkthroughStatus = 'ready' | 'warning' | 'blocked';
export type SourceCheckoutWalkthroughSeverity = 'success' | 'info' | 'warning' | 'blocking';

export interface SourceCheckoutWalkthroughAdapterGate {
  schemaVersion?: unknown;
  status?: unknown;
  severity?: unknown;
  issueCount?: unknown;
  nextActions?: unknown;
}

export interface SourceCheckoutOperatorWalkthroughInput {
  scenario?: DemoWorkspaceScenario;
  providerProfileCount?: number;
  discoveryDryRunSummary?: ProviderDiscoveryDryRunSummary;
  adapterShellResults?: SourceCheckoutWalkthroughAdapterGate[];
  templateReports?: PromptTemplateValidationReport[];
  runEvidence?: RunEvidenceExportPreview;
  scenarioEvidenceBundle?: ScenarioEvidenceBundlePreview;
  collaborationTriage?: CollaborationTriageView;
  auditHistoryPreview?: AuditHistoryPreview;
  workspaceManifestPreview?: WorkspaceManifestPreview;
  workspaceDryRun?: WorkspaceImportExportDryRun;
}

export interface SourceCheckoutWalkthroughBlocker {
  stepId: SourceCheckoutWalkthroughStepId;
  severity: 'blocking';
  message: string;
}

export interface SourceCheckoutWalkthroughStep {
  id: SourceCheckoutWalkthroughStepId;
  label: string;
  status: SourceCheckoutWalkthroughStatus;
  severity: SourceCheckoutWalkthroughSeverity;
  summary: string;
  blockers: string[];
  nextActions: string[];
}

export interface SourceCheckoutOperatorWalkthrough {
  schemaVersion: 'agent-hangar.source-checkout-operator-walkthrough.v1';
  source: {
    mode: 'source-checkout-only';
    workspaceId: string;
    scenarioId?: string;
  };
  summary: {
    status: SourceCheckoutWalkthroughStatus;
    stepCount: number;
    statusCounts: Partial<Record<SourceCheckoutWalkthroughStatus, number>>;
    severityCounts: Partial<Record<SourceCheckoutWalkthroughSeverity, number>>;
    blockerCount: number;
  };
  steps: SourceCheckoutWalkthroughStep[];
  blockers: SourceCheckoutWalkthroughBlocker[];
  nextActions: string[];
  markdown: string;
}

export interface SourceCheckoutWalkthroughSummary {
  schemaVersion: 'agent-hangar.source-checkout-operator-walkthrough-summary.v1';
  status: SourceCheckoutWalkthroughStatus;
  stepCount: number;
  readyCount: number;
  blockedCount: number;
  warningCount: number;
  blockerCount: number;
  nextActionCount: number;
}

const SCHEMA_VERSION = 'agent-hangar.source-checkout-operator-walkthrough.v1';
const SUMMARY_SCHEMA_VERSION = 'agent-hangar.source-checkout-operator-walkthrough-summary.v1';
const TEXT_LIMIT = 220;
const STEP_ORDER: SourceCheckoutWalkthroughStepId[] = [
  'provider-readiness',
  'template-validation',
  'demo-scenario',
  'execution-evidence',
  'collaboration-triage',
  'workspace-portability',
  'import-export-dry-run',
];

export function buildSourceCheckoutOperatorWalkthrough(
  input: SourceCheckoutOperatorWalkthroughInput,
): SourceCheckoutOperatorWalkthrough {
  const steps = [
    buildProviderStep(input),
    buildTemplateStep(input),
    buildScenarioStep(input),
    buildExecutionStep(input),
    buildCollaborationStep(input),
    buildPortabilityStep(input),
    buildDryRunStep(input),
  ].map(sanitizeStep).sort((left, right) => STEP_ORDER.indexOf(left.id) - STEP_ORDER.indexOf(right.id));
  const blockers = steps
    .flatMap((step) => step.blockers.map((message): SourceCheckoutWalkthroughBlocker => ({
      stepId: step.id,
      severity: 'blocking',
      message,
    })));
  const nextActions = uniqueOrdered(steps.flatMap((step) => step.nextActions.map((action) => safeText(action))));
  const summary = {
    status: blockers.length > 0 ? 'blocked' as const : steps.some((step) => step.status === 'warning') ? 'warning' as const : 'ready' as const,
    stepCount: steps.length,
    statusCounts: countBy(steps, ['ready', 'warning', 'blocked'], (step) => step.status),
    severityCounts: countBy(steps, ['success', 'info', 'warning', 'blocking'], (step) => step.severity),
    blockerCount: blockers.length,
  };
  const preview: Omit<SourceCheckoutOperatorWalkthrough, 'markdown'> = {
    schemaVersion: SCHEMA_VERSION,
    source: {
      mode: 'source-checkout-only',
      workspaceId: safeText(
        input.workspaceManifestPreview?.source.workspaceId
          ?? input.workspaceDryRun?.source.workspaceId
          ?? input.scenario?.seed.workspaceId
          ?? 'workspace-local',
      ),
      scenarioId: optionalSafeText(
        input.workspaceManifestPreview?.source.scenarioId
          ?? input.workspaceDryRun?.source.scenarioId
          ?? input.scenario?.id,
      ),
    },
    summary,
    steps,
    blockers,
    nextActions,
  };
  const sanitized = deepSanitize(preview) as Omit<SourceCheckoutOperatorWalkthrough, 'markdown'>;

  return {
    ...sanitized,
    markdown: redactSecretLikeMarkdown(renderMarkdown(sanitized)),
  };
}

export function summarizeSourceCheckoutWalkthrough(
  walkthrough: SourceCheckoutOperatorWalkthrough,
): SourceCheckoutWalkthroughSummary {
  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    status: walkthrough.summary.status,
    stepCount: walkthrough.summary.stepCount,
    readyCount: walkthrough.summary.statusCounts.ready ?? 0,
    blockedCount: walkthrough.summary.statusCounts.blocked ?? 0,
    warningCount: walkthrough.summary.statusCounts.warning ?? 0,
    blockerCount: walkthrough.summary.blockerCount,
    nextActionCount: walkthrough.nextActions.length,
  };
}

function buildProviderStep(input: SourceCheckoutOperatorWalkthroughInput): SourceCheckoutWalkthroughStep {
  const providerProfileCount = input.providerProfileCount ?? 0;
  const discovery = input.discoveryDryRunSummary;
  const adapterResults = input.adapterShellResults ?? [];
  const discoveryProblems = (discovery?.countsBySeverity.warning ?? 0) + (discovery?.countsBySeverity.error ?? 0);
  const adapterIssues = adapterResults.reduce((total, result) => total + numberValue(result.issueCount), 0);
  const blockers: string[] = [];
  const nextActions: string[] = [];

  if (providerProfileCount === 0) {
    blockers.push('No local provider profile is available for source-checkout review.');
    nextActions.push('Add at least one local provider profile before reviewing source-checkout readiness.');
  }
  if (!discovery) {
    nextActions.push('Add local discovery dry-run preview data before treating provider readiness as reviewed.');
  } else {
    nextActions.push(...discovery.nextActions);
  }
  for (const result of adapterResults) {
    if (Array.isArray(result.nextActions)) {
      nextActions.push(...result.nextActions.filter((action): action is string => typeof action === 'string'));
    }
  }

  return {
    id: 'provider-readiness',
    label: 'Provider profiles and discovery gate',
    status: blockers.length > 0 ? 'blocked' : !discovery || discoveryProblems > 0 || adapterIssues > 0 ? 'warning' : 'ready',
    severity: blockers.length > 0 ? 'blocking' : !discovery || discoveryProblems > 0 || adapterIssues > 0 ? 'warning' : 'success',
    summary: `${providerProfileCount} provider ${providerProfileCount === 1 ? 'profile' : 'profiles'}; ${discovery?.providerCount ?? 0} discovery dry-run ${discovery?.providerCount === 1 ? 'provider' : 'providers'}; ${adapterIssues} adapter shell ${adapterIssues === 1 ? 'issue' : 'issues'}.`,
    blockers,
    nextActions,
  };
}

function buildTemplateStep(input: SourceCheckoutOperatorWalkthroughInput): SourceCheckoutWalkthroughStep {
  const reports = input.templateReports ?? [];
  const blockingCount = reports.reduce((total, report) => total + report.summary.blockingIssueCount, 0);
  const warningCount = reports.reduce((total, report) => total + report.summary.warningIssueCount, 0);
  const blockers = reports
    .flatMap((report) => report.issues.filter((issue) => issue.severity === 'blocking').map((issue) => issue.message));

  return {
    id: 'template-validation',
    label: 'Template validation',
    status: blockingCount > 0 ? 'blocked' : reports.length === 0 || warningCount > 0 ? 'warning' : 'ready',
    severity: blockingCount > 0 ? 'blocking' : reports.length === 0 || warningCount > 0 ? 'warning' : 'success',
    summary: `${reports.length} template ${reports.length === 1 ? 'report' : 'reports'}; ${blockingCount} blocking; ${warningCount} warning.`,
    blockers,
    nextActions: reports.length === 0
      ? ['Validate local prompt templates before treating the walkthrough as complete.']
      : blockingCount > 0
        ? ['Resolve blocking template validation issues before handoff.']
        : warningCount > 0
          ? ['Review template warnings before handoff.']
          : ['Template validation is ready for source-checkout review.'],
  };
}

function buildScenarioStep(input: SourceCheckoutOperatorWalkthroughInput): SourceCheckoutWalkthroughStep {
  const scenario = input.scenario;
  return {
    id: 'demo-scenario',
    label: 'Demo scenario selection',
    status: scenario ? 'ready' : 'warning',
    severity: scenario ? 'success' : 'warning',
    summary: scenario
      ? `${scenario.label} (${scenario.id}) uses workspace ${scenario.seed.workspaceId}.`
      : 'No local demo scenario is selected.',
    blockers: [],
    nextActions: scenario
      ? ['Review the selected local scenario before copying walkthrough Markdown.']
      : ['Select a local demo scenario to connect graph, evidence, collaboration, and portability previews.'],
  };
}

function buildExecutionStep(input: SourceCheckoutOperatorWalkthroughInput): SourceCheckoutWalkthroughStep {
  const runEvidence = input.runEvidence;
  const scenarioBundle = input.scenarioEvidenceBundle;
  const missing = [
    ...(runEvidence ? [] : ['run evidence export']),
    ...(scenarioBundle ? [] : ['scenario evidence bundle']),
  ];
  return {
    id: 'execution-evidence',
    label: 'Execution evidence',
    status: missing.length > 0 ? 'warning' : 'ready',
    severity: missing.length > 0 ? 'warning' : 'success',
    summary: runEvidence
      ? `${runEvidence.counts.events} local execution ${runEvidence.counts.events === 1 ? 'event' : 'events'}; ${runEvidence.issues.length} issue ${runEvidence.issues.length === 1 ? 'record' : 'records'}.`
      : 'No run evidence export is attached.',
    blockers: [],
    nextActions: missing.length > 0
      ? [`Attach ${missing.join(' and ')} before source-checkout handoff.`]
      : ['Execution evidence and scenario bundle are ready for review.'],
  };
}

function buildCollaborationStep(input: SourceCheckoutOperatorWalkthroughInput): SourceCheckoutWalkthroughStep {
  const triage = input.collaborationTriage;
  const audit = input.auditHistoryPreview;
  const unresolvedEscalations = triage?.compact.unresolvedEscalationCount ?? audit?.counts.unresolvedEscalations ?? 0;
  const highPriority = triage?.compact.highPriorityUnresolvedCount ?? 0;
  const blockers = [
    ...(unresolvedEscalations > 0 ? [`${unresolvedEscalations} unresolved escalation ${unresolvedEscalations === 1 ? 'requires' : 'require'} operator triage.`] : []),
    ...(highPriority > 0 ? [`${highPriority} high-priority unresolved collaboration ${highPriority === 1 ? 'item requires' : 'items require'} review.`] : []),
  ];

  return {
    id: 'collaboration-triage',
    label: 'Collaboration triage and audit',
    status: blockers.length > 0 ? 'blocked' : !triage || !audit ? 'warning' : 'ready',
    severity: blockers.length > 0 ? 'blocking' : !triage || !audit ? 'warning' : 'success',
    summary: `${triage?.compact.visibleCount ?? 0} visible collaboration ${triage?.compact.visibleCount === 1 ? 'item' : 'items'}; ${audit?.counts.auditEntries ?? 0} audit ${audit?.counts.auditEntries === 1 ? 'entry' : 'entries'}.`,
    blockers,
    nextActions: blockers.length > 0
      ? [...(triage?.compact.nextActionHints ?? audit?.nextActionHints ?? [])]
      : !triage || !audit
        ? ['Attach collaboration triage and audit-history previews before handoff.']
        : ['Collaboration triage and audit preview are ready.'],
  };
}

function buildPortabilityStep(input: SourceCheckoutOperatorWalkthroughInput): SourceCheckoutWalkthroughStep {
  const manifest = input.workspaceManifestPreview;
  const blockers = manifest?.blockers.map((blocker) => blocker.message) ?? [];
  return {
    id: 'workspace-portability',
    label: 'Workspace portability manifest',
    status: !manifest ? 'warning' : manifest.summary.status === 'blocked' ? 'blocked' : 'ready',
    severity: !manifest ? 'warning' : manifest.summary.status === 'blocked' ? 'blocking' : 'success',
    summary: manifest
      ? `${manifest.summary.status}; ${manifest.providers.total} provider ${manifest.providers.total === 1 ? 'inventory' : 'inventories'}; ${manifest.templates.summary.total} template ${manifest.templates.summary.total === 1 ? 'report' : 'reports'}.`
      : 'No workspace portability manifest preview is attached.',
    blockers,
    nextActions: blockers.length > 0
      ? ['Resolve workspace portability blockers before source-checkout handoff.']
      : manifest
        ? ['Workspace portability manifest is ready for source-checkout review.']
        : ['Generate a workspace portability manifest preview before handoff.'],
  };
}

function buildDryRunStep(input: SourceCheckoutOperatorWalkthroughInput): SourceCheckoutWalkthroughStep {
  const dryRun = input.workspaceDryRun;
  const blockers = dryRun?.blockers.map((blocker) => blocker.message) ?? [];
  return {
    id: 'import-export-dry-run',
    label: 'Import/export dry run',
    status: !dryRun ? 'warning' : dryRun.summary.status === 'blocked' ? 'blocked' : 'ready',
    severity: !dryRun ? 'warning' : dryRun.summary.status === 'blocked' ? 'blocking' : 'success',
    summary: dryRun
      ? `${dryRun.mode} dry run ${dryRun.summary.status}; ${dryRun.summary.acceptedFileCount} accepted; ${dryRun.summary.rejectedFileCount} rejected; ${dryRun.summary.missingFileCount} missing.`
      : 'No import/export dry-run report is attached.',
    blockers,
    nextActions: blockers.length > 0
      ? ['Resolve import/export dry-run blockers before handoff.']
      : dryRun
        ? ['Import/export dry run is ready for source-checkout review.']
        : ['Generate an import/export dry-run report before handoff.'],
  };
}

function sanitizeStep(step: SourceCheckoutWalkthroughStep): SourceCheckoutWalkthroughStep {
  return {
    ...step,
    label: safeText(step.label),
    summary: safeText(step.summary, TEXT_LIMIT * 2),
    blockers: uniqueOrdered(step.blockers.map((blocker) => safeText(blocker))),
    nextActions: uniqueOrdered(step.nextActions.map((action) => safeText(action))),
  };
}

function renderMarkdown(walkthrough: Omit<SourceCheckoutOperatorWalkthrough, 'markdown'>): string {
  const blockers = walkthrough.blockers.length > 0
    ? walkthrough.blockers.map((blocker) => `- ${blocker.stepId}: ${escapeMarkdown(blocker.message)}`).join('\n')
    : '- None';
  const nextActions = walkthrough.nextActions.length > 0
    ? walkthrough.nextActions.map((action) => `- ${escapeMarkdown(action)}`).join('\n')
    : '- None';
  const stepRows = walkthrough.steps.map((step) => (
    `| ${escapeMarkdown(step.id)} | ${escapeMarkdown(step.label)} | ${step.status} | ${step.severity} | ${escapeMarkdown(step.summary)} |`
  )).join('\n');

  return `# Source Checkout Operator Walkthrough

schemaVersion: ${walkthrough.schemaVersion}
sourceMode: ${walkthrough.source.mode}
workspaceId: ${escapeMarkdown(walkthrough.source.workspaceId)}
scenarioId: ${escapeMarkdown(walkthrough.source.scenarioId ?? 'not selected')}

## Summary
- Source mode: ${walkthrough.source.mode}
- Status: ${walkthrough.summary.status}
- Steps: ${walkthrough.summary.stepCount}
- Blockers: ${walkthrough.summary.blockerCount}
- Provider, network, shell, package registry, and Tauri calls: not used

## Steps
| Step | Label | Status | Severity | Summary |
| --- | --- | --- | --- | --- |
${stepRows}

## Blockers
${blockers}

## Next Actions
${nextActions}
`;
}

function deepSanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepSanitize(child)]));
  }
  if (typeof value === 'string') {
    return safeText(value, TEXT_LIMIT * 3);
  }
  return value;
}

function safeText(value: unknown, limit = TEXT_LIMIT): string {
  const redacted = redactSecretLikeText(String(value ?? 'Local demo state requires operator review.')).replace(/\s+/g, ' ').trim();
  return truncate(redacted || 'Local demo state requires operator review.', limit);
}

function optionalSafeText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  return safeText(value);
}

function redactSecretLikeText(value: string): string {
  return value
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedApiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, '[redacted]')
    .replace(/\b(?:sk|sk-ant|sk-proj|AIza)[A-Za-z0-9._-]{6,}\b/g, '[redacted]')
    .replace(/\blocal-demo:v1:[a-f0-9A-Za-z._-]+\b/g, '[redacted]')
    .replace(/\bAPI\s+token\s+\S+/gi, '[redacted]')
    .replace(/\bsecret(?:\s*[:=]\s*\S+)?/gi, '[redacted]')
    .replace(/\bprivate\s+note\b/gi, '[redacted]')
    .replace(/\b[A-Z][A-Z0-9&.-]{2,}\s+(?:customer|workspace|account|tenant|project)\b/g, '[redacted]')
    .replace(/\bexample\s+customer\b/gi, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]')
    .replace(/\bACME\b/g, '[redacted]');
}

function redactSecretLikeMarkdown(value: string): string {
  return redactSecretLikeText(value);
}

function escapeMarkdown(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/`/g, '\\`');
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function countBy<T extends string, Item>(
  items: Item[],
  order: T[],
  select: (item: Item) => T,
): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const item of items) {
    const key = select(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(order.filter((key) => counts[key]).map((key) => [key, counts[key]])) as Partial<Record<T, number>>;
}

function uniqueOrdered(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
