# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar is a Rust Tauri + React desktop command center for managing teams of AI agents that collaborate on long-running, complex tasks. It focuses on strong harness design: provider abstraction, model discovery, prompt-template governance, typed agent communication, subagents, durable state, and clear operational UI.

## Why this exists

Most agent frameworks are excellent libraries, but operators still need a clear desktop surface to manage provider keys, model lists, role prompts, task state, collaboration messages, failures, and handoffs. Agent Hangar aims to be that control room.

## Planned capabilities

- Manage OpenAI, Anthropic, Gemini, and third-party OpenAI-compatible providers.
- Automatically fetch and normalize provider model lists.
- Create and version role-based agent prompt templates.
- Launch long-running tasks with multiple cooperating agents and subagents.
- Route typed inter-agent messages for delegation, review, broadcast, and escalation.
- Show agent states with clear pixel animations for queued, working, failed, and completed runs.

## Current status

This repository is in foundation development. The Rust core harness has passing tests for provider normalization, secret-safe provider cards, agent templates, status transitions, and inter-agent message routing. The Tauri/React shell and documentation are scaffolded.

## Development

```bash
cargo test -p agent-hangar-core
```

Frontend commands are defined in `package.json`; run them after installing npm dependencies in an environment with registry access.

## License

MIT
