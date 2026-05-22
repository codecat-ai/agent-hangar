# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar は、長時間で複雑なタスクに協調して取り組む AI Agent チームを管理するための、Rust Tauri + React 製デスクトップ管制センターです。

## 課題と動機

Agent フレームワークはライブラリとして便利ですが、実際にマルチ Agent ワークフローを運用するには、provider キー、モデル一覧、役割プロンプト、タスク状態、協調メッセージ、失敗、リトライ、引き継ぎ、監査ログを扱う明確なデスクトップ画面が必要です。Agent Hangar は、すべての実験をクラウドのダッシュボードに押し込むのではなく、そのローカル管制室になることを目指します。

## 現在の状態

Agent Hangar は **active-development** の基盤開発段階です。Rust core harness では、provider 正規化、secret-safe provider card、暗号化されたローカル provider profile helper、Agent テンプレート、状態遷移、Agent 間の型付きメッセージルーティングのテストが通っています。Tauri/React shell には provider 概要と Agent 状態パネルの足場があります。

まだエンドユーザー向けのパッケージはありません。開発と評価には、以下の source checkout 手順を使ってください。

## 機能

実装済みの基盤：

- provider と Agent runtime の基本型を扱う `agent-hangar-core` crate を含む Rust workspace。
- 表示や debug 出力にシークレットを出さない provider card。
- 将来の Tauri secure storage に差し替えられる injectable crypto を備えた、暗号化ローカル provider profile 用の純粋な frontend harness helper。
- 将来の provider 統合に向けた正規化済みモデルメタデータ。
- Agent テンプレート、runtime 状態遷移、型付き Agent 間メッセージルーティング。
- provider 概要と Agent 状態パネルを持つ React/Tauri shell の足場。
- Rust とフロントエンド検証のための GitHub Actions CI。

予定している機能：

- OpenAI、Anthropic、Gemini、サードパーティの OpenAI-compatible provider を管理する。
- provider からモデル一覧を取得し、共通形式に正規化する。
- 役割ベースのプロンプトテンプレートを作成し、バージョン管理する。
- 複数 Agent と subagent が協調する長時間タスクを開始する。
- delegation、review、broadcast、escalation メッセージを Agent 間でルーティングする。
- queued、working、blocked、failed、completed 状態をわかりやすい視覚表現で示す。

## インストール

Agent Hangar は npm、Cargo、Homebrew、その他の package registry には公開されていません。リポジトリを clone してソースから実行してください。

```bash
git clone https://github.com/codecat-ai/agent-hangar.git
cd agent-hangar
```

Rust core の開発だけなら Cargo を直接使えます。

```bash
cargo test -p agent-hangar-core
```

フロントエンド/Tauri の開発では、npm registry にアクセスできる環境で lockfile に沿って依存関係をインストールします。

```bash
npm ci
npm run build
npm test
```

## クイックスタート

1. リポジトリを clone します。
2. `cargo test -p agent-hangar-core` で Rust core を検証します。
3. npm registry が利用できる環境で、`npm ci` により lockfile に沿ったフロントエンド依存関係をインストールします。
4. `npm run build` と `npm test` で shell を検証します。
5. UI の反復作業では Vite frontend 用に `npm run dev` を使い、デスクトップ shell の作業では `npm run tauri` を使います。

## 例

現在の基盤はテストから確認するのが最も簡単です。

- `cargo test -p agent-hangar-core` は provider 正規化と runtime 状態の振る舞いを確認します。
- 依存関係をインストールすると、フロントエンドテストで React shell の振る舞いを検証できます。

将来の demo workspace では、planner、researcher、implementer、reviewer Agent が型付きの引き継ぎを通じて長時間タスクに協調する様子を示す予定です。

## 設定

現時点では本番用 provider 設定は不要です。基盤設定 helper は local-first かつ secret-safe です。

- Provider profile は、暗号化された API key を持つローカル表現として扱えます。
- シークレットは debug 文字列、エクスポートされた card、ログ、UI snapshot に出してはいけません。
- Provider health check と capability metadata 正規化が次の provider-management 作業です。

## 開発

便利なコマンド：

```bash
cargo test -p agent-hangar-core
npm run build
npm test
```

フロントエンド package は、npm package が公開されていないため `private` です。実際の package release が承認され検証されるまでは、`npm install -g`、`npx`、その他の registry コマンドをドキュメントに追加しないでください。

## テスト

CI は GitHub Actions でプロジェクトのチェックを実行します。ローカルでは次を実行してください。

```bash
cargo test -p agent-hangar-core
npm run build
npm test
```

新しい振る舞いを追加するときは TDD に従います。まず失敗する振る舞いテストを書き、期待した理由で失敗することを確認し、最小限の実装を行ってから focused と full verification コマンドを実行します。

## ロードマップ

active-development cadence、Now/Next/Later 計画、maintenance triggers、completion-review rules は [ROADMAP.md](ROADMAP.md) を参照してください。

現在の重点：

- 再現可能な frontend install flow の上に、初期 provider-management 体験を整える。
- 暗号化されたローカル provider profile をデスクトップの provider-management flow に接続する。
- provider health check と model capability tags を構築する。
- provider 管理が安定した後に Agent template studio を拡張する。

## コントリビューション

基盤が安定した後の貢献を歓迎します。変更は小さく保ち、振る舞い中心のテストを含め、英語の commit message とコードコメントを使ってください。また、実際の release が存在し検証されるまでは package-registry install claim を追加しないでください。

## ライセンス

Agent Hangar は [MIT License](LICENSE) で公開されています。

## AI 支援メンテナンス

このプロジェクトは AI 支援で作成・保守され、ローカルテスト、review、GitHub Actions によって検証されています。
