# Agent Hangar Roadmap

## Maturity and cadence

- **Maturity:** `active-development`
- **Planned cadence:** 2-4 focused sessions per week during foundation hardening.
- **Current phase:** Foundation, provider management, template studio, execution graph, expanded local demo workspace, local evidence export, guarded local execution controls, collaboration inbox persistence, and audit-history preview groundwork.
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
4. **Execution graph scaffolding**
   - Pure TypeScript execution graph helpers are implemented for deterministic workspace graphs with agent role/task nodes and directed dependency/handoff edges.
   - Validation now covers duplicate node ids, missing edge endpoints, self cycles, dependency cycles, unreachable non-start nodes, and blocked/missing template bindings.
   - Secret-safe operator summaries report node/edge counts, status counts, issue counts, and suggested next runnable nodes without raw API keys or encrypted key material.
   - Pure deterministic execution trail helpers now replay schema-versioned local events for task creation, planning, assignment, handoff/review, and completion into secret-safe summaries with event/status counts, ordered timeline entries, latest node statuses, next runnable nodes, and validation issue counts.
   - Pure deterministic demo workspace seed helpers now produce schema-versioned, clone-safe, secret-safe planner, researcher, implementer, and reviewer coordination data for graph, trail, collaboration, and audit-history preview surfaces.
   - A React execution graph preview shows graph counts, issue summaries, next runnable nodes, deterministic local execution trail evidence, guarded local execution controls, and a local-only run evidence export preview/copy action.
   - A pure deterministic run evidence export formatter now produces schema-versioned, secret-safe Markdown and preview data from trail summaries, graph validation issues, graph status counts, next runnable nodes, and timeline evidence.
   - Pure guarded execution-control helpers now derive allowed local pause, resume, cancel, and retry actions, apply clone-safe deterministic state transitions with injected clock/actor values, reject invalid completed-state actions with typed issues, and emit sanitized audit entries.
   - The local demo UI now exposes allowed control buttons only for the selected run/node state and previews sanitized status/audit results without real provider execution or external commands.
   - Pure collaboration inbox helpers now normalize schema-versioned delegation, review, broadcast, and escalation items; trim text; reject invalid type, status, priority, timestamp, schema, id, and title fields with typed issues; sort unresolved high-priority recent records first; and redact secret-looking body/note content.
   - Pure audit-history preview helpers now combine guarded execution-control audit entries with collaboration items into deterministic counts, recent sanitized entries, unresolved escalation counts, next-action hints, and secret-safe Markdown preview data.
   - Pure collaboration mutation helpers now acknowledge and resolve inbox items by id, reject unknown ids and invalid resolved-item transitions with typed issues, keep clone-safe sorted records, append schema-versioned sanitized mutation audit entries with injected clock/actor values, and return schema-versioned local persistence payloads with sanitized audit-history previews.
   - The local demo UI now shows a compact demo workspace summary, collaboration inbox counts, unresolved items, relevant acknowledge/resolve controls, localStorage persistence with safe fallback, mutation status text, recent sanitized audit history, next-action hints, and copyable Markdown preview data inside the execution graph panel.
5. **Operator-facing shell hardening**
   - Turn provider and agent panels from static scaffolding into test-backed UI states.
   - Add empty, loading, error, and disconnected states before introducing long-running execution.

## Next

1. **Collaboration triage ergonomics**
   - Add operator filters or compact views for collaboration and audit history once the seeded demo has enough items to justify them.
   - Keep collaboration mutation state deterministic, schema-versioned, and provider-free.
2. **Workspace portability**
   - Reuse template validation reports in source-checkout workspace import/export flows.
   - Keep bundle previews free of raw provider API keys and encrypted key material.
3. **Demo evidence scenarios**
   - Add a second deterministic local scenario for blocked or failed work so guarded controls, escalation handling, and audit previews can be exercised without providers.
   - Keep every scenario source-checkout friendly and free of real secrets, tokens, customer data, network calls, and shell commands.

## Later

1. **Observability and replay**
   - Token/cost summaries, structured error taxonomy, and provider-backed run reports.
2. **Execution observability**
   - Import/export provider-backed run evidence with schema versions and validation reports.
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

- If Agent Hangar has a working source-checkout desktop flow, encrypted provider profiles, provider profile UI, model discovery refresh, template CRUD, execution graph previews, and a useful demo workspace, consider moving from `active-development` to `growth`.
- If setup remains fragile or the project does not yet offer a usable operator workflow after several sessions, pause new feature work and focus only on reproducibility and onboarding.
- If a future desktop package or public release is prepared, verify install instructions against the actual artifact before documenting them.

## Completion-review rule

Before adding work beyond the current Now/Next/Later plan, do a completion review:

1. Verify whether the current roadmap created a coherent operator workflow rather than only disconnected panels.
2. Decide whether user value justifies a new phase such as packaged releases, integrations, or multi-provider execution.
3. If not, lower cadence to `maintenance` and reserve effort for bugs, CI, docs truthfulness, security/privacy, or adoption-driven requests.
