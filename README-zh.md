# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar 是一个基于 Rust Tauri + React 的桌面控制中心，用于管理协作处理长时间复杂任务的 AI Agent 团队。

## 问题与动机

Agent 框架作为库很有用，但真正运营多 Agent 工作流时，还需要一个清晰的桌面界面来管理 provider 密钥、模型列表、角色提示词、任务状态、协作消息、失败、重试、交接和审计记录。Agent Hangar 希望成为这个本地控制室，而不是把每次实验都强制放进云端仪表盘。

## 当前状态

Agent Hangar 处于 **active-development** 基础建设阶段。Rust core harness 目前已有 provider 标准化、secret-safe provider card、加密本地 provider profile helper、Agent 模板、状态转换和 Agent 间类型化消息路由的通过测试。前端 harness 也会为面向运营者的 provider card 标准化 provider health summary 和模型 capability tag，并且现在包含 local-first prompt template、execution graph、确定性 demo execution trail、带 schema version 的 demo workspace scenario、本地 run evidence export、scenario evidence bundle preview、source-checkout-only workspace portability manifest preview、受保护的本地 execution-control 脚手架、collaboration inbox 标准化、collaboration acknowledge/resolve 本地持久化、collaboration triage 过滤、紧凑 triage summary 和 audit-history preview helper，支持角色 preset、binding、版本历史、workspace-aware 校验、有向 handoff/dependency edge、runnable-node summary、timeline replay、audit entry、类型化 collaboration issue 和面向 import/export 的 validation report。Tauri/React shell 现在包含本地 provider profile 管理、template studio 基础面板、带本地 scenario selector 和 trail count 的 execution graph preview、用于 planner/researcher/implementer/reviewer 协调与 blocked recovery 的紧凑 demo workspace summary、用于本地 pause/resume/cancel/retry 状态转换的 guarded execution controls、带 acknowledge/resolve action 与本地 persistence fallback 的可过滤 collaboration inbox、按 active triage filter 限定的 audit-history preview 区域、本地 run evidence export、scenario evidence bundle 与 workspace portability manifest preview/copy action 和 Agent 状态面板。

应用还没有面向最终用户打包。开发和评估请使用下面的源码 checkout 流程。

## 功能

已实现的基础能力：

- Rust workspace，包含用于 provider 与 Agent runtime 基础类型的 `agent-hangar-core` crate。
- Provider card 在显示和调试输出中隐藏密钥。
- 纯前端 harness helper，用于加密本地 provider profile，并通过可注入 crypto 为后续 Tauri secure storage 留出替换接口。
- 本地 provider profile 创建、编辑、删除 UI flow，包含 secret-safe 的 key 状态、只写式 replacement key 处理，以及 missing-key、degraded、stale、empty 状态的模型发现 health summary。
- 纯 prompt template helper，支持确定性的角色 preset、template 创建/更新/删除、`{{variableName}}` 变量提取、不可变版本历史、provider/model/escalation 校验、workspace tool requirement 检查、escalation policy schema 检查、policy variable binding 检查和带 schema version 的 validation report。
- React template studio 基础面板，用于查看 preset/template、从角色 preset 创建、编辑 prompt record，并在不暴露 provider secret 的情况下显示校验/版本状态、缺失或禁用 tool summary，以及未知 policy variable summary。
- 纯 execution graph helper，支持确定性 workspace graph、Agent role/task node、有向 dependency 与 handoff edge、拓扑和 binding 校验、secret-safe operator summary，以及建议的下一批 runnable node。
- React execution graph preview，用于显示 graph count、issue summary、next runnable node、确定性的本地 execution trail timeline entry，以及本地 run evidence export preview/copy。
- 纯确定性 execution trail helper，支持带 schema version 的本地 event、replay summary、event/status 计数、最新 node status、secret-safe timeline note、未知 node issue，以及仅使用 placeholder 的 demo workspace data。
- 纯确定性 demo workspace scenario helper，用 clone-safe 的方式生成 planner、researcher、implementer、reviewer 协调数据，包含默认 coordination scenario 和 blocked/failure-recovery scenario，并提供带 schema version 的 graph、trail、collaboration 和 audit preview 输入。
- 纯确定性 run evidence export formatter，输出带 schema version 的 Markdown preview data，覆盖 trail summary、graph validation issue、status count、next runnable node 和 timeline evidence。
- 纯确定性 scenario evidence bundle formatter，复用 run evidence export、audit-history preview 和 collaboration triage summary，输出带 schema version 的 Markdown preview data；可校验 malformed 或 unsupported bundle input，保持确定性排序，并清理类似 API key 的值、encrypted key material、bearer token、像 secret 的 note 和客户类文本。
- 纯确定性 workspace portability manifest preview helper，用于 source-checkout-only workspace handoff summary，覆盖 provider binding/inventory 状态、prompt template validation report、选中的 demo scenario identity、execution graph/trail/evidence 可用性、collaboration/audit portability note、blocker validation、带 schema version 的 preview data，以及无需 network、provider、shell、registry 或 Tauri call 的可复制 Markdown。
- 纯 guarded execution-control helper，用于推导本地 pause、resume、cancel、retry 允许动作，通过注入 clock 和 actor id 应用 clone-safe 状态转换，返回类型化 invalid-action issue，并生成 secret-safe audit entry。
- React guarded execution controls，用于本地 demo run/node 状态，只显示允许动作，并在不执行真实 provider 或外部命令的情况下预览清理后的 audit 结果。
- 纯 collaboration inbox、triage 与 audit-history helper，支持带 schema version 的 delegation、review、broadcast、escalation item，类型化 validation 和 mutation issue，未解决和高优先级排序，status、priority、type 和已清理文本搜索过滤，紧凑 visible/hidden/filter/count summary，clone-safe acknowledge/resolve 转换，secret-safe 的 body、note、reason、audit detail summary、persistence payload、next-action hint，以及确定性的 Markdown preview data。
- React execution graph panel 内的 scenario selector、collaboration inbox、audit-history preview、scenario evidence bundle preview、workspace portability manifest preview 和紧凑 demo workspace summary 区域，包含 accessible control 和 region、角色计数、协作类型分布、未解决计数、status/priority/type/search 控件、acknowledge/resolve 按钮、localStorage persistence fallback、已清理的 recent history、next-action hint、source-checkout portability blocker 和可复制 Markdown。
- 用于后续 provider 集成的标准化模型元数据、保守的 capability tag 和 provider health summary。
- Agent 模板、运行状态转换和类型化 Agent 间消息路由。
- React/Tauri shell 脚手架，包含 provider profile 管理、prompt template 管理、provider health/capability summary 和 Agent 状态面板。
- GitHub Actions CI，用于 Rust 与前端验证。

规划能力：

- 管理 OpenAI、Anthropic、Gemini 和第三方 OpenAI-compatible provider。
- 获取并标准化 provider 模型列表。
- 启动由多个 Agent 和 subagent 协作的长时间任务。
- 在 Agent 之间路由 delegation、review、broadcast 和 escalation 消息。
- 用清晰的视觉提示展示 queued、working、blocked、failed 和 completed 状态。

## 安装

Agent Hangar 尚未发布到 npm、Cargo、Homebrew 或任何包注册表。请克隆仓库并从源码运行：

```bash
git clone https://github.com/codecat-ai/agent-hangar.git
cd agent-hangar
```

只开发 Rust core 时，可以直接使用 Cargo：

```bash
cargo test -p agent-hangar-core
```

开发前端/Tauri 时，请在可以访问 npm registry 的环境中安装锁定依赖：

```bash
npm ci
npm run build
npm test
```

## 快速开始

1. 克隆仓库。
2. 运行 `cargo test -p agent-hangar-core` 验证 Rust core。
3. 在 npm registry 可用时，用 `npm ci` 安装锁定的前端依赖。
4. 运行 `npm run build` 和 `npm test` 验证 shell。
5. UI 迭代时使用 `npm run dev` 运行 Vite 前端；开发桌面 shell 时使用 `npm run tauri`。

## 示例

当前基础能力最适合通过测试查看：

- `cargo test -p agent-hangar-core` 覆盖 provider 标准化和 runtime 状态行为。
- 安装依赖后，前端测试会验证 provider profile、prompt template、execution graph 和 trail 脚手架，以及 React shell 行为。

当前本地 demo scenario、execution trail、collaboration inbox、audit-history preview、guarded execution controls、run evidence export preview、scenario evidence bundle preview 和 workspace portability manifest preview 展示 planner、researcher、implementer、reviewer 如何在成功 coordination path 和 blocked/failure-recovery path 中工作。它们在没有真实 provider call、network call、shell command、secret 或客户数据的情况下，覆盖创建、规划、分配、委派、实现、交接、评审、完成、failed 和 blocked 状态、安全的本地控制状态转换、collaboration acknowledge/resolve、broadcast、escalation、运营者后续决策和 source-checkout portability blocker。

## 配置

目前还不需要生产 provider 配置。基础配置 helper 已保持 local-first 和 secret-safe：

- Provider profile 可以在本地表示，并保存加密后的 API key。
- Prompt template 是本地记录，只保存 provider/model 标识符，不保存原始 provider/API secret。
- Execution graph summary 只暴露 node、edge、status、issue 和 runnable-node 计数，不暴露原始 API key 或 encrypted key material。
- 本地 run evidence export preview 在渲染确定性 Markdown 前，会重新清理 workspace id、actor/title/note/node 文本、graph issue 和 trail issue。
- Scenario evidence bundle preview 会复用 run evidence export、collaboration triage 和 audit-history summary，并在复制或导出前重新清理 preview field 与 Markdown。
- Workspace portability manifest preview 会汇总 source-checkout-only provider binding、model inventory、prompt template validation、scenario identity、graph/trail/evidence 可用性、collaboration/audit note 与 blocker，同时省略原始 key、bearer token、encrypted key material 和客户类文本。
- Guarded execution-control audit entry 会清理 operator reason/note 文本，并且不会暴露原始 API key、encrypted key material、token、客户数据或真实命令文本。
- Collaboration inbox mutation、triage filter、紧凑 summary 与 audit-history preview 在渲染、复制或写入持久化 JSON 前会清理 body、note、reason、recent history 和 Markdown 文本，并且不会暴露原始 API key、encrypted key material、token、客户数据或 provider secret。
- 密钥不得出现在 debug 字符串、导出的 card、日志或 UI snapshot 中。
- Provider card 会暴露 secret-safe 的 health summary，以及从本地模型元数据派生的 capability tag 计数。
- 浏览器 demo crypto 有意仅用于 demo；在使用真实 provider key 前，生产存储应替换为 Tauri 支持的 secure storage。

## 开发

常用命令：

```bash
cargo test -p agent-hangar-core
npm run build
npm test
```

前端包标记为 `private`，因为尚未发布 npm package。除非真实 package release 已获批准并验证，否则不要记录 `npm install -g`、`npx` 或其他 registry 命令。

## 测试

CI 会在 GitHub Actions 上运行项目检查。本地检查应包括：

```bash
cargo test -p agent-hangar-core
npm run build
npm test
```

添加新行为时请遵循 TDD：先写失败的行为测试，确认它因预期原因失败，再实现最小代码，然后运行 focused 和 full verification 命令。

## 路线图

详见 [ROADMAP.md](ROADMAP.md)，其中包含 active-development cadence、Now/Next/Later 计划、维护触发条件和完成度评审规则。

当前重点：

- 在添加 Tauri secure storage 和真实模型发现 adapter 时，继续保持 provider profile 编辑的 secret-safe 约束。
- 在 workspace import/export 成型时，继续保持 template validation report 的 secret-safe 约束。
- 保持 workspace portability manifest、scenario evidence bundle、collaboration triage、audit history、紧凑 operator summary 和 execution controls 的确定性与 provider-free 约束。
- 在引入任何真实 provider execution 前，为 provider 和 Agent panel 添加 disconnected/error shell state 与本地 recovery guidance。

## 贡献

基础稳定后欢迎贡献。请保持改动小而清晰，包含行为导向测试，使用英文 commit message 和代码注释，并且不要在真实 release 存在并验证之前添加 package-registry 安装声明。

## 许可证

Agent Hangar 基于 [MIT License](LICENSE) 发布。

## AI 辅助维护

本项目在 AI 辅助下编写和维护，并通过本地测试、review 和 GitHub Actions 验证。
