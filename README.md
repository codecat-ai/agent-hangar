# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar is a Rust Tauri + React desktop command center for managing teams of AI agents that collaborate on long-running, complex tasks.

## Problem and motivation

Agent frameworks are useful as libraries, but operators still need a clear desktop surface for the parts that make multi-agent work dependable: provider keys, model lists, role prompts, task state, collaboration messages, failures, retries, handoffs, and audit trails. Agent Hangar aims to be that local control room without forcing every experiment into a cloud dashboard.

## Current status

Agent Hangar is in **active-development** foundation work. The Rust core harness currently has passing tests for provider normalization, secret-safe provider cards, encrypted local provider profile helpers, agent templates, status transitions, and inter-agent message routing. The Tauri/React shell is scaffolded with provider and agent state panels.

The app is not packaged for end users yet. Use the source checkout workflow below for development and evaluation.

## Features

Implemented foundation pieces:

- Rust workspace with an `agent-hangar-core` crate for provider and agent runtime primitives.
- Provider cards that keep secrets out of display/debug output.
- Pure frontend harness helpers for encrypted local provider profiles with injectable crypto for future Tauri secure storage.
- Normalized model metadata for future provider integrations.
- Agent templates, runtime status transitions, and typed inter-agent message routing.
- React/Tauri shell scaffold for provider overview and agent state panels.
- GitHub Actions CI for Rust and frontend verification.

Planned capabilities:

- Manage OpenAI, Anthropic, Gemini, and third-party OpenAI-compatible providers.
- Fetch and normalize provider model lists.
- Create and version role-based prompt templates.
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
- Frontend tests validate the React shell behavior once dependencies are installed.

A future demo workspace will show a planner, researcher, implementer, and reviewer agent cooperating on a long-running task with typed handoffs.

## Configuration

No production provider configuration is required yet. The foundation configuration helpers are local-first and secret-safe:

- Provider profiles can be represented locally with encrypted API keys.
- Secrets must not appear in debug strings, exported cards, logs, or UI snapshots.
- Provider health checks and capability metadata normalization are the next provider-management work.

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

- Complete early provider-management ergonomics on top of the reproducible frontend install flow.
- Wire encrypted local provider profiles into the desktop provider-management flow.
- Build provider health checks and model capability tags.
- Grow the agent template studio after provider management is dependable.

## Contributing

Contributions are welcome once the foundation stabilizes. Please keep changes small, include behavior-focused tests, use English commit messages and code comments, and avoid adding package-registry install claims before releases exist.

## License

Agent Hangar is released under the [MIT License](LICENSE).

## AI-assisted maintenance

This project is written and maintained with AI assistance, with verification through local tests, review, and GitHub Actions.
