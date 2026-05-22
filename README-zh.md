# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar 是一个基于 Rust Tauri + React 的桌面多 AI Agent 管理工具，用于让多个 AI 扮演不同职能，协作完成长时间复杂任务。项目重点是优秀的 harness 设计：provider 抽象、模型列表自动发现、提示词模板治理、Agent 间类型化通信、subagent、持久化状态与清晰管理界面。

## 项目目标

很多 Agent 框架适合作为库使用，但真正执行复杂任务时，还需要一个清晰的控制台来管理 API provider、模型、角色提示词、任务状态、协作消息、失败重试和交接记录。Agent Hangar 的目标就是成为这个控制室。

## 规划能力

- 管理 OpenAI、Anthropic、Gemini 和第三方 OpenAI-compatible provider。
- 自动获取并标准化 provider 的模型列表。
- 创建和版本化不同职能的 Agent 提示词模板。
- 创建长时间任务，由多个 Agent 和 subagent 协作执行。
- 支持 delegation、review、broadcast、escalation 等类型化 Agent 通信。
- 使用像素动画清晰展示 queued、working、failed、completed 等运行状态。

## 当前状态

项目处于基础建设阶段。Rust core harness 已有测试覆盖 provider 标准化、secret-safe provider cards、Agent 模板、状态转换和 Agent 间消息路由。Tauri/React shell 与文档已完成初始脚手架。

## 开发

```bash
cargo test -p agent-hangar-core
```

前端命令已写入 `package.json`；请在可以访问 npm registry 的环境中安装依赖后运行。

## 许可证

MIT
