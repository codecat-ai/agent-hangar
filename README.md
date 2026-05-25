# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar is a Rust Tauri + React desktop command center for managing teams of AI agents that collaborate on long-running, complex tasks.

## Problem and motivation

Agent frameworks are useful as libraries, but operators still need a clear desktop surface for the parts that make multi-agent work dependable: provider keys, model lists, role prompts, task state, collaboration messages, failures, retries, handoffs, and audit trails. Agent Hangar aims to be that local control room without forcing every experiment into a cloud dashboard.

## Current status

Agent Hangar is in **growth** hardening after its 2026-05-25 foundation completion review. The Rust core harness currently has passing tests for provider normalization, secret-safe provider cards, encrypted local provider profile helpers, agent templates, status transitions, and inter-agent message routing. The frontend harness also normalizes provider health summaries, provider/agent shell states, model capability tags, deterministic provider discovery dry-run previews, and a disabled-by-default fixture-backed provider discovery adapter shell for operator-facing cards, and now includes local-first prompt template, execution graph, deterministic demo execution trail, schema-versioned demo workspace scenarios, local run-evidence export, scenario evidence bundle previews, source-checkout-only workspace portability manifest previews, workspace import/export dry-run reports, a guided source-checkout operator walkthrough, source-checkout onboarding/accessibility guidance, source-checkout evidence quality gates, source-checkout fixture review coverage, guarded local execution-control scaffolding, collaboration inbox normalization, collaboration acknowledgement/resolution persistence, collaboration triage filtering, compact triage summaries, and audit-history preview helpers with role presets, bindings, version history, workspace-aware validation, directed handoff/dependency edges, runnable-node summaries, timeline replay, audit entries, typed collaboration issues, and import/export-ready validation reports. The Tauri/React shell includes local provider profile management, provider discovery dry-run and disabled adapter-shell preview summaries, provider and agent shell-state guidance, a template studio foundation, an execution graph preview with a local scenario selector, local trail counts, compact demo workspace summaries for planner/researcher/implementer/reviewer coordination and blocked recovery, guarded execution controls for local pause/resume/cancel/retry state transitions, a filtered collaboration inbox with acknowledge/resolve actions and local persistence fallback, an audit-history preview section scoped by active triage filters, local-only run evidence, scenario evidence bundle, a primary source-checkout onboarding region, source-checkout operator walkthrough, source-checkout evidence quality gate, workspace portability manifest, and workspace import/export dry-run preview/copy actions. The next phase should keep live provider discovery disabled until readiness gates are reviewed.

The app is not packaged for end users yet. Use the source checkout workflow below for development and evaluation.

## Features

Implemented foundation pieces:

- Rust workspace with an `agent-hangar-core` crate for provider and agent runtime primitives.
- Provider cards that keep secrets out of display/debug output.
- Pure frontend harness helpers for encrypted local provider profiles with injectable crypto for future Tauri secure storage.
- Local provider profile create/edit/delete UI flow with secret-safe key status, write-only replacement key handling, and model discovery health summaries for missing-key, degraded, stale, and empty states.
- Pure deterministic provider discovery dry-run helper that consumes local provider profiles and fixture responses to produce schema-versioned missing-key, ready, empty inventory, degraded/permission, stale inventory, and malformed fixture previews without provider, network, shell, or registry calls.
- React provider discovery dry-run preview with accessible summaries, status/severity guidance, model counts, capability tags, typed fixture issues, aggregate counts, and no raw API keys, bearer tokens, encrypted key material, or customer-like text.
- Reviewed provider discovery adapter contract in `docs/provider-discovery-contract.md`, defining the disabled-by-default live-adapter boundary, consent, timeout/retry, typed failure, audit, fixture, and redaction gates that must be satisfied before real provider discovery is enabled.
- Disabled-by-default fixture-backed provider discovery adapter shell with typed blocked, consent, degraded/permission, malformed, stale, and ready results; injected request timestamps/options only; clone-safe JSON/Markdown previews; local audit metadata; next-action guidance; and no provider, network, shell, registry, or Tauri calls.
- React provider discovery adapter-shell preview that stays read-only and disabled in the local demo while rendering typed blocked guidance without raw API keys, bearer tokens, encrypted key material, API key references, or customer-like text.
- Pure provider and agent shell-state helpers for deterministic empty, disconnected, stale, degraded/error, queued, working, completed, blocked, and failed summaries with local recovery guidance and secret-safe redaction.
- Pure prompt template helpers for deterministic role presets, template create/update/delete behavior, `{{variableName}}` extraction, immutable version history, provider/model/escalation validation, workspace tool requirement checks, escalation policy schema checks, policy variable binding checks, and schema-versioned validation reports.
- React template studio foundation for viewing presets/templates, creating from role presets, editing prompt records, and showing validation/version status plus missing/disabled tool and unknown policy-variable summaries without exposing provider secrets.
- Pure execution graph helpers for deterministic workspace graphs, agent role/task nodes, directed dependency and handoff edges, topology/binding validation, secret-safe operator summaries, and suggested next runnable node lists.
- React execution graph preview for graph counts, issue summaries, next runnable nodes, deterministic local execution trail timeline entries, and local-only run evidence export preview/copy.
- Pure deterministic execution trail helpers with schema-versioned local events, replay summaries, event/status counts, latest node statuses, secret-safe timeline notes, unknown-node issues, and placeholder-only demo workspace data.
- Pure deterministic demo workspace scenario helper for clone-safe planner, researcher, implementer, and reviewer coordination data, including the default coordination scenario plus a blocked/failure-recovery scenario with schema-versioned graph, trail, collaboration, and audit preview inputs.
- Pure deterministic run evidence export formatter with schema-versioned Markdown preview data for trail summaries, graph validation issues, status counts, next runnable nodes, and timeline evidence.
- Pure deterministic scenario evidence bundle formatter with schema-versioned Markdown preview data that reuses run evidence export, audit-history preview, and collaboration triage summaries; validates malformed or unsupported bundle input; preserves deterministic ordering; and redacts API-key-looking values, encrypted key material, bearer tokens, secret-looking notes, and customer-like text.
- Pure deterministic workspace portability manifest preview helper for source-checkout-only workspace handoff summaries, including provider binding/inventory status, prompt template validation reports, selected demo scenario identity, execution graph/trail/evidence availability, collaboration/audit portability notes, blocker validation, schema-versioned preview data, and copy/export-ready Markdown without network, provider, shell, registry, or Tauri calls.
- Pure deterministic source-checkout-only workspace import/export dry-run helper that consumes manifest preview data for export readiness, validates candidate import bundle shapes before mutation, reports file-level accepted/rejected/missing entries, replacement/new workspace notes, inherited blockers, and explicit no-mutation statements without provider, shell, network, registry, or Tauri calls.
- Pure deterministic guided source-checkout operator walkthrough helper that connects provider profiles, discovery dry-run summaries, disabled adapter-shell gates, template validation, selected demo scenarios, execution evidence, collaboration triage/audit, workspace portability, and import/export dry runs into schema-versioned checklist data and Markdown with step ids, labels, statuses, severities, blockers, next actions, clone-safe output, and secret redaction.
- Pure deterministic source-checkout onboarding/accessibility helper for schema-versioned keyboard order, named-region expectations, status-region expectations, setup notes, primary walkthrough guidance, blocker and next-action summaries, and secret-safe Markdown without provider, network, shell, registry, or Tauri calls.
- Pure deterministic source-checkout evidence quality-gate helper that compares copied Markdown and structured preview data across walkthrough, scenario bundle, workspace portability manifest, import/export dry run, collaboration triage/audit previews, run evidence, and onboarding guidance; flags missing Markdown, unsupported or missing schemas, non-source-checkout modes, install-command text, secret-like content, and practical count mismatches; and returns compact status/severity counts, issues, next actions, and copy-ready Markdown without provider, network, shell, registry, or Tauri calls.
- Checked-in synthetic workspace import/export fixture manifests under `examples/workspace-fixtures/`, plus a pure fixture review helper that validates them through the existing import dry-run path and verifies deterministic, source-checkout-only, secret-safe examples without provider or registry execution assumptions.
- Pure guarded execution-control helpers for deriving allowed local pause, resume, cancel, and retry actions, applying clone-safe state transitions with an injected clock and actor id, returning typed invalid-action issues, and producing secret-safe audit entries.
- React guarded execution controls for the local demo run/node state, showing allowed actions only and previewing sanitized audit results without executing real providers or external commands.
- Pure collaboration inbox, triage, and audit-history helpers for schema-versioned delegation, review, broadcast, and escalation items; typed validation and mutation issues; unresolved/high-priority sorting; status, priority, type, and sanitized text filters; compact visible/hidden/filter/count summaries; clone-safe acknowledge/resolve transitions; secret-safe body, note, reason, audit detail summaries, persistence payloads, next-action hints, and deterministic Markdown preview data.
- React scenario selector, source-checkout onboarding, collaboration inbox, audit-history preview, scenario evidence bundle preview, source-checkout operator walkthrough, source-checkout evidence quality gate, workspace portability manifest preview, workspace import/export dry-run preview, and compact demo workspace summary sections inside the execution graph panel, with accessible controls and regions, role counts, collaboration mix, unresolved counts, status/priority/type/search controls, acknowledge/resolve buttons, localStorage persistence fallback, recent sanitized history, next-action hints, source-checkout setup notes, evidence links, evidence quality issues, source-checkout portability blockers, no-mutation dry-run notes, and copyable Markdown.
- Normalized model metadata, conservative capability tags, and provider health summaries for future provider integrations.
- Agent templates, runtime status transitions, and typed inter-agent message routing.
- React/Tauri shell scaffold for provider profile management, prompt template management, provider health/capability summaries, accessible provider shell banners, and agent runway state panels.
- GitHub Actions CI for Rust and frontend verification.

Planned capabilities:

- Manage OpenAI, Anthropic, Gemini, and third-party OpenAI-compatible providers.
- Fetch and normalize provider model lists.
- Launch long-running tasks with cooperating agents and subagents.
- Route delegation, review, broadcast, and escalation messages between agents.
- Show queued, working, blocked, failed, and completed states with clear visual affordances.

## Installation

Agent Hangar is not published to npm, Cargo, Homebrew, or any package registry. Clone the repository and run it from source:

```bash
git clone https://github.com/codecat-ai/agent-hangar.git
cd agent-hangar
```

For Rust-only core development, use Cargo directly:

```bash
cargo test -p agent-hangar-core
```

For frontend/Tauri development, install locked npm dependencies in an environment with registry access:

```bash
npm ci
npm run build
npm test
```

## Quick start

1. Clone the repository.
2. Run the Rust core tests with `cargo test -p agent-hangar-core`.
3. Install locked frontend dependencies with `npm ci` when npm registry access is available.
4. Run `npm run build` and `npm test` to verify the shell.
5. Use `npm run dev` for the Vite frontend during UI iteration, or `npm run tauri` when working on the desktop shell.

## Examples

The current foundation is easiest to inspect through tests:

- `cargo test -p agent-hangar-core` exercises provider normalization and runtime state behavior.
- Frontend tests validate provider profiles, provider discovery dry-run and disabled adapter-shell previews, provider/agent shell states, prompt templates, execution graph and trail scaffolding, and React shell behavior once dependencies are installed.

The current local demo scenarios, execution trails, provider discovery dry-run preview, disabled provider discovery adapter-shell preview, provider and agent shell-state banners, collaboration inbox, audit-history preview, guarded execution controls, run evidence export preview, scenario evidence bundle preview, source-checkout onboarding, source-checkout operator walkthrough, source-checkout evidence quality gate, workspace portability manifest preview, and workspace import/export dry-run preview show a planner, researcher, implementer, and reviewer moving through both a successful coordination path and a blocked/failure-recovery path. They exercise creation, planning, assignment, delegation, implementation, handoff, review, completion, failed and blocked states, stale provider warnings, disconnected provider/template blockers, dry-run discovery outcomes, disabled adapter consent/option gates, safe local control transitions, collaboration acknowledgement/resolution, broadcast, escalation, operator follow-up decisions, guided source-checkout checklist review, copied Markdown consistency checks, keyboard/start guidance, named evidence links, file-level source-checkout readiness, replacement/new workspace import notes, and source-checkout portability blockers without real provider calls, network calls, shell commands, secrets, storage mutation, or customer data.

`examples/workspace-fixtures/` contains small synthetic source-checkout import examples for fixture review: one portable bundle candidate and one missing-manifest candidate. They are intended for validation tests and documentation review only, not for provider execution or package-registry installation.

## Configuration

No production provider configuration is required yet. The foundation configuration helpers are local-first and secret-safe:

- Provider profiles can be represented locally with encrypted API keys.
- Provider and agent shell-state summaries are deterministic local projections and redact raw API keys, bearer tokens, encrypted key material, and customer-like text before rendering.
- Provider discovery dry-run previews consume only local fixture objects and redact raw API keys, bearer tokens, encrypted key material, API key references, and customer-like text before exposing preview data or UI.
- The disabled provider discovery adapter shell consumes only local fixture objects, stays off unless explicitly enabled with operator consent and injected request options, and redacts raw API keys, bearer tokens, encrypted key material, API key references, and customer-like text from JSON, Markdown, audit, and UI previews.
- The provider discovery adapter contract requires explicit operator consent, bounded timeout/retry behavior, typed failures, response minimization, fixture-backed redaction tests, and local-only secret-safe audit data before any future live adapter can be enabled.
- Prompt templates are local records and store provider/model identifiers, not raw provider/API secrets.
- Execution graph summaries expose node, edge, status, issue, and runnable-node counts without raw API keys or encrypted key material.
- Local run evidence export previews re-sanitize workspace ids, actor/title/note/node text, graph issues, and trail issues before rendering deterministic Markdown.
- Scenario evidence bundle previews reuse run evidence export, collaboration triage, and audit-history summaries while re-sanitizing preview fields and Markdown before copy/export.
- Source-checkout operator walkthrough previews connect existing local-only surfaces into a schema-versioned checklist and re-sanitize step summaries, blockers, next actions, and Markdown before copy.
- Source-checkout onboarding previews make the guided walkthrough the primary review path while keeping provider, template, execution, collaboration, and portability evidence links visible; setup notes stay source-checkout-only and are sanitized before rendering or copy.
- Source-checkout evidence quality-gate previews compare local structured counts with copied Markdown where practical, reject missing Markdown, unsupported schemas, non-source-checkout modes, install-command text, and secret-like content, and re-sanitize issues, next actions, and Markdown before copy.
- Workspace portability manifest previews summarize source-checkout-only provider bindings, model inventories, prompt template validation, scenario identity, graph/trail/evidence availability, collaboration/audit notes, and blockers while omitting raw keys, bearer tokens, encrypted key material, and customer-like text.
- Workspace import/export dry-run reports summarize source-checkout-only export readiness and import candidate validation before mutation, including file-level accepted/rejected/missing entries and a statement that local provider secrets, encrypted key material, saved desktop state, and localStorage records were not changed.
- Workspace fixture review examples are synthetic source-checkout manifests that validate through the import dry-run path and are tested for deterministic output, safe relative paths, and absence of raw API keys, bearer tokens, encrypted key material, and customer-like text.
- Guarded execution-control audit entries sanitize operator reason/note text and never expose raw API keys, encrypted key material, tokens, customer data, or real command text.
- Collaboration inbox mutations, triage filters, compact summaries, and audit-history previews sanitize body, note, reason, recent history, persisted JSON payloads, and Markdown text before rendering or copying, and never expose raw API keys, encrypted key material, tokens, customer data, or provider secrets.
- Secrets must not appear in debug strings, exported cards, logs, or UI snapshots.
- Provider cards expose secret-safe health summaries and capability tag counts derived from local model metadata.
- The browser demo crypto is intentionally demo-only; production storage should replace it with Tauri-backed secure storage before real provider keys are used.

## Development

Useful commands:

```bash
cargo test -p agent-hangar-core
npm run build
npm test
```

The frontend package is marked `private` because no npm package has been published. Do not document `npm install -g`, `npx`, or other registry commands unless a real package release is approved and verified.

## Testing

CI runs the project checks on GitHub Actions. Local checks should include:

```bash
cargo test -p agent-hangar-core
npm run build
npm test
```

When adding new behavior, follow test-driven development: write the failing behavior test first, verify it fails for the expected reason, implement the minimal code, then run the focused and full verification commands.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the growth cadence, Now/Next/Later plan, maintenance triggers, and completion-review rules.

Current focus:

- Keep the guided source-checkout walkthrough as the primary review path while retaining visible provider/template/execution/collaboration/portability evidence.
- Keep deterministic provider discovery dry-run previews and the disabled fixture-backed adapter shell local/demo-only while any future live adapter prototype is held behind the reviewed contract gates.
- Keep template validation reports, workspace portability manifests, scenario evidence bundles, collaboration triage, audit history, compact operator summaries, and execution controls deterministic, provider-free, and secret-safe.
- Keep live discovery readiness review focused on secure storage, cancellation, cache replacement, retry policy, and live-adapter tests before enabling provider calls or preparing packaged desktop releases.

## Contributing

Contributions are welcome once the foundation stabilizes. Please keep changes small, include behavior-focused tests, use English commit messages and code comments, and avoid adding package-registry install claims before releases exist.

## License

Agent Hangar is released under the [MIT License](LICENSE).

## AI-assisted maintenance

This project is written and maintained with AI assistance, with verification through local tests, review, and GitHub Actions.
