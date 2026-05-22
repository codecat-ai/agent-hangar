import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { createAgentRun, transitionRun } from './harness/agentRuntime';
import { buildProviderCatalog } from './harness/providerCatalog';

const providers = buildProviderCatalog([
  { id: 'openai-main', kind: 'openai', displayName: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyRef: 'OPENAI_API_KEY' },
  { id: 'anthropic-main', kind: 'anthropic', displayName: 'Anthropic', baseUrl: 'https://api.anthropic.com', apiKeyRef: 'ANTHROPIC_API_KEY' },
  { id: 'gemini-main', kind: 'gemini', displayName: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com', apiKeyRef: 'GEMINI_API_KEY' },
  { id: 'third-party', kind: 'openai-compatible', displayName: 'Third-party OpenAI-compatible', baseUrl: 'https://api.example.com/v1' },
], {
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
}, {
  'openai-main': { checkedAt: '2026-05-23T10:00:00.000Z', modelInventoryUpdatedAt: '2026-05-23T09:30:00.000Z', now: '2026-05-23T10:00:00.000Z' },
  'anthropic-main': { checkedAt: '2026-05-23T10:00:00.000Z', modelInventoryUpdatedAt: '2026-05-21T09:00:00.000Z', now: '2026-05-23T10:00:00.000Z' },
  'gemini-main': { checkedAt: '2026-05-23T10:00:00.000Z', lastError: 'Model discovery returned a provider error.', now: '2026-05-23T10:00:00.000Z' },
  'third-party': { checkedAt: '2026-05-23T10:00:00.000Z', now: '2026-05-23T10:00:00.000Z' },
});
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
        <div className="panel">
          <h2>Provider fleet</h2>
          {providers.map((p) => (
            <article className="card provider-card" key={p.id}>
              <span className={`dot ${p.health.status}`} />
              <div className="card-body">
                <div className="card-title">
                  <strong>{p.displayName}</strong>
                  <small>{p.kind} · {p.modelCount} models</small>
                </div>
                <small className="health-detail">{p.health.label} · {p.health.detail}</small>
                <div className="tag-row">
                  {p.capabilities.tags.length > 0
                    ? p.capabilities.tags.map((tag) => <span className="tag" key={tag}>{tag} {p.capabilities.counts[tag]}</span>)
                    : <span className="tag muted">no model capabilities</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
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
