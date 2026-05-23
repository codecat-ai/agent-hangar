import React, { useEffect, useMemo, useState } from 'react';
import { Clipboard, GitBranch } from 'lucide-react';
import {
  applyExecutionControlAction,
  deriveAllowedExecutionControlActions,
  type ExecutionControlAction,
  type ExecutionControlAuditEntry,
  type ExecutionControlState,
  type ExecutionControlStatus,
} from './harness/executionControls';
import {
  applyCollaborationInboxMutation,
  buildAuditHistoryPreview,
  sortCollaborationInboxItems,
  type CollaborationMutationAction,
  type CollaborationMutationAuditEntry,
  type CollaborationInboxRecord,
} from './harness/collaborationAudit';
import {
  buildExecutionGraphSummary,
  validateExecutionGraph,
  type ExecutionGraph,
  type ExecutionNodeStatus,
} from './harness/executionGraph';
import { type ExecutionTrailSummary } from './harness/executionTrail';
import { formatRunEvidenceExport } from './harness/runEvidenceExport';

export interface ExecutionGraphPanelProps {
  graph: ExecutionGraph;
  trailSummary?: ExecutionTrailSummary;
  collaborationItems?: CollaborationInboxRecord[];
  collaborationActorId?: string;
  collaborationClock?: () => string;
  collaborationStorage?: CollaborationStorage;
  secretPreview?: string;
  copyRunEvidence?: (markdown: string) => void | Promise<void>;
  copyAuditHistory?: (markdown: string) => void | Promise<void>;
}

interface CollaborationStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface CollaborationUiState {
  items: CollaborationInboxRecord[];
  auditEntries: CollaborationMutationAuditEntry[];
  statusMessage?: string;
  issueMessage?: string;
}

const EMPTY_COLLABORATION_ITEMS: CollaborationInboxRecord[] = [];

export function ExecutionGraphPanel({
  graph,
  trailSummary,
  collaborationItems = EMPTY_COLLABORATION_ITEMS,
  collaborationActorId = 'operator-local-demo',
  collaborationClock = () => '2026-05-23T10:08:00.000Z',
  collaborationStorage,
  copyRunEvidence,
  copyAuditHistory,
}: ExecutionGraphPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [auditCopyState, setAuditCopyState] = useState<'idle' | 'copied'>('idle');
  const issues = useMemo(() => validateExecutionGraph(graph), [graph]);
  const summary = useMemo(() => buildExecutionGraphSummary(graph), [graph]);
  const initialControlState = useMemo(
    () => (trailSummary ? createInitialControlState(graph, trailSummary.latestNodeStatuses) : undefined),
    [graph, trailSummary],
  );
  const [controlState, setControlState] = useState<ExecutionControlState | undefined>(initialControlState);
  const [controlIssue, setControlIssue] = useState<string | undefined>();
  const [latestAuditEntry, setLatestAuditEntry] = useState<ExecutionControlAuditEntry | undefined>();
  const collaborationStorageKey = `agent-hangar:${graph.workspaceId}:collaboration-persistence:v1`;
  const storage = useMemo(() => collaborationStorage ?? getLocalStorage(), [collaborationStorage]);
  const initialCollaborationState = useMemo(
    () => readInitialCollaborationState(collaborationItems, storage, collaborationStorageKey),
    [collaborationItems, collaborationStorageKey, storage],
  );
  const [collaborationState, setCollaborationState] = useState<CollaborationUiState>(initialCollaborationState);
  const runEvidenceExport = useMemo(() => (
    trailSummary
      ? formatRunEvidenceExport({ trailSummary, graphSummary: summary, graphIssues: issues })
      : undefined
  ), [issues, summary, trailSummary]);
  const sortedCollaborationItems = useMemo(
    () => sortCollaborationInboxItems(collaborationState.items),
    [collaborationState.items],
  );
  const auditHistoryPreview = useMemo(() => (
    buildAuditHistoryPreview({
      auditEntries: [...(controlState?.auditLog ?? []), ...collaborationState.auditEntries],
      collaborationItems: sortedCollaborationItems,
    })
  ), [collaborationState.auditEntries, controlState?.auditLog, sortedCollaborationItems]);
  const allowedControlActions = useMemo(
    () => (controlState ? deriveAllowedExecutionControlActions(controlState) : []),
    [controlState],
  );
  const blockingLabel = `${summary.blockingIssueCount} blocking ${summary.blockingIssueCount === 1 ? 'issue' : 'issues'}`;
  const unresolvedCollaborationCount = sortedCollaborationItems.filter((item) => item.status !== 'resolved').length;
  const urgentCollaborationCount = sortedCollaborationItems.filter((item) => item.priority === 'urgent').length;

  useEffect(() => {
    setControlState(initialControlState);
    setControlIssue(undefined);
    setLatestAuditEntry(undefined);
  }, [initialControlState]);

  useEffect(() => {
    setCollaborationState(initialCollaborationState);
  }, [initialCollaborationState]);

  const handleCopyRunEvidence = () => {
    if (!runEvidenceExport) {
      return;
    }
    const copy = copyRunEvidence ?? ((markdown: string) => navigator.clipboard?.writeText(markdown));
    void Promise.resolve(copy(runEvidenceExport.markdown)).then(() => setCopyState('copied'));
  };
  const handleCopyAuditHistory = () => {
    const copy = copyAuditHistory ?? ((markdown: string) => navigator.clipboard?.writeText(markdown));
    void Promise.resolve(copy(auditHistoryPreview.markdown)).then(() => setAuditCopyState('copied'));
  };
  const handleControlAction = (action: ExecutionControlAction) => {
    if (!controlState) {
      return;
    }
    const result = applyExecutionControlAction(controlState, action, {
      actorId: 'operator-local-demo',
      clock: () => '2026-05-23T10:08:00.000Z',
      reason: 'Local deterministic demo control.',
    });
    setControlState(result.state);
    if (result.ok) {
      setLatestAuditEntry(result.auditEntry);
      setControlIssue(undefined);
    } else {
      setLatestAuditEntry(undefined);
      setControlIssue(result.issue.message);
    }
  };
  const handleCollaborationAction = (itemId: string, action: CollaborationMutationAction) => {
    const result = applyCollaborationInboxMutation(collaborationState.items, {
      action,
      itemId,
      actorId: collaborationActorId,
      clock: collaborationClock,
      reason: action === 'resolve' ? 'Resolved from local collaboration inbox.' : undefined,
      note: action === 'acknowledge' ? 'Acknowledged from local collaboration inbox.' : undefined,
      existingAuditEntries: collaborationState.auditEntries,
      auditHistoryEntries: controlState?.auditLog ?? [],
    });

    if (!result.ok) {
      setCollaborationState((current) => ({
        ...current,
        issueMessage: result.issue?.message ?? 'Collaboration mutation failed.',
        statusMessage: undefined,
      }));
      return;
    }

    const persistenceAvailable = persistCollaborationState(storage, collaborationStorageKey, result.persistencePayload);
    setCollaborationState({
      items: result.items,
      auditEntries: result.auditEntries,
      statusMessage: `${formatActionPastTense(action)} ${itemId}.${persistenceAvailable ? '' : ' Local persistence is unavailable.'}`,
      issueMessage: undefined,
    });
  };

  return (
    <section className="panel execution-graph" aria-labelledby="execution-graph-heading">
      <div className="panel-heading">
        <div>
          <h2 id="execution-graph-heading">Execution graph</h2>
          <p>Local workspace preview for agent roles, task dependencies, handoffs, and deterministic runnable-node planning.</p>
        </div>
        <span className="graph-icon" aria-hidden="true"><GitBranch size={20} /></span>
      </div>

      <div className="summary-grid graph-summary" aria-label="Execution graph summary">
        <span>{summary.nodeCount} {summary.nodeCount === 1 ? 'node' : 'nodes'}</span>
        <span>{summary.edgeCount} {summary.edgeCount === 1 ? 'edge' : 'edges'}</span>
        <span>{blockingLabel}</span>
        <span>{summary.statusCounts.completed} completed</span>
        <span>{summary.statusCounts.queued + summary.statusCounts.runnable} queued</span>
      </div>

      <div className="graph-columns">
        <div>
          <h3>Preview</h3>
          <ol className="graph-node-list">
            {graph.nodes.map((node) => (
              <li key={node.id}>
                <strong>{node.title}</strong>
                <small>{node.role} · {node.status}</small>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h3>Next runnable</h3>
          {summary.nextRunnableNodeIds.length > 0 ? (
            <ul className="tag-row" aria-label="Next runnable nodes">
              {summary.nextRunnableNodeIds.map((nodeId) => <li className="tag" key={nodeId}>{nodeId}</li>)}
            </ul>
          ) : (
            <p className="empty-state" role="status">No runnable nodes are ready.</p>
          )}
        </div>
      </div>

      {issues.length > 0 ? (
        <ul className="issue-list" aria-label="Execution graph issues">
          {issues.map((issue) => (
            <li key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}

      {trailSummary ? (
        <div className="trail-preview" aria-labelledby="execution-trail-heading">
          <div className="trail-heading">
            <h3 id="execution-trail-heading">Local execution trail</h3>
            <div className="summary-grid trail-summary" aria-label="Execution trail summary">
              <span>{trailSummary.eventCount} {trailSummary.eventCount === 1 ? 'event' : 'events'}</span>
              <span>{trailSummary.issueCount} trail {trailSummary.issueCount === 1 ? 'issue' : 'issues'}</span>
              <span>{trailSummary.eventStatusCounts.accepted} accepted</span>
              <span>{trailSummary.latestNodeStatuses
                ? Object.values(trailSummary.latestNodeStatuses).filter((status) => status === 'completed').length
                : 0} completed</span>
            </div>
          </div>
          <ol className="trail-list" aria-label="Local execution timeline">
            {trailSummary.timeline.map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.occurredAt}>{entry.occurredAt.slice(11, 16)}</time>
                <div>
                  <strong>{entry.title}</strong>
                  <small>{entry.kind} · {entry.status}</small>
                  {entry.note ? <p>{entry.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {trailSummary && controlState ? (
        <section className="execution-controls" aria-labelledby="execution-controls-heading">
          <div className="trail-heading">
            <div>
              <h3 id="execution-controls-heading">Guarded execution controls</h3>
              <p>{controlState.nodeId ?? controlState.runId} · {controlState.status}</p>
            </div>
            <div className="tag-row" aria-label="Allowed guarded actions">
              {allowedControlActions.length > 0 ? allowedControlActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleControlAction(action)}
                  aria-label={`${formatActionLabel(action)} local run ${controlState.nodeId ?? controlState.runId}`}
                >
                  {formatActionLabel(action)}
                </button>
              )) : <span className="tag muted">No actions</span>}
            </div>
          </div>
          {allowedControlActions.length === 0 ? (
            <p className="empty-state">No guarded actions are available for this local state.</p>
          ) : null}
          {latestAuditEntry ? (
            <div className="control-audit-preview">
              <p role="status">{controlState.nodeId ?? controlState.runId} is {controlState.status}.</p>
              <small>
                {latestAuditEntry.actorId} · {latestAuditEntry.action} · {latestAuditEntry.fromStatus} -&gt; {latestAuditEntry.toStatus} · {latestAuditEntry.occurredAt}
              </small>
            </div>
          ) : null}
          {controlIssue ? <p className="form-error" role="alert">{controlIssue}</p> : null}
        </section>
      ) : null}

      <section className="collaboration-inbox" aria-labelledby="collaboration-inbox-heading">
        <div className="trail-heading">
          <div>
            <h3 id="collaboration-inbox-heading">Collaboration inbox</h3>
            <div className="summary-grid trail-summary" aria-label="Collaboration inbox summary">
              <span>{sortedCollaborationItems.length} {sortedCollaborationItems.length === 1 ? 'item' : 'items'}</span>
              <span>{unresolvedCollaborationCount} unresolved</span>
              <span>{urgentCollaborationCount} urgent</span>
            </div>
          </div>
        </div>
        {sortedCollaborationItems.length > 0 ? (
          <ol className="trail-list" aria-label="Collaboration inbox items">
            {sortedCollaborationItems.slice(0, 4).map((item) => (
              <li key={item.id}>
                <time dateTime={item.createdAt}>{item.createdAt.slice(11, 16)}</time>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.type} · {item.priority} · {item.status}{item.assignedAgentId ? ` · ${item.assignedAgentId}` : ''}</small>
                  {item.body ? <p>{item.body}</p> : null}
                  {item.note ? <p>{item.note}</p> : null}
                  {item.status !== 'resolved' ? (
                    <div className="tag-row" aria-label={`Collaboration actions for ${item.id}`}>
                      {item.status === 'open' ? (
                        <button
                          type="button"
                          onClick={() => handleCollaborationAction(item.id, 'acknowledge')}
                          aria-label={`Acknowledge collaboration item ${item.id}`}
                        >
                          Acknowledge
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleCollaborationAction(item.id, 'resolve')}
                        aria-label={`Resolve collaboration item ${item.id}`}
                      >
                        Resolve
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">No collaboration inbox items are pending.</p>
        )}
        {collaborationState.statusMessage ? <p className="copy-status" role="status">{collaborationState.statusMessage}</p> : null}
        {collaborationState.issueMessage ? <p className="form-error" role="alert">{collaborationState.issueMessage}</p> : null}
      </section>

      <section className="audit-history-preview" aria-labelledby="audit-history-heading">
        <div className="trail-heading">
          <div>
            <h3 id="audit-history-heading">Audit history preview</h3>
            <div className="summary-grid trail-summary" aria-label="Audit history summary">
              <span>{auditHistoryPreview.counts.auditEntries} audit {auditHistoryPreview.counts.auditEntries === 1 ? 'entry' : 'entries'}</span>
              <span>{auditHistoryPreview.counts.collaborationItems} collaboration {auditHistoryPreview.counts.collaborationItems === 1 ? 'item' : 'items'}</span>
              <span>{auditHistoryPreview.counts.unresolvedEscalations} unresolved {auditHistoryPreview.counts.unresolvedEscalations === 1 ? 'escalation' : 'escalations'}</span>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={handleCopyAuditHistory} aria-label="Copy audit history preview" title="Copy audit history preview">
            <Clipboard size={18} aria-hidden="true" />
          </button>
        </div>
        <ul className="issue-list" aria-label="Audit history next actions">
          {auditHistoryPreview.nextActionHints.map((hint) => <li key={hint}>{hint}</li>)}
        </ul>
        <pre className="run-evidence-markdown" aria-label="Audit history Markdown preview">
          {auditHistoryPreview.markdown.split('\n').map((line, index) => (
            <code key={`${index}-${line}`}>{line || ' '}</code>
          ))}
        </pre>
        {auditCopyState === 'copied' ? <p className="copy-status" role="status">Copied audit history preview.</p> : null}
      </section>

      {runEvidenceExport ? (
        <div className="run-evidence-preview" aria-labelledby="run-evidence-heading">
          <div className="trail-heading">
            <div>
              <h3 id="run-evidence-heading">Run evidence export</h3>
              <div className="summary-grid trail-summary" aria-label="Run evidence export metadata">
                <span>{runEvidenceExport.schemaVersion}</span>
                <span>{runEvidenceExport.workspaceId}</span>
              </div>
            </div>
            <button className="icon-button" type="button" onClick={handleCopyRunEvidence} aria-label="Copy run evidence export" title="Copy run evidence export">
              <Clipboard size={18} aria-hidden="true" />
            </button>
          </div>
          <pre className="run-evidence-markdown" aria-label="Run evidence export preview">
            {runEvidenceExport.markdown.split('\n').map((line, index) => (
              <code key={`${index}-${line}`}>{line || ' '}</code>
            ))}
          </pre>
          {copyState === 'copied' ? <p className="copy-status" role="status">Copied run evidence export.</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function createInitialControlState(
  graph: ExecutionGraph,
  latestNodeStatuses: Record<string, ExecutionNodeStatus>,
): ExecutionControlState | undefined {
  const candidates = graph.nodes.map((node) => {
    const status = toControlStatus(latestNodeStatuses[node.id] ?? node.status);
    return {
      node,
      status,
      allowedActions: deriveAllowedExecutionControlActions({ status }),
    };
  });
  const selected = candidates.find((candidate) => candidate.allowedActions.length > 0) ?? candidates[0];
  if (!selected) {
    return undefined;
  }
  return {
    schemaVersion: 'agent-hangar.execution-control-state.v1',
    runId: `${graph.workspaceId}:${selected.node.id}`,
    nodeId: selected.node.id,
    status: selected.status,
    auditLog: [],
  };
}

function toControlStatus(status: ExecutionNodeStatus): ExecutionControlStatus {
  return status;
}

function formatActionLabel(action: ExecutionControlAction): string {
  return action.slice(0, 1).toUpperCase() + action.slice(1);
}

function formatActionPastTense(action: CollaborationMutationAction): string {
  return action === 'acknowledge' ? 'Acknowledged' : 'Resolved';
}

function readInitialCollaborationState(
  collaborationItems: CollaborationInboxRecord[],
  storage: CollaborationStorage | undefined,
  storageKey: string,
): CollaborationUiState {
  const persisted = readPersistedCollaborationState(storage, storageKey);
  return persisted ?? {
    items: sortCollaborationInboxItems(collaborationItems),
    auditEntries: [],
  };
}

function readPersistedCollaborationState(
  storage: CollaborationStorage | undefined,
  storageKey: string,
): CollaborationUiState | undefined {
  if (!storage) {
    return undefined;
  }

  try {
    const rawPayload = storage.getItem(storageKey);
    if (!rawPayload) {
      return undefined;
    }
    const payload = JSON.parse(rawPayload) as {
      schemaVersion?: string;
      collaborationItems?: CollaborationInboxRecord[];
      mutationAuditEntries?: CollaborationMutationAuditEntry[];
    };
    if (
      payload.schemaVersion !== 'agent-hangar.collaboration-persistence.v1'
      || !Array.isArray(payload.collaborationItems)
      || !Array.isArray(payload.mutationAuditEntries)
    ) {
      return undefined;
    }
    return {
      items: sortCollaborationInboxItems(payload.collaborationItems),
      auditEntries: payload.mutationAuditEntries,
    };
  } catch {
    return undefined;
  }
}

function persistCollaborationState(
  storage: CollaborationStorage | undefined,
  storageKey: string,
  payload: unknown,
): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function getLocalStorage(): CollaborationStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
