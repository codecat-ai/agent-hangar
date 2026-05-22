import {
  normalizeProviderHealth,
  summarizeModelCapabilities,
  type NormalizedModel,
  type ProviderCard,
  type ProviderKind,
} from './providerCatalog';
import {
  createProviderProfile,
  type CreateProviderProfileInput,
  type ProviderHealthMetadata,
  type ProviderProfile,
  type ProviderProfileClock,
  type ProviderProfileCrypto,
} from './providerProfiles';

export interface ProviderProfileDraft {
  id: string;
  kind: string;
  displayName: string;
  baseUrl: string;
  apiKey?: string;
  health?: ProviderHealthMetadata;
}

export interface ProviderProfileSummary extends ProviderCard {
  keyStatus: 'Configured' | 'Missing';
  refreshStatus: string;
}

export function createProfileFromDraft(
  draft: ProviderProfileDraft,
  crypto: ProviderProfileCrypto,
  clock: ProviderProfileClock,
): ProviderProfile {
  return createProviderProfile(draftToCreateInput(draft), crypto, clock);
}

export function updateProfileFromDraft(
  profile: ProviderProfile,
  draft: ProviderProfileDraft,
  crypto: ProviderProfileCrypto,
  clock: ProviderProfileClock,
): ProviderProfile {
  const validated = createProviderProfile({
    id: profile.id,
    kind: draft.kind,
    displayName: draft.displayName,
    baseUrl: draft.baseUrl,
  }, crypto, clock);
  const apiKey = draft.apiKey?.trim();

  return {
    ...profile,
    kind: validated.kind,
    displayName: validated.displayName,
    baseUrl: validated.baseUrl,
    updatedAt: clock().toISOString(),
    ...(apiKey ? { encryptedApiKey: crypto.encrypt(apiKey) } : {}),
  };
}

export function deleteProviderProfileById(profiles: ProviderProfile[], id: string): ProviderProfile[] {
  return profiles.filter((profile) => profile.id !== id);
}

export function summarizeProviderProfiles(
  profiles: ProviderProfile[],
  modelsByProvider: Record<string, NormalizedModel[]>,
  now: string,
): ProviderProfileSummary[] {
  return profiles.map((profile) => summarizeProviderProfile(profile, modelsByProvider[profile.id] ?? [], now));
}

export function summarizeProviderProfile(profile: ProviderProfile, models: NormalizedModel[], now: string): ProviderProfileSummary {
  const apiKeyConfigured = Boolean(profile.encryptedApiKey);
  const modelCount = models.length;
  const health = normalizeProviderHealth({
    apiKeyConfigured,
    modelCount,
    checkedAt: profile.health?.checkedAt,
    lastError: profile.health?.status === 'degraded' ? profile.health.message : undefined,
    modelInventoryUpdatedAt: profile.health?.modelInventoryUpdatedAt,
    now,
  });

  return {
    id: profile.id,
    kind: profile.kind,
    displayName: profile.displayName,
    baseUrl: profile.baseUrl,
    apiKeyConfigured,
    modelCount,
    health,
    capabilities: summarizeModelCapabilities(models),
    keyStatus: apiKeyConfigured ? 'Configured' : 'Missing',
    refreshStatus: health.label,
  };
}

export function emptyProviderProfileDraft(kind: ProviderKind = 'openai'): ProviderProfileDraft {
  return {
    id: '',
    kind,
    displayName: '',
    baseUrl: '',
    apiKey: '',
  };
}

export function draftFromProfile(profile: ProviderProfile): ProviderProfileDraft {
  return {
    id: profile.id,
    kind: profile.kind,
    displayName: profile.displayName,
    baseUrl: profile.baseUrl,
    apiKey: '',
  };
}

function draftToCreateInput(draft: ProviderProfileDraft): CreateProviderProfileInput {
  return {
    id: draft.id,
    kind: draft.kind,
    displayName: draft.displayName,
    baseUrl: draft.baseUrl,
    ...(draft.apiKey !== undefined ? { apiKey: draft.apiKey } : {}),
    ...(draft.health ? { health: draft.health } : {}),
  };
}
