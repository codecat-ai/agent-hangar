# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar 是一个基于 Rust Tauri + React 的桌面控制中心，用于管理协作处理长时间复杂任务的 AI Agent 团队。

## 问题与动机

Agent 框架作为库很有用，但真正运营多 Agent 工作流时，还需要一个清晰的桌面界面来管理 provider 密钥、模型列表、角色提示词、任务状态、协作消息、失败、重试、交接和审计记录。Agent Hangar 希望成为这个本地控制室，而不是把每次实验都强制放进云端仪表盘。

## 当前状态

Agent Hangar 处于 **growth** 硬化阶段，已完成 2026-05-25 基础阶段 completion review。Rust core harness 目前已有 provider 标准化、secret-safe provider card、加密本地 provider profile helper、Agent 模板、状态转换和 Agent 间类型化消息路由的通过测试。前端 harness 也会为面向运营者的 provider card 标准化 provider health summary、provider/Agent shell state、模型 capability tag、确定性的 provider discovery dry-run preview，以及默认禁用的 fixture-backed provider discovery adapter shell，并且现在包含 local-first prompt template、execution graph、确定性 demo execution trail、带 schema version 的 demo workspace scenario、本地 run evidence export、scenario evidence bundle preview、source-checkout-only workspace portability manifest preview、workspace import/export dry-run report、guided source-checkout operator walkthrough、source-checkout fixture review 覆盖、受保护的本地 execution-control 脚手架、collaboration inbox 标准化、collaboration acknowledge/resolve 本地持久化、collaboration triage 过滤、紧凑 triage summary 和 audit-history preview helper，支持角色 preset、binding、版本历史、workspace-aware 校验、有向 handoff/dependency edge、runnable-node summary、timeline replay、audit entry、类型化 collaboration issue 和面向 import/export 的 validation report。Tauri/React shell 现在包含本地 provider profile 管理、provider discovery dry-run 与禁用 adapter-shell preview summary、provider 与 Agent shell-state guidance、template studio 基础面板、带本地 scenario selector 和 trail count 的 execution graph preview、用于 planner/researcher/implementer/reviewer 协调与 blocked recovery 的紧凑 demo workspace summary、用于本地 pause/resume/cancel/retry 状态转换的 guarded execution controls、带 acknowledge/resolve action 与本地 persistence fallback 的可过滤 collaboration inbox、按 active triage filter 限定的 audit-history preview 区域、本地 run evidence export、scenario evidence bundle、source-checkout operator walkthrough、workspace portability manifest 与 workspace import/export dry-run preview/copy action。下一阶段应先强化 accessibility 与 onboarding，再考虑 live provider discovery 或打包工作。

应用还没有面向最终用户打包。开发和评估请使用下面的源码 checkout 流程。

## 功能

已实现的基础能力：

- Rust workspace，包含用于 provider 与 Agent runtime 基础类型的 `agent-hangar-core` crate。
- Provider card 在显示和调试输出中隐藏密钥。
- 纯前端 harness helper，用于加密本地 provider profile，并通过可注入 crypto 为后续 Tauri secure storage 留出替换接口。
- 本地 provider profile 创建、编辑、删除 UI flow，包含 secret-safe 的 key 状态、只写式 replacement key 处理，以及 missing-key、degraded、stale、empty 状态的模型发现 health summary。
- 纯确定性 provider discovery dry-run helper，使用本地 provider profile 和 fixture response 生成带 schema version 的 missing-key、ready、empty inventory、degraded/permission、stale inventory 和 malformed fixture preview，且不调用 provider、network、shell 或 registry。
- React provider discovery dry-run preview，包含 accessible summary、status/severity guidance、model count、capability tag、类型化 fixture issue 和聚合计数，并且不显示原始 API key、bearer token、encrypted key material 或客户类文本。
- `docs/provider-discovery-contract.md` 中已评审 provider discovery adapter contract，定义默认禁用的 live-adapter 边界，以及在启用真实 provider discovery 前必须满足的 consent、timeout/retry、typed failure、audit、fixture 和 redaction gate。
- 默认禁用的 fixture-backed provider discovery adapter shell，提供类型化 blocked、consent、degraded/permission、malformed、stale 和 ready 结果；只使用注入的 request timestamp/options；生成 clone-safe JSON/Markdown preview、本地 audit metadata 和 next-action guidance；且不调用 provider、network、shell、registry 或 Tauri。
- React provider discovery adapter-shell preview 在本地 demo 中保持只读和禁用状态，渲染类型化 blocked guidance，并且不显示原始 API key、bearer token、encrypted key material、API key reference 或客户类文本。
- 纯 provider 和 Agent shell-state helper，用确定性方式生成 empty、disconnected、stale、degraded/error、queued、working、completed、blocked 和 failed summary，并提供本地恢复 guidance 与 secret-safe redaction。
- 纯 prompt template helper，支持确定性的角色 preset、template 创建/更新/删除、`{{variableName}}` 变量提取、不可变版本历史、provider/model/escalation 校验、workspace tool requirement 检查、escalation policy schema 检查、policy variable binding 检查和带 schema version 的 validation report。
- React template studio 基础面板，用于查看 preset/template、从角色 preset 创建、编辑 prompt record，并在不暴露 provider secret 的情况下显示校验/版本状态、缺失或禁用 tool summary，以及未知 policy variable summary。
- 纯 execution graph helper，支持确定性 workspace graph、Agent role/task node、有向 dependency 与 handoff edge、拓扑和 binding 校验、secret-safe operator summary，以及建议的下一批 runnable node。
- React execution graph preview，用于显示 graph count、issue summary、next runnable node、确定性的本地 execution trail timeline entry，以及本地 run evidence export preview/copy。
- 纯确定性 execution trail helper，支持带 schema version 的本地 event、replay summary、event/status 计数、最新 node status、secret-safe timeline note、未知 node issue，以及仅使用 placeholder 的 demo workspace data。
- 纯确定性 demo workspace scenario helper，用 clone-safe 的方式生成 planner、researcher、implementer、reviewer 协调数据，包含默认 coordination scenario 和 blocked/failure-recovery scenario，并提供带 schema version 的 graph、trail、collaboration 和 audit preview 输入。
- 纯确定性 run evidence export formatter，输出带 schema version 的 Markdown preview data，覆盖 trail summary、graph validation issue、status count、next runnable node 和 timeline evidence。
- 纯确定性 scenario evidence bundle formatter，复用 run evidence export、audit-history preview 和 collaboration triage summary，输出带 schema version 的 Markdown preview data；可校验 malformed 或 unsupported bundle input，保持确定性排序，并清理类似 API key 的值、encrypted key material、bearer token、像 secret 的 note 和客户类文本。
- 纯确定性 workspace portability manifest preview helper，用于 source-checkout-only workspace handoff summary，覆盖 provider binding/inventory 状态、prompt template validation report、选中的 demo scenario identity、execution graph/trail/evidence 可用性、collaboration/audit portability note、blocker validation、带 schema version 的 preview data，以及无需 network、provider、shell、registry 或 Tauri call 的可复制 Markdown。
- 纯确定性的 source-checkout-only workspace import/export dry-run helper，使用 manifest preview data 生成 export readiness，先校验候选 import bundle 形状再发生任何 mutation，报告文件级 accepted/rejected/missing entry、replacement/new workspace note、继承的 blocker，以及明确的 no-mutation statement，且不调用 provider、shell、network、registry 或 Tauri API。
- 纯确定性的 guided source-checkout operator walkthrough helper，把 provider profile、discovery dry-run summary、禁用 adapter-shell gate、template validation、选中的 demo scenario、execution evidence、collaboration triage/audit、workspace portability 和 import/export dry run 连接成带 schema version 的 checklist data 与 Markdown，包含 step id、label、status、severity、blocker、next action、clone-safe output 和 secret redaction。
- `examples/workspace-fixtures/` 下提供已检入的合成 workspace import/export fixture manifest，并配套纯 fixture review helper；这些示例会通过现有 import dry-run path 校验，并验证确定性、source-checkout-only、secret-safe，且不包含 provider 或 registry 执行假设。
- 纯 guarded execution-control helper，用于推导本地 pause、resume、cancel、retry 允许动作，通过注入 clock 和 actor id 应用 clone-safe 状态转换，返回类型化 invalid-action issue，并生成 secret-safe audit entry。
- React guarded execution controls，用于本地 demo run/node 状态，只显示允许动作，并在不执行真实 provider 或外部命令的情况下预览清理后的 audit 结果。
- 纯 collaboration inbox、triage 与 audit-history helper，支持带 schema version 的 delegation、review、broadcast、escalation item，类型化 validation 和 mutation issue，未解决和高优先级排序，status、priority、type 和已清理文本搜索过滤，紧凑 visible/hidden/filter/count summary，clone-safe acknowledge/resolve 转换，secret-safe 的 body、note、reason、audit detail summary、persistence payload、next-action hint，以及确定性的 Markdown preview data。
- React execution graph panel 内的 scenario selector、collaboration inbox、audit-history preview、scenario evidence bundle preview、source-checkout operator walkthrough、workspace portability manifest preview、workspace import/export dry-run preview 和紧凑 demo workspace summary 区域，包含 accessible control 和 region、角色计数、协作类型分布、未解决计数、status/priority/type/search 控件、acknowledge/resolve 按钮、localStorage persistence fallback、已清理的 recent history、next-action hint、source-checkout portability blocker、no-mutation dry-run note 和可复制 Markdown。
- 用于后续 provider 集成的标准化模型元数据、保守的 capability tag 和 provider health summary。
- Agent 模板、运行状态转换和类型化 Agent 间消息路由。
- React/Tauri shell 脚手架，包含 provider profile 管理、prompt template 管理、provider health/capability summary、accessible provider shell banner 和 Agent runway 状态面板。
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
- 安装依赖后，前端测试会验证 provider profile、provider discovery dry-run 与禁用 adapter-shell preview、provider/Agent shell state、prompt template、execution graph 和 trail 脚手架，以及 React shell 行为。

当前本地 demo scenario、execution trail、provider discovery dry-run preview、禁用 provider discovery adapter-shell preview、provider 与 Agent shell-state banner、collaboration inbox、audit-history preview、guarded execution controls、run evidence export preview、scenario evidence bundle preview、source-checkout operator walkthrough、workspace portability manifest preview 和 workspace import/export dry-run preview 展示 planner、researcher、implementer、reviewer 如何在成功 coordination path 和 blocked/failure-recovery path 中工作。它们在没有真实 provider call、network call、shell command、secret、storage mutation 或客户数据的情况下，覆盖创建、规划、分配、委派、实现、交接、评审、完成、failed 和 blocked 状态、stale provider warning、disconnected provider/template blocker、dry-run discovery outcome、禁用 adapter consent/option gate、安全的本地控制状态转换、collaboration acknowledge/resolve、broadcast、escalation、运营者后续决策、guided source-checkout checklist review、文件级 source-checkout readiness、replacement/new workspace import note 和 source-checkout portability blocker。

`examples/workspace-fixtures/` 包含小型合成 source-checkout import 示例：一个可通过的 bundle candidate，以及一个缺失 manifest 的 candidate。它们只用于 validation test 和文档 review，不用于 provider 执行或 package-registry 安装。

## 配置

目前还不需要生产 provider 配置。基础配置 helper 已保持 local-first 和 secret-safe：

- Provider profile 可以在本地表示，并保存加密后的 API key。
- Provider 与 Agent shell-state summary 是确定性的本地投影，并在渲染前清理原始 API key、bearer token、encrypted key material 和客户类文本。
- Provider discovery dry-run preview 只读取本地 fixture object，并在暴露 preview data 或 UI 前清理原始 API key、bearer token、encrypted key material、API key reference 和客户类文本。
- 禁用的 provider discovery adapter shell 只读取本地 fixture object，除非显式启用并提供 operator consent 与注入的 request options，否则保持关闭；它会在 JSON、Markdown、audit 和 UI preview 中清理原始 API key、bearer token、encrypted key material、API key reference 和客户类文本。
- Provider discovery adapter contract 要求在未来任何 live adapter 启用前，先具备显式 operator consent、受限 timeout/retry、typed failure、response minimization、fixture-backed redaction test，以及 local-only、secret-safe audit data。
- Prompt template 是本地记录，只保存 provider/model 标识符，不保存原始 provider/API secret。
- Execution graph summary 只暴露 node、edge、status、issue 和 runnable-node 计数，不暴露原始 API key 或 encrypted key material。
- 本地 run evidence export preview 在渲染确定性 Markdown 前，会重新清理 workspace id、actor/title/note/node 文本、graph issue 和 trail issue。
- Scenario evidence bundle preview 会复用 run evidence export、collaboration triage 和 audit-history summary，并在复制或导出前重新清理 preview field 与 Markdown。
- Source-checkout operator walkthrough preview 会把现有 local-only 界面连接成带 schema version 的 checklist，并在复制前重新清理 step summary、blocker、next action 和 Markdown。
- Workspace portability manifest preview 会汇总 source-checkout-only provider binding、model inventory、prompt template validation、scenario identity、graph/trail/evidence 可用性、collaboration/audit note 与 blocker，同时省略原始 key、bearer token、encrypted key material 和客户类文本。
- Workspace import/export dry-run report 会在 mutation 前汇总 source-checkout-only export readiness 与 import candidate validation，包含文件级 accepted/rejected/missing entry，并声明本地 provider secret、encrypted key material、saved desktop state 和 localStorage record 没有被修改。
- Workspace fixture review 示例是合成的 source-checkout manifest，会通过 import dry-run path 校验，并通过测试确认输出确定、路径保持安全相对路径，且不包含原始 API key、bearer token、encrypted key material 或客户类文本。
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

请参阅 [ROADMAP.md](ROADMAP.md)，了解 growth cadence、Now/Next/Later 计划、maintenance triggers 和 completion-review rules。

当前重点：

- 围绕 guided source-checkout operator walkthrough 以及相邻 provider/template/execution 面板，强化 accessibility、keyboard flow、named region 和 onboarding note。
- 在任何未来 live adapter prototype 满足已 review 的 contract gate 前，保持确定性 provider discovery dry-run preview 与禁用的 fixture-backed adapter shell 为 local/demo-only。
- 保持 template validation report、workspace portability manifest、scenario evidence bundle、collaboration triage、audit history、compact operator summary 和 execution control 确定性、provider-free 且 secret-safe。
- 在提高 cadence 或准备桌面打包 release 前，先改进 accessibility 与 onboarding。

## 贡献

基础稳定后欢迎贡献。请保持改动小而清晰，包含行为导向测试，使用英文 commit message 和代码注释，并且不要在真实 release 存在并验证之前添加 package-registry 安装声明。

## 许可证

Agent Hangar 基于 [MIT License](LICENSE) 发布。

## AI 辅助维护

本项目在 AI 辅助下编写和维护，并通过本地测试、review 和 GitHub Actions 验证。
