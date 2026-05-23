export type ExecutionControlStatus =
  | 'queued'
  | 'runnable'
  | 'working'
  | 'paused'
  | 'failed'
  | 'completed'
  | 'canceled'
  | 'blocked';

export type ExecutionControlAction = 'pause' | 'resume' | 'cancel' | 'retry';

export interface ExecutionControlState {
  schemaVersion: 'agent-hangar.execution-control-state.v1';
  runId: string;
  nodeId?: string;
  status: ExecutionControlStatus;
  auditLog: ExecutionControlAuditEntry[];
}

export interface ExecutionControlAuditEntry {
  schemaVersion: 'agent-hangar.execution-control-audit.v1';
  id: string;
  runId: string;
  nodeId?: string;
  actorId: string;
  action: ExecutionControlAction;
  fromStatus: ExecutionControlStatus;
  toStatus: ExecutionControlStatus;
  occurredAt: string;
  reason?: string;
  note?: string;
}

export interface ExecutionControlActionInput {
  actorId: string;
  clock: () => string;
  reason?: string;
  note?: string;
}

export type ExecutionControlIssueCode = 'action-not-allowed';

export interface ExecutionControlIssue {
  code: ExecutionControlIssueCode;
  severity: 'blocking';
  action: ExecutionControlAction;
  status: ExecutionControlStatus;
  message: string;
}

export type ExecutionControlResult =
  | { ok: true; state: ExecutionControlState; auditEntry: ExecutionControlAuditEntry }
  | { ok: false; state: ExecutionControlState; issue: ExecutionControlIssue };

const NOTE_LIMIT = 140;

export function deriveAllowedExecutionControlActions(input: { status: ExecutionControlStatus }): ExecutionControlAction[] {
  if (input.status === 'working') {
    return ['pause', 'cancel'];
  }
  if (input.status === 'paused') {
    return ['resume', 'cancel'];
  }
  if (input.status === 'queued' || input.status === 'runnable') {
    return ['cancel'];
  }
  if (input.status === 'failed' || input.status === 'canceled') {
    return ['retry'];
  }
  return [];
}

export function applyExecutionControlAction(
  state: ExecutionControlState,
  action: ExecutionControlAction,
  input: ExecutionControlActionInput,
): ExecutionControlResult {
  const currentState = cloneState(state);
  const allowedActions = deriveAllowedExecutionControlActions(currentState);

  if (!allowedActions.includes(action)) {
    return {
      ok: false,
      state: currentState,
      issue: {
        code: 'action-not-allowed',
        severity: 'blocking',
        action,
        status: currentState.status,
        message: `Action ${action} is not allowed while the local run is ${currentState.status}.`,
      },
    };
  }

  const toStatus = deriveNextStatus(currentState.status, action);
  const occurredAt = input.clock();
  const auditEntry: ExecutionControlAuditEntry = {
    schemaVersion: 'agent-hangar.execution-control-audit.v1',
    id: buildAuditId(currentState, action, input.actorId, occurredAt),
    runId: sanitizeIdentifier(currentState.runId),
    ...(currentState.nodeId ? { nodeId: sanitizeIdentifier(currentState.nodeId) } : {}),
    actorId: sanitizeIdentifier(input.actorId),
    action,
    fromStatus: currentState.status,
    toStatus,
    occurredAt,
    ...(input.reason ? { reason: sanitizeNote(input.reason) } : {}),
    ...(input.note ? { note: sanitizeNote(input.note) } : {}),
  };

  return {
    ok: true,
    auditEntry,
    state: {
      ...currentState,
      status: toStatus,
      auditLog: [...currentState.auditLog, auditEntry],
    },
  };
}

function deriveNextStatus(status: ExecutionControlStatus, action: ExecutionControlAction): ExecutionControlStatus {
  if (action === 'pause' && status === 'working') {
    return 'paused';
  }
  if (action === 'resume' && status === 'paused') {
    return 'working';
  }
  if (action === 'cancel') {
    return 'canceled';
  }
  return 'queued';
}

function cloneState(state: ExecutionControlState): ExecutionControlState {
  return {
    schemaVersion: 'agent-hangar.execution-control-state.v1',
    runId: sanitizeIdentifier(state.runId),
    ...(state.nodeId ? { nodeId: sanitizeIdentifier(state.nodeId) } : {}),
    status: state.status,
    auditLog: state.auditLog.map((entry) => ({
      schemaVersion: 'agent-hangar.execution-control-audit.v1',
      id: sanitizeIdentifier(entry.id),
      runId: sanitizeIdentifier(entry.runId),
      ...(entry.nodeId ? { nodeId: sanitizeIdentifier(entry.nodeId) } : {}),
      actorId: sanitizeIdentifier(entry.actorId),
      action: entry.action,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      occurredAt: entry.occurredAt.trim(),
      ...(entry.reason ? { reason: sanitizeNote(entry.reason) } : {}),
      ...(entry.note ? { note: sanitizeNote(entry.note) } : {}),
    })),
  };
}

function buildAuditId(
  state: ExecutionControlState,
  action: ExecutionControlAction,
  actorId: string,
  occurredAt: string,
): string {
  return sanitizeIdentifier(`control-${state.runId}-${state.nodeId ?? 'run'}-${occurredAt}-${actorId}-${action}`);
}

function sanitizeIdentifier(value: string): string {
  return sanitizeText(value).replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
}

function sanitizeNote(value: string): string {
  return truncate(sanitizeText(value), NOTE_LIMIT);
}

function sanitizeText(value: string): string {
  return value
    .trim()
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bsk-[A-Za-z0-9._-]+/g, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, 'workspace');
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 3).trimEnd()}...`;
}
