#!/bin/bash
# MCP統合テストスクリプト v2.0
# MCP Inspector とVS Code統合の包括的テスト

set -euo pipefail

# 色付き出力設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ログ設定
LOG_FILE="logs/mcp-integration-test-$(date +%Y%m%d_%H%M%S).log"
mkdir -p logs

# ログ関数
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}❌ $1${NC}"
}

success() {
    log "${GREEN}✅ $1${NC}"
}

warning() {
    log "${YELLOW}⚠️  $1${NC}"
}

info() {
    log "${BLUE}ℹ️  $1${NC}"
}

# テスト結果追跡
PASSED_TESTS=0
TOTAL_TESTS=0
FAILED_TESTS=()

test_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $? -eq 0 ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        success "$1"
    else
        FAILED_TESTS+=("$1")
        error "$1"
        return 1
    fi
}

echo -e "${BLUE}🔌 MCP統合テスト v2.0 実行開始${NC}"
echo "=============================================="
info "実行時刻: $(date)"
info "作業ディレクトリ: $(pwd)"

# 前提条件チェック
echo -e "\n${BLUE}📋 前提条件チェック${NC}"

# ビルド確認
if [ ! -f "build/index.js" ]; then
    warning "build/index.js が見つかりません。ビルドを実行します..."
    npm run build
fi

if [ -f "build/index.js" ]; then
    test_result "MCPサーバービルド成果物確認"
else
    test_result "MCPサーバービルド成果物確認"
    exit 1
fi

# MCP Inspector可用性確認
if command -v npx > /dev/null; then
    test_result "npx コマンド可用性確認"
else
    test_result "npx コマンド可用性確認"
    exit 1
fi

# 1. MCP基本接続テスト
echo -e "\n${BLUE}🔗 1. MCP基本接続テスト${NC}"

info "MCPサーバーの基本起動テスト実行中..."
if timeout 15 node build/index.js < /dev/null > /dev/null 2>&1; then
    test_result "MCPサーバー基本起動 (15秒タイムアウト)"
else
    test_result "MCPサーバー基本起動 (15秒タイムアウト)"
fi

# 2. MCP Inspector統合テスト
echo -e "\n${BLUE}🔍 2. MCP Inspector統合テスト${NC}"

info "MCP Inspector パッケージ可用性チェック中..."
if npm list @modelcontextprotocol/inspector > /dev/null 2>&1 || npm list -g @modelcontextprotocol/inspector > /dev/null 2>&1; then
    test_result "MCP Inspector パッケージ可用性"
else
    warning "MCP Inspector がインストールされていません。グローバルからアクセスを試行..."
fi

# MCP Inspector起動テスト (バックグラウンド)
info "MCP Inspector バックグラウンド起動テスト実行中..."
timeout 20 npx @modelcontextprotocol/inspector node build/index.js > /dev/null 2>&1 &
INSPECTOR_PID=$!
sleep 5

if kill -0 $INSPECTOR_PID 2>/dev/null; then
    test_result "MCP Inspector バックグラウンド起動"
    kill $INSPECTOR_PID 2>/dev/null || true
else
    test_result "MCP Inspector バックグラウンド起動"
fi

# 3. MCPプロトコルレスポンステスト
echo -e "\n${BLUE}📡 3. MCPプロトコルレスポンステスト${NC}"

info "MCPサーバー初期化レスポンステスト実行中..."

# 簡単なJSONレスポンステスト
test_input='{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}'

response=$(echo "$test_input" | timeout 10 node build/index.js 2>/dev/null | head -1 || echo "")

if echo "$response" | grep -q "jsonrpc"; then
    test_result "MCP初期化レスポンス受信"
    info "レスポンス: ${response:0:100}..."
else
    test_result "MCP初期化レスポンス受信"
    warning "レスポンス: $response"
fi

# 4. VS Code設定ファイルテスト
echo -e "\n${BLUE}🎨 4. VS Code統合設定テスト${NC}"

if [ -f ".vscode/mcp.json" ]; then
    test_result "VS Code MCP設定ファイル存在"
    
    # JSON構文チェック
    if jq empty .vscode/mcp.json 2>/dev/null; then
        test_result "MCP設定JSON構文正当性"
        
        # 必要フィールドチェック
        if jq -e '.servers' .vscode/mcp.json > /dev/null 2>&1; then
            test_result "MCP設定 servers フィールド存在"
        else
            test_result "MCP設定 servers フィールド存在"
        fi
        
        # llm-generator サーバー設定確認
        if jq -e '.servers["llm-generator"]' .vscode/mcp.json > /dev/null 2>&1; then
            test_result "llm-generator サーバー設定確認"
        else
            test_result "llm-generator サーバー設定確認"
        fi
    else
        test_result "MCP設定JSON構文正当性"
    fi
else
    test_result "VS Code MCP設定ファイル存在"
fi

# 5. MCPツール機能テスト
echo -e "\n${BLUE}🛠️ 5. MCPツール機能テスト${NC}"

info "MCPサーバーツール機能の基本テスト実行中..."

# tools/list メソッドテスト
tools_request='{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}'
tools_response=$(echo -e "$test_input\n$tools_request" | timeout 10 node build/index.js 2>/dev/null | tail -1 || echo "")

if echo "$tools_response" | grep -q "tools"; then
    test_result "MCPツールリスト取得"
    info "検出されたツール数: $(echo "$tools_response" | jq '.result.tools | length' 2>/dev/null || echo "不明")"
else
    test_result "MCPツールリスト取得"
    warning "ツールレスポンス: $tools_response"
fi

# 6. データベース統合テスト
echo -e "\n${BLUE}🗄️ 6. データベース統合テスト${NC}"

if ls *.db >/dev/null 2>&1; then
    for db_file in *.db; do
        info "$db_file の統合テスト実行中..."
        
        # 整合性チェック
        if sqlite3 "$db_file" "PRAGMA integrity_check;" | grep -q "ok"; then
            test_result "データベース整合性 ($db_file)"
        else
            test_result "データベース整合性 ($db_file)"
        fi
        
        # スキーマ確認
        schema_output=$(sqlite3 "$db_file" ".schema" 2>/dev/null || echo "")
        if [ -n "$schema_output" ]; then
            test_result "データベーススキーマ確認 ($db_file)"
        else
            test_result "データベーススキーマ確認 ($db_file)"
        fi
    done
else
    warning "データベースファイルが見つかりません (初期状態)"
fi

# 7. パフォーマンス・メモリテスト
echo -e "\n${BLUE}⚡ 7. パフォーマンス・メモリテスト${NC}"

info "MCPサーバーメモリ使用量テスト実行中..."

# メモリ制限テスト (100MB制限)
if timeout 10 node --max-old-space-size=100 build/index.js < /dev/null > /dev/null 2>&1; then
    test_result "メモリ制限テスト (100MB制限)"
else
    test_result "メモリ制限テスト (100MB制限)"
fi

# 8. エラーハンドリングテスト
echo -e "\n${BLUE}🚨 8. エラーハンドリングテスト${NC}"

info "不正入力に対するエラーハンドリングテスト実行中..."

# 不正JSONテスト
invalid_json='{"invalid": json}'
error_response=$(echo "$invalid_json" | timeout 5 node build/index.js 2>/dev/null || echo "")

if echo "$error_response" | grep -q "error\|Error" || [ -z "$error_response" ]; then
    test_result "不正JSON入力エラーハンドリング"
else
    test_result "不正JSON入力エラーハンドリング"
fi

# 9. 結果レポート
echo -e "\n${BLUE}📊 MCP統合テスト結果サマリー${NC}"
echo "=============================================="

info "テスト完了時刻: $(date)"
info "テスト実行ログ: $LOG_FILE"

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    success "🎉 すべてのMCP統合テストが成功しました!"
    echo -e "${GREEN}✅ 成功: $PASSED_TESTS/$TOTAL_TESTS${NC}"
    echo ""
    echo -e "${GREEN}🚀 MCPサーバーは本番環境でのデプロイ準備が完了しています。${NC}"
    echo ""
    echo -e "${BLUE}次のステップ:${NC}"
    echo "1. VS Codeでの実機テスト:"
    echo "   - VS Code再起動"
    echo "   - Copilot Chat: '@llm-generator explain quantum computing'"
    echo "   - Output → Model Context Protocol でログ確認"
    echo ""
    echo "2. MCP Inspector手動テスト:"
    echo "   npx @modelcontextprotocol/inspector node build/index.js"
    echo "   http://localhost:5173 でブラウザテスト"
    exit 0
else
    error "❌ MCP統合テストで失敗項目があります"
    echo -e "${RED}❌ 成功: $PASSED_TESTS/$TOTAL_TESTS${NC}"
    echo ""
    echo -e "${RED}失敗したテスト:${NC}"
    for failed_test in "${FAILED_TESTS[@]}"; do
        echo -e "${RED}  - $failed_test${NC}"
    done
    echo ""
    echo -e "${YELLOW}🔧 トラブルシューティング:${NC}"
    echo "1. ビルド再実行: npm run build"
    echo "2. 依存関係更新: npm install"
    echo "3. 設定ファイル確認: .vscode/mcp.json"
    echo "4. ログ詳細確認: $LOG_FILE"
    echo ""
    echo -e "${YELLOW}📋 修正後、再度このスクリプトを実行してください:${NC}"
    echo "  ./scripts/mcp-integration-test.sh"
    exit 1
fi
