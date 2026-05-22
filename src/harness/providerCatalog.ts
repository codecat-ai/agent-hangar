export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';
export interface ProviderConfig { id: string; kind: ProviderKind; displayName: string; baseUrl: string; apiKeyRef?: string }
export interface NormalizedModel { id: string; displayName: string; providerKind: ProviderKind }
export interface ProviderCard { id: string; kind: ProviderKind; displayName: string; baseUrl: string; apiKeyConfigured: boolean; modelCount: number; health: 'ready' | 'needs-key' | 'empty' }
export function normalizeProviderModel(providerKind: ProviderKind, raw: Record<string, unknown>): NormalizedModel {
  const source = String(raw.id ?? raw.name ?? '');
  const id = providerKind === 'gemini' ? source.replace(/^models\//, '') : source;
  return { id, displayName: String(raw.display_name ?? raw.displayName ?? id), providerKind };
}
export function buildProviderCatalog(configs: ProviderConfig[], modelsByProvider: Record<string, NormalizedModel[]>): ProviderCard[] {
  return configs.map(({ apiKeyRef: _secretRef, ...config }) => {
    const modelCount = modelsByProvider[config.id]?.length ?? 0;
    const apiKeyConfigured = Boolean(_secretRef);
    return { ...config, apiKeyConfigured, modelCount, health: !apiKeyConfigured ? 'needs-key' : modelCount > 0 ? 'ready' : 'empty' };
  });
}
