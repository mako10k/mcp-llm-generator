# MCP Sampler

最新のTypeScript MCP SDKを使用したサンプリング機能付きMCPサーバーです。

## 機能

### ツール
- **sample**: LLMサンプリング機能を使用してテキスト、コード、分析、要約を生成
- **health**: サーバーのヘルスチェック

### リソース
- **sample-config**: サンプル設定情報
- **sample-result**: 動的サンプル結果 (テンプレート付き)

### プロンプト
- **sample-template**: サンプルリクエスト用のテンプレート

## セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. TypeScriptのコンパイル:
```bash
npm run build
```

3. MCP設定ファイルのセットアップ:
```bash
# テンプレートをコピーして設定
cp .vscode/mcp.json.template .vscode/mcp.json
# 必要に応じて API キーなどを設定
```

4. 開発モードでの実行:
```bash
npm run dev
```

5. 本番モードでの実行:
```bash
npm start
```

## 重要な注意事項

`.vscode/mcp.json` ファイルには機密情報（APIキーなど）が含まれる可能性があります。
このファイルは `.gitignore` に含まれており、リポジトリにコミットされません。
設定時は `.vscode/mcp.json.template` をコピーして使用してください。

## MCP設定

### Claude Desktop設定例

`~/.cursor/mcp.json` または `~/.claude/mcp.json` に以下を追加:

```json
{
  "servers": {
    "mcp-sampler": {
      "command": "node",
      "args": ["/path/to/mcp-sampler/build/index.js"],
      "type": "stdio"
    }
  }
}
```

### VS Code MCP設定例

`.vscode/mcp.json` に以下を追加:

```json
{
  "servers": {
    "mcp-sampler": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/mcp-sampler/build/index.js"
      ]
    }
  }
}
```

## 使用例

### sampleツールの使用

```typescript
// 基本的なテキストサンプル
await client.callTool("sample", {
  prompt: "TypeScriptの非同期処理について説明してください",
  type: "text"
});

// コードサンプル
await client.callTool("sample", {
  prompt: "React コンポーネントの例を作成してください",
  type: "code",
  maxTokens: 1000
});

// 分析サンプル
await client.callTool("sample", {
  prompt: "この売上データの傾向を分析してください: [データ]",
  type: "analysis",
  temperature: 0.3
});
```

### リソースの読み取り

```typescript
// 設定の取得
const config = await client.readResource({ uri: "sample://config" });

// 特定の結果の取得
const result = await client.readResource({ uri: "sample://results/abc123" });
```

### プロンプトの使用

```typescript
// サンプルテンプレートの取得
const prompt = await client.getPrompt("sample-template", {
  topic: "機械学習",
  style: "technical"
});
```

## アーキテクチャ

このMCPサーバーは以下の特徴を持ちます：

- **Sampling機能**: MCP仕様のsampling機能を使用してLLMと対話
- **リソーステンプレート**: 動的リソースの生成
- **構造化データ**: ツールの結果に構造化されたメタデータを含める
- **エラーハンドリング**: 堅牢なエラー処理とログ記録
- **型安全性**: TypeScriptとZodを使用した型安全な実装

## 開発

### ビルド
```bash
npm run build
```

### 開発用サーバー起動
```bash
npm run dev
```

### デバッグ

MCPサーバーのデバッグには、[MCP Inspector](https://github.com/modelcontextprotocol/inspector)を使用できます：

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## ライセンス

MIT License
