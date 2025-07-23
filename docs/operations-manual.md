# 📚 MCP LLM Generator 企業レベル運用マニュアル
**Sprint4 Phase 2: 企業レベル運用管理システム**

> **🎯 目的**: MCPシステムの企業レベル運用、24/7監視、自動化、トラブルシューティング、災害復旧の包括的ガイド

## � 目次

1. [🏗️ システム概要](#システム概要)
2. [🚀 日常運用](#日常運用)
3. [📊 監視とアラート](#監視とアラート)
4. [🗄️ バックアップ・復旧](#バックアップ復旧)
5. [🚨 緊急時対応](#緊急時対応)
6. [🔧 メンテナンス](#メンテナンス)
7. [📈 パフォーマンス最適化](#パフォーマンス最適化)
8. [🔒 セキュリティ](#セキュリティ)
9. [📝 トラブルシューティング](#トラブルシューティング)
10. [📖 運用ベストプラクティス](#運用ベストプラクティス)

---

## 🏗️ システム概要

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP LLM Generator                        │
├─────────────────────────────────────────────────────────────┤
│  📱 フロントエンド                                           │
│  - VS Code Extension                                        │
│  - Claude Desktop Integration                               │
│  - MCP Inspector                                           │
├─────────────────────────────────────────────────────────────┤
│  🧠 コアサービス                                            │
│  - LLM Text Generation                                     │
│  - Context Management                                      │
│  - Persona Management                                      │
│  - Template System                                         │
├─────────────────────────────────────────────────────────────┤
│  🗄️ データ層                                               │
│  - SQLite Database (context-memory.db)                    │
│  - Persona Database (persona.db)                          │
│  - File-based Templates                                   │
├─────────────────────────────────────────────────────────────┤
│  🔧 運用ツール                                              │
│  - Health Check System                                    │
│  - Daily Reporting                                        │
│  - Backup System                                          │
│  - Emergency Response                                     │
└─────────────────────────────────────────────────────────────┘
```

### 主要コンポーネント

| コンポーネント | 説明 | 責任 |
|---------------|------|------|
| **MCP Server** | メインのModel Context Protocolサーバー | LLM統合、コンテキスト管理 |
| **PersonaManager** | ペルソナ管理システム | 役割階層、タスク委譲 |
| **ContextManager** | コンテキスト記憶システム | 会話履歴、状態管理 |
| **TemplateSystem** | テンプレート管理 | 再利用可能プロンプト |
| **SecurityManager** | セキュリティ機能 | プロンプトインジェクション防止 |

---

## 🚀 日常運用

### 開始手順

#### 1. 開発環境での起動

```bash
# プロジェクトディレクトリに移動
cd /home/mako10k/mcp-sampler

# 依存関係の確認
npm install

# ビルド実行
npm run build

# 開発サーバー起動
npm run dev
```

#### 2. 本番環境での起動

```bash
# ヘルスチェック実行
./scripts/health-check.sh

# システム状態確認
./scripts/daily-report.sh

# サーバー起動
node build/index.js
```

### 1.2 VS Code MCP統合

#### クライアント設定確認
```bash
# VS Code MCP設定ファイルの確認
cat .vscode/mcp.json

# 期待される設定
{
  "servers": {
    "llm-generator": {
      "command": "node",
      "args": ["build/index.js"],
      "type": "stdio"
    },
    "assoc-memory": { ... },
    "mcp-shell-server": { ... },
    "google": { ... }
  }
}
```

#### 接続状態の監視
```bash
# MCP Inspectorでサーバーテスト
npx @modelcontextprotocol/inspector node build/index.js

# VS Code Output パネルで接続ログ確認
# View → Output → Model Context Protocol
```

### 1.3 データベース状態確認

#### SQLite データベースチェック
```bash
# データベースファイルの存在確認
ls -la *.db *.db-wal *.db-shm 2>/dev/null || echo "No database files found"

# データベース整合性チェック
sqlite3 context-memory.db "PRAGMA integrity_check;"

# テーブル構造確認
sqlite3 context-memory.db ".schema"

# データ件数確認
sqlite3 context-memory.db "
SELECT 'contexts' as table_name, COUNT(*) as count FROM contexts
UNION
SELECT 'conversations', COUNT(*) FROM conversations
UNION
SELECT 'templates', COUNT(*) FROM templates;"
```

---

## 2. 開発・テスト手順

### 2.1 開発環境セットアップ

#### 新規環境構築
```bash
# 1. リポジトリクローン
git clone https://github.com/mako10k/mcp-sampler.git
cd mcp-sampler

# 2. Node.js バージョン確認（推奨: 18.x以上）
node --version
npm --version

# 3. 依存関係インストール
npm install

# 4. TypeScript設定確認
npx tsc --showConfig

# 5. 初回ビルド
npm run build

# 6. 開発サーバー起動（ウォッチモード）
npm run dev
```

#### 環境変数設定
```bash
# .env.local ファイル作成（本番用）
cat > .env.local << 'EOF'
# Claude API（本番のみ）
ANTHROPIC_API_KEY=your_actual_api_key_here

# OpenAI API（オプション）
OPENAI_API_KEY=your_openai_key_here

# Google Custom Search（オプション）
GOOGLE_CSE_ID=your_search_engine_id
GOOGLE_API_KEY=your_google_api_key

# ログレベル設定
LOG_LEVEL=info
NODE_ENV=production
EOF

# 開発環境では .env ファイルを使用
# 本番環境では適切にキーを暗号化・管理
```

### 2.2 コード変更ワークフロー

#### 標準的な開発サイクル
```bash
# 1. フィーチャーブランチ作成
git checkout -b feature/your-feature-name

# 2. コード変更

# 3. TypeScript型チェック
npm run type-check

# 4. Lintチェック
npm run lint

# 5. 自動修正
npm run lint:fix

# 6. ビルドテスト
npm run build

# 7. 単体テスト（実装時）
npm test

# 8. MCP統合テスト
npx @modelcontextprotocol/inspector node build/index.js
```

#### コミット前チェックリスト
- [ ] TypeScriptコンパイルエラーなし
- [ ] ESLintエラーなし
- [ ] データベースファイルがコミット対象外
- [ ] セキュリティ情報（APIキー等）の除外確認
- [ ] MCP Inspector でツール動作確認

### 2.3 テスト実行手順

#### MCPツールテスト
```bash
# 1. MCP Inspector起動
npx @modelcontextprotocol/inspector node build/index.js

# 2. 基本ツールテスト
# ブラウザで http://localhost:5173 にアクセス

# 3. 実行するテストケース
# - llm-generate: 基本的なテキスト生成
# - template-execute: テンプレート実行
# - context-chat: コンテキストチャット
# - memory-store: メモリ保存
# - template-manage: テンプレート管理
```

#### VS Code統合テスト
```bash
# 1. VS Code設定確認
code .vscode/mcp.json

# 2. VS Code再起動

# 3. Copilot Chatでテスト
# "Use @llm-generator to explain quantum computing"

# 4. ログ確認
# View → Output → Model Context Protocol
```

---

## 3. デプロイメント手順

### 3.1 本番環境デプロイ

#### グローバルパッケージ更新
```bash
# 1. 現在のバージョン確認
npm list -g @mako10k/mcp-llm-generator

# 2. 最新版インストール
npm install -g @mako10k/mcp-llm-generator@latest

# 3. インストール確認
mcp-llm-generator --version

# 4. グローバル設定更新
# ~/.claude/mcp.json または相当ファイルを更新
```

#### ローカル環境デプロイ
```bash
# 1. 本番ブランチにマージ
git checkout main
git merge feature/your-feature

# 2. バージョンタグ作成
npm version patch  # または minor, major
git push origin main --tags

# 3. 本番ビルド
NODE_ENV=production npm run build

# 4. 設定ファイル更新
cp .vscode/mcp.json.template .vscode/mcp.json
# 本番用パスに修正

# 5. MCP クライアント再起動
# VS Code: 再起動またはMCPサーバー再読み込み
```

### 3.2 設定ファイル管理

#### VS Code MCP設定
```json
{
  "servers": {
    "llm-generator": {
      "command": "mcp-llm-generator",  // グローバル
      "type": "stdio",
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "LOG_LEVEL": "warn"
      }
    }
  }
}
```

#### 環境別設定管理
```bash
# 開発環境
export NODE_ENV=development
export LOG_LEVEL=debug

# ステージング環境
export NODE_ENV=staging
export LOG_LEVEL=info

# 本番環境
export NODE_ENV=production
export LOG_LEVEL=warn
```

---

## 4. メンテナンス手順

### 4.1 定期メンテナンス

#### 週次メンテナンス（毎週月曜 9:00）
```bash
# 1. システム状態確認
systemctl --user status mcp-servers || echo "Manual process management"

# 2. ログローテーション確認
ls -la logs/ | grep $(date +%Y-%m)

# 3. データベース最適化
sqlite3 context-memory.db "VACUUM; ANALYZE;"

# 4. ディスク容量確認
df -h
du -sh context-memory.db* logs/

# 5. セキュリティ更新確認
npm audit
npm outdated
```

#### 月次メンテナンス（毎月第1月曜）
```bash
# 1. 依存関係更新
npm update
npm audit fix

# 2. ログアーカイブ
tar -czf logs/archive-$(date +%Y%m).tar.gz logs/*.log
find logs/ -name "*.log" -mtime +30 -delete

# 3. データベースバックアップ
cp context-memory.db backups/context-memory-$(date +%Y%m%d).db

# 4. パフォーマンス分析
sqlite3 context-memory.db "
SELECT 
  'Table sizes:',
  name,
  COUNT(*) as rows
FROM sqlite_master 
WHERE type='table'
GROUP BY name;"

# 5. 不要データクリーンアップ
# 90日以上古い会話履歴の削除（運用ポリシーに従って）
```

### 4.2 データベースメンテナンス

#### パフォーマンス最適化
```bash
# 1. インデックス再構築
sqlite3 context-memory.db "REINDEX;"

# 2. 統計情報更新
sqlite3 context-memory.db "ANALYZE;"

# 3. 未使用領域回収
sqlite3 context-memory.db "VACUUM;"

# 4. WALファイル整理
sqlite3 context-memory.db "PRAGMA wal_checkpoint(FULL);"

# 5. 整合性チェック
sqlite3 context-memory.db "PRAGMA integrity_check;"
```

#### バックアップ・リストア
```bash
# バックアップ作成
sqlite3 context-memory.db ".backup backups/context-memory-$(date +%Y%m%d_%H%M%S).db"

# 差分バックアップ（増分）
rsync -av --progress context-memory.db* backups/

# リストア手順
# 1. サービス停止
# 2. 現在のDBファイル移動
mv context-memory.db context-memory.db.backup-$(date +%Y%m%d_%H%M%S)
# 3. バックアップからリストア
cp backups/context-memory-YYYYMMDD.db context-memory.db
# 4. 整合性確認
sqlite3 context-memory.db "PRAGMA integrity_check;"
# 5. サービス開始
```

---

## 5. トラブルシューティング

### 5.1 よくある問題と解決方法

#### MCP接続エラー
```bash
# 問題: VS CodeがMCPサーバーに接続できない
# 症状: "Server failed to start" エラー

# 解決手順:
# 1. プロセス確認
ps aux | grep mcp

# 2. ポート使用状況確認
netstat -tlnp | grep :3000

# 3. ログ確認
tail -f logs/mcp-server.log

# 4. 設定ファイル確認
cat .vscode/mcp.json | jq '.'

# 5. 手動起動テスト
node build/index.js < /dev/null

# 6. 権限確認
ls -la build/index.js
chmod +x build/index.js
```

#### TypeScriptビルドエラー
```bash
# 問題: TypeScriptコンパイルが失敗する
# 症状: "Type errors" または "Cannot find module"

# 解決手順:
# 1. Node.js/npm バージョン確認
node --version  # >= 18.0.0
npm --version   # >= 8.0.0

# 2. node_modules クリーンアップ
rm -rf node_modules package-lock.json
npm install

# 3. TypeScript設定確認
npx tsc --showConfig

# 4. 段階的ビルド
npx tsc --noEmit  # 型チェックのみ
npx tsc           # フルビルド

# 5. 詳細エラー表示
npx tsc --verbose
```

#### データベース関連エラー
```bash
# 問題: SQLiteデータベースアクセスエラー
# 症状: "database is locked" または "no such table"

# 解決手順:
# 1. ファイル権限確認
ls -la context-memory.db*
chmod 644 context-memory.db

# 2. ロックファイル確認・削除
rm -f context-memory.db-shm context-memory.db-wal

# 3. データベース整合性チェック
sqlite3 context-memory.db "PRAGMA integrity_check;"

# 4. スキーマ確認
sqlite3 context-memory.db ".schema"

# 5. プロセス確認（複数アクセス）
lsof context-memory.db
```

#### メモリ・パフォーマンス問題
```bash
# 問題: 高メモリ使用量・レスポンス遅延
# 症状: システムが重い、レスポンスが遅い

# 診断手順:
# 1. プロセス監視
top -p $(pgrep -f mcp-llm-generator)

# 2. メモリ使用量詳細
ps -p $(pgrep -f mcp-llm-generator) -o pid,ppid,cmd,%mem,%cpu

# 3. ヒープメモリ分析
node --expose-gc --inspect build/index.js

# 4. データベースサイズ確認
du -sh context-memory.db
sqlite3 context-memory.db "SELECT COUNT(*) FROM conversations;"

# 対策:
# - 古い会話履歴のアーカイブ
# - データベースVACUUM実行
# - メモリ制限設定: node --max-old-space-size=512
```

### 5.2 ログ分析手順

#### エラーログ分析
```bash
# 1. 最新エラーの確認
tail -100 logs/error.log | grep -E "(ERROR|FATAL)"

# 2. 特定期間のエラー抽出
grep "$(date +%Y-%m-%d)" logs/error.log

# 3. エラーパターン分析
grep -E "(TypeError|ReferenceError|UnhandledPromiseRejection)" logs/error.log | sort | uniq -c

# 4. MCP通信エラー
grep "MCP\|protocol\|stdio" logs/error.log

# 5. データベースエラー
grep -i "sqlite\|database\|sql" logs/error.log
```

#### パフォーマンスログ分析
```bash
# 1. レスポンス時間分析
grep "response_time" logs/performance.log | awk '{print $NF}' | sort -n

# 2. 遅いクエリ特定
grep "slow_query" logs/performance.log

# 3. メモリ使用傾向
grep "memory_usage" logs/performance.log | tail -50

# 4. CPU使用率推移
grep "cpu_usage" logs/performance.log | tail -50
```

---

## 6. セキュリティ運用

### 6.1 セキュリティチェック

#### 定期セキュリティ監査（月次）
```bash
# 1. 依存関係脆弱性チェック
npm audit
npm audit fix --dry-run

# 2. APIキー漏洩チェック
grep -r "sk-\|cl-\|AIza" . --exclude-dir=node_modules --exclude-dir=.git
git log --grep="key\|secret\|password" -i

# 3. ファイル権限チェック
find . -name "*.db" -exec ls -la {} \;
find . -name "*.env*" -exec ls -la {} \;

# 4. 不審なファイル検出
find . -name "*.tmp" -o -name "*.temp" -o -name "core.*"

# 5. ネットワーク監視
netstat -tlnp | grep $(pgrep -f mcp)
```

#### API キー管理
```bash
# 開発環境
# .env ファイル使用（.gitignore済み）
echo "ANTHROPIC_API_KEY=your_dev_key" >> .env

# 本番環境
# 環境変数またはシークレット管理システム使用
export ANTHROPIC_API_KEY=$(aws secretsmanager get-secret-value --secret-id prod/anthropic-key --query SecretString --output text)

# キー有効性確認
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/messages
```

### 6.2 データ保護

#### 機密データ特定
```bash
# データベース内容監査
sqlite3 context-memory.db "
SELECT 
  table_name,
  COUNT(*) as record_count,
  'Contains conversation data' as data_type
FROM (
  SELECT 'contexts' as table_name FROM contexts
  UNION
  SELECT 'conversations' FROM conversations
  UNION  
  SELECT 'templates' FROM templates
);"

# 個人情報パターン検索
sqlite3 context-memory.db "
SELECT content 
FROM conversations 
WHERE content LIKE '%email%' 
   OR content LIKE '%phone%'
   OR content LIKE '%address%'
LIMIT 5;"
```

#### バックアップ暗号化
```bash
# 暗号化バックアップ作成
sqlite3 context-memory.db ".backup backup-$(date +%Y%m%d).db"
gpg --symmetric --cipher-algo AES256 backup-$(date +%Y%m%d).db
rm backup-$(date +%Y%m%d).db

# 復号化・リストア
gpg --decrypt backup-YYYYMMDD.db.gpg > restored.db
sqlite3 restored.db "PRAGMA integrity_check;"
```

---

## 7. 監視・ログ管理

### 7.1 ログ設定

#### ログレベル設定
```bash
# 環境別ログレベル
export LOG_LEVEL=debug    # 開発環境
export LOG_LEVEL=info     # ステージング環境  
export LOG_LEVEL=warn     # 本番環境
export LOG_LEVEL=error    # 本番環境（最小）
```

#### ログローテーション設定
```bash
# logrotate 設定（/etc/logrotate.d/mcp-llm-generator）
/home/mako10k/mcp-sampler/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 mako10k mako10k
    postrotate
        # MCP サーバー再起動不要（ファイルハンドル再オープン対応済み）
    endscript
}
```

### 7.2 システム監視

#### ヘルスチェック
```bash
#!/bin/bash
# health-check.sh

# プロセス存在確認
if ! pgrep -f "mcp-llm-generator" > /dev/null; then
    echo "ERROR: MCP LLM Generator process not found"
    exit 1
fi

# データベース接続確認
if ! sqlite3 context-memory.db "SELECT 1;" > /dev/null 2>&1; then
    echo "ERROR: Database connection failed"
    exit 1
fi

# ディスク容量確認（80%以下）
disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 80 ]; then
    echo "WARNING: Disk usage ${disk_usage}%"
    exit 1
fi

echo "OK: All systems healthy"
exit 0
```

#### アラート設定
```bash
# crontab 設定
# 5分間隔でヘルスチェック
*/5 * * * * /home/mako10k/mcp-sampler/scripts/health-check.sh || logger "MCP Health Check Failed"

# 日次レポート
0 9 * * * /home/mako10k/mcp-sampler/scripts/daily-report.sh
```

---

## 8. 緊急時対応

### 8.1 緊急停止手順

#### システム緊急停止
```bash
# 1. 即座に全MCPプロセス停止
pkill -TERM -f "mcp-llm-generator"
sleep 5
pkill -KILL -f "mcp-llm-generator"

# 2. データベース整合性確保
sqlite3 context-memory.db "PRAGMA wal_checkpoint(FULL);"

# 3. ログ記録
echo "$(date): Emergency shutdown executed" >> logs/emergency.log

# 4. バックアップ作成
cp context-memory.db emergency-backup-$(date +%Y%m%d_%H%M%S).db
```

### 8.2 災害復旧手順

#### システム復旧
```bash
# 1. 環境確認
node --version
npm --version
which sqlite3

# 2. ソースコード復旧
git status
git stash  # 未保存変更があれば
git checkout main
git pull origin main

# 3. 依存関係復旧
rm -rf node_modules
npm install

# 4. データベース復旧
sqlite3 context-memory.db "PRAGMA integrity_check;"
# 破損している場合は最新バックアップからリストア

# 5. 段階的起動
npm run build
npm run test  # テストがあれば実行
npm start

# 6. 動作確認
npx @modelcontextprotocol/inspector node build/index.js
```

### 8.3 連絡体制

#### エスカレーション
1. **Level 1**: 自動復旧スクリプト実行
2. **Level 2**: 開発者通知（Slack/Discord）
3. **Level 3**: 管理者呼び出し（電話）
4. **Level 4**: ベンダー問い合わせ

#### 重要連絡先
- **技術責任者**: [連絡先情報]
- **GitHub Issues**: https://github.com/mako10k/mcp-sampler/issues
- **MCP Community**: https://github.com/modelcontextprotocol

---

## 📞 サポート情報

### ドキュメント
- **システムアーキテクチャ**: `docs/system-architecture.md`
- **API リファレンス**: `docs/API.md`
- **コンテキストメモリ設計**: `docs/context-memory-design.md`

### コミュニティリソース
- **GitHub**: https://github.com/mako10k/mcp-sampler
- **Issues**: バグ報告・機能要求
- **Discussions**: 技術的な質問・議論

### 更新履歴
- **v2.0.0**: コンテキストメモリ・連想記憶機能追加
- **v1.x**: 基本MCP機能・テンプレートシステム

---

**最終更新**: 2025年7月19日  
**文書バージョン**: 1.0.0  
**対象システム**: MCP LLM Generator v2
