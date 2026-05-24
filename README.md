# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar is a Rust Tauri + React desktop command center for managing teams of AI agents that collaborate on long-running, complex tasks.

## Problem and motivation

Agent frameworks are useful as libraries, but operators still need a clear desktop surface for the parts that make multi-agent work dependable: provider keys, model lists, role prompts, task state, collaboration messages, failures, retries, handoffs, and audit trails. Agent Hangar aims to be that local control room without forcing every experiment into a cloud dashboard.

## Current status

Agent Hangar is in **active-development** foundation work. The Rust core harness currently has passing tests for provider normalization, secret-safe provider cards, encrypted local provider profile helpers, agent templates, status transitions, and inter-agent message routing. The frontend harness also normalizes provider health summaries, provider/agent shell states, and model capability tags for operator-facing cards, and now includes local-first prompt template, execution graph, deterministic demo execution trail, schema-versioned demo workspace scenarios, local run-evidence export, scenario evidence bundle previews, source-checkout-only workspace portability manifest previews, workspace import/export dry-run reports, guarded local execution-control scaffolding, collaboration inbox normalization, collaboration acknowledgement/resolution persistence, collaboration triage filtering, compact triage summaries, and audit-history preview helpers with role presets, bindings, version history, workspace-aware validation, directed handoff/dependency edges, runnable-node summaries, timeline replay, audit entries, typed collaboration issues, and import/export-ready validation reports. The Tauri/React shell includes local provider profile management, provider and agent shell-state guidance, a template studio foundation, an execution graph preview with a local scenario selector, local trail counts, compact demo workspace summaries for planner/researcher/implementer/reviewer coordination and blocked recovery, guarded execution controls for local pause/resume/cancel/retry state transitions, a filtered collaboration inbox with acknowledge/resolve actions and local persistence fallback, an audit-history preview section scoped by active triage filters, local-only run evidence, scenario evidence bundle, workspace portability manifest, and workspace import/export dry-run preview/copy actions.

The app is not packaged for end users yet. Use the source checkout workflow below for development and evaluation.

## Features

Implemented foundation pieces:

- Rust workspace with an `agent-hangar-core` crate for provider and agent runtime primitives.
- Provider cards that keep secrets out of display/debug output.
- Pure frontend harness helpers for encrypted local provider profiles with injectable crypto for future Tauri secure storage.
- Local provider profile create/edit/delete UI flow with secret-safe key status, write-only replacement key handling, and model discovery health summaries for missing-key, degraded, stale, and empty states.
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
- Pure guarded execution-control helpers for deriving allowed local pause, resume, cancel, and retry actions, applying clone-safe state transitions with an injected clock and actor id, returning typed invalid-action issues, and producing secret-safe audit entries.
- React guarded execution controls for the local demo run/node state, showing allowed actions only and previewing sanitized audit results without executing real providers or external commands.
- Pure collaboration inbox, triage, and audit-history helpers for schema-versioned delegation, review, broadcast, and escalation items; typed validation and mutation issues; unresolved/high-priority sorting; status, priority, type, and sanitized text filters; compact visible/hidden/filter/count summaries; clone-safe acknowledge/resolve transitions; secret-safe body, note, reason, audit detail summaries, persistence payloads, next-action hints, and deterministic Markdown preview data.
- React scenario selector, collaboration inbox, audit-history preview, scenario evidence bundle preview, workspace portability manifest preview, workspace import/export dry-run preview, and compact demo workspace summary sections inside the execution graph panel, with accessible controls and regions, role counts, collaboration mix, unresolved counts, status/priority/type/search controls, acknowledge/resolve buttons, localStorage persistence fallback, recent sanitized history, next-action hints, source-checkout portability blockers, no-mutation dry-run notes, and copyable Markdown.
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
- Frontend tests validate provider profiles, provider/agent shell states, prompt templates, execution graph and trail scaffolding, and React shell behavior once dependencies are installed.

The current local demo scenarios, execution trails, provider and agent shell-state banners, collaboration inbox, audit-history preview, guarded execution controls, run evidence export preview, scenario evidence bundle preview, workspace portability manifest preview, and workspace import/export dry-run preview show a planner, researcher, implementer, and reviewer moving through both a successful coordination path and a blocked/failure-recovery path. They exercise creation, planning, assignment, delegation, implementation, handoff, review, completion, failed and blocked states, stale provider warnings, disconnected provider/template blockers, safe local control transitions, collaboration acknowledgement/resolution, broadcast, escalation, operator follow-up decisions, file-level source-checkout readiness, replacement/new workspace import notes, and source-checkout portability blockers without real provider calls, network calls, shell commands, secrets, storage mutation, or customer data.

## Configuration

No production provider configuration is required yet. The foundation configuration helpers are local-first and secret-safe:

- Provider profiles can be represented locally with encrypted API keys.
- Provider and agent shell-state summaries are deterministic local projections and redact raw API keys, bearer tokens, encrypted key material, and customer-like text before rendering.
- Prompt templates are local records and store provider/model identifiers, not raw provider/API secrets.
- Execution graph summaries expose node, edge, status, issue, and runnable-node counts without raw API keys or encrypted key material.
- Local run evidence export previews re-sanitize workspace ids, actor/title/note/node text, graph issues, and trail issues before rendering deterministic Markdown.
- Scenario evidence bundle previews reuse run evidence export, collaboration triage, and audit-history summaries while re-sanitizing preview fields and Markdown before copy/export.
- Workspace portability manifest previews summarize source-checkout-only provider bindings, model inventories, prompt template validation, scenario identity, graph/trail/evidence availability, collaboration/audit notes, and blockers while omitting raw keys, bearer tokens, encrypted key material, and customer-like text.
- Workspace import/export dry-run reports summarize source-checkout-only export readiness and import candidate validation before mutation, including file-level accepted/rejected/missing entries and a statement that local provider secrets, encrypted key material, saved desktop state, and localStorage records were not changed.
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

See [ROADMAP.md](ROADMAP.md) for the active-development cadence, Now/Next/Later plan, maintenance triggers, and completion-review rules.

Current focus:

- Keep provider profile editing secret-safe while Tauri secure storage and real model discovery adapters are added.
- Keep template validation reports secret-safe as workspace import/export takes shape.
- Keep workspace portability manifests, scenario evidence bundles, collaboration triage, audit history, compact operator summaries, and execution controls deterministic and provider-free.
- Add deterministic provider discovery dry-run adapters and fixture-backed refresh states before any real provider execution is introduced.

## Contributing

Contributions are welcome once the foundation stabilizes. Please keep changes small, include behavior-focused tests, use English commit messages and code comments, and avoid adding package-registry install claims before releases exist.

## License

Agent Hangar is released under the [MIT License](LICENSE).

## AI-assisted maintenance

This project is written and maintained with AI assistance, with verification through local tests, review, and GitHub Actions.
