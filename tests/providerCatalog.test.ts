import { describe, expect, it } from 'vitest';
import {
  buildProviderCatalog,
  normalizeModelCapabilities,
  normalizeProviderHealth,
  normalizeProviderModel,
} from '../src/harness/providerCatalog';

describe('provider catalog harness', () => {
  it('normalizes OpenAI, Anthropic, Gemini and third-party models into one shape', () => {
    expect(normalizeProviderModel('openai', { id: 'gpt-4.1', created: 123 })).toMatchObject({ id: 'gpt-4.1', displayName: 'gpt-4.1', providerKind: 'openai' });
    expect(normalizeProviderModel('anthropic', { id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' })).toMatchObject({ id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', providerKind: 'anthropic' });
    expect(normalizeProviderModel('gemini', { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' })).toMatchObject({ id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', providerKind: 'gemini' });
    expect(normalizeProviderModel('openai-compatible', { id: 'nous/hermes-4' })).toMatchObject({ id: 'nous/hermes-4', providerKind: 'openai-compatible' });
  });

  it('builds provider cards with model discovery status and secret-safe metadata', () => {
    const catalog = buildProviderCatalog([{ id: 'openai-main', kind: 'openai', displayName: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyRef: 'OPENAI_API_KEY' }], { 'openai-main': [{ id: 'gpt-4.1', displayName: 'GPT 4.1', providerKind: 'openai' }] });
    expect(catalog[0]).toEqual({
      id: 'openai-main',
      kind: 'openai',
      displayName: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyConfigured: true,
      modelCount: 1,
      health: {
        status: 'ready',
        label: 'Ready',
        detail: 'Provider is reachable with 1 discovered model.',
        checkedAt: undefined,
      },
      capabilities: {
        counts: { text: 1, reasoning: 1, longContext: 1, toolUse: 1 },
        tags: ['text', 'reasoning', 'longContext', 'toolUse'],
      },
    });
    expect(JSON.stringify(catalog)).not.toContain('OPENAI_API_KEY');
  });

  it('normalizes provider health without exposing secret references', () => {
    expect(normalizeProviderHealth({
      apiKeyConfigured: false,
      modelCount: 4,
      modelInventoryUpdatedAt: '2026-05-23T09:30:00.000Z',
      now: '2026-05-23T10:00:00.000Z',
    })).toMatchObject({
      status: 'needs-key',
      label: 'Missing API key',
    });

    expect(normalizeProviderHealth({
      apiKeyConfigured: true,
      modelCount: 0,
      modelInventoryUpdatedAt: '2026-05-23T09:30:00.000Z',
      now: '2026-05-23T10:00:00.000Z',
    })).toMatchObject({
      status: 'empty',
      label: 'No models discovered',
    });

    expect(normalizeProviderHealth({
      apiKeyConfigured: true,
      modelCount: 1,
      lastError: 'HTTP 429 from model list endpoint',
      modelInventoryUpdatedAt: '2026-05-23T09:30:00.000Z',
      now: '2026-05-23T10:00:00.000Z',
    })).toMatchObject({
      status: 'degraded',
      label: 'Provider degraded',
      detail: 'HTTP 429 from model list endpoint',
    });

    expect(normalizeProviderHealth({
      apiKeyConfigured: true,
      modelCount: 2,
      modelInventoryUpdatedAt: '2026-05-21T09:59:59.000Z',
      now: '2026-05-23T10:00:00.000Z',
      staleAfterMs: 48 * 60 * 60 * 1000,
    })).toMatchObject({
      status: 'stale',
      label: 'Stale model inventory',
    });

    expect(JSON.stringify(normalizeProviderHealth({
      apiKeyConfigured: false,
      modelCount: 0,
      apiKeyRef: 'SECRET_ENV_VAR',
      now: '2026-05-23T10:00:00.000Z',
    }))).not.toContain('SECRET_ENV_VAR');

    expect(JSON.stringify(normalizeProviderHealth({
      apiKeyConfigured: true,
      modelCount: 1,
      apiKeyRef: 'SECRET_ENV_VAR',
      lastError: 'Model discovery failed with SECRET_ENV_VAR=sk-test-secret',
      now: '2026-05-23T10:00:00.000Z',
    }))).not.toContain('sk-test-secret');
  });

  it('derives conservative model capability tags from provider and model names', () => {
    expect(normalizeModelCapabilities({ id: 'gpt-4.1-mini', displayName: 'GPT 4.1 mini', providerKind: 'openai' })).toEqual(['text', 'fast', 'longContext', 'toolUse']);
    expect(normalizeModelCapabilities({ id: 'gpt-4o', displayName: 'GPT-4o', providerKind: 'openai' })).toEqual(['text', 'vision', 'toolUse']);
    expect(normalizeModelCapabilities({ id: 'o3', displayName: 'o3', providerKind: 'openai' })).toEqual(['text', 'reasoning', 'toolUse']);
    expect(normalizeModelCapabilities({ id: 'text-embedding-3-large', displayName: 'text-embedding-3-large', providerKind: 'openai' })).toEqual(['embeddings']);
    expect(normalizeModelCapabilities({ id: 'claude-3-5-haiku-latest', displayName: 'Claude 3.5 Haiku', providerKind: 'anthropic' })).toEqual(['text', 'vision', 'fast', 'longContext', 'toolUse']);
    expect(normalizeModelCapabilities({ id: 'unknown-local-model', displayName: 'Unknown Local Model', providerKind: 'openai-compatible' })).toEqual(['text']);
  });

  it('adds health details and capability summaries to provider cards', () => {
    const catalog = buildProviderCatalog([
      { id: 'anthropic-main', kind: 'anthropic', displayName: 'Anthropic', baseUrl: 'https://api.anthropic.com', apiKeyRef: 'ANTHROPIC_API_KEY' },
      { id: 'third-party', kind: 'openai-compatible', displayName: 'Compatible', baseUrl: 'https://api.example.com/v1' },
    ], {
      'anthropic-main': [
        { id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', providerKind: 'anthropic' },
        { id: 'claude-3-5-haiku-latest', displayName: 'Claude 3.5 Haiku', providerKind: 'anthropic' },
      ],
    }, {
      'anthropic-main': {
        modelInventoryUpdatedAt: '2026-05-23T09:30:00.000Z',
        now: '2026-05-23T10:00:00.000Z',
      },
      'third-party': {
        now: '2026-05-23T10:00:00.000Z',
      },
    });

    expect(catalog[0].health).toMatchObject({ status: 'ready', label: 'Ready' });
    expect(catalog[0].capabilities).toEqual({
      counts: { text: 2, vision: 1, reasoning: 1, fast: 1, longContext: 2, toolUse: 2 },
      tags: ['text', 'vision', 'reasoning', 'fast', 'longContext', 'toolUse'],
    });
    expect(catalog[1].health).toMatchObject({ status: 'needs-key' });
    expect(JSON.stringify(catalog)).not.toContain('ANTHROPIC_API_KEY');
  });
});
