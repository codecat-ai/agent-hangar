import { describe, expect, it } from 'vitest';
import { normalizeProviderModel, buildProviderCatalog } from '../src/harness/providerCatalog';

describe('provider catalog harness', () => {
  it('normalizes OpenAI, Anthropic, Gemini and third-party models into one shape', () => {
    expect(normalizeProviderModel('openai', { id: 'gpt-4.1', created: 123 })).toMatchObject({ id: 'gpt-4.1', displayName: 'gpt-4.1', providerKind: 'openai' });
    expect(normalizeProviderModel('anthropic', { id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' })).toMatchObject({ id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', providerKind: 'anthropic' });
    expect(normalizeProviderModel('gemini', { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' })).toMatchObject({ id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', providerKind: 'gemini' });
    expect(normalizeProviderModel('openai-compatible', { id: 'nous/hermes-4' })).toMatchObject({ id: 'nous/hermes-4', providerKind: 'openai-compatible' });
  });

  it('builds provider cards with model discovery status and secret-safe metadata', () => {
    const catalog = buildProviderCatalog([{ id: 'openai-main', kind: 'openai', displayName: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyRef: 'OPENAI_API_KEY' }], { 'openai-main': [{ id: 'gpt-4.1', displayName: 'GPT 4.1', providerKind: 'openai' }] });
    expect(catalog[0]).toEqual({ id: 'openai-main', kind: 'openai', displayName: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyConfigured: true, modelCount: 1, health: 'ready' });
    expect(JSON.stringify(catalog)).not.toContain('OPENAI_API_KEY');
  });
});
