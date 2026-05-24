import { describe, expect, it } from 'vitest';
import {
  evaluateProviderDiscoveryAdapterShell,
  renderProviderDiscoveryAdapterMarkdown,
  type ProviderDiscoveryAdapterShellOptions,
} from '../src/harness/providerDiscoveryAdapterShell';
import { type ProviderDiscoveryFixture } from '../src/harness/providerDiscoveryDryRun';
import { createProfileFromDraft } from '../src/harness/providerProfileFlow';
import { type ProviderProfileCrypto } from '../src/harness/providerProfiles';

const clock = () => new Date('2026-05-23T10:00:00.000Z');
const options: ProviderDiscoveryAdapterShellOptions = {
  requestId: 'discovery-request-001',
  requestedAt: '2026-05-24T10:00:00.000Z',
  now: '2026-05-24T10:00:00.000Z',
  staleAfterMs: 24 * 60 * 60 * 1000,
  timeoutMs: 5000,
  retryLimit: 0,
};

const fakeCrypto: ProviderProfileCrypto = {
  encrypt: (plaintext) => `fake:${plaintext.split('').reverse().join('')}`,
  decrypt: (ciphertext) => ciphertext.replace(/^fake:/, '').split('').reverse().join(''),
};

function profile(input: Parameters<typeof createProfileFromDraft>[0]) {
  return createProfileFromDraft(input, fakeCrypto, clock);
}

function expectSecretSafe(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  expect(text).not.toContain('sk-');
  expect(text).not.toContain('sk-ant');
  expect(text).not.toContain('AIza');
  expect(text).not.toContain('Bearer token-abc123');
  expect(text).not.toContain('fake:');
  expect(text).not.toContain('OPENAI_API_KEY');
  expect(text).not.toContain('ACME customer');
}

describe('provider discovery adapter shell', () => {
  it('is disabled by default, does not inspect fixtures, and returns a typed blocked result', () => {
    const fixture = Object.defineProperty({}, 'models', {
      get() {
        throw new Error('fixture must not be inspected while adapter is disabled');
      },
    }) as ProviderDiscoveryFixture;

    const result = evaluateProviderDiscoveryAdapterShell({
      profile: profile({
        id: 'openai-main',
        kind: 'openai',
        displayName: 'OpenAI Main',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-profile-secret',
      }),
      fixture,
    });

    expect(result).toMatchObject({
      schemaVersion: 'provider-discovery-adapter-shell/v1',
      adapter: {
        id: 'fixture-provider-discovery-adapter-shell',
        mode: 'fixture-only',
        enabled: false,
      },
      status: 'blocked',
      severity: 'warning',
      issueCount: 1,
      modelCount: 0,
      issues: [
        {
          code: 'adapter-disabled',
          severity: 'warning',
          retryable: false,
          message: 'Provider discovery adapter shell is disabled by default.',
          nextAction: 'Enable the fixture adapter shell in local demo state before requesting discovery.',
        },
      ],
      nextActions: ['Enable the fixture adapter shell in local demo state before requesting discovery.'],
      audit: {
        requestId: 'not-requested',
        providerId: 'openai',
        profileId: 'openai-main',
        attemptCount: 0,
        durationMs: 0,
        status: 'blocked',
        issueCodes: ['adapter-disabled'],
      },
    });
    expect(result.request.requestedAt).toBeUndefined();
    expectSecretSafe(result);
  });

  it('requires explicit operator consent and injected options before evaluating local fixtures', () => {
    const result = evaluateProviderDiscoveryAdapterShell({
      profile: profile({
        id: 'anthropic-main',
        kind: 'anthropic',
        displayName: 'Anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-profile-secret',
      }),
      fixture: {
        checkedAt: options.requestedAt,
        inventoryUpdatedAt: options.requestedAt,
        models: [{ id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' }],
      },
      state: { enabled: true, options },
    });

    expect(result).toMatchObject({
      status: 'blocked',
      severity: 'warning',
      issueCount: 1,
      issues: [
        {
          code: 'missing-operator-consent',
          severity: 'warning',
          retryable: false,
          message: 'Provider discovery requires explicit operator consent.',
          nextAction: 'Trigger discovery from an operator-visible control before using fixtures.',
        },
      ],
      nextActions: ['Trigger discovery from an operator-visible control before using fixtures.'],
    });
    expect(result.models).toEqual([]);
    expectSecretSafe(result);

    const missingOptions = evaluateProviderDiscoveryAdapterShell({
      profile: profile({
        id: 'openai-main',
        kind: 'openai',
        displayName: 'OpenAI Main',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-profile-secret',
      }),
      fixture: {
        checkedAt: options.requestedAt,
        inventoryUpdatedAt: options.requestedAt,
        models: [{ id: 'gpt-4.1' }],
      },
      state: { enabled: true, consent: 'operator-initiated' },
    });

    expect(missingOptions).toMatchObject({
      status: 'blocked',
      severity: 'warning',
      issueCount: 1,
      issues: [
        {
          code: 'missing-request-options',
          severity: 'warning',
          retryable: false,
          message: 'Provider discovery requires injected request options.',
          nextAction: 'Provide request id, timestamps, timeout, retry, and freshness options from local demo state.',
        },
      ],
    });
    expect(missingOptions.models).toEqual([]);
    expectSecretSafe(missingOptions);
  });

  it('normalizes the ready path through existing dry-run and catalog helpers with clone-safe output', () => {
    const result = evaluateProviderDiscoveryAdapterShell({
      profile: profile({
        id: 'gemini-main',
        kind: 'gemini',
        displayName: 'Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'AIza-profile-secret',
      }),
      fixture: {
        checkedAt: '2026-05-24T09:55:00.000Z',
        inventoryUpdatedAt: '2026-05-24T09:55:00.000Z',
        models: [
          { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
          { name: 'models/text-embedding-004', displayName: 'Text Embedding 004' },
        ],
      },
      state: { enabled: true, consent: 'operator-initiated', options },
    });

    expect(result).toEqual({
      schemaVersion: 'provider-discovery-adapter-shell/v1',
      adapter: {
        id: 'fixture-provider-discovery-adapter-shell',
        mode: 'fixture-only',
        enabled: true,
      },
      request: {
        schemaVersion: 'provider-discovery-adapter-request/v1',
        requestId: 'discovery-request-001',
        profileId: 'gemini-main',
        providerId: 'gemini',
        consent: 'operator-initiated',
        requestedAt: '2026-05-24T10:00:00.000Z',
        timeoutMs: 5000,
        retryLimit: 0,
        staleAfterMs: 86400000,
      },
      provider: { id: 'gemini-main', name: 'Gemini', kind: 'gemini' },
      status: 'ready',
      severity: 'success',
      issueCount: 0,
      modelCount: 2,
      checkedAt: '2026-05-24T09:55:00.000Z',
      capabilities: {
        counts: { text: 1, vision: 1, reasoning: 1, embeddings: 1, longContext: 1, toolUse: 1 },
        tags: ['text', 'vision', 'reasoning', 'embeddings', 'longContext', 'toolUse'],
      },
      models: [
        { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', providerKind: 'gemini', capabilities: ['text', 'vision', 'reasoning', 'longContext', 'toolUse'] },
        { id: 'text-embedding-004', displayName: 'Text Embedding 004', providerKind: 'gemini', capabilities: ['embeddings'] },
      ],
      issues: [],
      nextActions: ['Review the fixture-backed inventory preview before enabling any future live adapter.'],
      audit: {
        requestId: 'discovery-request-001',
        providerId: 'gemini',
        profileId: 'gemini-main',
        attemptCount: 1,
        durationMs: 0,
        requestedAt: '2026-05-24T10:00:00.000Z',
        completedAt: '2026-05-24T10:00:00.000Z',
        status: 'ready',
        issueCodes: [],
      },
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expectSecretSafe(result);
  });

  it('maps degraded, permission, malformed, and stale fixtures to typed issues and injected-time guidance', () => {
    const baseProfile = profile({
      id: 'openai-main',
      kind: 'openai',
      displayName: 'OpenAI Main',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-profile-secret',
    });

    const permission = evaluateProviderDiscoveryAdapterShell({
      profile: baseProfile,
      fixture: {
        checkedAt: '2026-05-24T09:00:00.000Z',
        apiKeyRef: 'OPENAI_API_KEY',
        error: {
          type: 'permission',
          message: '403 for Bearer token-abc123 using OPENAI_API_KEY in ACME customer',
        },
      },
      state: { enabled: true, consent: 'operator-initiated', options },
    });
    const malformed = evaluateProviderDiscoveryAdapterShell({
      profile: baseProfile,
      fixture: { checkedAt: 'not-a-date', models: { id: 'gpt-4.1' } },
      state: { enabled: true, consent: 'operator-initiated', options },
    });
    const stale = evaluateProviderDiscoveryAdapterShell({
      profile: baseProfile,
      fixture: {
        checkedAt: '2026-05-24T09:00:00.000Z',
        inventoryUpdatedAt: '2026-05-22T09:59:59.000Z',
        models: [{ id: 'gpt-4.1-mini', display_name: 'GPT 4.1 mini' }],
      },
      state: { enabled: true, consent: 'operator-initiated', options },
    });

    expect(permission.status).toBe('degraded');
    expect(permission.issues).toEqual([
      {
        code: 'fixture-permission',
        severity: 'error',
        retryable: false,
        message: '403 for [redacted] using [redacted-ref] in [redacted]',
        nextAction: 'Review provider permissions in local configuration before retrying discovery.',
      },
    ]);
    expect(malformed.status).toBe('malformed');
    expect(malformed.issues.map((issue) => issue.code)).toEqual(['invalid-checked-at', 'invalid-models']);
    expect(stale.status).toBe('stale');
    expect(stale.issues).toEqual([
      {
        code: 'stale-fixture-inventory',
        severity: 'warning',
        retryable: true,
        message: 'Fixture inventory is older than the injected freshness threshold.',
        nextAction: 'Refresh the local fixture before trusting routing or capability previews.',
      },
    ]);
    expect(stale.audit.completedAt).toBe(options.requestedAt);
    expectSecretSafe([permission, malformed, stale]);
  });

  it('renders deterministic secret-safe Markdown preview output', () => {
    const result = evaluateProviderDiscoveryAdapterShell({
      profile: profile({
        id: 'openai-main',
        kind: 'openai',
        displayName: 'OpenAI Main',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-profile-secret',
      }),
      fixture: {
        checkedAt: '2026-05-24T09:00:00.000Z',
        inventoryUpdatedAt: '2026-05-24T09:00:00.000Z',
        apiKeyRef: 'OPENAI_API_KEY',
        error: {
          type: 'degraded',
          message: 'Provider returned Bearer token-abc123 for OPENAI_API_KEY in ACME customer',
        },
      },
      state: { enabled: true, consent: 'operator-initiated', options },
    });

    const markdown = renderProviderDiscoveryAdapterMarkdown(result);

    expect(markdown).toBe(`# Provider Discovery Adapter Shell

schemaVersion: provider-discovery-adapter-shell/v1
requestId: discovery-request-001
profileId: openai-main
providerId: openai
status: degraded

## Summary
- Adapter: fixture-provider-discovery-adapter-shell
- Mode: fixture-only
- Enabled: yes
- Consent: operator-initiated
- Models: 0
- Issues: 1
- Checked at: 2026-05-24T09:00:00.000Z

## Issues
- fixture-degraded | error | Provider returned [redacted] for [redacted-ref] in [redacted]

## Next Actions
- Review sanitized fixture errors before enabling any future live adapter.
`);
    expectSecretSafe(markdown);
  });
});
