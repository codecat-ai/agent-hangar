import { describe, expect, it } from 'vitest';
import { createAgentTemplate, createAgentRun, transitionRun, routeAgentMessage } from '../src/harness/agentRuntime';

describe('agent runtime harness', () => {
  it('creates role-based agents from prompt templates with safe defaults', () => {
    const template = createAgentTemplate({ name: 'Planner', role: 'planning', prompt: 'Break tasks into milestones.' });
    expect(template).toMatchObject({ name: 'Planner', role: 'planning', modelPolicy: { temperature: 0.2 }, tools: [] });
  });

  it('tracks long-running status transitions for pixel animation states', () => {
    const run = createAgentRun('task-1', 'agent-planner');
    expect(run.status).toBe('queued');
    expect(transitionRun(run, 'working').pixelState).toBe('working');
    expect(transitionRun(run, 'failed', 'provider timeout').pixelState).toBe('failed');
    expect(transitionRun(run, 'completed').finishedAt).toBeDefined();
  });

  it('routes collaboration messages between parent agents and subagents', () => {
    const message = routeAgentMessage({ from: 'agent-planner', to: 'agent-researcher', taskId: 'task-1', body: 'Find prior art.', channel: 'delegation' });
    expect(message.threadId).toBe('task-1:agent-planner->agent-researcher');
    expect(message.visibility).toBe('team');
  });
});
