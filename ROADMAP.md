# Agent Hangar Roadmap

## Maturity and cadence

- **Maturity:** `active-development`
- **Planned cadence:** 2-4 focused sessions per week during foundation hardening.
- **Current phase:** Foundation, provider management, deterministic provider discovery dry-run previews, provider/agent shell states, template studio, execution graph, expanded local demo scenarios, local evidence export, scenario evidence packaging, source-checkout workspace portability manifest previews, source-checkout workspace import/export dry runs, guarded local execution controls, collaboration inbox persistence, collaboration triage filters, compact audit previews, and audit-history preview groundwork.
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
   - Deterministic provider discovery dry-run helpers now consume local provider profiles and fixture responses to produce schema-versioned previews for missing-key, ready, empty inventory, degraded/permission, stale inventory, and malformed fixture states without provider calls, network calls, shell execution, or package-registry assumptions.
   - The provider profile UI now exposes an accessible local discovery dry-run preview with status/severity guidance, model counts, capability tags, typed fixture issues, aggregate counts, and the existing secret-safe display contract.
   - Pure provider shell-state helpers now derive deterministic empty, disconnected, inventory-empty, stale, degraded/error, and ready summaries with local operator guidance.
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
   - Pure deterministic demo workspace scenario helpers now list and clone schema-versioned local scenarios, including the default coordination happy path and a blocked/failure-recovery path with failed and blocked node states, unresolved escalation triage, high-priority collaboration, audit history, and next-action hints.
   - A React execution graph preview shows graph counts, issue summaries, next runnable nodes, deterministic local execution trail evidence, guarded local execution controls, and a local-only run evidence export preview/copy action.
   - A pure deterministic run evidence export formatter now produces schema-versioned, secret-safe Markdown and preview data from trail summaries, graph validation issues, graph status counts, next runnable nodes, and timeline evidence.
   - Pure guarded execution-control helpers now derive allowed local pause, resume, cancel, and retry actions, apply clone-safe deterministic state transitions with injected clock/actor values, reject invalid completed-state actions with typed issues, and emit sanitized audit entries.
   - The local demo UI now exposes allowed control buttons only for the selected run/node state and previews sanitized status/audit results without real provider execution or external commands.
   - Pure collaboration inbox helpers now normalize schema-versioned delegation, review, broadcast, and escalation items; trim text; reject invalid type, status, priority, timestamp, schema, id, and title fields with typed issues; sort unresolved high-priority recent records first; and redact secret-looking body/note content.
   - Pure audit-history preview helpers now combine guarded execution-control audit entries with collaboration items into deterministic counts, recent sanitized entries, unresolved escalation counts, next-action hints, and secret-safe Markdown preview data.
   - Pure collaboration mutation helpers now acknowledge and resolve inbox items by id, reject unknown ids and invalid resolved-item transitions with typed issues, keep clone-safe sorted records, append schema-versioned sanitized mutation audit entries with injected clock/actor values, and return schema-versioned local persistence payloads with sanitized audit-history previews.
   - Pure collaboration triage helpers now filter sanitized local demo rows by status, high priority, type, and text across title/body/next-action hints; return compact visible/hidden/active-filter summaries; and count high-priority unresolved items plus unresolved escalations without exposing secret-looking content.
   - The local demo UI now shows an accessible scenario selector, compact demo workspace summaries, deterministic collaboration triage controls, collaboration inbox counts, visible/hidden filter counts, unresolved items, relevant acknowledge/resolve controls, localStorage persistence with safe fallback, mutation status text, filtered sanitized audit history, next-action hints, and copyable Markdown preview data inside the execution graph panel.
   - Pure scenario evidence bundle helpers now reuse run evidence export, audit-history preview, and collaboration triage summaries to produce schema-versioned local-only bundle preview data and Markdown with deterministic ordering, validation for malformed or unsupported bundle inputs, recent audit entries, issue summaries, unresolved escalation/high-priority counts, and redaction for API-key-looking values, encrypted key material, bearer tokens, secret-looking notes, and customer-like text.
   - The local demo UI now exposes a scenario evidence bundle preview/copy region inside the execution graph panel, using the selected local scenario and active collaboration/audit summaries without provider calls, network calls, or external commands.
   - Pure workspace portability manifest preview helpers now summarize source-checkout-only provider binding/inventory status, prompt template validation reports, selected demo scenario identity, execution graph/trail/evidence availability, collaboration/audit portability notes, and blockers for missing provider bindings, missing/disabled tools, unresolved escalations, high-priority collaboration items, graph validation issues, and malformed or unsupported manifest input.
   - The local demo UI now exposes a workspace portability manifest preview/copy region inside the execution graph panel with schema-versioned Markdown, source-checkout-only portability notes, deterministic ordering, and redaction for raw API keys, bearer tokens, encrypted key material, secret-looking notes, and customer-like text.
   - Pure source-checkout-only workspace import/export dry-run helpers now consume manifest preview data for export readiness, validate import candidate bundle shapes before mutation, report file-level ready/accepted/rejected/missing entries, summarize replacement/new workspace decisions, inherit manifest blockers, and state that local provider secrets, encrypted key material, saved desktop state, and localStorage records were not mutated.
   - The local demo UI now exposes a workspace import/export dry-run preview/copy region for the selected scenario inside the execution graph panel, with schema-versioned Markdown and no provider, shell, network, package-registry, or Tauri API calls.
5. **Operator-facing shell hardening**
   - Provider and agent panels now use test-backed shell-state derivation instead of static scaffolding.
   - Agent runway helpers now cover empty, queued, working, completed, blocked provider/template bindings, stale provider warnings, and failed/error states without real provider execution.
   - React provider and agent panels now show accessible local guidance/status regions and redact raw API keys, bearer tokens, encrypted key material, and customer-like text.
   - Keep these shell states local/demo-only until real provider discovery adapters have their own reviewed contracts and fixture-backed tests.

## Next

1. **Workspace import/export fixture review**
   - Add small checked-in source-checkout fixture manifests for import validation examples once the dry-run schema settles.
   - Keep fixtures synthetic, secret-safe, and free of package-registry or provider execution assumptions.
2. **Provider discovery contract review**
   - Draft the non-network adapter boundary that future live discovery implementations must satisfy.
   - Keep the reviewed boundary disabled by default until storage, consent, retry, and audit behavior are specified.

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
