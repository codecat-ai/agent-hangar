# Agent Hangar

[English](README.md) | [中文](README-zh.md) | [日本語](README-ja.md)

Agent Hangar は、長時間で複雑なタスクに協調して取り組む AI Agent チームを管理するための、Rust Tauri + React 製デスクトップ管制センターです。

## 課題と動機

Agent フレームワークはライブラリとして便利ですが、実際にマルチ Agent ワークフローを運用するには、provider キー、モデル一覧、役割プロンプト、タスク状態、協調メッセージ、失敗、リトライ、引き継ぎ、監査ログを扱う明確なデスクトップ画面が必要です。Agent Hangar は、すべての実験をクラウドのダッシュボードに押し込むのではなく、そのローカル管制室になることを目指します。

## 現在の状態

Agent Hangar は **growth** のハードニング段階で、2026-05-25 の基盤 completion review を終えています。Rust core harness では、provider 正規化、secret-safe provider card、暗号化されたローカル provider profile helper、Agent テンプレート、状態遷移、Agent 間の型付きメッセージルーティングのテストが通っています。frontend harness では、運用者向け provider card のために provider health summary、provider/Agent shell state、model capability tag、確定的な provider discovery dry-run preview、既定で無効な fixture-backed provider discovery adapter shell も正規化し、role preset、binding、version history、workspace-aware validation、有向 handoff/dependency edge、runnable-node summary、timeline replay、audit entry、型付き collaboration issue、import/export 向け validation report を備えた local-first prompt template、execution graph、確定的な demo execution trail、schema version 付き demo workspace scenario、ローカル run evidence export、scenario evidence bundle preview、source-checkout-only workspace portability manifest preview、workspace import/export dry-run report、guided source-checkout operator walkthrough、source-checkout onboarding/accessibility guidance、source-checkout fixture review coverage、保護されたローカル execution-control、collaboration inbox 正規化、collaboration acknowledge/resolve のローカル永続化、collaboration triage filter、compact triage summary、audit-history preview helper も含みます。Tauri/React shell には、ローカル provider profile 管理、provider discovery dry-run と無効 adapter-shell の preview summary、provider と Agent の shell-state guidance、template studio の基盤パネル、ローカル scenario selector と trail count 付きの execution graph preview、planner/researcher/implementer/reviewer 協調と blocked recovery の compact demo workspace summary、ローカルの pause/resume/cancel/retry 状態遷移を扱う guarded execution controls、acknowledge/resolve action と persistence fallback を備えた filter 可能な collaboration inbox、active triage filter に沿った audit-history preview の領域、ローカル run evidence export、scenario evidence bundle、主要な source-checkout onboarding 領域、source-checkout operator walkthrough、workspace portability manifest、workspace import/export dry-run の preview/copy action があります。次の段階では、live provider discovery や packaging の前に、review gate をローカルかつ明示的に保ちます。

まだエンドユーザー向けのパッケージはありません。開発と評価には、以下の source checkout 手順を使ってください。

## 機能

実装済みの基盤：

- provider と Agent runtime の基本型を扱う `agent-hangar-core` crate を含む Rust workspace。
- 表示や debug 出力にシークレットを出さない provider card。
- 将来の Tauri secure storage に差し替えられる injectable crypto を備えた、暗号化ローカル provider profile 用の純粋な frontend harness helper。
- ローカル provider profile の作成、編集、削除 UI flow。secret-safe な key status、書き込み専用の replacement key 処理、missing-key、degraded、stale、empty 状態の model discovery health summary を備えます。
- ローカル provider profile と fixture response を消費し、provider、network、shell、registry call なしで schema version 付きの missing-key、ready、empty inventory、degraded/permission、stale inventory、malformed fixture preview を生成する、純粋で確定的な provider discovery dry-run helper。
- accessible な summary、status/severity guidance、model count、capability tag、型付き fixture issue、集計 count を表示し、生の API key、bearer token、encrypted key material、顧客らしい text を表示しない React provider discovery dry-run preview。
- `docs/provider-discovery-contract.md` で provider discovery adapter contract を review 済みです。実際の provider discovery を有効にする前に満たすべき、既定で無効な live-adapter boundary、consent、timeout/retry、typed failure、audit、fixture、redaction gate を定義しています。
- 既定で無効な fixture-backed provider discovery adapter shell。型付き blocked、consent、degraded/permission、malformed、stale、ready result、注入された request timestamp/options のみ、clone-safe な JSON/Markdown preview、ローカル audit metadata、next-action guidance を備え、provider、network、shell、registry、Tauri call は行いません。
- React provider discovery adapter-shell preview はローカル demo で read-only かつ disabled のまま、型付き blocked guidance を表示し、生の API key、bearer token、encrypted key material、API key reference、顧客らしい text を表示しません。
- empty、disconnected、stale、degraded/error、queued、working、completed、blocked、failed の summary、ローカル recovery guidance、secret-safe redaction を確定的に返す、純粋な provider/Agent shell-state helper。
- 確定的な role preset、template の作成/更新/削除、`{{variableName}}` の変数抽出、不変の version history、provider/model/escalation validation、workspace tool requirement check、escalation policy schema check、policy variable binding check、schema version 付き validation report を扱う純粋な prompt template helper。
- preset/template の閲覧、role preset からの作成、prompt record の編集、provider secret を出さない validation/version status、欠落または無効な tool summary、不明な policy variable summary の表示を行う React template studio 基盤。
- 確定的な workspace graph、Agent role/task node、有向 dependency と handoff edge、topology/binding validation、secret-safe operator summary、次に runnable な node の候補を扱う純粋な execution graph helper。
- graph count、issue summary、next runnable node、確定的なローカル execution trail timeline entry、ローカル run evidence export preview/copy を表示する React execution graph preview。
- schema version 付き local event、replay summary、event/status count、最新 node status、secret-safe な timeline note、未知 node issue、placeholder のみを使う demo workspace data を扱う、純粋で確定的な execution trail helper。
- planner、researcher、implementer、reviewer の協調を clone-safe に表す、既定の coordination scenario と blocked/failure-recovery scenario、schema version 付き graph、trail、collaboration、audit preview 入力を生成する純粋で確定的な demo workspace scenario helper。
- trail summary、graph validation issue、status count、next runnable node、timeline evidence を含む schema version 付き Markdown preview data を出力する、純粋で確定的な run evidence export formatter。
- run evidence export、audit-history preview、collaboration triage summary を再利用して schema version 付き Markdown preview data を出力し、malformed または unsupported bundle input を検証し、確定的な順序を保ち、API key らしい値、encrypted key material、bearer token、secret らしい note、顧客らしい text を redaction する、純粋で確定的な scenario evidence bundle formatter。
- source-checkout-only workspace handoff summary のための、純粋で確定的な workspace portability manifest preview helper。provider binding/inventory status、prompt template validation report、選択された demo scenario identity、execution graph/trail/evidence availability、collaboration/audit portability note、blocker validation、schema version 付き preview data、network、provider、shell、registry、Tauri call を行わない copy/export 向け Markdown を扱います。
- source-checkout-only workspace import/export dry-run のための、純粋で確定的な helper。manifest preview data から export readiness を作り、import candidate bundle の形を mutation 前に検証し、file-level accepted/rejected/missing entry、replacement/new workspace note、継承した blocker、明確な no-mutation statement を、provider、shell、network、registry、Tauri API call なしで出力します。
- provider profile、discovery dry-run summary、無効 adapter-shell gate、template validation、選択された demo scenario、execution evidence、collaboration triage/audit、workspace portability、import/export dry run を、schema version 付き checklist data と Markdown に接続する、純粋で確定的な guided source-checkout operator walkthrough helper。step id、label、status、severity、blocker、next action、clone-safe output、secret redaction を含みます。
- schema version 付きの keyboard order、named-region expectation、status-region expectation、setup note、primary walkthrough guidance、blocker/next-action summary、secret-safe Markdown を返す、純粋で確定的な source-checkout onboarding/accessibility helper。provider、network、shell、registry、Tauri call は行いません。
- `examples/workspace-fixtures/` にチェックインされた合成 workspace import/export fixture manifest と、純粋な fixture review helper。既存の import dry-run path で検証し、確定的、source-checkout-only、secret-safe で、provider や registry execution の前提を含まない例であることを確認します。
- ローカルの pause、resume、cancel、retry の許可アクションを導出し、注入された clock と actor id で clone-safe な状態遷移を適用し、型付き invalid-action issue を返し、secret-safe な audit entry を生成する純粋な guarded execution-control helper。
- ローカル demo の run/node 状態に対して許可されたアクションだけを表示し、実際の provider や外部コマンドを実行せずに sanitize 済み audit 結果を preview する React guarded execution controls。
- schema version 付きの delegation、review、broadcast、escalation item、型付き validation issue と mutation issue、未解決および高優先度の sort、status、priority、type、sanitize 済み text search filter、compact な visible/hidden/filter/count summary、clone-safe な acknowledge/resolve 遷移、secret-safe な body、note、reason、audit detail summary、persistence payload、next-action hint、確定的な Markdown preview data を扱う純粋な collaboration inbox、triage、audit-history helper。
- execution graph panel 内の React scenario selector、source-checkout onboarding、collaboration inbox、audit-history preview、scenario evidence bundle preview、source-checkout operator walkthrough、workspace portability manifest preview、workspace import/export dry-run preview、compact demo workspace summary 領域。accessible control と region、role count、collaboration mix、未解決 count、status/priority/type/search controls、acknowledge/resolve button、localStorage persistence fallback、sanitize 済み recent history、next-action hint、source-checkout setup note、evidence link、source-checkout portability blocker、no-mutation dry-run note、copy 可能な Markdown を表示します。
- 将来の provider 統合に向けた正規化済みモデルメタデータ、保守的な capability tag、provider health summary。
- Agent テンプレート、runtime 状態遷移、型付き Agent 間メッセージルーティング。
- provider profile 管理、prompt template 管理、provider health/capability summary、accessible provider shell banner、Agent runway 状態パネルを持つ React/Tauri shell の足場。
- Rust とフロントエンド検証のための GitHub Actions CI。

予定している機能：

- OpenAI、Anthropic、Gemini、サードパーティの OpenAI-compatible provider を管理する。
- provider からモデル一覧を取得し、共通形式に正規化する。
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
- 依存関係をインストールすると、フロントエンドテストで provider profile、provider discovery dry-run と無効 adapter-shell preview、provider/Agent shell state、prompt template、execution graph と trail の足場、React shell の振る舞いを検証できます。

現在のローカル demo scenario、execution trail、provider discovery dry-run preview、無効 provider discovery adapter-shell preview、provider と Agent の shell-state banner、collaboration inbox、audit-history preview、guarded execution controls、run evidence export preview、scenario evidence bundle preview、source-checkout onboarding、source-checkout operator walkthrough、workspace portability manifest preview、workspace import/export dry-run preview は、planner、researcher、implementer、reviewer が成功する coordination path と blocked/failure-recovery path の両方で動く様子を示します。実際の provider call、network call、shell command、secret、storage mutation、顧客データなしで、作成、計画、割り当て、委任、実装、引き継ぎ、レビュー、完了、failed と blocked 状態、stale provider warning、disconnected provider/template blocker、dry-run discovery outcome、無効 adapter consent/option gate、安全なローカル制御状態遷移、collaboration acknowledge/resolve、broadcast、escalation、運用者の次アクション判断、guided source-checkout checklist review、keyboard/start guidance、named evidence link、file-level source-checkout readiness、replacement/new workspace import note、source-checkout portability blocker を扱います。

`examples/workspace-fixtures/` には、小さな合成 source-checkout import 例があります。1 つは portable な bundle candidate、もう 1 つは manifest が欠けた candidate です。これらは validation test と documentation review 専用であり、provider execution や package-registry installation には使いません。

## 設定

現時点では本番用 provider 設定は不要です。基盤設定 helper は local-first かつ secret-safe です。

- Provider profile は、暗号化された API key を持つローカル表現として扱えます。
- Provider と Agent の shell-state summary は確定的なローカル投影であり、表示前に生の API key、bearer token、encrypted key material、顧客らしい text を redact します。
- Provider discovery dry-run preview はローカル fixture object だけを消費し、preview data や UI に出す前に生の API key、bearer token、encrypted key material、API key reference、顧客らしい text を redaction します。
- 無効 provider discovery adapter shell はローカル fixture object だけを消費し、明示的な enable、operator consent、注入された request options がない限り off のままです。JSON、Markdown、audit、UI preview では生の API key、bearer token、encrypted key material、API key reference、顧客らしい text を redact します。
- Provider discovery adapter contract は、将来の live adapter を有効にする前に、明示的な operator consent、bounded timeout/retry、typed failure、response minimization、fixture-backed redaction test、local-only で secret-safe な audit data を要求します。
- Prompt template はローカル record として扱い、provider/model 識別子だけを保存し、生の provider/API secret は保存しません。
- Execution graph summary は node、edge、status、issue、runnable-node の count のみを公開し、生の API key や encrypted key material は公開しません。
- ローカル run evidence export preview は、確定的な Markdown を表示する前に workspace id、actor/title/note/node text、graph issue、trail issue を再 sanitize します。
- Scenario evidence bundle preview は run evidence export、collaboration triage、audit-history summary を再利用し、copy/export の前に preview field と Markdown を再 sanitize します。
- Source-checkout operator walkthrough preview は既存の local-only surface を schema version 付き checklist に接続し、copy 前に step summary、blocker、next action、Markdown を再 sanitize します。
- Source-checkout onboarding preview は guided walkthrough を主要な review path として示しつつ、provider、template、execution、collaboration、portability の evidence link を表示したままにします。setup note は source-checkout-only のまま、表示や copy の前に sanitize されます。
- Workspace portability manifest preview は source-checkout-only provider binding、model inventory、prompt template validation、scenario identity、graph/trail/evidence availability、collaboration/audit note、blocker を要約し、生の key、bearer token、encrypted key material、顧客らしい text を省きます。
- Workspace import/export dry-run report は mutation 前に source-checkout-only export readiness と import candidate validation を要約し、file-level accepted/rejected/missing entry と、ローカル provider secret、encrypted key material、saved desktop state、localStorage record が変更されていないことを示します。
- Workspace fixture review examples は合成の source-checkout manifest で、import dry-run path を通して検証されます。出力が確定的であること、安全な相対パスだけを使うこと、生の API key、bearer token、encrypted key material、顧客らしい text を含まないことをテストします。
- Guarded execution-control audit entry は operator reason/note text を sanitize し、生の API key、encrypted key material、token、顧客データ、実コマンド text を公開しません。
- Collaboration inbox mutation、triage filter、compact summary、audit-history preview は、表示、copy、永続化 JSON への書き込みの前に body、note、reason、recent history、Markdown text を sanitize し、生の API key、encrypted key material、token、顧客データ、provider secret を公開しません。
- シークレットは debug 文字列、エクスポートされた card、ログ、UI snapshot に出してはいけません。
- Provider card は、secret-safe な health summary と、ローカルモデルメタデータから派生した capability tag 数を公開します。
- ブラウザー demo crypto は意図的に demo 専用です。実際の provider key を使う前に、本番ストレージは Tauri-backed secure storage に置き換える必要があります。

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

growth cadence、Now/Next/Later 計画、maintenance triggers、completion-review rules は [ROADMAP.md](ROADMAP.md) を参照してください。

現在の重点：

- guided source-checkout walkthrough を主要な review path として保ちつつ、provider/template/execution/collaboration/portability evidence を表示したままにする。
- 将来の live adapter prototype が review 済み contract gate を満たすまで、確定的な provider discovery dry-run preview と無効な fixture-backed adapter shell を local/demo-only に保つ。
- template validation report、workspace portability manifest、scenario evidence bundle、collaboration triage、audit history、compact operator summary、execution control を deterministic、provider-free、secret-safe に保つ。
- cadence を上げたり desktop package release を準備したりする前に、review gate と source-checkout evidence quality を強化する。

## コントリビューション

基盤が安定した後の貢献を歓迎します。変更は小さく保ち、振る舞い中心のテストを含め、英語の commit message とコードコメントを使ってください。また、実際の release が存在し検証されるまでは package-registry install claim を追加しないでください。

## ライセンス

Agent Hangar は [MIT License](LICENSE) で公開されています。

## AI 支援メンテナンス

このプロジェクトは AI 支援で作成・保守され、ローカルテスト、review、GitHub Actions によって検証されています。
