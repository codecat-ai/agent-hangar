# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar は、Rust Tauri + React で構築するデスクトップ型のマルチ AI Agent 管理ツールです。複数の AI が異なる職能を担当し、長時間の複雑なタスクを協調して進めるためのコントロールセンターを目指します。重視するのは、provider 抽象、モデル自動検出、プロンプトテンプレート管理、型付き Agent 間通信、subagent、永続状態、明確な運用 UI です。

## 目的

多くの Agent フレームワークはライブラリとして優れていますが、実運用では API provider、モデル、役割プロンプト、タスク状態、協調メッセージ、失敗、引き継ぎを管理する明確な画面が必要です。Agent Hangar はその管制室になります。

## 予定機能

- OpenAI、Anthropic、Gemini、サードパーティの OpenAI-compatible provider を管理。
- provider からモデル一覧を自動取得し、共通形式へ正規化。
- 役割別 Agent プロンプトテンプレートの作成とバージョン管理。
- 複数 Agent と subagent による長時間タスク実行。
- delegation、review、broadcast、escalation などの型付き Agent 間通信。
- queued、working、failed、completed などの状態をピクセルアニメーションで表示。

## 現在の状態

基盤開発フェーズです。Rust core harness では provider 正規化、secret-safe provider cards、Agent テンプレート、状態遷移、Agent 間メッセージルーティングのテストが通っています。Tauri/React shell とドキュメントも初期化済みです。

## 開発

```bash
cargo test -p agent-hangar-core
```

フロントエンド用コマンドは `package.json` に定義済みです。npm registry にアクセスできる環境で依存関係をインストールしてから実行してください。

## ライセンス

MIT
