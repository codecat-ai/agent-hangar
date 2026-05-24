import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProviderProfilePanel } from '../src/ProviderProfilePanel';
import { type ProviderDiscoveryFixture } from '../src/harness/providerDiscoveryDryRun';
import { createProfileFromDraft } from '../src/harness/providerProfileFlow';
import { type ProviderProfileCrypto } from '../src/harness/providerProfiles';

const clock = () => new Date('2026-05-23T10:00:00.000Z');
const laterClock = () => new Date('2026-05-23T10:45:00.000Z');

const fakeCrypto: ProviderProfileCrypto = {
  encrypt: (plaintext) => `fake:${plaintext.split('').reverse().join('')}`,
  decrypt: (ciphertext) => ciphertext.replace(/^fake:/, '').split('').reverse().join(''),
};

describe('ProviderProfilePanel', () => {
  it('creates, edits, replaces key material, and deletes provider profiles without rendering secrets', () => {
    render(<ProviderProfilePanel crypto={fakeCrypto} clock={clock} now="2026-05-23T10:00:00.000Z" initialProfiles={[]} modelsByProvider={{}} />);

    expect(screen.getByText('No provider profiles yet.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Profile ID'), { target: { value: ' openai-main ' } });
    fireEvent.change(screen.getByLabelText('Provider kind'), { target: { value: 'openai' } });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: ' OpenAI Main ' } });
    fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: ' https://api.openai.com/v1 ' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: ' sk-ui-create-secret ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    const createdCard = screen.getByTestId('provider-profile-openai-main');
    expect(within(createdCard).getByText('OpenAI Main')).toBeInTheDocument();
    expect(within(createdCard).getByText('Key: Configured')).toBeInTheDocument();
    expect(within(createdCard).getByText('No models discovered')).toBeInTheDocument();
    expect(screen.queryByText('sk-ui-create-secret')).not.toBeInTheDocument();
    expect(screen.queryByText('fake:terces-etaerc-iu-ks')).not.toBeInTheDocument();

    fireEvent.click(within(createdCard).getByRole('button', { name: 'Edit OpenAI Main' }));
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: ' Updated OpenAI ' } });
    fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: ' https://proxy.example.test/v1 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(screen.getByText('Updated OpenAI')).toBeInTheDocument();
    expect(screen.queryByText('OpenAI Main')).not.toBeInTheDocument();
    expect(screen.queryByText('sk-ui-create-secret')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Updated OpenAI' }));
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: ' sk-ui-replacement-secret ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(screen.getByText('Updated OpenAI')).toBeInTheDocument();
    expect(screen.queryByText('sk-ui-replacement-secret')).not.toBeInTheDocument();
    expect(screen.queryByText('fake:terces-tnemecalper-iu-ks')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Updated OpenAI' }));

    expect(screen.queryByTestId('provider-profile-openai-main')).not.toBeInTheDocument();
    expect(screen.getByText('No provider profiles yet.')).toBeInTheDocument();
  });

  it('renders secret-safe missing-key, degraded, stale, and empty model discovery states', () => {
    const profiles = [
      createProfileFromDraft({ id: 'missing-key', kind: 'openai', displayName: 'Missing', baseUrl: 'https://api.openai.com/v1' }, fakeCrypto, clock),
      createProfileFromDraft({
        id: 'degraded',
        kind: 'gemini',
        displayName: 'Degraded',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'sk-ui-degraded-secret',
        health: { checkedAt: '2026-05-23T09:55:00.000Z', status: 'degraded', message: 'Model discovery failed with sk-ui-degraded-secret' },
      }, fakeCrypto, clock),
      createProfileFromDraft({
        id: 'stale',
        kind: 'anthropic',
        displayName: 'Stale',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ui-stale-secret',
        health: { checkedAt: '2026-05-23T09:55:00.000Z', modelInventoryUpdatedAt: '2026-05-20T10:00:00.000Z' },
      }, fakeCrypto, clock),
      createProfileFromDraft({
        id: 'empty',
        kind: 'openai-compatible',
        displayName: 'Empty',
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'sk-ui-empty-secret',
        health: { checkedAt: '2026-05-23T09:55:00.000Z' },
      }, fakeCrypto, clock),
    ];

    render(
      <ProviderProfilePanel
        crypto={fakeCrypto}
        clock={laterClock}
        now="2026-05-23T10:00:00.000Z"
        initialProfiles={profiles}
        modelsByProvider={{ stale: [{ id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', providerKind: 'anthropic' }] }}
      />,
    );

    expect(within(screen.getByTestId('provider-profile-missing-key')).getByText('Missing API key')).toBeInTheDocument();
    expect(within(screen.getByTestId('provider-profile-degraded')).getByText('Provider degraded')).toBeInTheDocument();
    expect(within(screen.getByTestId('provider-profile-stale')).getByText('Stale model inventory')).toBeInTheDocument();
    expect(within(screen.getByTestId('provider-profile-empty')).getByText('No models discovered')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('sk-ui-');
    expect(document.body.textContent).not.toContain('fake:');
  });

  it('renders an accessible secret-safe provider discovery dry-run preview', () => {
    const profiles = [
      createProfileFromDraft({
        id: 'ready',
        kind: 'openai',
        displayName: 'Ready',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-ui-ready-secret',
      }, fakeCrypto, clock),
      createProfileFromDraft({
        id: 'degraded',
        kind: 'gemini',
        displayName: 'Degraded',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'AIza-ui-degraded-secret',
      }, fakeCrypto, clock),
      createProfileFromDraft({
        id: 'missing-key',
        kind: 'anthropic',
        displayName: 'Missing',
        baseUrl: 'https://api.anthropic.com',
      }, fakeCrypto, clock),
    ];
    const fixturesByProvider: Record<string, ProviderDiscoveryFixture> = {
      ready: {
        checkedAt: '2026-05-23T09:55:00.000Z',
        inventoryUpdatedAt: '2026-05-23T09:55:00.000Z',
        models: [{ id: 'gpt-4.1-mini', display_name: 'GPT 4.1 mini' }],
      },
      degraded: {
        checkedAt: '2026-05-23T09:55:00.000Z',
        apiKeyRef: 'GEMINI_API_KEY',
        error: { type: 'permission', message: '403 Bearer abc12345 for GEMINI_API_KEY in ACME customer' },
      },
    };

    render(
      <ProviderProfilePanel
        crypto={fakeCrypto}
        clock={laterClock}
        now="2026-05-23T10:00:00.000Z"
        initialProfiles={profiles}
        modelsByProvider={{}}
        discoveryFixturesByProvider={fixturesByProvider}
      />,
    );

    const previewRegion = screen.getByRole('region', { name: 'Provider discovery dry-run preview' });
    expect(within(previewRegion).getByText('Provider discovery dry-run')).toBeInTheDocument();
    expect(within(previewRegion).getByText('1 ready · 1 warning · 1 error')).toBeInTheDocument();
    expect(within(previewRegion).getByText('Ready')).toBeInTheDocument();
    expect(within(previewRegion).getByText('ready · 1 model')).toBeInTheDocument();
    expect(within(previewRegion).getByText('text 1')).toBeInTheDocument();
    expect(within(previewRegion).getByText('fast 1')).toBeInTheDocument();
    expect(within(previewRegion).getByText('Degraded')).toBeInTheDocument();
    expect(within(previewRegion).getByText('degraded · 0 models')).toBeInTheDocument();
    expect(within(previewRegion).getByText('Review the sanitized local fixture error before enabling real discovery.')).toBeInTheDocument();
    expect(within(previewRegion).getByText('Missing')).toBeInTheDocument();
    expect(within(previewRegion).getByText('needs-key · 0 models')).toBeInTheDocument();
    expect(within(previewRegion).getByText('Add local key material before previewing model discovery outcomes.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('sk-ui-ready-secret');
    expect(document.body.textContent).not.toContain('AIza-ui-degraded-secret');
    expect(document.body.textContent).not.toContain('Bearer abc12345');
    expect(document.body.textContent).not.toContain('GEMINI_API_KEY');
    expect(document.body.textContent).not.toContain('ACME customer');
    expect(document.body.textContent).not.toContain('fake:');
  });
});
