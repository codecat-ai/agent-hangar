import React, { useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import {
  createProfileFromDraft,
  deleteProviderProfileById,
  draftFromProfile,
  emptyProviderProfileDraft,
  summarizeProviderProfiles,
  updateProfileFromDraft,
  type ProviderProfileDraft,
} from './harness/providerProfileFlow';
import { type NormalizedModel, type ProviderKind } from './harness/providerCatalog';
import { type ProviderProfile, type ProviderProfileClock, type ProviderProfileCrypto } from './harness/providerProfiles';
import { deriveProviderShellState } from './harness/shellStates';

const providerKinds: ProviderKind[] = ['openai', 'anthropic', 'gemini', 'openai-compatible'];

export interface ProviderProfilePanelProps {
  crypto: ProviderProfileCrypto;
  clock: ProviderProfileClock;
  now: string;
  initialProfiles: ProviderProfile[];
  modelsByProvider: Record<string, NormalizedModel[]>;
}

export function ProviderProfilePanel({ crypto, clock, now, initialProfiles, modelsByProvider }: ProviderProfilePanelProps) {
  const [profiles, setProfiles] = useState<ProviderProfile[]>(initialProfiles);
  const [draft, setDraft] = useState<ProviderProfileDraft>(emptyProviderProfileDraft());
  const [editingId, setEditingId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const summaries = useMemo(() => summarizeProviderProfiles(profiles, modelsByProvider, now), [profiles, modelsByProvider, now]);
  const shellState = useMemo(
    () => deriveProviderShellState({ profiles, modelsByProvider, now }),
    [modelsByProvider, now, profiles],
  );

  function updateDraft(field: keyof ProviderProfileDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function startCreate() {
    setEditingId(undefined);
    setDraft(emptyProviderProfileDraft());
    setError(undefined);
  }

  function startEdit(profile: ProviderProfile) {
    setEditingId(profile.id);
    setDraft(draftFromProfile(profile));
    setError(undefined);
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    try {
      if (editingId) {
        setProfiles((current) => current.map((profile) => (
          profile.id === editingId ? updateProfileFromDraft(profile, draft, crypto, clock) : profile
        )));
      } else {
        const profile = createProfileFromDraft(draft, crypto, clock);
        if (profiles.some((existing) => existing.id === profile.id)) {
          throw new Error('Provider profile id already exists');
        }
        setProfiles((current) => [...current, profile]);
      }
      startCreate();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save provider profile');
    }
  }

  function deleteProfile(profile: ProviderProfile) {
    setProfiles((current) => deleteProviderProfileById(current, profile.id));
    if (editingId === profile.id) {
      startCreate();
    }
  }

  return (
    <section className="panel provider-manager" aria-labelledby="provider-profile-heading">
      <div className="panel-heading">
        <div>
          <h2 id="provider-profile-heading">Provider profiles</h2>
          <p>Local profile drafts use demo-only encryption until Tauri secure storage is wired in.</p>
        </div>
        <button className="icon-button" type="button" onClick={startCreate} aria-label="Create new provider profile">
          <Plus size={18} />
        </button>
      </div>

      <form className="profile-form" onSubmit={saveProfile}>
        <label>
          Profile ID
          <input value={draft.id} onChange={(event) => updateDraft('id', event.target.value)} disabled={Boolean(editingId)} />
        </label>
        <label>
          Provider kind
          <select value={draft.kind} onChange={(event) => updateDraft('kind', event.target.value)}>
            {providerKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
        </label>
        <label>
          Display name
          <input value={draft.displayName} onChange={(event) => updateDraft('displayName', event.target.value)} />
        </label>
        <label>
          Base URL
          <input value={draft.baseUrl} onChange={(event) => updateDraft('baseUrl', event.target.value)} />
        </label>
        <label className="wide-field">
          API key
          <input
            value={draft.apiKey ?? ''}
            onChange={(event) => updateDraft('apiKey', event.target.value)}
            type="password"
            autoComplete="off"
          />
        </label>
        <div className="form-actions">
          <button type="submit">
            <Save size={16} />
            Save profile
          </button>
          {editingId ? (
            <button type="button" onClick={startCreate}>
              <X size={16} />
              Cancel
            </button>
          ) : null}
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>

      <div className="shell-state-banner" role="status" aria-live="polite">
        <strong>{shellState.label}</strong>
        <span>{shellState.summary}</span>
      </div>
      <p className="shell-guidance">{shellState.guidance}</p>

      <div className="profile-list" aria-label="Provider shell states">
        {summaries.length === 0 ? <p className="empty-state">No provider profiles yet.</p> : null}
        {summaries.map((summary) => {
          const profile = profiles.find((item) => item.id === summary.id);
          if (!profile) {
            return null;
          }
          return (
            <article className="card provider-card profile-card" key={summary.id} data-testid={`provider-profile-${summary.id}`}>
              <span className={`dot ${summary.health.status}`} />
              <div className="card-body">
                <div className="card-title">
                  <strong>{summary.displayName}</strong>
                  <small>{summary.kind} · {summary.modelCount} models</small>
                </div>
                <div className="summary-grid">
                  <span>Key: {summary.keyStatus}</span>
                  <span><RefreshCw size={14} /> {summary.refreshStatus}</span>
                </div>
                <small className="health-detail">{summary.health.detail}</small>
                <div className="tag-row">
                  {summary.capabilities.tags.length > 0
                    ? summary.capabilities.tags.map((tag) => <span className="tag" key={tag}>{tag} {summary.capabilities.counts[tag]}</span>)
                    : <span className="tag muted">no model capabilities</span>}
                </div>
              </div>
              <div className="card-actions">
                <button className="icon-button" type="button" onClick={() => startEdit(profile)} aria-label={`Edit ${summary.displayName}`}>
                  <Pencil size={16} />
                </button>
                <button className="icon-button danger" type="button" onClick={() => deleteProfile(profile)} aria-label={`Delete ${summary.displayName}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
