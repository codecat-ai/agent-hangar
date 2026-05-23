import { describe, expect, it } from 'vitest';
import {
  applyExecutionControlAction,
  deriveAllowedExecutionControlActions,
  type ExecutionControlState,
} from '../src/harness/executionControls';

const clock = () => '2026-05-23T10:30:00.000Z';

describe('execution control harness', () => {
  it('derives safe local actions from run and node status', () => {
    expect(deriveAllowedExecutionControlActions({ status: 'working' })).toEqual(['pause', 'cancel']);
    expect(deriveAllowedExecutionControlActions({ status: 'paused' })).toEqual(['resume', 'cancel']);
    expect(deriveAllowedExecutionControlActions({ status: 'queued' })).toEqual(['cancel']);
    expect(deriveAllowedExecutionControlActions({ status: 'runnable' })).toEqual(['cancel']);
    expect(deriveAllowedExecutionControlActions({ status: 'failed' })).toEqual(['retry']);
    expect(deriveAllowedExecutionControlActions({ status: 'canceled' })).toEqual(['retry']);
    expect(deriveAllowedExecutionControlActions({ status: 'completed' })).toEqual([]);
  });

  it('applies pause, resume, cancel, and retry transitions with deterministic audit entries', () => {
    const working = stateFixture('working');

    const paused = applyExecutionControlAction(working, 'pause', {
      actorId: 'operator-1',
      clock,
      note: 'Pause for local review.',
    });
    expect(paused.ok).toBe(true);
    expect(paused.ok && paused.state.status).toBe('paused');
    expect(paused.ok && paused.auditEntry).toMatchObject({
      actorId: 'operator-1',
      action: 'pause',
      fromStatus: 'working',
      toStatus: 'paused',
      occurredAt: '2026-05-23T10:30:00.000Z',
      note: 'Pause for local review.',
    });

    const resumed = paused.ok
      ? applyExecutionControlAction(paused.state, 'resume', { actorId: 'operator-1', clock })
      : paused;
    expect(resumed.ok).toBe(true);
    expect(resumed.ok && resumed.state.status).toBe('working');

    const canceled = applyExecutionControlAction(stateFixture('queued'), 'cancel', {
      actorId: 'operator-1',
      clock,
    });
    expect(canceled.ok).toBe(true);
    expect(canceled.ok && canceled.state.status).toBe('canceled');

    const retriedFromFailed = applyExecutionControlAction(stateFixture('failed'), 'retry', {
      actorId: 'operator-1',
      clock,
    });
    expect(retriedFromFailed.ok).toBe(true);
    expect(retriedFromFailed.ok && retriedFromFailed.state.status).toBe('queued');

    const retriedFromCanceled = applyExecutionControlAction(stateFixture('canceled'), 'retry', {
      actorId: 'operator-1',
      clock,
    });
    expect(retriedFromCanceled.ok).toBe(true);
    expect(retriedFromCanceled.ok && retriedFromCanceled.state.status).toBe('queued');
  });

  it('rejects completed-run actions with a typed issue and without mutation', () => {
    const completed = stateFixture('completed');
    const before = structuredClone(completed);

    const result = applyExecutionControlAction(completed, 'cancel', {
      actorId: 'operator-1',
      clock,
      reason: 'Mistaken cancel.',
    });

    expect(result).toEqual({
      ok: false,
      issue: {
        code: 'action-not-allowed',
        severity: 'blocking',
        action: 'cancel',
        status: 'completed',
        message: 'Action cancel is not allowed while the local run is completed.',
      },
      state: before,
    });
    expect(completed).toEqual(before);
    expect(deriveAllowedExecutionControlActions({ status: 'completed' })).toEqual([]);
  });

  it('redacts secret-like reason and note text from audit output', () => {
    const result = applyExecutionControlAction(stateFixture('working'), 'pause', {
      actorId: 'operator-1',
      clock,
      reason: 'apiKey=sk-live-secret should not leak',
      note: 'encryptedKeyMaterial=abc123 and sk-local-secret are hidden',
    });

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).toContain('[redacted]');
    expect(JSON.stringify(result)).not.toMatch(/apiKey|sk-live-secret|sk-local-secret|encryptedKeyMaterial|abc123/);
  });

  it('returns clone-safe deterministic output without mutating input objects', () => {
    const input = stateFixture('working');
    input.auditLog.push({
      schemaVersion: 'agent-hangar.execution-control-audit.v1',
      id: 'existing-entry',
      runId: 'run-1',
      nodeId: 'node-1',
      actorId: 'operator-0',
      action: 'pause',
      fromStatus: 'working',
      toStatus: 'paused',
      occurredAt: '2026-05-23T10:00:00.000Z',
    });
    const before = structuredClone(input);

    const first = applyExecutionControlAction(input, 'pause', { actorId: 'operator-1', clock });
    const second = applyExecutionControlAction(input, 'pause', { actorId: 'operator-1', clock });

    expect(input).toEqual(before);
    expect(first).toEqual(second);
    expect(first.ok && first.state).not.toBe(input);
    expect(first.ok && first.state.auditLog).not.toBe(input.auditLog);
    expect(first.ok && first.state.auditLog).toHaveLength(2);
  });
});

function stateFixture(status: ExecutionControlState['status']): ExecutionControlState {
  return {
    schemaVersion: 'agent-hangar.execution-control-state.v1',
    runId: 'run-1',
    nodeId: 'node-1',
    status,
    auditLog: [],
  };
}
