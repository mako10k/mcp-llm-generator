# Definition of Done (DoD) v2.0

このプロジェクトでは、以下のDefinition of Done（完成の定義）に基づき、スプリント成果物の品質を担保します。

## 🎯 基本原則

- **ユーザー指示・制約事項の最優先遵守**
- **mainブランチは常にリリース可能な状態を維持**  
- **品質ゲートをクリアした成果物のみmainへマージ**
- **MCP統合・VS Code連携の動作確認必須**
- **データベース整合性とセキュリティの確保**

## 📋 改善履歴

- **v2.0** (2025-07-19): Sprint2学習に基づく大幅強化
  - MCP統合テスト要件追加
  - VS Code統合確認プロセス詳細化  
  - データベース管理・セキュリティ強化
  - 外部API統合テスト標準化

## ✅ Definition of Done チェックリスト

### 1. 機能要件の達成
- [ ] 受け入れ基準（Acceptance Criteria）を満たしている
- [ ] ユーザーストーリーの全ての要件が実装されている  
- [ ] 既存機能への影響がないことを確認済み
- [ ] **機能デモまたは証跡が記録されている**

### 2. MCP統合・プロトコル要件 🔌
- [ ] **MCP Inspector での動作確認完了**
  ```bash
  npx @modelcontextprotocol/inspector node build/index.js
  ```
- [ ] **全ツール・リソース・プロンプトが期待通り動作**
- [ ] **MCPプロトコル仕様（stdio/JSON-RPC）準拠確認**
- [ ] **エラーレスポンスが適切に処理される**
- [ ] **サンプリング機能が正常動作（該当する場合）**

### 3. VS Code統合・クライアント要件 🎨  
- [ ] **VS Code MCP設定（.vscode/mcp.json）が正常**
- [ ] **VS Code再起動後の自動接続確認**
- [ ] **Copilot Chatでの基本動作テスト完了**
  ```
  例: "Use @llm-generator to explain quantum computing"
  ```
- [ ] **Model Context Protocol Output パネルでエラーなし**
- [ ] **複数MCP サーバー併用時の競合なし**

### 4. 品質基準の達成
- [ ] **TypeScript strict modeでの型エラーがない**
- [ ] **ESLintのwarning/errorが0件**  
- [ ] **ビルド成功（npm run build）**
- [ ] テストカバレッジが80%以上（該当する場合）
- [ ] 単体テスト・統合テストが全て通過
- [ ] **手動テストでユーザー体験を確認済み**

### 5. データベース・永続化要件 🗄️
- [ ] **SQLite データベース整合性チェック完了**
  ```bash
  sqlite3 context-memory.db "PRAGMA integrity_check;"
  ```
- [ ] **データベースファイルがコミット対象外**
- [ ] **マイグレーション・スキーマ変更の妥当性確認**
- [ ] **バックアップ・リストア手順の動作確認**
- [ ] **個人情報・機密データの適切な処理**

### 6. セキュリティ・プロトコル準拠 🔒
- [ ] **セキュリティ監査（npm audit）が通過**
- [ ] **APIキー・認証情報がリポジトリに含まれていない** 
- [ ] **環境変数・設定ファイルの適切な管理**
- [ ] **外部API連携のエラーハンドリングが適切**
- [ ] **外部API利用は事前承認記録があること**

### 7. 外部API・サービス統合要件 🌐
- [ ] **課金が発生する外部API利用は事前承認を得ている**
- [ ] **外部API承認申請記録が文書化されている**
- [ ] **API利用量・課金予想が承認範囲内**
- [ ] **代替案・回避策を検討済み**
- [ ] **Claude API/OpenAI API統合テスト完了（該当する場合）**
- [ ] **Google Custom Search API動作確認（該当する場合）**

### 8. コード品質・アーキテクチャ 💎
- [ ] **コードレビューが完了している**
- [ ] **リファクタリングが必要な技術的負債がない** 
- [ ] **ログ出力がstderrに適切に設定されている（MCPサーバー）**
- [ ] **エラーハンドリングが適切に実装されている**
- [ ] **Zodスキーマによる入力検証が適切**
- [ ] **TypeScript型定義が包括的**

### 9. ドキュメント・透明性 📚
- [ ] **README.mdが更新されている（機能追加の場合）**
- [ ] **APIドキュメントが更新されている（該当する場合）**
- [ ] **システムアーキテクチャ文書の同期確認**
- [ ] **運用手順書への影響確認・更新**
- [ ] **リリースノートが作成されている** 
- [ ] **変更履歴がコミットメッセージに適切に記録されている**

### 10. 開発・ビルド環境 🛠️
- [ ] **mcp-shell-server を使用した開発・テスト実施**
- [ ] **依存関係（package.json）の最新化確認**
- [ ] **Node.js/npm バージョン互換性確認**
- [ ] **クロスプラットフォーム動作確認（Linux/macOS/Windows）**

### 11. 運用・制約管理 ⚙️
- [ ] **ユーザーからの明示的な実装許可を得ている**
- [ ] **バックログ項目の意図（既存変更/新規追加）が明確**
- [ ] **CI/CDパイプラインが全て成功している**
- [ ] **ブランチ戦略に従ったPR・マージ手順を遵守**
- [ ] **VS Code MCP ライフサイクル管理の理解**
- [ ] **プロセス管理と端末管理の使い分け確認**

### 12. リリース・デプロイ準備 🚀
- [ ] **本番環境での動作確認が完了（該当する場合）**
- [ ] **パフォーマンスに問題がない**
- [ ] **ロールバック手順が確認されている**
- [ ] **リリース後の監視計画が準備されている**
- [ ] **グローバルパッケージ更新手順の確認（該当する場合）**

## 🧪 必須テストシナリオ

### MCP統合テスト
```bash
# 1. ビルドテスト
npm run build

# 2. MCP Inspector起動
npx @modelcontextprotocol/inspector node build/index.js

# 3. 基本ツールテスト（ブラウザ: http://localhost:5173）
# - llm-generate: "Hello, world!"
# - template-execute: explain-template
# - context-chat: 新しいコンテキスト作成
# - memory-store: テストメモリ保存

# 4. VS Code統合テスト
# - VS Code再起動
# - Copilot Chat: "@llm-generator explain quantum computing"
# - Output パネルでエラーチェック
```

### データベーステスト
```bash
# 1. 整合性確認
sqlite3 context-memory.db "PRAGMA integrity_check;"

# 2. スキーマ確認
sqlite3 context-memory.db ".schema"

# 3. データ件数確認
sqlite3 context-memory.db "
SELECT 'contexts' as table_name, COUNT(*) FROM contexts
UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL  
SELECT 'templates', COUNT(*) FROM templates;"
```

## 🚨 品質ゲート失敗時の対応

### 重要度レベル別対応

#### 🔴 Critical (即座対応必須)
- MCP Inspector でツールが動作しない
- VS Code統合で接続エラー
- データベース整合性エラー  
- セキュリティ監査失敗

**対応**: 即座にPR停止、原因調査・修正後に再検証

#### 🟡 Warning (修正推奨)
- TypeScript型エラー
- ESLint警告
- ドキュメント不整合
- テストカバレッジ不足

**対応**: 次回リリースまでに修正、技術的負債として記録

### 修正プロセス
1. **問題の特定**: 失敗した項目を具体的に特定
2. **影響範囲調査**: 既存機能への影響を詳細調査
3. **修正作業**: 段階的修正・部分的検証の実施
4. **再検証**: DoDチェックリストの再実行
5. **学習の記録**: 原因・解決策を連想記憶システムに保存

## 📊 品質メトリクス・KPI

### 開発品質指標
- **TypeScriptコンパイル成功率**: 100%
- **ESLint違反件数**: 0件
- **MCP Inspector テスト成功率**: 100%
- **VS Code統合成功率**: 100%
- **データベース整合性エラー**: 0件

### プロセス効率指標
- **PR承認までの平均時間**: 目標 24時間以内
- **DoDチェック完了時間**: 目標 30分以内
- **CI/CDパイプライン成功率**: 95%以上
- **バグ発見率**: Sprint内で90%以上捕捉
- **リリース後問題報告**: 月1件以下

### ユーザー体験指標
- **MCP接続成功率**: 98%以上
- **レスポンス時間**: 平均2秒以内
- **エラー復旧時間**: 平均5分以内
- **ユーザー満足度**: フィードバック評価4/5以上

## 🔄 継続的改善・学習

### スプリントレトロスペクティブ
- **DoDの運用状況振り返り**: 各項目の実行負荷・効果測定
- **チェックリスト最適化**: 形式的項目の除去・実用的項目の追加
- **自動化推進**: 手動チェック項目の自動化検討
- **品質意識向上**: チーム全体でのベストプラクティス共有

### 学習・知識管理連携
- **問題解決事例の蓄積**: 連想記憶システムでの事例管理
- **改善提案の追跡**: バックログアイテムとしての改善課題管理
- **外部学習の取り込み**: MCPコミュニティ・技術トレンドの反映
- **ドキュメント連動更新**: 運用手順書・アーキテクチャ文書との同期

### 自動化・効率化推進
```bash
# DoD自動チェックスクリプト例
#!/bin/bash
# dod-check.sh

echo "🔍 Running Definition of Done automated checks..."

# TypeScript check
echo "📝 TypeScript compilation..."
npm run build || exit 1

# Lint check  
echo "🧹 ESLint check..."
npm run lint || exit 1

# Security audit
echo "🔒 Security audit..."
npm audit --audit-level=moderate || exit 1

# Database integrity
echo "🗄️ Database integrity check..."
sqlite3 context-memory.db "PRAGMA integrity_check;" || exit 1

# MCP Inspector (background)
echo "🔌 MCP Inspector availability check..."
timeout 10 npx @modelcontextprotocol/inspector node build/index.js --check-only || exit 1

echo "✅ All automated DoD checks passed!"
```

## 🎓 トレーニング・オンボーディング

### 新規チームメンバー向け
1. **DoD理解セッション**: 30分のガイダンス実施
2. **実践演習**: サンプルタスクでのDoD適用練習
3. **メンター制度**: 経験者による1週間サポート
4. **フィードバック収集**: オンボーディング改善点の把握

### 定期研修
- **月次品質セッション**: DoDベストプラクティス共有
- **技術トレンド学習**: MCP・TypeScript最新動向
- **セキュリティ意識向上**: 脆弱性対策・API管理
- **ツール習熟**: mcp-shell-server・開発効率化

---

## 📋 クイックリファレンス

### 必須コマンド
```bash
# ビルド・品質チェック
npm run build && npm run lint && npm audit

# MCP統合テスト
npx @modelcontextprotocol/inspector node build/index.js

# データベース確認
sqlite3 context-memory.db "PRAGMA integrity_check;"

# VS Code統合確認
# 1. VS Code再起動
# 2. Copilot Chat: "@llm-generator test"
# 3. Output → Model Context Protocol でログ確認
```

### 重要ファイル
- **MCP設定**: `.vscode/mcp.json`
- **セキュリティ**: `.env*` (gitignore確認)
- **データベース**: `context-memory.db*` (gitignore確認)
- **品質設定**: `tsconfig.json`, `.eslintrc.js`

---

**このDoD v2.0は全チームメンバーが遵守すべき品質基準です。**  
**不明な点がある場合は、Scrum MasterまたはQAエンジニアに確認してください。**  

**最終更新**: 2025年7月19日  
**文書バージョン**: 2.0.0  
**適用プロジェクト**: MCP LLM Generator v2
