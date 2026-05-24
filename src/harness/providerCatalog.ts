import { redactOperatorText } from './redaction';

export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';
export interface ProviderConfig { id: string; kind: ProviderKind; displayName: string; baseUrl: string; apiKeyRef?: string }
export type ModelCapabilityTag = 'text' | 'vision' | 'reasoning' | 'embeddings' | 'fast' | 'longContext' | 'toolUse';
export type ProviderHealthStatus = 'ready' | 'needs-key' | 'empty' | 'degraded' | 'stale';
export interface NormalizedModel { id: string; displayName: string; providerKind: ProviderKind; capabilities?: ModelCapabilityTag[] }
export interface ProviderHealthInput {
  apiKeyConfigured: boolean;
  modelCount: number;
  checkedAt?: string;
  lastError?: string;
  modelInventoryUpdatedAt?: string;
  now?: string;
  staleAfterMs?: number;
  apiKeyRef?: string;
}
export interface ProviderHealthSummary {
  status: ProviderHealthStatus;
  label: string;
  detail: string;
  checkedAt?: string;
}
export interface ProviderCapabilitySummary {
  counts: Partial<Record<ModelCapabilityTag, number>>;
  tags: ModelCapabilityTag[];
}
export interface ProviderCard {
  id: string;
  kind: ProviderKind;
  displayName: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  modelCount: number;
  health: ProviderHealthSummary;
  capabilities: ProviderCapabilitySummary;
}

export type ProviderHealthOverrides = Omit<ProviderHealthInput, 'apiKeyConfigured' | 'modelCount' | 'apiKeyRef'>;

const defaultStaleAfterMs = 48 * 60 * 60 * 1000;
const capabilityOrder: ModelCapabilityTag[] = ['text', 'vision', 'reasoning', 'embeddings', 'fast', 'longContext', 'toolUse'];

export function normalizeProviderModel(providerKind: ProviderKind, raw: Record<string, unknown>): NormalizedModel {
  const source = String(raw.id ?? raw.name ?? '');
  const id = providerKind === 'gemini' ? source.replace(/^models\//, '') : source;
  const displayName = String(raw.display_name ?? raw.displayName ?? id);
  return { id, displayName, providerKind, capabilities: normalizeModelCapabilities({ id, displayName, providerKind }) };
}

export function normalizeProviderHealth(input: ProviderHealthInput): ProviderHealthSummary {
  if (!input.apiKeyConfigured) {
    return {
      status: 'needs-key',
      label: 'Missing API key',
      detail: 'Add an API key before model discovery or agent execution.',
      checkedAt: input.checkedAt,
    };
  }

  if (input.lastError) {
    return {
      status: 'degraded',
      label: 'Provider degraded',
      detail: sanitizeHealthDetail(input.lastError, input.apiKeyRef),
      checkedAt: input.checkedAt,
    };
  }

  if (input.modelCount === 0) {
    return {
      status: 'empty',
      label: 'No models discovered',
      detail: 'Provider credentials are configured, but no models are available yet.',
      checkedAt: input.checkedAt,
    };
  }

  if (isStaleInventory(input.modelInventoryUpdatedAt, input.now, input.staleAfterMs ?? defaultStaleAfterMs)) {
    return {
      status: 'stale',
      label: 'Stale model inventory',
      detail: 'Refresh model discovery before making provider routing decisions.',
      checkedAt: input.checkedAt,
    };
  }

  return {
    status: 'ready',
    label: 'Ready',
    detail: `Provider is reachable with ${input.modelCount} discovered ${input.modelCount === 1 ? 'model' : 'models'}.`,
    checkedAt: input.checkedAt,
  };
}

export function normalizeModelCapabilities(model: Pick<NormalizedModel, 'id' | 'displayName' | 'providerKind'>): ModelCapabilityTag[] {
  const searchableName = `${model.id} ${model.displayName}`.toLowerCase();
  const tags = new Set<ModelCapabilityTag>();
  const isEmbedding = /\bembed|embedding|embeddings\b/.test(searchableName);

  if (isEmbedding) {
    tags.add('embeddings');
    return orderedCapabilities(tags);
  }

  tags.add('text');

  if (/\b(vision|vl|multimodal|gpt-4o|4o|claude-3|claude-4|gemini|pixtral|llava)\b/.test(searchableName)) {
    tags.add('vision');
  }

  if (
    /\b(o1|o3|o4|reasoning|reasoner|sonnet-4|opus-4|gemini-2\.5-pro)\b/.test(searchableName)
    || (/\bgpt-4\.1\b/.test(searchableName) && !/\b(mini|nano)\b/.test(searchableName))
  ) {
    tags.add('reasoning');
  }

  if (/\b(mini|nano|haiku|flash|lite|fast|instant|turbo)\b/.test(searchableName)) {
    tags.add('fast');
  }

  if (/\b(128k|200k|1m|long|context|gpt-4\.1|claude|gemini-1\.5|gemini-2|sonnet|opus)\b/.test(searchableName)) {
    tags.add('longContext');
  }

  if (model.providerKind !== 'openai-compatible' || /\b(tool|function|gpt|claude|gemini)\b/.test(searchableName)) {
    tags.add('toolUse');
  }

  return orderedCapabilities(tags);
}

export function summarizeModelCapabilities(models: NormalizedModel[]): ProviderCapabilitySummary {
  const counts: Partial<Record<ModelCapabilityTag, number>> = {};

  for (const model of models) {
    for (const tag of model.capabilities ?? normalizeModelCapabilities(model)) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }

  return {
    counts,
    tags: capabilityOrder.filter((tag) => (counts[tag] ?? 0) > 0),
  };
}

export function buildProviderCatalog(
  configs: ProviderConfig[],
  modelsByProvider: Record<string, NormalizedModel[]>,
  healthByProvider: Record<string, ProviderHealthOverrides> = {},
): ProviderCard[] {
  return configs.map(({ apiKeyRef: _secretRef, ...config }) => {
    const models = modelsByProvider[config.id] ?? [];
    const modelCount = models.length;
    const apiKeyConfigured = Boolean(_secretRef);
    return {
      ...config,
      apiKeyConfigured,
      modelCount,
      health: normalizeProviderHealth({
        ...healthByProvider[config.id],
        apiKeyConfigured,
        modelCount,
      }),
      capabilities: summarizeModelCapabilities(models),
    };
  });
}

function orderedCapabilities(tags: Set<ModelCapabilityTag>): ModelCapabilityTag[] {
  return capabilityOrder.filter((tag) => tags.has(tag));
}

function isStaleInventory(modelInventoryUpdatedAt: string | undefined, now: string | undefined, staleAfterMs: number): boolean {
  if (!modelInventoryUpdatedAt || !now) {
    return false;
  }

  const updatedAtMs = Date.parse(modelInventoryUpdatedAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(updatedAtMs) || !Number.isFinite(nowMs)) {
    return false;
  }

  return nowMs - updatedAtMs > staleAfterMs;
}

function sanitizeHealthDetail(detail: string, apiKeyRef: string | undefined): string {
  let sanitized = redactOperatorText(detail, 'Provider reported an error during model discovery.');

  if (apiKeyRef) {
    sanitized = sanitized.replaceAll(apiKeyRef, '[redacted-ref]');
  }

  return sanitized.trim() || 'Provider reported an error during model discovery.';
}
