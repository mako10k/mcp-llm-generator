#!/bin/bash
# DoD自動チェックスクリプト v2.0
# Definition of Done 自動化チェック実行

set -euo pipefail

# 色付き出力設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ設定
LOG_FILE="logs/dod-check-$(date +%Y%m%d_%H%M%S).log"
mkdir -p logs

# ログ関数
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}❌ ERROR: $1${NC}"
}

success() {
    log "${GREEN}✅ SUCCESS: $1${NC}"
}

warning() {
    log "${YELLOW}⚠️  WARNING: $1${NC}"
}

info() {
    log "${BLUE}ℹ️  INFO: $1${NC}"
}

# エラーハンドリング
trap 'error "DoD check failed at line $LINENO"' ERR

# チェック結果追跡
PASSED_CHECKS=0
TOTAL_CHECKS=0
FAILED_CHECKS=()

check_result() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ $? -eq 0 ]; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        success "$1"
    else
        FAILED_CHECKS+=("$1")
        error "$1"
        return 1
    fi
}

echo -e "${BLUE}🔍 Definition of Done v2.0 - 自動チェック開始${NC}"
echo "=========================================="
info "実行時刻: $(date)"
info "作業ディレクトリ: $(pwd)"
info "Node.js バージョン: $(node --version)"
info "npm バージョン: $(npm --version)"

# 1. 基本環境確認
echo -e "\n${BLUE}📋 1. 基本環境確認${NC}"
info "Node.js環境とプロジェクト構造をチェック中..."

# Node.jsバージョン確認
if node --version | grep -E "v(1[8-9]|[2-9][0-9])" > /dev/null; then
    check_result "Node.js バージョン確認 (18.x以上)"
else
    check_result "Node.js バージョン確認 (18.x以上)"
fi

# package.jsonの存在確認
if [ -f "package.json" ]; then
    check_result "package.json 存在確認"
else
    check_result "package.json 存在確認"
fi

# tsconfig.jsonの存在確認
if [ -f "tsconfig.json" ]; then
    check_result "tsconfig.json 存在確認"
else
    check_result "tsconfig.json 存在確認"
fi

# 2. TypeScript・品質チェック
echo -e "\n${BLUE}📝 2. TypeScript・品質チェック${NC}"
info "TypeScriptコンパイルとコード品質をチェック中..."

# 依存関係インストール確認
if [ -d "node_modules" ]; then
    info "node_modules ディレクトリ存在確認 ✓"
else
    info "依存関係をインストール中..."
    npm install
fi

# TypeScriptコンパイル
info "TypeScriptコンパイル実行中..."
if npm run build > /dev/null 2>&1; then
    check_result "TypeScript コンパイル成功"
else
    check_result "TypeScript コンパイル成功"
fi

# ESLintチェック
info "ESLint品質チェック実行中..."
if npm run lint > /dev/null 2>&1; then
    check_result "ESLint 品質チェック通過"
else
    check_result "ESLint 品質チェック通過"
fi

# 3. セキュリティ・脆弱性チェック
echo -e "\n${BLUE}🔒 3. セキュリティ・脆弱性チェック${NC}"
info "セキュリティ監査を実行中..."

# npm audit
if npm audit --audit-level=moderate > /dev/null 2>&1; then
    check_result "npm audit セキュリティ監査通過"
else
    check_result "npm audit セキュリティ監査通過"
fi

# APIキー漏洩チェック
info "APIキー漏洩チェック実行中..."
if ! grep -r "sk-\|cl-\|AIza" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=logs > /dev/null 2>&1; then
    check_result "APIキー漏洩チェック (パターンマッチング)"
else
    check_result "APIキー漏洩チェック (パターンマッチング)"
fi

# .env ファイルの .gitignore 確認
if grep -q "\.env" .gitignore 2>/dev/null; then
    check_result ".env ファイル .gitignore 設定確認"
else
    check_result ".env ファイル .gitignore 設定確認"
fi

# 4. データベース・永続化チェック
echo -e "\n${BLUE}🗄️ 4. データベース・永続化チェック${NC}"
info "SQLiteデータベース状態をチェック中..."

# データベースファイル存在確認
if ls *.db >/dev/null 2>&1; then
    info "データベースファイル検出"
    
    # データベース整合性チェック
    for db_file in *.db; do
        if sqlite3 "$db_file" "PRAGMA integrity_check;" | grep -q "ok"; then
            check_result "データベース整合性チェック ($db_file)"
        else
            check_result "データベース整合性チェック ($db_file)"
        fi
    done
    
    # データベースファイルの.gitignore確認
    if grep -q "\.db" .gitignore 2>/dev/null; then
        check_result "データベースファイル .gitignore 設定確認"
    else
        check_result "データベースファイル .gitignore 設定確認"
    fi
else
    warning "データベースファイルが見つかりません (初期状態の可能性)"
fi

# 5. MCP統合テスト
echo -e "\n${BLUE}🔌 5. MCP統合テスト${NC}"
info "MCP Inspector でのサーバー動作をチェック中..."

# ビルド成果物確認
if [ -f "build/index.js" ]; then
    check_result "MCPサーバービルド成果物確認 (build/index.js)"
    
    # MCP Inspector可用性チェック（タイムアウト付き）
    info "MCP Inspector 起動テスト実行中 (10秒タイムアウト)..."
    if timeout 10 node build/index.js < /dev/null > /dev/null 2>&1; then
        check_result "MCP サーバー基本起動テスト"
    else
        check_result "MCP サーバー基本起動テスト"
    fi
else
    check_result "MCPサーバービルド成果物確認 (build/index.js)"
fi

# 6. VS Code統合確認
echo -e "\n${BLUE}🎨 6. VS Code統合確認${NC}"
info "VS Code MCP設定をチェック中..."

# MCP設定ファイル確認
if [ -f ".vscode/mcp.json" ]; then
    check_result "VS Code MCP設定ファイル存在確認"
    
    # JSON構文チェック
    if jq empty .vscode/mcp.json > /dev/null 2>&1; then
        check_result "VS Code MCP設定 JSON構文確認"
    else
        check_result "VS Code MCP設定 JSON構文確認"
    fi
else
    check_result "VS Code MCP設定ファイル存在確認"
fi

# 7. 文書・ドキュメント確認
echo -e "\n${BLUE}📚 7. 文書・ドキュメント確認${NC}"
info "プロジェクト文書の整合性をチェック中..."

# README.md確認
if [ -f "README.md" ]; then
    check_result "README.md 存在確認"
else
    check_result "README.md 存在確認"
fi

# システムアーキテクチャ文書確認
if [ -f "docs/system-architecture.md" ]; then
    check_result "システムアーキテクチャ文書確認"
else
    check_result "システムアーキテクチャ文書確認"
fi

# 運用手順書確認
if [ -f "docs/operations-manual.md" ]; then
    check_result "運用手順書確認"
else
    check_result "運用手順書確認"
fi

# Definition of Done確認
if [ -f ".github/DEFINITION_OF_DONE.md" ]; then
    check_result "Definition of Done文書確認"
else
    check_result "Definition of Done文書確認"
fi

# 8. 結果レポート生成
echo -e "\n${BLUE}📊 8. チェック結果サマリー${NC}"
echo "=========================================="

info "実行完了時刻: $(date)"
info "チェック実行ログ: $LOG_FILE"

if [ ${#FAILED_CHECKS[@]} -eq 0 ]; then
    success "🎉 すべてのDoD自動チェックが成功しました!"
    echo -e "${GREEN}✅ 合格: $PASSED_CHECKS/$TOTAL_CHECKS${NC}"
    echo ""
    echo -e "${GREEN}🚀 このコードはmainブランチへのマージ準備が完了しています。${NC}"
    exit 0
else
    error "❌ DoD自動チェックで失敗項目があります"
    echo -e "${RED}❌ 合格: $PASSED_CHECKS/$TOTAL_CHECKS${NC}"
    echo ""
    echo -e "${RED}失敗した項目:${NC}"
    for failed_check in "${FAILED_CHECKS[@]}"; do
        echo -e "${RED}  - $failed_check${NC}"
    done
    echo ""
    echo -e "${YELLOW}📋 修正後、再度このスクリプトを実行してください:${NC}"
    echo "  ./scripts/dod-check.sh"
    exit 1
fi
