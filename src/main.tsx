import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { ExecutionGraphPanel } from './ExecutionGraphPanel';
import { ProviderProfilePanel } from './ProviderProfilePanel';
import { TemplateStudioPanel } from './TemplateStudioPanel';
import { createAgentRun, transitionRun } from './harness/agentRuntime';
import { buildDemoExecutionTrail, replayExecutionTrail } from './harness/executionTrail';
import { type NormalizedModel } from './harness/providerCatalog';
import { createProfileFromDraft } from './harness/providerProfileFlow';
import { localDemoProviderProfileCrypto } from './harness/providerProfiles';
import { createTemplateFromPreset } from './harness/promptTemplates';

const demoClock = () => new Date('2026-05-23T10:00:00.000Z');
const demoTemplateClock = () => '2026-05-23T10:00:00.000Z';
const demoNow = '2026-05-23T10:00:00.000Z';
const demoProfiles = [
  createProfileFromDraft({
    id: 'openai-main',
    kind: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'configured',
    health: { checkedAt: demoNow, modelInventoryUpdatedAt: '2026-05-23T09:30:00.000Z' },
  }, localDemoProviderProfileCrypto, demoClock),
  createProfileFromDraft({
    id: 'anthropic-main',
    kind: 'anthropic',
    displayName: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKey: 'configured',
    health: { checkedAt: demoNow, modelInventoryUpdatedAt: '2026-05-21T09:00:00.000Z' },
  }, localDemoProviderProfileCrypto, demoClock),
  createProfileFromDraft({
    id: 'gemini-main',
    kind: 'gemini',
    displayName: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: 'configured',
    health: { checkedAt: demoNow, status: 'degraded', message: 'Model discovery returned a provider error.' },
  }, localDemoProviderProfileCrypto, demoClock),
  createProfileFromDraft({
    id: 'third-party',
    kind: 'openai-compatible',
    displayName: 'Third-party OpenAI-compatible',
    baseUrl: 'https://api.example.com/v1',
    health: { checkedAt: demoNow },
  }, localDemoProviderProfileCrypto, demoClock),
];
const demoModelsByProvider: Record<string, NormalizedModel[]> = {
  'openai-main': [
    { id: 'gpt-4.1', displayName: 'GPT 4.1', providerKind: 'openai' },
    { id: 'text-embedding-3-large', displayName: 'Text embedding 3 large', providerKind: 'openai' },
  ],
  'anthropic-main': [
    { id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', providerKind: 'anthropic' },
    { id: 'claude-3-5-haiku-latest', displayName: 'Claude 3.5 Haiku', providerKind: 'anthropic' },
  ],
  'gemini-main': [
    { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', providerKind: 'gemini' },
  ],
};
const demoTemplates = [
  createTemplateFromPreset('planner', {
    id: () => 'template-planner-demo',
    clock: demoTemplateClock,
    providerProfileId: 'openai-main',
    modelId: 'gpt-4.1',
    escalationPolicyId: 'default-escalation',
  }),
  createTemplateFromPreset('reviewer', {
    id: () => 'template-reviewer-demo',
    clock: demoTemplateClock,
    providerProfileId: 'anthropic-main',
    modelId: 'claude-sonnet-4-5',
    escalationPolicyId: 'review-escalation',
  }),
];
let demoTemplateIdCounter = 0;
const demoTemplateIdSource = () => {
  demoTemplateIdCounter += 1;
  return `template-local-${demoTemplateIdCounter}`;
};
const templateProviderOptions = demoProfiles.map((profile) => ({
  id: profile.id,
  label: profile.displayName,
  modelIds: (demoModelsByProvider[profile.id] ?? []).map((model) => model.id),
}));
const escalationPolicies = [
  { id: 'default-escalation', label: 'Default escalation' },
  { id: 'review-escalation', label: 'Review escalation' },
];
const demoTrail = buildDemoExecutionTrail();
const demoTrailSummary = replayExecutionTrail(demoTrail.graph, demoTrail.trail);
const runs = [
  transitionRun(createAgentRun('task-1', 'planner'), 'working'),
  transitionRun(createAgentRun('task-1', 'researcher'), 'completed'),
  transitionRun(createAgentRun('task-1', 'reviewer'), 'failed', 'Needs a provider key'),
];
function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Multi-agent command center</p>
        <h1>Agent Hangar</h1>
        <p>Design, launch, observe, and coordinate long-running AI agent teams across OpenAI, Anthropic, Gemini, and third-party providers.</p>
      </section>
      <section className="grid">
        <ProviderProfilePanel
          crypto={localDemoProviderProfileCrypto}
          clock={demoClock}
          now={demoNow}
          initialProfiles={demoProfiles}
          modelsByProvider={demoModelsByProvider}
        />
        <TemplateStudioPanel
          clock={demoTemplateClock}
          idSource={demoTemplateIdSource}
          initialTemplates={demoTemplates}
          providerOptions={templateProviderOptions}
          escalationPolicies={escalationPolicies}
        />
        <ExecutionGraphPanel graph={demoTrail.graph} trailSummary={demoTrailSummary} />
        <div className="panel">
          <h2>Agent runway</h2>
          {runs.map((r) => (
            <article className="card" key={r.agentId}>
              <span className={`sprite ${r.pixelState}`} aria-label={r.pixelState} />
              <strong>{r.agentId}</strong>
              <small>{r.status}{r.error ? ` · ${r.error}` : ''}</small>
            </article>
          ))}
        </div>
        <div className="panel wide">
          <h2>Harness principles</h2>
          <ol>
            <li>Provider adapters normalize model discovery before execution.</li>
            <li>Planner, worker, reviewer, and subagent roles communicate through typed team threads.</li>
            <li>Every state transition is observable and mapped to a clear pixel animation state.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
