import { type AgentRun } from './agentRuntime';
import { summarizeProviderProfiles } from './providerProfileFlow';
import { type NormalizedModel } from './providerCatalog';
import { type ProviderProfile } from './providerProfiles';
import { redactOperatorText } from './redaction';

export type ShellSeverity = 'info' | 'success' | 'warning' | 'error';
export type ProviderShellStatus = 'empty' | 'disconnected' | 'inventory-empty' | 'stale' | 'error' | 'ready';
export type AgentRunwayShellStatus = 'empty' | 'queued' | 'working' | 'completed' | 'blocked' | 'stale-warning' | 'failed';

export interface ProviderShellState {
  status: ProviderShellStatus;
  severity: ShellSeverity;
  label: string;
  guidance: string;
  summary: string;
  affectedProfileIds: string[];
}

export interface DeriveProviderShellStateInput {
  profiles: ProviderProfile[];
  modelsByProvider: Record<string, NormalizedModel[]>;
  now: string;
}

export interface AgentRunwayBinding {
  agentId: string;
  providerProfileId?: string;
  templateId?: string;
}

export interface AgentRunwayShellState {
  status: AgentRunwayShellStatus;
  severity: ShellSeverity;
  label: string;
  guidance: string;
  summary: string;
  affectedAgentIds: string[];
}

export interface DeriveAgentRunwayShellStateInput {
  runs: AgentRun[];
  bindings: AgentRunwayBinding[];
  providerShellState: Pick<ProviderShellState, 'status'> & Partial<Pick<ProviderShellState, 'affectedProfileIds'>>;
}

export function deriveProviderShellState(input: DeriveProviderShellStateInput): ProviderShellState {
  if (input.profiles.length === 0) {
    return {
      status: 'empty',
      severity: 'info',
      label: 'No provider profiles',
      guidance: 'Create a local provider profile before binding templates or previewing runs.',
      summary: 'No provider profiles are configured.',
      affectedProfileIds: [],
    };
  }

  const summaries = summarizeProviderProfiles(input.profiles, input.modelsByProvider, input.now);
  const degraded = summaries.filter((summary) => summary.health.status === 'degraded');
  if (degraded.length > 0) {
    return {
      status: 'error',
      severity: 'error',
      label: 'Provider health error',
      guidance: 'Review the local health message and keep real provider execution disabled.',
      summary: `${countProviders(degraded.length)} reported a sanitized health error.`,
      affectedProfileIds: degraded.map((summary) => summary.id),
    };
  }

  const disconnected = summaries.filter((summary) => summary.health.status === 'needs-key');
  if (disconnected.length > 0) {
    return {
      status: 'disconnected',
      severity: 'warning',
      label: 'Provider disconnected',
      guidance: 'Add a local API key placeholder or switch affected templates to a configured provider.',
      summary: `${countProviders(disconnected.length)} missing local key material.`,
      affectedProfileIds: disconnected.map((summary) => summary.id),
    };
  }

  const emptyInventory = summaries.filter((summary) => summary.health.status === 'empty');
  if (emptyInventory.length > 0) {
    return {
      status: 'inventory-empty',
      severity: 'info',
      label: 'No model inventory',
      guidance: 'Keep the provider local-only and add fixture models before previewing routing decisions.',
      summary: `${countProviders(emptyInventory.length)} have credentials but no demo model inventory.`,
      affectedProfileIds: emptyInventory.map((summary) => summary.id),
    };
  }

  const stale = summaries.filter((summary) => summary.health.status === 'stale');
  if (stale.length > 0) {
    return {
      status: 'stale',
      severity: 'warning',
      label: 'Model inventory stale',
      guidance: 'Refresh or replace the local model fixture before trusting template routing.',
      summary: `${countProviders(stale.length)} using stale model inventory.`,
      affectedProfileIds: stale.map((summary) => summary.id),
    };
  }

  return {
    status: 'ready',
    severity: 'success',
    label: 'Providers ready',
    guidance: 'Provider profiles have local credentials and current model inventory.',
    summary: `${input.profiles.length} ${input.profiles.length === 1 ? 'provider is' : 'providers are'} ready for local demo binding previews.`,
    affectedProfileIds: summaries.map((summary) => summary.id),
  };
}

export function deriveAgentRunwayShellState(input: DeriveAgentRunwayShellStateInput): AgentRunwayShellState {
  if (input.runs.length === 0) {
    return {
      status: 'empty',
      severity: 'info',
      label: 'No agent runs',
      guidance: 'Create a local demo run after provider and template bindings are ready.',
      summary: 'No local agent runs are queued.',
      affectedAgentIds: [],
    };
  }

  const bindingByAgent = new Map(input.bindings.map((binding) => [binding.agentId, binding]));
  const disconnectedProviderIds = new Set(input.providerShellState.affectedProfileIds ?? []);
  const blockedAgentIds = input.runs
    .filter((run) => {
      const binding = bindingByAgent.get(run.agentId);
      return !binding?.templateId
        || !binding.providerProfileId
        || (input.providerShellState.status === 'disconnected' && disconnectedProviderIds.has(binding.providerProfileId));
    })
    .map((run) => run.agentId);

  if (blockedAgentIds.length > 0) {
    return {
      status: 'blocked',
      severity: 'warning',
      label: 'Runway blocked',
      guidance: 'Reconnect the provider profile or choose a template binding before previewing local runs.',
      summary: `${countAgents(blockedAgentIds.length)} blocked by provider or template bindings.`,
      affectedAgentIds: blockedAgentIds,
    };
  }

  const failed = input.runs.filter((run) => run.status === 'failed');
  if (failed.length > 0) {
    const details = failed.map((run) => redactOperatorText(run.error, 'Run failed in the local demo harness.')).join(' ');
    return {
      status: 'failed',
      severity: 'error',
      label: 'Agent run failed',
      guidance: 'Inspect the local run error and keep provider execution disabled until the binding is fixed.',
      summary: `${countAgents(failed.length)} failed. ${details}`,
      affectedAgentIds: failed.map((run) => run.agentId),
    };
  }

  const staleProviderIds = new Set(input.providerShellState.status === 'stale' ? input.providerShellState.affectedProfileIds ?? [] : []);
  const staleAgentIds = input.runs
    .filter((run) => staleProviderIds.has(bindingByAgent.get(run.agentId)?.providerProfileId ?? ''))
    .map((run) => run.agentId);
  if (staleAgentIds.length > 0) {
    return {
      status: 'stale-warning',
      severity: 'warning',
      label: 'Agents working with stale provider inventory',
      guidance: 'Treat routing as a local preview until the provider inventory fixture is refreshed.',
      summary: `${countAgents(staleAgentIds.length)} bound to stale provider inventory.`,
      affectedAgentIds: staleAgentIds,
    };
  }

  const working = input.runs.filter((run) => run.status === 'working');
  if (working.length > 0) {
    return {
      status: 'working',
      severity: 'info',
      label: 'Agents working',
      guidance: 'Observe local demo progress without starting real provider execution.',
      summary: `${countAgents(working.length)} currently working in the local demo harness.`,
      affectedAgentIds: working.map((run) => run.agentId),
    };
  }

  const queued = input.runs.filter((run) => run.status === 'queued');
  if (queued.length > 0) {
    return {
      status: 'queued',
      severity: 'info',
      label: 'Agents queued',
      guidance: 'Queued runs are waiting in the local preview runway.',
      summary: `${countAgents(queued.length)} queued for local preview.`,
      affectedAgentIds: queued.map((run) => run.agentId),
    };
  }

  return {
    status: 'completed',
    severity: 'success',
    label: 'Agent runs completed',
    guidance: 'Review local evidence and audit previews before starting another demo run.',
    summary: `${countAgents(input.runs.length)} completed in the local demo harness.`,
    affectedAgentIds: input.runs.map((run) => run.agentId),
  };
}

export function redactRunError(error: string | undefined): string {
  return redactOperatorText(error, 'Run failed in the local demo harness.');
}

function countProviders(count: number): string {
  return `${count} ${count === 1 ? 'provider' : 'providers'}`;
}

function countAgents(count: number): string {
  return `${count} ${count === 1 ? 'agent' : 'agents'}`;
}
