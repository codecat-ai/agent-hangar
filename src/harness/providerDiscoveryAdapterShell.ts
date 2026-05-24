import {
  buildProviderDiscoveryDryRun,
  type ProviderDiscoveryDryRunPreview,
  type ProviderDiscoveryDryRunSeverity,
  type ProviderDiscoveryDryRunStatus,
  type ProviderDiscoveryFixture,
} from './providerDiscoveryDryRun';
import { type ProviderCapabilitySummary, type NormalizedModel } from './providerCatalog';
import { type ProviderProfile } from './providerProfiles';
import { redactOperatorText } from './redaction';

export type ProviderDiscoveryAdapterShellStatus = ProviderDiscoveryDryRunStatus | 'blocked';
export type ProviderDiscoveryAdapterShellConsent = 'operator-initiated';
export type ProviderDiscoveryAdapterIssueCode =
  | 'adapter-disabled'
  | 'missing-operator-consent'
  | 'missing-request-options'
  | 'fixture-degraded'
  | 'fixture-permission'
  | 'invalid-checked-at'
  | 'invalid-inventory-updated-at'
  | 'invalid-models'
  | 'unsupported-fixture'
  | 'stale-fixture-inventory';

export interface ProviderDiscoveryAdapterShellOptions {
  requestId: string;
  requestedAt: string;
  now: string;
  staleAfterMs: number;
  timeoutMs: number;
  retryLimit: number;
}

export interface ProviderDiscoveryAdapterShellState {
  enabled?: boolean;
  consent?: ProviderDiscoveryAdapterShellConsent;
  options?: ProviderDiscoveryAdapterShellOptions;
}

export interface ProviderDiscoveryAdapterIssue {
  code: ProviderDiscoveryAdapterIssueCode;
  severity: Exclude<ProviderDiscoveryDryRunSeverity, 'success'>;
  retryable: boolean;
  message: string;
  nextAction: string;
}

export interface ProviderDiscoveryAdapterShellResult {
  schemaVersion: 'provider-discovery-adapter-shell/v1';
  adapter: {
    id: 'fixture-provider-discovery-adapter-shell';
    mode: 'fixture-only';
    enabled: boolean;
  };
  request: {
    schemaVersion: 'provider-discovery-adapter-request/v1';
    requestId: string;
    profileId: string;
    providerId: ProviderProfile['kind'];
    consent?: ProviderDiscoveryAdapterShellConsent;
    requestedAt?: string;
    timeoutMs?: number;
    retryLimit?: number;
    staleAfterMs?: number;
  };
  provider: {
    id: string;
    name: string;
    kind: ProviderProfile['kind'];
  };
  status: ProviderDiscoveryAdapterShellStatus;
  severity: ProviderDiscoveryDryRunSeverity;
  issueCount: number;
  modelCount: number;
  checkedAt?: string;
  capabilities: ProviderCapabilitySummary;
  models: NormalizedModel[];
  issues: ProviderDiscoveryAdapterIssue[];
  nextActions: string[];
  audit: {
    requestId: string;
    providerId: ProviderProfile['kind'];
    profileId: string;
    attemptCount: number;
    durationMs: 0;
    requestedAt?: string;
    completedAt?: string;
    status: ProviderDiscoveryAdapterShellStatus;
    issueCodes: ProviderDiscoveryAdapterIssueCode[];
  };
}

export interface EvaluateProviderDiscoveryAdapterShellInput {
  profile: ProviderProfile;
  fixture: ProviderDiscoveryFixture | unknown;
  state?: ProviderDiscoveryAdapterShellState;
}

const adapterId = 'fixture-provider-discovery-adapter-shell';
const emptyCapabilities: ProviderCapabilitySummary = { counts: {}, tags: [] };

export function evaluateProviderDiscoveryAdapterShell(
  input: EvaluateProviderDiscoveryAdapterShellInput,
): ProviderDiscoveryAdapterShellResult {
  const enabled = Boolean(input.state?.enabled);

  if (!enabled) {
    return blockedResult(
      input.profile,
      enabled,
      input.state,
      typedIssue('adapter-disabled'),
    );
  }

  if (input.state?.consent !== 'operator-initiated') {
    return blockedResult(
      input.profile,
      enabled,
      input.state,
      typedIssue('missing-operator-consent'),
    );
  }

  if (!input.state.options) {
    return blockedResult(
      input.profile,
      enabled,
      input.state,
      typedIssue('missing-request-options'),
    );
  }

  const activeState = {
    ...input.state,
    consent: input.state.consent,
    options: input.state.options,
  };
  const preview = buildProviderDiscoveryDryRun({
    profiles: [input.profile],
    fixturesByProvider: { [input.profile.id]: input.fixture },
    now: activeState.options.now,
    staleAfterMs: activeState.options.staleAfterMs,
  })[0];
  const issues = adapterIssuesFromPreview(preview);
  const result = resultFromPreview(input.profile, activeState, preview, issues);
  return cloneResult(result);
}

export function renderProviderDiscoveryAdapterMarkdown(result: ProviderDiscoveryAdapterShellResult): string {
  const sanitizedIssues = result.issues.length > 0
    ? result.issues.map((issue) => `- ${issue.code} | ${issue.severity} | ${redactOperatorText(issue.message)}`).join('\n')
    : '- None';
  const nextActions = result.nextActions.length > 0
    ? result.nextActions.map((action) => `- ${redactOperatorText(action)}`).join('\n')
    : '- None';

  return `# Provider Discovery Adapter Shell

schemaVersion: ${result.schemaVersion}
requestId: ${result.request.requestId}
profileId: ${result.request.profileId}
providerId: ${result.request.providerId}
status: ${result.status}

## Summary
- Adapter: ${result.adapter.id}
- Mode: ${result.adapter.mode}
- Enabled: ${result.adapter.enabled ? 'yes' : 'no'}
- Consent: ${result.request.consent ?? 'missing'}
- Models: ${result.modelCount}
- Issues: ${result.issueCount}
- Checked at: ${result.checkedAt ?? 'not checked'}

## Issues
${sanitizedIssues}

## Next Actions
${nextActions}
`;
}

function blockedResult(
  profile: ProviderProfile,
  enabled: boolean,
  state: ProviderDiscoveryAdapterShellState | undefined,
  issue: ProviderDiscoveryAdapterIssue,
): ProviderDiscoveryAdapterShellResult {
  const result: ProviderDiscoveryAdapterShellResult = {
    schemaVersion: 'provider-discovery-adapter-shell/v1',
    adapter: { id: adapterId, mode: 'fixture-only', enabled },
    request: buildRequest(profile, state),
    provider: sanitizedProvider(profile),
    status: 'blocked',
    severity: 'warning',
    issueCount: 1,
    modelCount: 0,
    capabilities: emptyCapabilities,
    models: [],
    issues: [issue],
    nextActions: [issue.nextAction],
    audit: {
      requestId: state?.options?.requestId ?? 'not-requested',
      providerId: profile.kind,
      profileId: profile.id,
      attemptCount: 0,
      durationMs: 0,
      ...(state?.options?.requestedAt ? { requestedAt: state.options.requestedAt, completedAt: state.options.requestedAt } : {}),
      status: 'blocked',
      issueCodes: [issue.code],
    },
  };
  return cloneResult(result);
}

function resultFromPreview(
  profile: ProviderProfile,
  state: Required<Pick<ProviderDiscoveryAdapterShellState, 'consent' | 'options'>> & ProviderDiscoveryAdapterShellState,
  preview: ProviderDiscoveryDryRunPreview,
  issues: ProviderDiscoveryAdapterIssue[],
): ProviderDiscoveryAdapterShellResult {
  const nextActions = issues.length > 0
    ? orderedUnique(issues.map((issue) => issue.nextAction))
    : ['Review the fixture-backed inventory preview before enabling any future live adapter.'];

  return {
    schemaVersion: 'provider-discovery-adapter-shell/v1',
    adapter: { id: adapterId, mode: 'fixture-only', enabled: true },
    request: buildRequest(profile, state),
    provider: {
      id: preview.provider.id,
      name: redactOperatorText(preview.provider.name, 'Provider profile'),
      kind: preview.provider.kind,
    },
    status: preview.status,
    severity: preview.severity,
    issueCount: issues.length,
    modelCount: preview.modelCount,
    ...(preview.checkedAt ? { checkedAt: preview.checkedAt } : {}),
    capabilities: preview.capabilities,
    models: preview.models.map(sanitizeModel),
    issues,
    nextActions,
    audit: {
      requestId: state.options.requestId,
      providerId: profile.kind,
      profileId: profile.id,
      attemptCount: 1,
      durationMs: 0,
      requestedAt: state.options.requestedAt,
      completedAt: state.options.requestedAt,
      status: preview.status,
      issueCodes: issues.map((issue) => issue.code),
    },
  };
}

function buildRequest(
  profile: ProviderProfile,
  state: ProviderDiscoveryAdapterShellState | undefined,
): ProviderDiscoveryAdapterShellResult['request'] {
  return {
    schemaVersion: 'provider-discovery-adapter-request/v1',
    requestId: state?.options?.requestId ?? 'not-requested',
    profileId: profile.id,
    providerId: profile.kind,
    ...(state?.consent ? { consent: state.consent } : {}),
    ...(state?.options?.requestedAt ? { requestedAt: state.options.requestedAt } : {}),
    ...(state?.options?.timeoutMs !== undefined ? { timeoutMs: state.options.timeoutMs } : {}),
    ...(state?.options?.retryLimit !== undefined ? { retryLimit: state.options.retryLimit } : {}),
    ...(state?.options?.staleAfterMs !== undefined ? { staleAfterMs: state.options.staleAfterMs } : {}),
  };
}

function sanitizedProvider(profile: ProviderProfile): ProviderDiscoveryAdapterShellResult['provider'] {
  return {
    id: profile.id,
    name: redactOperatorText(profile.displayName, 'Provider profile'),
    kind: profile.kind,
  };
}

function sanitizeModel(model: NormalizedModel): NormalizedModel {
  return {
    id: redactOperatorText(model.id, 'redacted-model'),
    displayName: redactOperatorText(model.displayName, 'Redacted model'),
    providerKind: model.providerKind,
    ...(model.capabilities ? { capabilities: [...model.capabilities] } : {}),
  };
}

function adapterIssuesFromPreview(preview: ProviderDiscoveryDryRunPreview): ProviderDiscoveryAdapterIssue[] {
  const issues = preview.issues.map((issue) => typedIssue(issue.code as ProviderDiscoveryAdapterIssueCode, issue.message));
  if (preview.status === 'stale') {
    issues.push(typedIssue('stale-fixture-inventory'));
  }
  return issues;
}

function typedIssue(code: ProviderDiscoveryAdapterIssueCode, message?: string): ProviderDiscoveryAdapterIssue {
  const definitions: Record<ProviderDiscoveryAdapterIssueCode, ProviderDiscoveryAdapterIssue> = {
    'adapter-disabled': {
      code: 'adapter-disabled',
      severity: 'warning',
      retryable: false,
      message: 'Provider discovery adapter shell is disabled by default.',
      nextAction: 'Enable the fixture adapter shell in local demo state before requesting discovery.',
    },
    'missing-operator-consent': {
      code: 'missing-operator-consent',
      severity: 'warning',
      retryable: false,
      message: 'Provider discovery requires explicit operator consent.',
      nextAction: 'Trigger discovery from an operator-visible control before using fixtures.',
    },
    'missing-request-options': {
      code: 'missing-request-options',
      severity: 'warning',
      retryable: false,
      message: 'Provider discovery requires injected request options.',
      nextAction: 'Provide request id, timestamps, timeout, retry, and freshness options from local demo state.',
    },
    'fixture-degraded': {
      code: 'fixture-degraded',
      severity: 'error',
      retryable: true,
      message: 'Fixture reported a degraded provider response.',
      nextAction: 'Review sanitized fixture errors before enabling any future live adapter.',
    },
    'fixture-permission': {
      code: 'fixture-permission',
      severity: 'error',
      retryable: false,
      message: 'Fixture reported a permission error.',
      nextAction: 'Review provider permissions in local configuration before retrying discovery.',
    },
    'invalid-checked-at': {
      code: 'invalid-checked-at',
      severity: 'error',
      retryable: true,
      message: 'Fixture checkedAt must be an ISO timestamp.',
      nextAction: 'Fix the local fixture metadata before requesting discovery again.',
    },
    'invalid-inventory-updated-at': {
      code: 'invalid-inventory-updated-at',
      severity: 'error',
      retryable: true,
      message: 'Fixture inventoryUpdatedAt must be an ISO timestamp.',
      nextAction: 'Fix the local fixture metadata before requesting discovery again.',
    },
    'invalid-models': {
      code: 'invalid-models',
      severity: 'error',
      retryable: true,
      message: 'Fixture models must be an array.',
      nextAction: 'Fix the local fixture model inventory before requesting discovery again.',
    },
    'unsupported-fixture': {
      code: 'unsupported-fixture',
      severity: 'error',
      retryable: true,
      message: 'Fixture payload must be a local object.',
      nextAction: 'Replace the fixture with a local object before requesting discovery again.',
    },
    'stale-fixture-inventory': {
      code: 'stale-fixture-inventory',
      severity: 'warning',
      retryable: true,
      message: 'Fixture inventory is older than the injected freshness threshold.',
      nextAction: 'Refresh the local fixture before trusting routing or capability previews.',
    },
  };
  const issue = definitions[code] ?? definitions['unsupported-fixture'];
  return {
    ...issue,
    message: redactOperatorText(message ?? issue.message, issue.message),
    nextAction: redactOperatorText(issue.nextAction),
  };
}

function orderedUnique(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function cloneResult(result: ProviderDiscoveryAdapterShellResult): ProviderDiscoveryAdapterShellResult {
  return JSON.parse(JSON.stringify(result)) as ProviderDiscoveryAdapterShellResult;
}
