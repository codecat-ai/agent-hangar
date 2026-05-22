import { describe, expect, it } from 'vitest';
import {
  createProviderProfile,
  decryptProviderApiKey,
  localDemoProviderProfileCrypto,
  toProviderCard,
  updateProviderApiKey,
  type ProviderProfileCrypto,
} from '../src/harness/providerProfiles';

const clock = () => new Date('2026-05-23T10:00:00.000Z');
const laterClock = () => new Date('2026-05-23T10:05:00.000Z');

const fakeCrypto: ProviderProfileCrypto = {
  encrypt: (plaintext) => `fake:${plaintext.split('').reverse().join('')}`,
  decrypt: (ciphertext) => ciphertext.replace(/^fake:/, '').split('').reverse().join(''),
};

describe('provider profile vault harness', () => {
  it('creates a trimmed encrypted provider profile without plaintext secrets', () => {
    const profile = createProviderProfile({
      id: ' openai-main ',
      kind: 'openai',
      displayName: ' OpenAI Main ',
      baseUrl: ' https://api.openai.com/v1 ',
      apiKey: 'sk-test-secret',
    }, fakeCrypto, clock);

    expect(profile).toEqual({
      id: 'openai-main',
      kind: 'openai',
      displayName: 'OpenAI Main',
      baseUrl: 'https://api.openai.com/v1',
      createdAt: '2026-05-23T10:00:00.000Z',
      updatedAt: '2026-05-23T10:00:00.000Z',
      encryptedApiKey: 'fake:terces-tset-ks',
    });
    expect('apiKey' in profile).toBe(false);
  });

  it('keeps provider card JSON secret-safe while reflecting models and health', () => {
    const profile = createProviderProfile({
      id: 'anthropic-main',
      kind: 'anthropic',
      displayName: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant-secret',
    }, fakeCrypto, clock);

    const card = toProviderCard(profile, [{ id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', providerKind: 'anthropic' }]);

    expect(card).toEqual({
      id: 'anthropic-main',
      kind: 'anthropic',
      displayName: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
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
    expect(JSON.stringify(profile)).not.toContain('sk-ant-secret');
    expect(JSON.stringify(card)).not.toContain('sk-ant-secret');
  });

  it('marks missing-key provider cards as needs-key before model readiness', () => {
    const profile = createProviderProfile({
      id: 'gemini-main',
      kind: 'gemini',
      displayName: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    }, fakeCrypto, clock);

    expect(profile.encryptedApiKey).toBeUndefined();
    expect(toProviderCard(profile, [{ id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', providerKind: 'gemini' }])).toMatchObject({
      apiKeyConfigured: false,
      modelCount: 1,
      health: {
        status: 'needs-key',
        label: 'Missing API key',
      },
    });
  });

  it('rejects invalid ids, kinds, and URLs', () => {
    expect(() => createProviderProfile({
      id: 'bad id',
      kind: 'openai',
      displayName: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
    }, fakeCrypto, clock)).toThrow(/id/i);

    expect(() => createProviderProfile({
      id: 'local',
      kind: 'ollama',
      displayName: 'Local',
      baseUrl: 'https://example.test',
    }, fakeCrypto, clock)).toThrow(/kind/i);

    expect(() => createProviderProfile({
      id: 'bad-url',
      kind: 'openai-compatible',
      displayName: 'Bad URL',
      baseUrl: 'ftp://example.test',
    }, fakeCrypto, clock)).toThrow(/baseUrl/i);
  });

  it('updates an API key while preserving createdAt and metadata', () => {
    const profile = createProviderProfile({
      id: 'compatible-main',
      kind: 'openai-compatible',
      displayName: 'Compatible',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'old-secret',
      health: { checkedAt: '2026-05-23T09:59:00.000Z', status: 'empty' },
      capabilities: { models: ['local-model'], supportsStreaming: true },
    }, fakeCrypto, clock);

    const updated = updateProviderApiKey(profile, 'new-secret', fakeCrypto, laterClock);

    expect(updated.createdAt).toBe('2026-05-23T10:00:00.000Z');
    expect(updated.updatedAt).toBe('2026-05-23T10:05:00.000Z');
    expect(updated.encryptedApiKey).toBe('fake:terces-wen');
    expect(updated.health).toEqual(profile.health);
    expect(updated.capabilities).toEqual(profile.capabilities);
    expect(JSON.stringify(updated)).not.toContain('new-secret');
  });

  it('decrypts only through explicit calls and returns undefined without a key', () => {
    const profile = createProviderProfile({
      id: 'openai-main',
      kind: 'openai',
      displayName: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-secret',
    }, fakeCrypto, clock);
    const emptyProfile = createProviderProfile({
      id: 'no-key',
      kind: 'openai',
      displayName: 'No Key',
      baseUrl: 'https://api.openai.com/v1',
    }, fakeCrypto, clock);

    expect(decryptProviderApiKey(profile, fakeCrypto)).toBe('sk-test-secret');
    expect(decryptProviderApiKey(emptyProfile, fakeCrypto)).toBeUndefined();
  });

  it('provides a deterministic local demo crypto adapter that is clearly replaceable', () => {
    const encrypted = localDemoProviderProfileCrypto.encrypt('demo-secret');

    expect(encrypted).toMatch(/^local-demo:v1:/);
    expect(localDemoProviderProfileCrypto.decrypt(encrypted)).toBe('demo-secret');
  });
});
