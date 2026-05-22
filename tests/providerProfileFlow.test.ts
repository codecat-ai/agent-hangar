import { describe, expect, it } from 'vitest';
import {
  createProfileFromDraft,
  deleteProviderProfileById,
  summarizeProviderProfiles,
  updateProfileFromDraft,
  type ProviderProfileDraft,
} from '../src/harness/providerProfileFlow';
import { type ProviderProfileCrypto } from '../src/harness/providerProfiles';

const clock = () => new Date('2026-05-23T10:00:00.000Z');
const laterClock = () => new Date('2026-05-23T10:30:00.000Z');

const fakeCrypto: ProviderProfileCrypto = {
  encrypt: (plaintext) => `fake:${plaintext.split('').reverse().join('')}`,
  decrypt: (ciphertext) => ciphertext.replace(/^fake:/, '').split('').reverse().join(''),
};

const draft: ProviderProfileDraft = {
  id: ' openai-main ',
  kind: 'openai',
  displayName: ' OpenAI Main ',
  baseUrl: ' https://api.openai.com/v1 ',
  apiKey: ' sk-local-create-secret ',
};

describe('provider profile UI flow helpers', () => {
  it('creates a profile from trimmed form fields without retaining plaintext key material', () => {
    const profile = createProfileFromDraft(draft, fakeCrypto, clock);

    expect(profile).toEqual({
      id: 'openai-main',
      kind: 'openai',
      displayName: 'OpenAI Main',
      baseUrl: 'https://api.openai.com/v1',
      createdAt: '2026-05-23T10:00:00.000Z',
      updatedAt: '2026-05-23T10:00:00.000Z',
      encryptedApiKey: 'fake:terces-etaerc-lacol-ks',
    });
    expect(JSON.stringify(profile)).not.toContain('sk-local-create-secret');
  });

  it('edits public metadata while preserving the configured key when no replacement key is entered', () => {
    const original = createProfileFromDraft(draft, fakeCrypto, clock);
    const updated = updateProfileFromDraft(original, {
      id: ' ignored-id ',
      kind: 'anthropic',
      displayName: ' Updated OpenAI ',
      baseUrl: ' https://proxy.example.test/v1 ',
      apiKey: '   ',
    }, fakeCrypto, laterClock);

    expect(updated).toMatchObject({
      id: 'openai-main',
      kind: 'anthropic',
      displayName: 'Updated OpenAI',
      baseUrl: 'https://proxy.example.test/v1',
      createdAt: '2026-05-23T10:00:00.000Z',
      updatedAt: '2026-05-23T10:30:00.000Z',
      encryptedApiKey: original.encryptedApiKey,
    });
  });

  it('replaces API key material without exposing raw or encrypted key values in profile summaries', () => {
    const original = createProfileFromDraft(draft, fakeCrypto, clock);
    const updated = updateProfileFromDraft(original, {
      id: original.id,
      kind: original.kind,
      displayName: original.displayName,
      baseUrl: original.baseUrl,
      apiKey: ' sk-local-replacement-secret ',
    }, fakeCrypto, laterClock);
    const summaries = summarizeProviderProfiles([updated], {
      [updated.id]: [{ id: 'gpt-4.1', displayName: 'GPT 4.1', providerKind: 'openai' }],
    }, '2026-05-23T10:30:00.000Z');

    expect(updated.encryptedApiKey).toBe('fake:terces-tnemecalper-lacol-ks');
    expect(JSON.stringify(summaries)).not.toContain('sk-local-replacement-secret');
    expect(JSON.stringify(summaries)).not.toContain(updated.encryptedApiKey);
    expect(summaries[0]).toMatchObject({
      id: 'openai-main',
      keyStatus: 'Configured',
      refreshStatus: 'Ready',
      health: { status: 'ready' },
    });
  });

  it('deletes profiles by id without mutating the original profile list', () => {
    const first = createProfileFromDraft(draft, fakeCrypto, clock);
    const second = createProfileFromDraft({
      id: 'anthropic-main',
      kind: 'anthropic',
      displayName: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-local-second-secret',
    }, fakeCrypto, clock);
    const profiles = [first, second];

    expect(deleteProviderProfileById(profiles, 'openai-main')).toEqual([second]);
    expect(profiles).toEqual([first, second]);
  });

  it('summarizes missing-key, degraded, stale, and empty provider states deterministically', () => {
    const profiles = [
      createProfileFromDraft({ id: 'missing-key', kind: 'openai', displayName: 'Missing', baseUrl: 'https://api.openai.com/v1' }, fakeCrypto, clock),
      createProfileFromDraft({
        id: 'degraded',
        kind: 'gemini',
        displayName: 'Degraded',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'sk-local-degraded-secret',
        health: { checkedAt: '2026-05-23T09:55:00.000Z', status: 'degraded', message: 'Model discovery failed with sk-local-degraded-secret' },
      }, fakeCrypto, clock),
      createProfileFromDraft({
        id: 'stale',
        kind: 'anthropic',
        displayName: 'Stale',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-local-stale-secret',
        health: { checkedAt: '2026-05-23T09:55:00.000Z', modelInventoryUpdatedAt: '2026-05-20T10:00:00.000Z' },
      }, fakeCrypto, clock),
      createProfileFromDraft({
        id: 'empty',
        kind: 'openai-compatible',
        displayName: 'Empty',
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'sk-local-empty-secret',
        health: { checkedAt: '2026-05-23T09:55:00.000Z' },
      }, fakeCrypto, clock),
    ];

    const summaries = summarizeProviderProfiles(profiles, {
      stale: [{ id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', providerKind: 'anthropic' }],
    }, '2026-05-23T10:00:00.000Z');

    expect(summaries.map((summary) => [summary.id, summary.health.status, summary.keyStatus, summary.refreshStatus])).toEqual([
      ['missing-key', 'needs-key', 'Missing', 'Missing API key'],
      ['degraded', 'degraded', 'Configured', 'Provider degraded'],
      ['stale', 'stale', 'Configured', 'Stale model inventory'],
      ['empty', 'empty', 'Configured', 'No models discovered'],
    ]);
    expect(JSON.stringify(summaries)).not.toContain('sk-local');
    expect(JSON.stringify(summaries)).not.toContain('fake:');
  });
});
