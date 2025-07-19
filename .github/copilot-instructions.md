# Copilot Instructions for MCP Sampler

このプロジェクトは最新のTypeScript MCP SDKを使用したサンプリング機能付きMCPサーバーです。

## プロジェクト概要

- **目的**: Model Context Protocol (MCP) を使用して、LLMサンプリング機能を提供するサーバー
- **技術スタック**: TypeScript, MCP SDK, Zod, Node.js
- **主要機能**: テキスト生成、コード生成、分析、要約のサンプル機能

## 継続的なメンテナンス方法

### 定期レビュー
- スプリントやリリースごとに内容を見直し、チームのフィードバックを反映します。

### 変更履歴管理
- 変更点をコミットメッセージやPRで明示し、背景を記録します。

### 自動チェック
- CI/CDパイプラインでMarkdownフォーマットや内容の存在を確認します。

### チーム教育
- 新メンバーへの説明や定期的な勉強会を開催します。

## 実践的な指示例

- **新しい規約導入時**: 速やかに追記し、PRレビューで確認します。
- **提案が意図と異なる場合**: 該当箇所を記録し、具体例や禁止事項を追加します。

---

この方法を活用し、プロジェクトの品質向上を目指してください。

## Copilot 指示内容

### プロジェクト固有のルール

1. **MCPプロトコル実装**:
   - MCPサーバーの標準出力（stdout）はプロトコル通信専用です
   - デバッグ情報や一般的なログは必ず `console.error()` を使用してstderrに出力
   - サーバー実装時は必ず `Server` クラスを継承し、適切なcapabilitiesを設定

2. **TypeScript型安全性**:
   - `any` 型の使用を避け、具体的な型定義を作成
   - Zodスキーマによる実行時型検証を必須とする
   - 外部APIレスポンスには必ず型ガードを適用

3. **エラーハンドリング**:
   - 非同期処理には必ずtry-catch文を適用
   - MCPエラーは `McpError` クラスを使用し、適切なエラーコードを設定
   - ユーザー向けエラーメッセージは日本語で分かりやすく記述

### 禁止事項

- `eval()` や `Function()` コンストラクタの使用禁止
- プロセス終了時の強制終了（`process.exit()`）の使用禁止
- 非同期処理での `setTimeout()` による擬似的な待機の禁止
- MCPサーバーでの `console.log()` 使用禁止（stderrのみ使用）

### 推奨パターン

```typescript
// MCPツール実装の推奨パターン
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    
    // Zodスキーマで入力検証
    const validatedArgs = SomeSchema.parse(args);
    
    // 処理実行
    const result = await processData(validatedArgs);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Tool execution error: ${error.message}`);
    throw new McpError(
      ErrorCode.InternalError,
      `処理中にエラーが発生しました: ${error.message}`
    );
  }
});
```

### コードレビューチェックリスト

- [ ] MCPプロトコル仕様に準拠しているか
- [ ] 型安全性が保たれているか
- [ ] エラーハンドリングが適切に実装されているか
- [ ] ログ出力先が正しいか（stderr使用）
- [ ] Zodスキーマによる入力検証があるか

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

## メンテナンス管理

### 自動更新の仕組み

1. **依存関係の定期更新**:
   - Dependabotによる自動PR作成
   - セキュリティアップデートの優先適用
   - 定期的な脆弱性スキャン

2. **継続的インテグレーション**:
   - TypeScriptコンパイル確認
   - Lintチェック（ESLint + Prettier）
   - テスト実行（Vitest）
   - copilot-instructions.mdの存在確認

3. **自動化されたメンテナンス**:
   - 週次でcopilot-instructions.mdの更新確認
   - 新しいMCP SDK機能の調査と適用検討
   - パフォーマンス指標の監視

### メンテナンス担当者向けガイド

- **月次レビュー**: MCPプロトコルの更新情報確認
- **四半期レビュー**: アーキテクチャの見直しと最適化
- **年次レビュー**: 技術スタックの全面的な評価

### 品質保証

- **コードカバレッジ**: 80%以上を維持
- **型安全性**: strict モードでの警告ゼロ
- **セキュリティ**: 脆弱性の即座対応（24時間以内）

## 関連リンク

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Sampling Documentation](https://modelcontextprotocol.io/docs/concepts/sampling)
