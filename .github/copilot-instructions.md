# Copilot Instructions for MCP Sampler

このプロジェクトは最新のTypeScript MCP SDKを使用したサンプリング機能付きMCPサーバーです。

## プロジェクト概要

- **目的**: Model Context Protocol (MCP) を使用して、LLMサンプリング機能を提供するサーバー
- **技術スタック**: TypeScript, MCP SDK, Zod, Node.js
- **主要機能**: テキスト生成、コード生成、分析、要約のサンプル機能

## 開発・テスト環境での mcp-shell-server の使用

このプロジェクトでは、開発とテストのために **mcp-shell-server** を積極的に使用してください。

### mcp-shell-server の使用方法

1. **ビルドとテスト**:
```bash
# mcp-shell-serverを使用してビルド
mcp_mcp-shell-ser_shell_execute({
  "command": "cd /home/mako10k/mcp-sampler && npm run build",
  "execution_mode": "foreground"
})
```

2. **開発サーバーの起動**:
```bash
# バックグラウンドでサーバーを起動
mcp_mcp-shell-ser_shell_execute({
  "command": "cd /home/mako10k/mcp-sampler && npm run dev",
  "execution_mode": "background"
})
```

3. **MCP Inspector を使用したテスト**:
```bash
# MCP Inspectorでサーバーをテスト
mcp_mcp-shell-ser_shell_execute({
  "command": "cd /home/mako10k/mcp-sampler && npx @modelcontextprotocol/inspector node build/index.js",
  "execution_mode": "background"
})
```

4. **プロセス管理**:
```bash
# 実行中のプロセス一覧
mcp_mcp-shell-ser_process_list({"status_filter": "running"})

# プロセス終了
mcp_mcp-shell-ser_process_terminate({"process_id": "<process_id>"})
```

5. **ログと出力の確認**:
```bash
# 実行出力の確認
mcp_mcp-shell-ser_list_execution_outputs({"execution_id": "<execution_id>"})

# 出力の詳細読み取り
mcp_mcp-shell-ser_read_execution_output({"output_id": "<output_id>"})
```

### 推奨される開発ワークフロー

1. **コード変更後**:
   - mcp-shell-serverでビルドを実行
   - TypeScriptの型エラーを確認
   - 必要に応じて修正

2. **機能テスト**:
   - MCP Inspectorを使用してサーバーをテスト
   - ツール、リソース、プロンプトの動作を確認

3. **統合テスト**:
   - VS Code または Claude Desktop で実際のMCP接続をテスト
   - サンプリング機能の動作を確認

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

## 関連リンク

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Sampling Documentation](https://modelcontextprotocol.io/docs/concepts/sampling)
