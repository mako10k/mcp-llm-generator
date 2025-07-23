#!/bin/bash

# MCP Inspector CLI 自動テストスクリプト
# GitHub公式仕様に基づいた正しい方法でテスト実施

set -e  # エラー時に終了

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/mcp-inspector-cli-test-$(date +%Y%m%d-%H%M%S).log"
EVIDENCE_FILE="$PROJECT_ROOT/test-evidence-mcp-inspector.log"

# ログディレクトリ作成
mkdir -p "$PROJECT_ROOT/logs"

echo "=== MCP Inspector CLI 自動テスト開始 ===" | tee -a "$LOG_FILE"
echo "開始時刻: $(date)" | tee -a "$LOG_FILE"
echo "プロジェクトルート: $PROJECT_ROOT" | tee -a "$LOG_FILE"
echo "ログファイル: $LOG_FILE" | tee -a "$LOG_FILE"

# 現在のポート使用状況確認
echo "" | tee -a "$LOG_FILE"
echo "=== ポート使用状況確認 ===" | tee -a "$LOG_FILE"
netstat -tuln | grep -E ":(6274|6275|6277|6278)" | tee -a "$LOG_FILE" || echo "対象ポートは空いています" | tee -a "$LOG_FILE"

# ビルド確認
echo "" | tee -a "$LOG_FILE"
echo "=== ビルドファイル確認 ===" | tee -a "$LOG_FILE"
if [ -f "$PROJECT_ROOT/build/src/index.js" ]; then
    echo "✅ build/src/index.js が存在します" | tee -a "$LOG_FILE"
    ls -la "$PROJECT_ROOT/build/src/index.js" | tee -a "$LOG_FILE"
else
    echo "❌ build/src/index.js が見つかりません" | tee -a "$LOG_FILE"
    echo "ビルドを実行します..." | tee -a "$LOG_FILE"
    cd "$PROJECT_ROOT"
    npm run build | tee -a "$LOG_FILE"
fi

# MCP Inspector CLIテスト用設定ファイル作成
echo "" | tee -a "$LOG_FILE"
echo "=== MCP Inspector設定ファイル作成 ===" | tee -a "$LOG_FILE"
MCP_CONFIG_FILE="$PROJECT_ROOT/mcp-inspector-test-config.json"
cat > "$MCP_CONFIG_FILE" << 'EOF'
{
  "mcpServers": {
    "mcp-sampler": {
      "command": "node",
      "args": ["build/src/index.js"]
    }
  }
}
EOF
echo "✅ 設定ファイル作成: $MCP_CONFIG_FILE" | tee -a "$LOG_FILE"
cat "$MCP_CONFIG_FILE" | tee -a "$LOG_FILE"

# ポート競合回避設定
CLIENT_PORT=${CLIENT_PORT:-6275}
PROXY_PORT=${PROXY_PORT:-6278}

echo "" | tee -a "$LOG_FILE"
echo "=== テスト環境設定 ===" | tee -a "$LOG_FILE"
echo "CLIENT_PORT: $CLIENT_PORT" | tee -a "$LOG_FILE"
echo "PROXY_PORT: $PROXY_PORT" | tee -a "$LOG_FILE"

# ワーキングディレクトリ移動
cd "$PROJECT_ROOT"

# テスト関数
run_mcp_test() {
    local test_name="$1"
    local cli_command="$2"
    
    echo "" | tee -a "$LOG_FILE"
    echo "=== テスト: $test_name ===" | tee -a "$LOG_FILE"
    echo "実行コマンド: $cli_command" | tee -a "$LOG_FILE"
    
    # タイムアウト付きでコマンド実行
    if timeout 30s bash -c "$cli_command" 2>&1 | tee -a "$LOG_FILE"; then
        echo "✅ $test_name: 成功" | tee -a "$LOG_FILE"
        return 0
    else
        local exit_code=$?
        echo "❌ $test_name: 失敗 (exit code: $exit_code)" | tee -a "$LOG_FILE"
        return $exit_code
    fi
}

# テスト実行
echo "" | tee -a "$LOG_FILE"
echo "=== MCP Inspector CLI テスト実行 ===" | tee -a "$LOG_FILE"

# 1. バージョン確認
run_mcp_test "バージョン確認" "CLIENT_PORT=$CLIENT_PORT PROXY_PORT=$PROXY_PORT npx @modelcontextprotocol/inspector --version"

# 2. ヘルプ表示
run_mcp_test "ヘルプ表示" "CLIENT_PORT=$CLIENT_PORT PROXY_PORT=$PROXY_PORT npx @modelcontextprotocol/inspector --help"

# 3. 基本CLI接続テスト（設定ファイル使用）
run_mcp_test "CLI接続テスト（設定ファイル）" "CLIENT_PORT=$CLIENT_PORT PROXY_PORT=$PROXY_PORT npx @modelcontextprotocol/inspector --cli --config $MCP_CONFIG_FILE --server mcp-sampler"

# 4. 直接コマンド指定によるCLI接続テスト
run_mcp_test "CLI接続テスト（直接指定）" "CLIENT_PORT=$CLIENT_PORT PROXY_PORT=$PROXY_PORT npx @modelcontextprotocol/inspector --cli node build/src/index.js"

# 5. ツール一覧取得テスト
run_mcp_test "ツール一覧取得" "CLIENT_PORT=$CLIENT_PORT PROXY_PORT=$PROXY_PORT npx @modelcontextprotocol/inspector --cli node build/src/index.js --method tools/list"

# 6. リソース一覧取得テスト
run_mcp_test "リソース一覧取得" "CLIENT_PORT=$CLIENT_PORT PROXY_PORT=$PROXY_PORT npx @modelcontextprotocol/inspector --cli node build/src/index.js --method resources/list"

# 7. プロンプト一覧取得テスト
run_mcp_test "プロンプト一覧取得" "CLIENT_PORT=$CLIENT_PORT PROXY_PORT=$PROXY_PORT npx @modelcontextprotocol/inspector --cli node build/src/index.js --method prompts/list"

# SharedMemoryツール固有テスト
echo "" | tee -a "$LOG_FILE"
echo "=== SharedMemoryツール機能テスト ===" | tee -a "$LOG_FILE"

# 8. shared-memory-createツールテスト
run_mcp_test "SharedMemory作成テスト" "CLIENT_PORT=$CLIENT_PORT PROXY_PORT=$PROXY_PORT npx @modelcontextprotocol/inspector --cli node build/src/index.js --method tools/call --tool-name shared-memory-create --tool-arg title=\"テストメモリ\" --tool-arg content=\"テスト内容\""

# 9. shared-memory-searchツールテスト
run_mcp_test "SharedMemory検索テスト" "CLIENT_PORT=$CLIENT_PORT PROXY_PORT=$PROXY_PORT npx @modelcontextprotocol/inspector --cli node build/src/index.js --method tools/call --tool-name shared-memory-search --tool-arg query=\"テスト\""

# エビデンス収集
echo "" | tee -a "$LOG_FILE"
echo "=== エビデンス収集 ===" | tee -a "$LOG_FILE"

# ログをエビデンスファイルにコピー
cp "$LOG_FILE" "$EVIDENCE_FILE"

# システム情報追加
echo "" | tee -a "$EVIDENCE_FILE"
echo "=== システム情報 ===" | tee -a "$EVIDENCE_FILE"
echo "OS: $(uname -a)" | tee -a "$EVIDENCE_FILE"
echo "Node.js: $(node --version)" | tee -a "$EVIDENCE_FILE"
echo "npm: $(npm --version)" | tee -a "$EVIDENCE_FILE"
echo "プロジェクト情報:" | tee -a "$EVIDENCE_FILE"
grep -E "\"name\"|\"version\"" "$PROJECT_ROOT/package.json" | tee -a "$EVIDENCE_FILE"

echo "" | tee -a "$LOG_FILE"
echo "=== MCP Inspector CLI 自動テスト完了 ===" | tee -a "$LOG_FILE"
echo "完了時刻: $(date)" | tee -a "$LOG_FILE"
echo "エビデンスファイル: $EVIDENCE_FILE" | tee -a "$LOG_FILE"

echo ""
echo "🟢 MCP Inspector CLI自動テストが完了しました"
echo "📄 ログファイル: $LOG_FILE"
echo "📄 エビデンスファイル: $EVIDENCE_FILE"
echo ""
echo "ログ内容確認: cat $LOG_FILE"
echo "エビデンス確認: cat $EVIDENCE_FILE"
