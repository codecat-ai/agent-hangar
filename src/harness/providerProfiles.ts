import { normalizeProviderHealth, summarizeModelCapabilities, type NormalizedModel, type ProviderCard, type ProviderHealthStatus, type ProviderKind } from './providerCatalog';

const providerKinds = ['openai', 'anthropic', 'gemini', 'openai-compatible'] as const;
const profileIdPattern = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const localDemoPrefix = 'local-demo:v1:';
const localDemoKey = 'agent-hangar-local-demo';

export interface ProviderProfileCrypto {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

export interface ProviderHealthMetadata {
  checkedAt?: string;
  status?: ProviderHealthStatus;
  message?: string;
  modelInventoryUpdatedAt?: string;
}

export interface ProviderCapabilityMetadata {
  models?: string[];
  supportsStreaming?: boolean;
  supportsTools?: boolean;
  [key: string]: unknown;
}

export interface ProviderProfile {
  id: string;
  kind: ProviderKind;
  displayName: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
  encryptedApiKey?: string;
  health?: ProviderHealthMetadata;
  capabilities?: ProviderCapabilityMetadata;
}

export interface CreateProviderProfileInput {
  id: string;
  kind: string;
  displayName: string;
  baseUrl: string;
  apiKey?: string;
  health?: ProviderHealthMetadata;
  capabilities?: ProviderCapabilityMetadata;
}

export type ProviderProfileClock = () => Date;

export function createProviderProfile(
  input: CreateProviderProfileInput,
  crypto: ProviderProfileCrypto,
  clock: ProviderProfileClock,
): ProviderProfile {
  const id = validateId(input.id);
  const kind = validateKind(input.kind);
  const displayName = validateDisplayName(input.displayName);
  const baseUrl = validateBaseUrl(input.baseUrl);
  const timestamp = clock().toISOString();
  const apiKey = input.apiKey?.trim();

  return {
    id,
    kind,
    displayName,
    baseUrl,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(apiKey ? { encryptedApiKey: crypto.encrypt(apiKey) } : {}),
    ...(input.health ? { health: input.health } : {}),
    ...(input.capabilities ? { capabilities: input.capabilities } : {}),
  };
}

export function toProviderCard(profile: ProviderProfile, models: NormalizedModel[] = []): ProviderCard {
  const apiKeyConfigured = Boolean(profile.encryptedApiKey);
  const modelCount = models.length;

  return {
    id: profile.id,
    kind: profile.kind,
    displayName: profile.displayName,
    baseUrl: profile.baseUrl,
    apiKeyConfigured,
    modelCount,
    health: normalizeProviderHealth({
      apiKeyConfigured,
      modelCount,
      checkedAt: profile.health?.checkedAt,
      lastError: profile.health?.status === 'degraded' ? profile.health.message : undefined,
      modelInventoryUpdatedAt: profile.health?.modelInventoryUpdatedAt,
    }),
    capabilities: summarizeModelCapabilities(models),
  };
}

export function updateProviderApiKey(
  profile: ProviderProfile,
  apiKey: string,
  crypto: ProviderProfileCrypto,
  clock: ProviderProfileClock,
): ProviderProfile {
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    throw new Error('apiKey is required');
  }

  return {
    ...profile,
    encryptedApiKey: crypto.encrypt(trimmedApiKey),
    updatedAt: clock().toISOString(),
  };
}

export function decryptProviderApiKey(profile: ProviderProfile, crypto: ProviderProfileCrypto): string | undefined {
  return profile.encryptedApiKey ? crypto.decrypt(profile.encryptedApiKey) : undefined;
}

export const localDemoProviderProfileCrypto: ProviderProfileCrypto = {
  encrypt(plaintext: string): string {
    const bytes = new TextEncoder().encode(plaintext);
    const key = new TextEncoder().encode(localDemoKey);
    const encoded = Array.from(bytes, (byte, index) => (byte ^ key[index % key.length]).toString(16).padStart(2, '0')).join('');
    return `${localDemoPrefix}${encoded}`;
  },
  decrypt(ciphertext: string): string {
    if (!ciphertext.startsWith(localDemoPrefix)) {
      throw new Error('Unsupported local demo provider profile ciphertext');
    }

    const encoded = ciphertext.slice(localDemoPrefix.length);
    if (encoded.length % 2 !== 0 || /[^a-f0-9]/i.test(encoded)) {
      throw new Error('Invalid local demo provider profile ciphertext');
    }

    const key = new TextEncoder().encode(localDemoKey);
    const bytes = new Uint8Array(encoded.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(encoded.slice(index * 2, index * 2 + 2), 16) ^ key[index % key.length];
    }
    return new TextDecoder().decode(bytes);
  },
};

function validateId(value: string): string {
  const id = value.trim();
  if (!profileIdPattern.test(id)) {
    throw new Error('Provider profile id must be 2-64 lowercase letters, numbers, underscores, or hyphens');
  }
  return id;
}

function validateKind(value: string): ProviderKind {
  if (providerKinds.includes(value as ProviderKind)) {
    return value as ProviderKind;
  }
  throw new Error(`Provider profile kind must be one of: ${providerKinds.join(', ')}`);
}

function validateDisplayName(value: string): string {
  const displayName = value.trim();
  if (!displayName) {
    throw new Error('Provider profile displayName is required');
  }
  return displayName;
}

function validateBaseUrl(value: string): string {
  const baseUrl = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('Provider profile baseUrl must be a valid URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Provider profile baseUrl must use http or https');
  }
  return baseUrl;
}
