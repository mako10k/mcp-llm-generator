#!/bin/bash

# 影響度分析自動化スクリプト
# ファイル変更に対する影響範囲を体系的に分析

set -euo pipefail

echo "🔍 モジュール影響度分析を開始..."

# 1. 依存関係グラフ生成
echo "📊 依存関係グラフ生成中..."
npx madge --image dependency-graph.svg src/ || echo "Warning: madge image generation failed"
npx madge --json src/ > dependency-analysis.json

# 2. 設定ファイル整合性チェック
echo "🔧 設定ファイル整合性チェック..."

CONFIG_ISSUES=""

# package.json main フィールドチェック
PACKAGE_MAIN=$(jq -r '.main' package.json)
if [ ! -f "$PACKAGE_MAIN" ]; then
    CONFIG_ISSUES="${CONFIG_ISSUES}\n❌ package.json main: $PACKAGE_MAIN (存在しません)"
else
    echo "✅ package.json main: $PACKAGE_MAIN (存在)"
fi

# mcp.json パスチェック
if [ -f ".vscode/mcp.json" ]; then
    LLM_GEN_PATH=$(jq -r '.servers["llm-generator"].args[0]' .vscode/mcp.json 2>/dev/null || echo "")
    if [ -n "$LLM_GEN_PATH" ] && [ "$LLM_GEN_PATH" != "null" ]; then
        # 変数展開をシミュレート
        RESOLVED_PATH=$(echo "$LLM_GEN_PATH" | sed "s|\${workspaceFolder}|$(pwd)|g")
        if [ ! -f "$RESOLVED_PATH" ]; then
            CONFIG_ISSUES="${CONFIG_ISSUES}\n❌ mcp.json llm-generator: $LLM_GEN_PATH → $RESOLVED_PATH (存在しません)"
        else
            echo "✅ mcp.json llm-generator: $RESOLVED_PATH (存在)"
        fi
    fi
fi

# 3. ビルド成果物チェック
echo "🏗️ ビルド成果物チェック..."
if [ -f "build/index.js" ]; then
    echo "✅ build/index.js 存在"
else
    CONFIG_ISSUES="${CONFIG_ISSUES}\n❌ build/index.js 存在しません"
fi

if [ -f "build-production/index.js" ]; then
    echo "✅ build-production/index.js 存在"
else
    CONFIG_ISSUES="${CONFIG_ISSUES}\n❌ build-production/index.js 存在しません"
fi

# 4. 影響範囲分析結果
echo ""
echo "📋 影響度分析結果:"
echo "===================="

if [ -n "$CONFIG_ISSUES" ]; then
    echo -e "\n🚨 設定ファイル問題:"
    echo -e "$CONFIG_ISSUES"
else
    echo "✅ 設定ファイル: 整合性OK"
fi

# 5. 推奨アクション
echo ""
echo "💡 推奨アクション:"
echo "=================="
echo "1. 設定ファイルの不整合を修正"
echo "2. 依存関係グラフを確認 (dependency-analysis.json)"
echo "3. 変更前後の影響範囲をテスト計画に反映"
echo "4. QAレビューを実施"

# 6. テストカバレッジ分析 (jest設定がある場合)
if [ -f "jest.config.json" ]; then
    echo ""
    echo "🧪 テストカバレッジ分析準備..."
    echo "npm test -- --coverage でカバレッジ確認を実施してください"
fi

echo ""
echo "🔍 影響度分析完了"
