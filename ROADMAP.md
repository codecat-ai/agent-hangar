# Agent Hangar Roadmap

## Maturity and cadence

- **Maturity:** `active-development`
- **Planned cadence:** 2-4 focused sessions per week during foundation hardening.
- **Current phase:** Foundation, provider management, and template studio groundwork.
- **Category:** Local-first desktop productivity / multi-agent operations UI.

Agent Hangar is a young project. It should receive active investment only while each session advances a product-shaped workflow: reproducible setup, safe provider management, prompt/template governance, task execution, observability, or usable demo evidence. Avoid adding decorative UI or narrow options before the core operator workflow is dependable.

## Now

1. **Reproducible frontend setup**
   - A `package-lock.json` is now committed so local and CI frontend installs can use `npm ci`.
   - Keep source-checkout documentation truthful until a packaged desktop release exists.
   - Verify Rust core tests, frontend build, frontend tests, and CI together.
2. **Provider-management foundation**
   - Encrypted local provider profile helpers are implemented in the frontend harness with injectable crypto for later Tauri secure storage.
   - Local provider profile create/edit/delete UI flow is implemented with deterministic controller tests and React tests.
   - Provider cards now include secret-safe health summaries for missing keys, empty inventories, ready providers, degraded providers, and stale model inventories.
   - Normalized model capability tags now summarize text, vision, reasoning, embeddings, fast, long-context, and tool-use support for operator decisions.
   - Preserve the secret-safe display/debug contract as Tauri secure storage and real model discovery refresh adapters are added.
3. **Agent template studio**
   - Prompt template CRUD helpers are implemented in the frontend harness with deterministic role presets, `{{variableName}}` extraction, immutable updates, version history, provider/model/escalation validation, workspace tool requirement checks, escalation policy schema checks, policy variable binding checks, and schema-versioned validation reports.
   - A React template studio foundation is implemented for viewing presets/templates, creating from role presets, editing records, and showing validation/version status plus missing/disabled tool and unknown policy-variable summaries.
   - Keep template records local-first and ensure provider/model bindings never expose raw provider/API secrets.
4. **Operator-facing shell hardening**
   - Turn provider and agent panels from static scaffolding into test-backed UI states.
   - Add empty, loading, error, and disconnected states before introducing long-running execution.

## Next

1. **Execution graph**
   - Create tasks, assign agent teams, spawn subagents, and stream events.
   - Support pause, resume, cancel, retry, and durable audit logs.
   - Add inter-agent inbox views for delegation, review, broadcast, and escalation.
2. **Demo workspace**
   - Include a deterministic local demo showing a small team moving a task from planning to review.
   - Keep demo data free of real secrets, tokens, customer data, or external commands.
3. **Workspace portability**
   - Reuse template validation reports in source-checkout workspace import/export flows.
   - Keep bundle previews free of raw provider API keys and encrypted key material.

## Later

1. **Observability and replay**
   - Timeline replay, token/cost summaries, structured error taxonomy, and exportable run reports.
2. **Execution observability**
   - Import/export run evidence with schema versions and validation reports.
3. **Polish and accessibility**
   - Keyboard-first navigation, screen-reader labels for operational states, and a restrained pixel animation pack for queued, working, blocked, failed, and completed states.
4. **Packaging review**
   - Evaluate signed desktop builds only after the provider profile and task execution workflows are useful and tested.

## Maintenance triggers

Treat these as higher priority than routine feature growth:

- Failing `main` CI or broken local verification commands.
- Misleading install or packaging documentation.
- Any path that can display, log, export, or commit provider secrets.
- Data-loss risk in local provider profiles, templates, workspaces, or task history.
- Browser/Tauri compatibility regressions that block the source-checkout workflow.
- Accessibility regressions in core operator controls.

## Cadence-review notes

Review cadence after the provider-management foundation and first demo workspace are complete.

- If Agent Hangar has a working source-checkout desktop flow, encrypted provider profiles, provider profile UI, model discovery refresh, template CRUD, and a useful demo workspace, consider moving from `active-development` to `growth`.
- If setup remains fragile or the project does not yet offer a usable operator workflow after several sessions, pause new feature work and focus only on reproducibility and onboarding.
- If a future desktop package or public release is prepared, verify install instructions against the actual artifact before documenting them.

## Completion-review rule

Before adding work beyond the current Now/Next/Later plan, do a completion review:

1. Verify whether the current roadmap created a coherent operator workflow rather than only disconnected panels.
2. Decide whether user value justifies a new phase such as packaged releases, integrations, or multi-provider execution.
3. If not, lower cadence to `maintenance` and reserve effort for bugs, CI, docs truthfulness, security/privacy, or adoption-driven requests.
