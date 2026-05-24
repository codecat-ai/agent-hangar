import React, { useMemo } from 'react';
import { type AgentRun } from './harness/agentRuntime';
import {
  deriveAgentRunwayShellState,
  redactRunError,
  type AgentRunwayBinding,
  type ProviderShellState,
} from './harness/shellStates';

export interface AgentRunwayPanelProps {
  runs: AgentRun[];
  bindings: AgentRunwayBinding[];
  providerShellState: Pick<ProviderShellState, 'status' | 'affectedProfileIds'>;
}

export function AgentRunwayPanel({ runs, bindings, providerShellState }: AgentRunwayPanelProps) {
  const shellState = useMemo(
    () => deriveAgentRunwayShellState({ runs, bindings, providerShellState }),
    [bindings, providerShellState, runs],
  );

  return (
    <section className={`panel agent-runway shell-state-${shellState.severity}`} aria-labelledby="agent-runway-heading">
      <h2 id="agent-runway-heading">Agent runway</h2>
      <div className="shell-state-banner" role="status" aria-live="polite">
        <strong>{shellState.label}</strong>
        <span>{shellState.summary}</span>
      </div>
      <p className="shell-guidance">{shellState.guidance}</p>
      {runs.length === 0 ? <p className="empty-state">No agent runs yet.</p> : null}
      {runs.map((run) => (
        <article className="card agent-run-card" key={run.agentId} data-testid={`agent-run-${run.agentId}`}>
          <span className={`sprite ${run.pixelState}`} aria-label={run.pixelState} />
          <strong>{run.agentId}</strong>
          <small>{run.status}{run.error ? ` · ${redactRunError(run.error)}` : ''}</small>
        </article>
      ))}
    </section>
  );
}
