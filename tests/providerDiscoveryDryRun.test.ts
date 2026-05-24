import { describe, expect, it } from 'vitest';
import {
  buildProviderDiscoveryDryRun,
  summarizeDiscoveryDryRun,
  type ProviderDiscoveryFixture,
} from '../src/harness/providerDiscoveryDryRun';
import { createProfileFromDraft } from '../src/harness/providerProfileFlow';
import { type ProviderProfileCrypto } from '../src/harness/providerProfiles';

const clock = () => new Date('2026-05-23T10:00:00.000Z');
const now = '2026-05-24T10:00:00.000Z';
const staleAfterMs = 24 * 60 * 60 * 1000;

const fakeCrypto: ProviderProfileCrypto = {
  encrypt: (plaintext) => `fake:${plaintext.split('').reverse().join('')}`,
  decrypt: (ciphertext) => ciphertext.replace(/^fake:/, '').split('').reverse().join(''),
};

function profile(input: Parameters<typeof createProfileFromDraft>[0]) {
  return createProfileFromDraft(input, fakeCrypto, clock);
}

describe('provider discovery dry-run harness', () => {
  it('emits schema-versioned provider previews with status, severity, counts, capabilities, checkedAt, and guidance', () => {
    const previews = buildProviderDiscoveryDryRun({
      profiles: [
        profile({
          id: 'openai-main',
          kind: 'openai',
          displayName: 'OpenAI Main',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-preview-secret',
        }),
      ],
      fixturesByProvider: {
        'openai-main': {
          checkedAt: '2026-05-24T09:59:00.000Z',
          inventoryUpdatedAt: '2026-05-24T09:59:00.000Z',
          models: [{ id: 'gpt-4.1-mini', display_name: 'GPT 4.1 mini' }],
        },
      },
      now,
      staleAfterMs,
    });

    expect(previews).toEqual([
      {
        schemaVersion: 'provider-discovery-dry-run/v1',
        provider: { id: 'openai-main', name: 'OpenAI Main', kind: 'openai' },
        status: 'ready',
        severity: 'success',
        modelCount: 1,
        capabilities: {
          counts: { text: 1, fast: 1, longContext: 1, toolUse: 1 },
          tags: ['text', 'fast', 'longContext', 'toolUse'],
        },
        checkedAt: '2026-05-24T09:59:00.000Z',
        guidance: 'Dry-run fixture has current local model inventory for preview only.',
        models: [{ id: 'gpt-4.1-mini', displayName: 'GPT 4.1 mini', providerKind: 'openai', capabilities: ['text', 'fast', 'longContext', 'toolUse'] }],
        issues: [],
      },
    ]);
    expect(JSON.stringify(previews)).not.toContain('sk-preview-secret');
    expect(JSON.stringify(previews)).not.toContain('fake:');
  });

  it('reports missing key without inspecting fixture payload or leaking secret-like data', () => {
    const throwingFixture = Object.defineProperty({}, 'models', {
      get() {
        throw new Error('fixture should not be inspected');
      },
    }) as ProviderDiscoveryFixture;

    const previews = buildProviderDiscoveryDryRun({
      profiles: [
        profile({ id: 'missing-key', kind: 'anthropic', displayName: 'Missing Key', baseUrl: 'https://api.anthropic.com' }),
      ],
      fixturesByProvider: {
        'missing-key': throwingFixture,
      },
      now,
      staleAfterMs,
    });

    expect(previews[0]).toMatchObject({
      provider: { id: 'missing-key', name: 'Missing Key', kind: 'anthropic' },
      status: 'needs-key',
      severity: 'warning',
      modelCount: 0,
      guidance: 'Add local key material before previewing model discovery outcomes.',
      issues: [],
    });
    expect(JSON.stringify(previews)).not.toContain('Bearer');
    expect(JSON.stringify(previews)).not.toContain('API_KEY');
  });

  it('normalizes ready fixture models using existing model and capability helpers', () => {
    const previews = buildProviderDiscoveryDryRun({
      profiles: [
        profile({
          id: 'gemini-main',
          kind: 'gemini',
          displayName: 'Gemini',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          apiKey: 'AIza-preview-secret',
        }),
      ],
      fixturesByProvider: {
        'gemini-main': {
          checkedAt: '2026-05-24T08:00:00.000Z',
          inventoryUpdatedAt: '2026-05-24T08:00:00.000Z',
          models: [
            { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
            { name: 'models/text-embedding-004', displayName: 'Text Embedding 004' },
          ],
        },
      },
      now,
      staleAfterMs,
    });

    expect(previews[0].models).toEqual([
      { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', providerKind: 'gemini', capabilities: ['text', 'vision', 'reasoning', 'longContext', 'toolUse'] },
      { id: 'text-embedding-004', displayName: 'Text Embedding 004', providerKind: 'gemini', capabilities: ['embeddings'] },
    ]);
    expect(previews[0].capabilities).toEqual({
      counts: { text: 1, vision: 1, reasoning: 1, embeddings: 1, longContext: 1, toolUse: 1 },
      tags: ['text', 'vision', 'reasoning', 'embeddings', 'longContext', 'toolUse'],
    });
  });

  it('keeps empty model inventory distinct from missing key', () => {
    const previews = buildProviderDiscoveryDryRun({
      profiles: [
        profile({
          id: 'compatible-empty',
          kind: 'openai-compatible',
          displayName: 'Compatible Empty',
          baseUrl: 'https://models.example.test/v1',
          apiKey: 'sk-compatible-secret',
        }),
      ],
      fixturesByProvider: {
        'compatible-empty': {
          checkedAt: '2026-05-24T08:00:00.000Z',
          inventoryUpdatedAt: '2026-05-24T08:00:00.000Z',
          models: [],
        },
      },
      now,
      staleAfterMs,
    });

    expect(previews[0]).toMatchObject({
      status: 'empty',
      severity: 'info',
      modelCount: 0,
      guidance: 'Credentials are present, but the local fixture has no models to preview.',
    });
  });

  it('redacts degraded permission fixture errors, bearer tokens, API-key-looking strings, apiKeyRef text, and customer-like text', () => {
    const previews = buildProviderDiscoveryDryRun({
      profiles: [
        profile({
          id: 'degraded',
          kind: 'openai',
          displayName: 'Degraded',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-profile-secret',
        }),
      ],
      fixturesByProvider: {
        degraded: {
          checkedAt: '2026-05-24T07:00:00.000Z',
          inventoryUpdatedAt: '2026-05-24T07:00:00.000Z',
          apiKeyRef: 'OPENAI_API_KEY',
          error: {
            type: 'permission',
            message: '403 for Bearer token-abc123 using sk-fixture-secret and OPENAI_API_KEY in ACME customer',
          },
        },
      },
      now,
      staleAfterMs,
    });

    expect(previews[0]).toMatchObject({
      status: 'degraded',
      severity: 'error',
      modelCount: 0,
      guidance: 'Review the sanitized local fixture error before enabling real discovery.',
      issues: [
        {
          code: 'fixture-permission',
          message: '403 for [redacted] using [redacted] and [redacted-ref] in [redacted]',
        },
      ],
    });
    expect(JSON.stringify(previews)).not.toContain('Bearer token-abc123');
    expect(JSON.stringify(previews)).not.toContain('sk-fixture-secret');
    expect(JSON.stringify(previews)).not.toContain('OPENAI_API_KEY');
    expect(JSON.stringify(previews)).not.toContain('ACME customer');
  });

  it('marks inventory stale when fixture timestamp is older than injected now and threshold', () => {
    const previews = buildProviderDiscoveryDryRun({
      profiles: [
        profile({
          id: 'stale',
          kind: 'anthropic',
          displayName: 'Stale',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-ant-preview-secret',
        }),
      ],
      fixturesByProvider: {
        stale: {
          checkedAt: '2026-05-24T09:00:00.000Z',
          inventoryUpdatedAt: '2026-05-22T09:59:59.000Z',
          models: [{ id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' }],
        },
      },
      now,
      staleAfterMs,
    });

    expect(previews[0]).toMatchObject({
      status: 'stale',
      severity: 'warning',
      modelCount: 1,
      guidance: 'Refresh the local fixture before trusting routing or capability previews.',
    });
  });

  it('turns malformed and unsupported fixture payloads into typed issues instead of throwing', () => {
    const previews = buildProviderDiscoveryDryRun({
      profiles: [
        profile({
          id: 'malformed',
          kind: 'openai',
          displayName: 'Malformed',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-malformed-secret',
        }),
        profile({
          id: 'unsupported',
          kind: 'gemini',
          displayName: 'Unsupported',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          apiKey: 'AIza-unsupported-secret',
        }),
      ],
      fixturesByProvider: {
        malformed: { checkedAt: 'not-a-date', inventoryUpdatedAt: '2026-05-24T08:00:00.000Z', models: { id: 'gpt-4.1' } },
        unsupported: 'raw json text',
      },
      now,
      staleAfterMs,
    });

    expect(previews.map((preview) => [preview.provider.id, preview.status, preview.severity])).toEqual([
      ['malformed', 'malformed', 'error'],
      ['unsupported', 'malformed', 'error'],
    ]);
    expect(previews[0].issues).toEqual([
      { code: 'invalid-checked-at', message: 'Fixture checkedAt must be an ISO timestamp.' },
      { code: 'invalid-models', message: 'Fixture models must be an array.' },
    ]);
    expect(previews[1].issues).toEqual([
      { code: 'unsupported-fixture', message: 'Fixture payload must be a local object.' },
    ]);
  });

  it('aggregates counts by status and severity with deterministic next actions', () => {
    const previews = buildProviderDiscoveryDryRun({
      profiles: [
        profile({ id: 'missing-key', kind: 'openai', displayName: 'Missing', baseUrl: 'https://api.openai.com/v1' }),
        profile({ id: 'ready', kind: 'openai', displayName: 'Ready', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-ready-secret' }),
        profile({ id: 'empty', kind: 'openai', displayName: 'Empty', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-empty-secret' }),
        profile({ id: 'degraded', kind: 'openai', displayName: 'Degraded', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-degraded-secret' }),
        profile({ id: 'stale', kind: 'openai', displayName: 'Stale', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-stale-secret' }),
        profile({ id: 'malformed', kind: 'openai', displayName: 'Malformed', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-bad-secret' }),
      ],
      fixturesByProvider: {
        ready: { checkedAt: now, inventoryUpdatedAt: now, models: [{ id: 'gpt-4.1' }] },
        empty: { checkedAt: now, inventoryUpdatedAt: now, models: [] },
        degraded: { checkedAt: now, error: { type: 'degraded', message: 'HTTP 429' } },
        stale: { checkedAt: now, inventoryUpdatedAt: '2026-05-22T09:59:59.000Z', models: [{ id: 'gpt-4.1' }] },
        malformed: { checkedAt: now, models: { id: 'gpt-4.1' } },
      },
      now,
      staleAfterMs,
    });

    expect(summarizeDiscoveryDryRun(previews)).toEqual({
      schemaVersion: 'provider-discovery-dry-run-summary/v1',
      providerCount: 6,
      modelCount: 2,
      countsByStatus: { 'needs-key': 1, ready: 1, empty: 1, degraded: 1, stale: 1, malformed: 1 },
      countsBySeverity: { warning: 2, success: 1, info: 1, error: 2 },
      nextActions: [
        'Add local key material for 1 provider before discovery preview.',
        'Review sanitized fixture errors for 1 provider.',
        'Refresh stale fixture inventory for 1 provider.',
        'Fix malformed local fixtures for 1 provider.',
        'Add fixture models for 1 configured provider with empty inventory.',
      ],
    });
  });
});
