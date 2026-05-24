import { describe, expect, it } from 'vitest';
import { createAgentRun, transitionRun } from '../src/harness/agentRuntime';
import { createProfileFromDraft } from '../src/harness/providerProfileFlow';
import {
  deriveAgentRunwayShellState,
  deriveProviderShellState,
  type AgentRunwayBinding,
} from '../src/harness/shellStates';
import { type ProviderProfileCrypto } from '../src/harness/providerProfiles';

const now = '2026-05-23T10:00:00.000Z';
const clock = () => new Date(now);
const fakeCrypto: ProviderProfileCrypto = {
  encrypt: (plaintext) => `fake:${plaintext.split('').reverse().join('')}`,
  decrypt: (ciphertext) => ciphertext.replace(/^fake:/, '').split('').reverse().join(''),
};

describe('shell state derivation', () => {
  it('derives provider empty, disconnected, stale, error, and ready states without secrets', () => {
    expect(deriveProviderShellState({ profiles: [], modelsByProvider: {}, now })).toEqual({
      status: 'empty',
      severity: 'info',
      label: 'No provider profiles',
      guidance: 'Create a local provider profile before binding templates or previewing runs.',
      summary: 'No provider profiles are configured.',
      affectedProfileIds: [],
    });

    const disconnected = createProfileFromDraft({
      id: 'missing-key',
      kind: 'openai',
      displayName: 'Missing Key',
      baseUrl: 'https://api.openai.com/v1',
    }, fakeCrypto, clock);
    expect(deriveProviderShellState({ profiles: [disconnected], modelsByProvider: {}, now })).toMatchObject({
      status: 'disconnected',
      severity: 'warning',
      label: 'Provider disconnected',
      affectedProfileIds: ['missing-key'],
    });

    const stale = createProfileFromDraft({
      id: 'stale-provider',
      kind: 'anthropic',
      displayName: 'Stale Provider',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-provider-secret',
      health: { checkedAt: now, modelInventoryUpdatedAt: '2026-05-20T10:00:00.000Z' },
    }, fakeCrypto, clock);
    expect(deriveProviderShellState({
      profiles: [stale],
      modelsByProvider: { 'stale-provider': [{ id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', providerKind: 'anthropic' }] },
      now,
    })).toMatchObject({
      status: 'stale',
      severity: 'warning',
      label: 'Model inventory stale',
      affectedProfileIds: ['stale-provider'],
    });

    const degraded = createProfileFromDraft({
      id: 'degraded-provider',
      kind: 'gemini',
      displayName: 'Degraded Provider',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'sk-provider-secret',
      health: { checkedAt: now, status: 'degraded', message: 'Bearer sk-provider-secret failed for ACME customer workspace' },
    }, fakeCrypto, clock);
    const errorState = deriveProviderShellState({ profiles: [degraded], modelsByProvider: {}, now });
    expect(errorState).toMatchObject({
      status: 'error',
      severity: 'error',
      label: 'Provider health error',
      affectedProfileIds: ['degraded-provider'],
    });
    expect(JSON.stringify(errorState)).not.toContain('sk-provider-secret');
    expect(JSON.stringify(errorState)).not.toContain('ACME');

    const ready = createProfileFromDraft({
      id: 'ready-provider',
      kind: 'openai-compatible',
      displayName: 'Ready Provider',
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'sk-ready-secret',
      health: { checkedAt: now, modelInventoryUpdatedAt: now },
    }, fakeCrypto, clock);
    expect(deriveProviderShellState({
      profiles: [ready],
      modelsByProvider: { 'ready-provider': [{ id: 'local-model', displayName: 'Local Model', providerKind: 'openai-compatible' }] },
      now,
    })).toEqual({
      status: 'ready',
      severity: 'success',
      label: 'Providers ready',
      guidance: 'Provider profiles have local credentials and current model inventory.',
      summary: '1 provider is ready for local demo binding previews.',
      affectedProfileIds: ['ready-provider'],
    });
  });

  it('derives agent runway progress, blocked, stale-warning, failed, and empty states without secrets', () => {
    expect(deriveAgentRunwayShellState({ runs: [], bindings: [], providerShellState: { status: 'empty' } })).toMatchObject({
      status: 'empty',
      severity: 'info',
      label: 'No agent runs',
    });

    const bindings: AgentRunwayBinding[] = [
      { agentId: 'planner', providerProfileId: 'ready-provider', templateId: 'template-planner' },
      { agentId: 'reviewer', providerProfileId: 'missing-provider', templateId: 'template-reviewer' },
    ];
    const blocked = deriveAgentRunwayShellState({
      runs: [createAgentRun('task-1', 'planner'), createAgentRun('task-1', 'reviewer')],
      bindings,
      providerShellState: { status: 'disconnected', affectedProfileIds: ['missing-provider'] },
    });
    expect(blocked).toMatchObject({
      status: 'blocked',
      severity: 'warning',
      label: 'Runway blocked',
      affectedAgentIds: ['reviewer'],
    });

    expect(deriveAgentRunwayShellState({
      runs: [transitionRun(createAgentRun('task-1', 'planner'), 'working')],
      bindings: [{ agentId: 'planner', providerProfileId: 'ready-provider', templateId: 'template-planner' }],
      providerShellState: { status: 'stale', affectedProfileIds: ['ready-provider'] },
    })).toMatchObject({
      status: 'stale-warning',
      severity: 'warning',
      label: 'Agents working with stale provider inventory',
      affectedAgentIds: ['planner'],
    });

    const failed = deriveAgentRunwayShellState({
      runs: [transitionRun(createAgentRun('task-1', 'reviewer'), 'failed', 'Bearer sk-agent-secret failed for ACME workspace')],
      bindings: [{ agentId: 'reviewer', providerProfileId: 'ready-provider', templateId: 'template-reviewer' }],
      providerShellState: { status: 'ready', affectedProfileIds: ['ready-provider'] },
    });
    expect(failed).toMatchObject({
      status: 'failed',
      severity: 'error',
      label: 'Agent run failed',
      affectedAgentIds: ['reviewer'],
    });
    expect(JSON.stringify(failed)).not.toContain('sk-agent-secret');
    expect(JSON.stringify(failed)).not.toContain('ACME');

    expect(deriveAgentRunwayShellState({
      runs: [
        transitionRun(createAgentRun('task-1', 'planner'), 'completed'),
        transitionRun(createAgentRun('task-1', 'researcher'), 'completed'),
      ],
      bindings: [
        { agentId: 'planner', providerProfileId: 'ready-provider', templateId: 'template-planner' },
        { agentId: 'researcher', providerProfileId: 'ready-provider', templateId: 'template-researcher' },
      ],
      providerShellState: { status: 'ready', affectedProfileIds: ['ready-provider'] },
    })).toMatchObject({
      status: 'completed',
      severity: 'success',
      label: 'Agent runs completed',
      affectedAgentIds: ['planner', 'researcher'],
    });
  });
});
