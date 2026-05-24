import { describe, expect, it } from 'vitest';
import {
  buildSourceCheckoutOnboarding,
  formatSourceCheckoutOnboardingMarkdown,
} from '../src/harness/sourceCheckoutOnboarding';

describe('source checkout onboarding accessibility guidance', () => {
  it('builds deterministic schema-versioned guidance for the default happy path', () => {
    const first = buildSourceCheckoutOnboarding();
    const second = buildSourceCheckoutOnboarding();

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('agent-hangar.source-checkout-onboarding.v1');
    expect(first.source.mode).toBe('source-checkout-only');
    expect(first.primaryWalkthrough.heading).toBe('Start with the guided source-checkout walkthrough');
    expect(first.keyboard.order.map((region) => region.id)).toEqual([
      'source-checkout-onboarding',
      'provider-evidence',
      'template-evidence',
      'execution-evidence',
      'collaboration-evidence',
      'portability-evidence',
    ]);
    expect(first.setupNotes).toContain('Use a local source checkout or cloned repository workspace.');
    expect(first.setupNotes.join('\n')).not.toMatch(/\bnpm\s+(?:install|ci|run|exec)\b|\bpip\s+install\b|\bpackage registry\b/i);
    expect(first.summary.status).toBe('ready');
    expect(first.blockers).toEqual([]);
  });

  it('warns when required operator regions or status text are absent or unnamed', () => {
    const guidance = buildSourceCheckoutOnboarding({
      regions: [
        { id: 'provider-evidence', label: 'Provider evidence', accessibleName: '', statusRegionName: 'Provider status' },
        { id: 'execution-evidence', label: 'Execution evidence', accessibleName: 'Execution evidence', statusRegionName: '' },
      ],
    });

    expect(guidance.summary.status).toBe('warning');
    expect(guidance.summary.warningCount).toBeGreaterThanOrEqual(4);
    expect(guidance.blockers).toEqual([]);
    expect(guidance.nextActions).toContain('Name the Provider evidence region before source-checkout handoff.');
    expect(guidance.nextActions).toContain('Add a named status text region for Execution evidence.');
    expect(guidance.nextActions).toContain('Add the Template evidence region to the source-checkout review path.');
    expect(guidance.nextActions).toContain('Add the Collaboration evidence region to the source-checkout review path.');
    expect(guidance.nextActions).toContain('Add the Portability evidence region to the source-checkout review path.');
  });

  it('keeps setup notes source-checkout-only without package-manager publication claims', () => {
    const guidance = buildSourceCheckoutOnboarding();
    const joined = [...guidance.setupNotes, guidance.markdown].join('\n');

    expect(joined).toMatch(/source checkout|cloned repository/i);
    expect(joined).not.toMatch(/\bnpm\s+(?:install|ci|run|exec)\b|\bpip\s+install\b|\bbrew\s+install\b/i);
    expect(joined).not.toMatch(/published package|package registry|registry installation|download from npm/i);
  });

  it('redacts API-key-looking, bearer, encrypted, and customer-like text from data and Markdown', () => {
    const guidance = buildSourceCheckoutOnboarding({
      primaryWalkthroughNotes: [
        'Review apiKey=sk-onboarding-secret for ACME customer.',
        'Bearer abcdef1234567890 and encryptedKeyMaterial=raw-local-value must not render.',
      ],
      setupNotes: [
        'Use PRIVATE customer workspace token sk-proj-onboarding-secret from encryptedApiKey=fixture.',
      ],
    });
    const markdown = formatSourceCheckoutOnboardingMarkdown(guidance);
    const serialized = JSON.stringify(guidance);

    expect(serialized).toContain('[redacted]');
    expect(serialized).not.toMatch(/apiKey|sk-onboarding-secret|sk-proj-onboarding-secret|Bearer abcdef|encryptedKeyMaterial|encryptedApiKey|ACME customer|PRIVATE customer/i);
    expect(markdown).toContain('[redacted]');
    expect(markdown).not.toMatch(/apiKey|sk-onboarding-secret|sk-proj-onboarding-secret|Bearer abcdef|encryptedKeyMaterial|encryptedApiKey|ACME customer|PRIVATE customer/i);
  });
});
