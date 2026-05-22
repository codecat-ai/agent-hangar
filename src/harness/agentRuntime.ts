export type AgentRunStatus = 'queued' | 'working' | 'failed' | 'completed';
export interface AgentTemplate { name: string; role: string; prompt: string; modelPolicy: { temperature: number }; tools: string[] }
export interface AgentRun { taskId: string; agentId: string; status: AgentRunStatus; pixelState: 'idle' | AgentRunStatus; error?: string; finishedAt?: string }
export interface AgentMessageInput { from: string; to: string; taskId: string; body: string; channel: 'delegation' | 'review' | 'broadcast' }
export function createAgentTemplate(input: Pick<AgentTemplate, 'name' | 'role' | 'prompt'>): AgentTemplate {
  return { ...input, modelPolicy: { temperature: 0.2 }, tools: [] };
}
export function createAgentRun(taskId: string, agentId: string): AgentRun {
  return { taskId, agentId, status: 'queued', pixelState: 'idle' };
}
export function transitionRun(run: AgentRun, status: AgentRunStatus, error?: string): AgentRun {
  return { ...run, status, pixelState: status === 'queued' ? 'idle' : status, error, finishedAt: status === 'completed' || status === 'failed' ? new Date(0).toISOString() : run.finishedAt };
}
export function routeAgentMessage(input: AgentMessageInput) {
  return { ...input, threadId: `${input.taskId}:${input.from}->${input.to}`, visibility: 'team' as const };
}
