import {
  normalizeProviderModel,
  summarizeModelCapabilities,
  type ModelCapabilityTag,
  type NormalizedModel,
  type ProviderCapabilitySummary,
} from './providerCatalog';
import { type ProviderProfile } from './providerProfiles';
import { redactOperatorText } from './redaction';

export type ProviderDiscoveryDryRunStatus = 'needs-key' | 'ready' | 'empty' | 'degraded' | 'stale' | 'malformed';
export type ProviderDiscoveryDryRunSeverity = 'info' | 'success' | 'warning' | 'error';
export type ProviderDiscoveryFixtureErrorType = 'degraded' | 'permission';

export interface ProviderDiscoveryFixtureIssue {
  code: string;
  message: string;
}

export interface ProviderDiscoveryFixtureError {
  type: ProviderDiscoveryFixtureErrorType;
  message: string;
}

export interface ProviderDiscoveryFixture {
  checkedAt?: string;
  inventoryUpdatedAt?: string;
  models?: unknown;
  error?: ProviderDiscoveryFixtureError;
  apiKeyRef?: string;
}

export interface ProviderDiscoveryDryRunPreview {
  schemaVersion: 'provider-discovery-dry-run/v1';
  provider: {
    id: string;
    name: string;
    kind: ProviderProfile['kind'];
  };
  status: ProviderDiscoveryDryRunStatus;
  severity: ProviderDiscoveryDryRunSeverity;
  modelCount: number;
  capabilities: ProviderCapabilitySummary;
  checkedAt?: string;
  guidance: string;
  models: NormalizedModel[];
  issues: ProviderDiscoveryFixtureIssue[];
}

export interface ProviderDiscoveryDryRunSummary {
  schemaVersion: 'provider-discovery-dry-run-summary/v1';
  providerCount: number;
  modelCount: number;
  countsByStatus: Partial<Record<ProviderDiscoveryDryRunStatus, number>>;
  countsBySeverity: Partial<Record<ProviderDiscoveryDryRunSeverity, number>>;
  nextActions: string[];
}

export interface BuildProviderDiscoveryDryRunInput {
  profiles: ProviderProfile[];
  fixturesByProvider: Record<string, ProviderDiscoveryFixture | unknown>;
  now: string;
  staleAfterMs: number;
}

const emptyCapabilities: ProviderCapabilitySummary = { counts: {}, tags: [] };
const statusOrder: ProviderDiscoveryDryRunStatus[] = ['needs-key', 'ready', 'empty', 'degraded', 'stale', 'malformed'];
const severityOrder: ProviderDiscoveryDryRunSeverity[] = ['warning', 'success', 'info', 'error'];

export function buildProviderDiscoveryDryRun(input: BuildProviderDiscoveryDryRunInput): ProviderDiscoveryDryRunPreview[] {
  return input.profiles.map((profile) => {
    if (!profile.encryptedApiKey) {
      return buildPreview(profile, 'needs-key', 'warning', [], undefined, 'Add local key material before previewing model discovery outcomes.', []);
    }

    const fixture = input.fixturesByProvider[profile.id];
    const objectIssue = validateFixtureObject(fixture);
    if (objectIssue) {
      return buildPreview(profile, 'malformed', 'error', [], undefined, 'Fix the local fixture shape before previewing model discovery.', [objectIssue]);
    }

    const fixtureObject = fixture as ProviderDiscoveryFixture;
    const issues = validateFixtureMetadata(fixtureObject);
    if (fixtureObject.error) {
      return buildPreview(profile, 'degraded', 'error', [], validIsoTimestamp(fixtureObject.checkedAt) ? fixtureObject.checkedAt : undefined, 'Review the sanitized local fixture error before enabling real discovery.', [
        ...issues,
        {
          code: fixtureObject.error.type === 'permission' ? 'fixture-permission' : 'fixture-degraded',
          message: sanitizeFixtureMessage(fixtureObject.error.message, fixtureObject.apiKeyRef),
        },
      ]);
    }

    if (!Array.isArray(fixtureObject.models)) {
      return buildPreview(profile, 'malformed', 'error', [], validIsoTimestamp(fixtureObject.checkedAt) ? fixtureObject.checkedAt : undefined, 'Fix the local fixture shape before previewing model discovery.', [
        ...issues,
        { code: 'invalid-models', message: 'Fixture models must be an array.' },
      ]);
    }

    const models = normalizeFixtureModels(profile, fixtureObject.models);
    if (issues.length > 0) {
      return buildPreview(profile, 'malformed', 'error', models, undefined, 'Fix the local fixture metadata before previewing model discovery.', issues);
    }

    if (models.length === 0) {
      return buildPreview(profile, 'empty', 'info', [], fixtureObject.checkedAt, 'Credentials are present, but the local fixture has no models to preview.', []);
    }

    if (isStaleInventory(fixtureObject.inventoryUpdatedAt, input.now, input.staleAfterMs)) {
      return buildPreview(profile, 'stale', 'warning', models, fixtureObject.checkedAt, 'Refresh the local fixture before trusting routing or capability previews.', []);
    }

    return buildPreview(profile, 'ready', 'success', models, fixtureObject.checkedAt, 'Dry-run fixture has current local model inventory for preview only.', []);
  });
}

export function summarizeDiscoveryDryRun(previews: ProviderDiscoveryDryRunPreview[]): ProviderDiscoveryDryRunSummary {
  const countsByStatus = countBy(previews, statusOrder, (preview) => preview.status);
  const countsBySeverity = countBy(previews, severityOrder, (preview) => preview.severity);
  const nextActions: string[] = [];

  appendAction(nextActions, countsByStatus['needs-key'], (count) => `Add local key material for ${count} ${providerLabel(count)} before discovery preview.`);
  appendAction(nextActions, countsByStatus.degraded, (count) => `Review sanitized fixture errors for ${count} ${providerLabel(count)}.`);
  appendAction(nextActions, countsByStatus.stale, (count) => `Refresh stale fixture inventory for ${count} ${providerLabel(count)}.`);
  appendAction(nextActions, countsByStatus.malformed, (count) => `Fix malformed local fixtures for ${count} ${providerLabel(count)}.`);
  appendAction(nextActions, countsByStatus.empty, (count) => `Add fixture models for ${count} configured ${providerLabel(count)} with empty inventory.`);

  return {
    schemaVersion: 'provider-discovery-dry-run-summary/v1',
    providerCount: previews.length,
    modelCount: previews.reduce((total, preview) => total + preview.modelCount, 0),
    countsByStatus,
    countsBySeverity,
    nextActions,
  };
}

function buildPreview(
  profile: ProviderProfile,
  status: ProviderDiscoveryDryRunStatus,
  severity: ProviderDiscoveryDryRunSeverity,
  models: NormalizedModel[],
  checkedAt: string | undefined,
  guidance: string,
  issues: ProviderDiscoveryFixtureIssue[],
): ProviderDiscoveryDryRunPreview {
  return {
    schemaVersion: 'provider-discovery-dry-run/v1',
    provider: { id: profile.id, name: profile.displayName, kind: profile.kind },
    status,
    severity,
    modelCount: models.length,
    capabilities: models.length > 0 ? summarizeModelCapabilities(models) : emptyCapabilities,
    checkedAt,
    guidance,
    models,
    issues,
  };
}

function validateFixtureObject(fixture: unknown): ProviderDiscoveryFixtureIssue | undefined {
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
    return { code: 'unsupported-fixture', message: 'Fixture payload must be a local object.' };
  }
  return undefined;
}

function validateFixtureMetadata(fixture: ProviderDiscoveryFixture): ProviderDiscoveryFixtureIssue[] {
  const issues: ProviderDiscoveryFixtureIssue[] = [];
  if (fixture.checkedAt !== undefined && !validIsoTimestamp(fixture.checkedAt)) {
    issues.push({ code: 'invalid-checked-at', message: 'Fixture checkedAt must be an ISO timestamp.' });
  }
  if (fixture.inventoryUpdatedAt !== undefined && !validIsoTimestamp(fixture.inventoryUpdatedAt)) {
    issues.push({ code: 'invalid-inventory-updated-at', message: 'Fixture inventoryUpdatedAt must be an ISO timestamp.' });
  }
  return issues;
}

function normalizeFixtureModels(profile: ProviderProfile, models: unknown[]): NormalizedModel[] {
  return models
    .filter((model): model is Record<string, unknown> => Boolean(model) && typeof model === 'object' && !Array.isArray(model))
    .map((model) => normalizeProviderModel(profile.kind, model));
}

function validIsoTimestamp(value: string | undefined): value is string {
  if (!value) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isStaleInventory(inventoryUpdatedAt: string | undefined, now: string, staleAfterMs: number): boolean {
  if (!validIsoTimestamp(inventoryUpdatedAt) || !validIsoTimestamp(now)) {
    return false;
  }
  return Date.parse(now) - Date.parse(inventoryUpdatedAt) > staleAfterMs;
}

function sanitizeFixtureMessage(message: string, apiKeyRef: string | undefined): string {
  let sanitized = redactOperatorText(message, 'Provider discovery dry-run fixture reported an error.');
  if (apiKeyRef) {
    sanitized = sanitized.replaceAll(apiKeyRef, '[redacted-ref]');
  }
  return sanitized;
}

function countBy<T extends string>(
  previews: ProviderDiscoveryDryRunPreview[],
  order: T[],
  select: (preview: ProviderDiscoveryDryRunPreview) => T,
): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const item of previews) {
    const key = select(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(order.filter((key) => counts[key]).map((key) => [key, counts[key]])) as Partial<Record<T, number>>;
}

function appendAction(actions: string[], count: number | undefined, build: (count: number) => string): void {
  if (count && count > 0) {
    actions.push(build(count));
  }
}

function providerLabel(count: number): string {
  return count === 1 ? 'provider' : 'providers';
}
