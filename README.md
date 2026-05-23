# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar is a Rust Tauri + React desktop command center for managing teams of AI agents that collaborate on long-running, complex tasks.

## Problem and motivation

Agent frameworks are useful as libraries, but operators still need a clear desktop surface for the parts that make multi-agent work dependable: provider keys, model lists, role prompts, task state, collaboration messages, failures, retries, handoffs, and audit trails. Agent Hangar aims to be that local control room without forcing every experiment into a cloud dashboard.

## Current status

Agent Hangar is in **active-development** foundation work. The Rust core harness currently has passing tests for provider normalization, secret-safe provider cards, encrypted local provider profile helpers, agent templates, status transitions, and inter-agent message routing. The frontend harness also normalizes provider health summaries and model capability tags for operator-facing provider cards, and now includes local-first prompt template, execution graph, deterministic demo execution trail, local run-evidence export, guarded local execution-control scaffolding, collaboration inbox normalization, collaboration acknowledgement/resolution persistence, and audit-history preview helpers with role presets, bindings, version history, workspace-aware validation, directed handoff/dependency edges, runnable-node summaries, timeline replay, audit entries, typed collaboration issues, and import/export-ready validation reports. The Tauri/React shell includes local provider profile management, a template studio foundation, an execution graph preview with local trail counts, a guarded execution controls section for local pause/resume/cancel/retry state transitions, a collaboration inbox with acknowledge/resolve actions and local persistence fallback, an audit-history preview section, a local-only run evidence export preview/copy action, and agent state panels.

The app is not packaged for end users yet. Use the source checkout workflow below for development and evaluation.

## Features

Implemented foundation pieces:

- Rust workspace with an `agent-hangar-core` crate for provider and agent runtime primitives.
- Provider cards that keep secrets out of display/debug output.
- Pure frontend harness helpers for encrypted local provider profiles with injectable crypto for future Tauri secure storage.
- Local provider profile create/edit/delete UI flow with secret-safe key status, write-only replacement key handling, and model discovery health summaries for missing-key, degraded, stale, and empty states.
- Pure prompt template helpers for deterministic role presets, template create/update/delete behavior, `{{variableName}}` extraction, immutable version history, provider/model/escalation validation, workspace tool requirement checks, escalation policy schema checks, policy variable binding checks, and schema-versioned validation reports.
- React template studio foundation for viewing presets/templates, creating from role presets, editing prompt records, and showing validation/version status plus missing/disabled tool and unknown policy-variable summaries without exposing provider secrets.
- Pure execution graph helpers for deterministic workspace graphs, agent role/task nodes, directed dependency and handoff edges, topology/binding validation, secret-safe operator summaries, and suggested next runnable node lists.
- React execution graph preview for graph counts, issue summaries, next runnable nodes, deterministic local execution trail timeline entries, and local-only run evidence export preview/copy.
- Pure deterministic execution trail helpers with schema-versioned local events, replay summaries, event/status counts, latest node statuses, secret-safe timeline notes, unknown-node issues, and placeholder-only demo workspace data.
- Pure deterministic run evidence export formatter with schema-versioned Markdown preview data for trail summaries, graph validation issues, status counts, next runnable nodes, and timeline evidence.
- Pure guarded execution-control helpers for deriving allowed local pause, resume, cancel, and retry actions, applying clone-safe state transitions with an injected clock and actor id, returning typed invalid-action issues, and producing secret-safe audit entries.
- React guarded execution controls for the local demo run/node state, showing allowed actions only and previewing sanitized audit results without executing real providers or external commands.
- Pure collaboration inbox and audit-history helpers for schema-versioned delegation, review, broadcast, and escalation items; typed validation and mutation issues; unresolved/high-priority sorting; clone-safe acknowledge/resolve transitions; secret-safe body, note, reason, and audit detail summaries; persistence payloads; next-action hints; and deterministic Markdown preview data.
- React collaboration inbox and audit-history preview sections inside the execution graph panel, with accessible regions, unresolved counts, acknowledge/resolve buttons, localStorage persistence fallback, recent sanitized history, next-action hints, and copyable Markdown.
- Normalized model metadata, conservative capability tags, and provider health summaries for future provider integrations.
- Agent templates, runtime status transitions, and typed inter-agent message routing.
- React/Tauri shell scaffold for provider profile management, prompt template management, provider health/capability summaries, and agent state panels.
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
- Frontend tests validate provider profiles, prompt templates, execution graph and trail scaffolding, and React shell behavior once dependencies are installed.

The current demo graph, local execution trail, collaboration inbox, audit-history preview, guarded execution controls, and run evidence export preview show a planner, researcher, and reviewer moving a task through creation, planning, assignment, handoff, review, completion, safe local control transitions, collaboration acknowledgement/resolution, and operator follow-up decisions without real provider calls, network calls, shell commands, secrets, or customer data.

## Configuration

No production provider configuration is required yet. The foundation configuration helpers are local-first and secret-safe:

- Provider profiles can be represented locally with encrypted API keys.
- Prompt templates are local records and store provider/model identifiers, not raw provider/API secrets.
- Execution graph summaries expose node, edge, status, issue, and runnable-node counts without raw API keys or encrypted key material.
- Local run evidence export previews re-sanitize workspace ids, actor/title/note/node text, graph issues, and trail issues before rendering deterministic Markdown.
- Guarded execution-control audit entries sanitize operator reason/note text and never expose raw API keys, encrypted key material, tokens, customer data, or real command text.
- Collaboration inbox mutations and audit-history previews sanitize body, note, reason, recent history, persisted JSON payloads, and Markdown text before rendering or copying, and never expose raw API keys, encrypted key material, tokens, customer data, or provider secrets.
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
- Harden the implemented local demo coordination views around delegation, review, broadcast, escalation, acknowledgement/resolution, persistence fallback, and audit history while keeping execution controls deterministic and provider-free.

## Contributing

Contributions are welcome once the foundation stabilizes. Please keep changes small, include behavior-focused tests, use English commit messages and code comments, and avoid adding package-registry install claims before releases exist.

## License

Agent Hangar is released under the [MIT License](LICENSE).

## AI-assisted maintenance

This project is written and maintained with AI assistance, with verification through local tests, review, and GitHub Actions.
