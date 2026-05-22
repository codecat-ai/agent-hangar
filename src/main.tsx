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
], { 'openai-main': [{ id: 'gpt-4.1', displayName: 'GPT 4.1', providerKind: 'openai' }] });
const runs = [
  transitionRun(createAgentRun('task-1', 'planner'), 'working'),
  transitionRun(createAgentRun('task-1', 'researcher'), 'completed'),
  transitionRun(createAgentRun('task-1', 'reviewer'), 'failed', 'Needs a provider key'),
];
function App() {
  return <main className="shell"><section className="hero"><p className="eyebrow">Multi-agent command center</p><h1>Agent Hangar</h1><p>Design, launch, observe, and coordinate long-running AI agent teams across OpenAI, Anthropic, Gemini, and third-party providers.</p></section><section className="grid"><div className="panel"><h2>Provider fleet</h2>{providers.map((p) => <article className="card" key={p.id}><span className={`dot ${p.health}`} /> <strong>{p.displayName}</strong><small>{p.kind} · {p.modelCount} models · {p.health}</small></article>)}</div><div className="panel"><h2>Agent runway</h2>{runs.map((r) => <article className="card" key={r.agentId}><span className={`sprite ${r.pixelState}`} aria-label={r.pixelState} /> <strong>{r.agentId}</strong><small>{r.status}{r.error ? ` · ${r.error}` : ''}</small></article>)}</div><div className="panel wide"><h2>Harness principles</h2><ol><li>Provider adapters normalize model discovery before execution.</li><li>Planner, worker, reviewer, and subagent roles communicate through typed team threads.</li><li>Every state transition is observable and mapped to a clear pixel animation state.</li></ol></div></section></main>;
}

createRoot(document.getElementById('root')!).render(<App />);
