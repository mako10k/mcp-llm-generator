# GitHub Copilot Instructions for Collaborative AI Development

このプロジェクトは最新のTypeScript MCP SDKを使用したサンプリング機能付きMCPサーバーです。

## プロジェクト概要

- **目的**: Model Context Protocol (MCP) を使用して、LLMサンプリング機能を提供するサーバー
- **技術スタック**: TypeScript, MCP SDK, Zod, Node.js
- **主要機能**: テキスト生成、コード生成、分析、要約のサンプル機能

## 🚀 再現性の高いチーム開発プロセス

このプロジェクトは多角的な専門家レビューと直感的な意見収集を組み合わせた開発手法を採用しています。

### チーム体制（必須）

1. **専門家チーム（4-6人）**
   - System Architect: 技術アーキテクチャ、設計品質、拡張性
   - Security Engineer: セキュリティリスク、脆弱性対策、コンプライアンス
   - QA Engineer: テスト戦略、品質管理、バグ防止
   - DevOps Engineer: 運用性、自動化、デプロイメント
   - Performance Engineer: パフォーマンス、スケーラビリティ（大規模プロジェクトのみ）

2. **直感型率直意見者（1人）**
   - 専門知識に縛られない、純粋な直感と常識的感覚での意見提供
   - 「普通の人ならどう思うか」「本当に必要なのか」という視点
   - 専門家のピットホール（過度な複雑化、過剰設計）からの脱出支援

### レビュープロセス

1. **機能実装完了時**
   - 全テスト通過確認
   - 専門家チームによる多角的レビュー（並行実行）
   - 直感型意見者による実用性・シンプルさの確認

2. **意思決定プロセス**
   - 専門的品質と実用性のバランスを重視
   - 複雑すぎる提案は簡素化検討
   - ユーザビリティを最優先

## 🛠️ mcp-shell-server 開発自動化（標準ツール）

このプロジェクトでは、開発・テスト・デプロイの一貫した自動化のために **mcp-shell-server** を積極的に使用してください。

### 🚨 ツール使用強制原則（LLM行動パターン改善）

**GitHub Copilotの性質を考慮した指示強化**: LLMは「繰り返されるパターンが強化される」特性があるため、以下の原則を徹底します。

#### 必須実行パターン（反復強化）
```typescript
// ✅ 必ず以下のパターンを使用
mcp_mcp-shell-ser_shell_execute({
  "command": "実行したいコマンド",
  "execution_mode": "foreground" // または "background"
})
```

#### 🛡️ ツール使用規律監督システム
- **監督者コンテキスト**: `context-mdb8zhe9-5rbu9j` (ツール使用規律監督者)
- **事前チェック**: 作業開始前に適切なツール選択を確認
- **即座修正**: 不適切なツール使用の即座指摘・修正

#### 🔄 習慣強化メカニズム
1. **意識的反復**: 正しいツール使用パターンを意識的に反復
2. **監督者確認**: 重要な作業前に監督者コンテキストで適切性確認
3. **パターン強化**: 成功事例の積極的な再利用・強化

### 基本的な使用方法（必須習得）

1. **ビルドとテスト**:
```bash
# TypeScriptビルド
mcp_mcp-shell-ser_shell_execute({
  "command": "cd /home/mako10k/mcp-sampler && npm run build",
  "execution_mode": "foreground"
})

# テスト実行
mcp_mcp-shell-ser_shell_execute({
  "command": "cd /home/mako10k/mcp-sampler && npm test",
  "execution_mode": "foreground"
})
```

2. **開発サーバーの起動**:
```bash
# バックグラウンドでサーバー起動
mcp_mcp-shell-ser_shell_execute({
  "command": "cd /home/mako10k/mcp-sampler && npm run dev",
  "execution_mode": "background"
})
```

3. **MCP Inspector でのテスト**:
```bash
# MCP Inspectorでプロトコルレベルテスト
mcp_mcp-shell-ser_shell_execute({
  "command": "cd /home/mako10k/mcp-sampler && npx @modelcontextprotocol/inspector node build/index.js",
  "execution_mode": "background"
})
```

4. **プロセス管理**:
```bash
# 実行中プロセス確認
mcp_mcp-shell-ser_process_list({"status_filter": "running"})

# プロセス終了
mcp_mcp-shell-ser_process_terminate({"process_id": "<process_id>"})

# 実行ログ確認
mcp_mcp-shell-ser_read_execution_output({"output_id": "<output_id>"})
```

### セキュリティガイドライン（必須遵守）

- **コマンド実行権限**: 必要最小限のコマンドのみ許可、ホワイトリスト管理
- **入力値検証**: 外部入力は必ずバリデーション・サニタイズ実行
- **監査ログ**: 全コマンド実行履歴を不変ログとして記録
- **環境分離**: 開発環境では機密データを扱わない、本番アクセス厳格制限

### 推奨開発ワークフロー

1. **機能実装**
   - mcp-shell-serverでビルド実行
   - TypeScript型エラー確認・修正
   - ユニットテスト作成・実行

2. **統合テスト**
   - MCP Inspector でプロトコルテスト
   - VS Code/Claude Desktop で実際のMCP接続確認

3. **品質保証**
   - 全テスト通過確認（目安: 50+テストケース）
   - 専門家チームレビュー
   - 直感型意見者による実用性確認

## ⚙️ Feature Flag 戦略（段階的統合）

新機能は Feature Flag を使用して段階的に統合し、リスクを最小化しながら品質を確保します。

### 基本原則

- **デフォルト無効**: 新機能は環境変数により無効状態でスタート
- **段階的有効化**: 充分なテスト・レビュー後に段階的に有効化
- **簡単ロールバック**: 問題発生時は即座に無効化可能

### 実装例

```typescript
// Feature Flag の実装パターン
private useNewFeature: boolean;

constructor() {
  // デフォルト false、環境変数で制御
  this.useNewFeature = process.env.USE_NEW_FEATURE === 'true';
}

private someMethod(): string {
  if (this.useNewFeature) {
    return NewImplementation.process(); // 新実装
  }
  
  // 既存実装（フォールバック）
  return LegacyImplementation.process();
}
```

### 管理ルール

- **変更権限**: 管理者のみ Feature Flag 変更可能
- **変更履歴**: 全ての変更を監査ログに記録
- **レビュー必須**: Feature Flag 有効化前にセキュリティレビュー実施
- **テスト要件**: 新旧両方のパスをテストでカバー

## 💭 専門家コンテキスト活用ガイド

### チーム人格の作成・活用

1. **利用可能なコンテキスト確認**:
```bash
mcp_llm-generator_context-manage({"action": "list"})
```

2. **新しい専門家人格作成**:
```bash
mcp_llm-generator_context-manage({
  "action": "create",
  "name": "専門分野名",
  "personality": "専門家の特性・役割・視点",
  "systemPrompt": "具体的な指示・制約・出力形式"
})
```

3. **専門家との相談**:
```bash
mcp_llm-generator_context-chat({
  "contextId": "context-id",
  "message": "相談内容",
  "maintainPersonality": true
})
```

### 推奨チーム構成

- **System Architect**: 技術アーキテクチャ・設計品質・拡張性
- **Security Engineer**: セキュリティリスク・脆弱性・コンプライアンス  
- **QA Engineer**: テスト戦略・品質管理・バグ防止
- **DevOps Engineer**: 運用性・自動化・デプロイメント
- **直感型率直意見者**: 専門家のピットホール脱出・実用性確認

## コーディング規約とベストプラクティス

### TypeScript/MCP SDK使用時の注意点

1. **型安全性**:
   - Zodスキーマを使用して入力検証
   - TypeScriptの strict モードを維持
   - 型アサーションを避け、型ガードを使用

2. **エラーハンドリング**:
   - MCPサーバーでは適切なエラーレスポンスを返す
   - try-catch文でLLMサンプリングエラーを処理
   - ログ出力は stderr を使用（stdoutはMCPプロトコル用）

3. **リソース管理**:
   - リソーステンプレートを使用した動的リソース
   - メタデータの適切な設定
   - URIスキームの一貫性

4. **サンプリング実装**:
   - `server.server.createMessage()` を使用
   - 適切なシステムプロンプトの設定
   - 構造化されたレスポンスの返却

### セキュリティ指針（必須遵守）

- **機密情報管理**: APIキー・認証情報は環境変数またはSecret Manager使用
- **アクセス制御**: RBAC・最小権限の原則を適用
- **監査ログ**: 全操作履歴を不可改ログとして記録
- **入力検証**: 外部入力は必ずバリデーション・サニタイズ実行
- **セキュアコーディング**: OWASP Secure Coding Practices準拠

### ファイル構成

```
/home/mako10k/mcp-sampler/
├── src/
│   └── index.ts          # メインのMCPサーバー実装
├── build/                # TypeScriptコンパイル後の出力
├── .vscode/
│   └── mcp.json         # VS Code MCP設定
├── .github/
│   └── copilot-instructions.md  # このファイル
├── package.json
├── tsconfig.json
└── README.md
```

### 重要な実装詳細

- **サンプリング機能**: MCP仕様の sampling 機能を使用してLLMと対話
- **構造化データ**: ツールレスポンスに structuredContent を含める
- **リソーステンプレート**: 動的リソース生成用のテンプレートパターン
- **プロンプトテンプレート**: 再利用可能なプロンプト定義

## トラブルシューティング

### よくある問題

1. **ビルドエラー**:
   - TypeScript型エラーの確認
   - 依存関係の更新: `npm install`

2. **MCPサーバー接続問題**:
   - mcp.json設定の確認
   - サーバープロセスの状態確認
   - ログ出力の詳細確認

3. **サンプリング機能の問題**:
   - クライアントのsampling capability確認
   - エラーハンドリングの実装確認

### デバッグ方法

1. mcp-shell-serverでプロセス状態を監視
2. MCP Inspectorでプロトコルレベルのテスト
3. console.error()でデバッグログ出力（stderrに出力）

## 実用性重視の運用指針

### 「最低限の型＋現場の自由」アプローチ

1. **必須事項（絶対標準化）**:
   - セキュリティ・運用リスク対策
   - CI/CD・テストの基本フロー
   - mcp-shell-serverの基本使用法

2. **柔軟事項（プロジェクト裁量）**:
   - 具体的なツール選定
   - 詳細な開発・運用体制
   - テストの粒度・カバレッジ基準

3. **現場重視の原則**:
   - 「使うと楽になる」体験を最優先
   - 現場のフィードバックで継続改善
   - ドキュメントは「困ったときに役立つ」ことを最重視

### レビューバランス

- **専門的品質**: 技術的堅牢性・セキュリティ・パフォーマンス
- **実用性重視**: シンプルさ・使いやすさ・現場の声
- **意思決定**: 複雑すぎる提案は簡素化、ユーザビリティ最優先

## 関連リンク

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Sampling Documentation](https://modelcontextprotocol.io/docs/concepts/sampling)
