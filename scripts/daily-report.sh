#!/bin/bash
# Sprint4 Phase 2: 日次レポートスクリプト
# daily-report.sh - システム運用の包括的レポート生成

set -euo pipefail

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$PROJECT_DIR/logs/reports"
REPORT_DATE=$(date '+%Y-%m-%d')
REPORT_FILE="$REPORT_DIR/daily-report-$REPORT_DATE.md"
JSON_REPORT="$REPORT_DIR/daily-report-$REPORT_DATE.json"
ALERT_THRESHOLD_ERROR=50

# 初期化
init_report() {
    mkdir -p "$REPORT_DIR"
    cd "$PROJECT_DIR"
    
    echo "# 📊 MCP LLM Generator 日次運用レポート" > "$REPORT_FILE"
    echo "**生成日時**: $(date '+%Y年%m月%d日 %H:%M:%S')" >> "$REPORT_FILE"
    echo "**プロジェクト**: $PROJECT_DIR" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # JSON初期化
    cat > "$JSON_REPORT" << EOF
{
  "reportDate": "$REPORT_DATE",
  "generatedAt": "$(date -Iseconds)",
  "projectPath": "$PROJECT_DIR",
  "summary": {},
  "metrics": {},
  "alerts": [],
  "recommendations": []
}
EOF
    
    echo "📋 日次レポート生成開始: $REPORT_DATE"
}

# JSON更新関数
update_json() {
    local key="$1"
    local value="$2"
    local temp_file
    temp_file=$(mktemp)
    
    jq --arg key "$key" --argjson value "$value" '.metrics[$key] = $value' "$JSON_REPORT" > "$temp_file"
    mv "$temp_file" "$JSON_REPORT"
}

add_alert() {
    local level="$1"
    local message="$2"
    local temp_file
    temp_file=$(mktemp)
    
    jq --arg level "$level" --arg message "$message" \
       '.alerts += [{"level": $level, "message": $message, "timestamp": now | strftime("%Y-%m-%d %H:%M:%S")}]' \
       "$JSON_REPORT" > "$temp_file"
    mv "$temp_file" "$JSON_REPORT"
}

# システム概要レポート
report_system_overview() {
    echo "## 🖥️ システム概要" >> "$REPORT_FILE"
    
    # OS情報
    if command -v lsb_release >/dev/null 2>&1; then
        local os_info
        os_info=$(lsb_release -d | cut -f2)
        echo "- **OS**: $os_info" >> "$REPORT_FILE"
    fi
    
    # アップタイム
    local uptime_info
    uptime_info=$(uptime -p 2>/dev/null || uptime)
    echo "- **アップタイム**: $uptime_info" >> "$REPORT_FILE"
    
    # Node.jsバージョン
    if command -v node >/dev/null 2>&1; then
        local node_version
        node_version=$(node --version)
        echo "- **Node.js**: $node_version" >> "$REPORT_FILE"
        update_json "nodeVersion" "\"$node_version\""
    fi
    
    # プロジェクト情報
    if [[ -f "package.json" ]]; then
        local project_version
        project_version=$(jq -r '.version // "unknown"' package.json)
        echo "- **プロジェクトバージョン**: $project_version" >> "$REPORT_FILE"
        update_json "projectVersion" "\"$project_version\""
    fi
    
    echo "" >> "$REPORT_FILE"
}

# リソース使用状況レポート
report_resource_usage() {
    echo "## 📈 リソース使用状況" >> "$REPORT_FILE"
    
    # CPU使用率（1分平均）
    local cpu_load
    if command -v uptime >/dev/null 2>&1; then
        cpu_load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        echo "- **CPU負荷平均 (1分)**: $cpu_load" >> "$REPORT_FILE"
        update_json "cpuLoad1min" "$cpu_load"
        
        if (( $(echo "$cpu_load > 2.0" | bc -l) )); then
            add_alert "WARNING" "高CPU負荷: $cpu_load"
        fi
    fi
    
    # メモリ使用量
    if command -v free >/dev/null 2>&1; then
        local mem_total mem_used mem_free mem_usage_percent
        eval "$(free -m | awk 'NR==2{printf "mem_total=%s; mem_used=%s; mem_free=%s", $2, $3, $4}')"
        mem_usage_percent=$(echo "scale=1; $mem_used * 100 / $mem_total" | bc -l)
        
        echo "- **メモリ使用量**: ${mem_used}MB / ${mem_total}MB (${mem_usage_percent}%)" >> "$REPORT_FILE"
        update_json "memoryUsedMB" "$mem_used"
        update_json "memoryTotalMB" "$mem_total"
        update_json "memoryUsagePercent" "$mem_usage_percent"
        
        if (( $(echo "$mem_usage_percent > 80" | bc -l) )); then
            add_alert "WARNING" "高メモリ使用率: ${mem_usage_percent}%"
        fi
    fi
    
    # ディスク使用量
    local disk_usage disk_avail
    eval "$(df -h "$PROJECT_DIR" | awk 'NR==2{printf "disk_usage=%s; disk_avail=%s", $5, $4}')"
    echo "- **ディスク使用量**: $disk_usage (利用可能: $disk_avail)" >> "$REPORT_FILE"
    
    local disk_usage_num
    disk_usage_num=$(echo "$disk_usage" | sed 's/%//')
    update_json "diskUsagePercent" "$disk_usage_num"
    
    if [[ $disk_usage_num -gt 80 ]]; then
        add_alert "WARNING" "高ディスク使用率: $disk_usage"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# プロセス状況レポート
report_process_status() {
    echo "## 🔄 プロセス状況" >> "$REPORT_FILE"
    
    # MCPプロセス確認
    local mcp_pids
    mcp_pids=$(pgrep -f "mcp-llm-generator\|build/index.js" 2>/dev/null || true)
    
    if [[ -n "$mcp_pids" ]]; then
        local process_count
        process_count=$(echo "$mcp_pids" | wc -l)
        echo "- **MCPプロセス数**: $process_count" >> "$REPORT_FILE"
        update_json "mcpProcessCount" "$process_count"
        
        echo "  - PID一覧: $mcp_pids" >> "$REPORT_FILE"
        
        # 各プロセスの詳細
        echo "  - プロセス詳細:" >> "$REPORT_FILE"
        for pid in $mcp_pids; do
            if ps -p "$pid" > /dev/null 2>&1; then
                local mem_usage cpu_usage start_time
                eval "$(ps -p "$pid" -o %mem,%cpu,etime --no-headers | awk '{printf "mem_usage=%s; cpu_usage=%s; start_time=\"%s\"", $1, $2, $3}')"
                echo "    - PID $pid: CPU=${cpu_usage}%, Memory=${mem_usage}%, 稼働時間=${start_time}" >> "$REPORT_FILE"
            fi
        done
    else
        echo "- **MCPプロセス数**: 0 ⚠️" >> "$REPORT_FILE"
        update_json "mcpProcessCount" "0"
        add_alert "WARNING" "MCPプロセスが見つかりません"
    fi
    
    # 総プロセス数
    local total_processes
    total_processes=$(ps aux | wc -l)
    echo "- **総プロセス数**: $total_processes" >> "$REPORT_FILE"
    update_json "totalProcesses" "$total_processes"
    
    echo "" >> "$REPORT_FILE"
}

# データベース状況レポート
report_database_status() {
    echo "## 🗄️ データベース状況" >> "$REPORT_FILE"
    
    local db_files=("context-memory.db" "persona.db")
    local healthy_dbs=0
    local total_tables=0
    local total_size_kb=0
    
    for db_file in "${db_files[@]}"; do
        if [[ -f "$db_file" ]]; then
            echo "### $db_file" >> "$REPORT_FILE"
            
            # 整合性チェック
            if sqlite3 "$db_file" "PRAGMA integrity_check;" | grep -q "ok"; then
                echo "- **整合性**: ✅ OK" >> "$REPORT_FILE"
                healthy_dbs=$((healthy_dbs + 1))
            else
                echo "- **整合性**: ❌ ERROR" >> "$REPORT_FILE"
                add_alert "ERROR" "データベース整合性エラー: $db_file"
            fi
            
            # サイズ情報
            local db_size_kb
            db_size_kb=$(du -k "$db_file" | cut -f1)
            total_size_kb=$((total_size_kb + db_size_kb))
            echo "- **サイズ**: ${db_size_kb}KB" >> "$REPORT_FILE"
            
            # テーブル数
            local table_count
            table_count=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
            total_tables=$((total_tables + table_count))
            echo "- **テーブル数**: $table_count" >> "$REPORT_FILE"
            
            # レコード数統計
            echo "- **テーブル別レコード数**:" >> "$REPORT_FILE"
            sqlite3 "$db_file" "SELECT name FROM sqlite_master WHERE type='table';" | while read -r table_name; do
                if [[ -n "$table_name" ]]; then
                    local record_count
                    record_count=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM \`$table_name\`;" 2>/dev/null || echo "0")
                    echo "  - $table_name: $record_count件" >> "$REPORT_FILE"
                fi
            done
            
        else
            echo "### $db_file" >> "$REPORT_FILE"
            echo "- **状態**: ❌ ファイルが見つかりません" >> "$REPORT_FILE"
            add_alert "ERROR" "データベースファイルが見つかりません: $db_file"
        fi
        echo "" >> "$REPORT_FILE"
    done
    
    # サマリー
    echo "### データベースサマリー" >> "$REPORT_FILE"
    echo "- **健全なDB数**: $healthy_dbs/${#db_files[@]}" >> "$REPORT_FILE"
    echo "- **総テーブル数**: $total_tables" >> "$REPORT_FILE"
    echo "- **総サイズ**: ${total_size_kb}KB" >> "$REPORT_FILE"
    
    update_json "healthyDatabases" "$healthy_dbs"
    update_json "totalTables" "$total_tables"
    update_json "totalDatabaseSizeKB" "$total_size_kb"
    
    echo "" >> "$REPORT_FILE"
}

# ログ分析レポート
report_log_analysis() {
    echo "## 📋 ログ分析" >> "$REPORT_FILE"
    
    local log_dir="$PROJECT_DIR/logs"
    
    if [[ -d "$log_dir" ]]; then
        # ログディレクトリサイズ
        local log_size_kb
        log_size_kb=$(du -sk "$log_dir" | cut -f1)
        echo "- **ログディレクトリサイズ**: ${log_size_kb}KB" >> "$REPORT_FILE"
        update_json "logDirectorySizeKB" "$log_size_kb"
        
        # 過去24時間のエラー統計
        local error_count=0
        local warn_count=0
        local info_count=0
        
        # ログファイルが存在する場合のみ処理
        if [[ -d "$log_dir" ]]; then
            # 過去24時間のログファイルを対象にカウント
            local log_files
            log_files=$(find "$log_dir" -name "*.log" -newermt "yesterday" 2>/dev/null | head -20)
            
            if [[ -n "$log_files" ]]; then
                # 各ログファイルをカウント
                while IFS= read -r log_file; do
                    if [[ -f "$log_file" ]]; then
                        local errors warns infos
                        errors=$(grep -c "ERROR" "$log_file" 2>/dev/null || echo "0")
                        warns=$(grep -c "WARN" "$log_file" 2>/dev/null || echo "0")
                        infos=$(grep -c "INFO" "$log_file" 2>/dev/null || echo "0")
                        
                        # 数値であることを確認してから加算
                        [[ "$errors" =~ ^[0-9]+$ ]] && error_count=$((error_count + errors))
                        [[ "$warns" =~ ^[0-9]+$ ]] && warn_count=$((warn_count + warns))
                        [[ "$infos" =~ ^[0-9]+$ ]] && info_count=$((info_count + infos))
                    fi
                done <<< "$log_files"
            fi
        fi
        
        # デフォルト値を確実に設定
        error_count=${error_count:-0}
        warn_count=${warn_count:-0}
        info_count=${info_count:-0}
        
        echo "### 過去24時間のログ統計" >> "$REPORT_FILE"
        echo "- **エラー**: ${error_count}件" >> "$REPORT_FILE"
        echo "- **警告**: ${warn_count}件" >> "$REPORT_FILE"
        echo "- **情報**: ${info_count}件" >> "$REPORT_FILE"
        
        update_json "errorCount24h" "$error_count"
        update_json "warningCount24h" "$warn_count"
        update_json "infoCount24h" "$info_count"
        
        if [[ $error_count -gt $ALERT_THRESHOLD_ERROR ]]; then
            add_alert "ERROR" "24時間のエラー数が閾値を超過: ${error_count}件"
        fi
        
        # 最新のエラー例
        if [[ $error_count -gt 0 ]]; then
            echo "### 最新のエラー例" >> "$REPORT_FILE"
            find "$log_dir" -name "*.log" -newermt "yesterday" -exec grep -H "ERROR" {} \; | tail -5 | while read -r error_line; do
                echo "- \`$error_line\`" >> "$REPORT_FILE"
            done
        fi
        
    else
        echo "- **ログディレクトリ**: ❌ 見つかりません" >> "$REPORT_FILE"
        add_alert "WARNING" "ログディレクトリが見つかりません"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# セキュリティ監査レポート
report_security_audit() {
    echo "## 🔒 セキュリティ監査" >> "$REPORT_FILE"
    
    # ファイル権限チェック
    local permission_issues=0
    
    echo "### ファイル権限監査" >> "$REPORT_FILE"
    
    # 機密ファイルの権限チェック
    local sensitive_patterns=("*.db" "*.env*" "logs/*.log")
    for pattern in "${sensitive_patterns[@]}"; do
        while IFS= read -r -d '' file; do
            local perms
            perms=$(stat -c "%a" "$file" 2>/dev/null || echo "unknown")
            if [[ "$perms" != "644" && "$perms" != "600" && "$perms" != "640" ]]; then
                echo "- ⚠️ 不適切な権限: $file ($perms)" >> "$REPORT_FILE"
                permission_issues=$((permission_issues + 1))
            fi
        done < <(find . -name "$pattern" -print0 2>/dev/null)
    done
    
    if [[ $permission_issues -eq 0 ]]; then
        echo "- ✅ ファイル権限: 問題なし" >> "$REPORT_FILE"
    else
        echo "- ❌ 権限問題: ${permission_issues}件" >> "$REPORT_FILE"
        add_alert "WARNING" "ファイル権限の問題: ${permission_issues}件"
    fi
    
    update_json "permissionIssues" "$permission_issues"
    
    # npm audit
    echo "### 依存関係セキュリティ監査" >> "$REPORT_FILE"
    if command -v npm >/dev/null 2>&1 && [[ -f "package.json" ]]; then
        local audit_output
        if audit_output=$(npm audit --json 2>/dev/null); then
            local vulnerabilities
            vulnerabilities=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.total // 0')
            
            if [[ "$vulnerabilities" == "0" ]]; then
                echo "- ✅ 脆弱性: なし" >> "$REPORT_FILE"
            else
                echo "- ❌ 脆弱性発見: ${vulnerabilities}件" >> "$REPORT_FILE"
                add_alert "WARNING" "npm脆弱性: ${vulnerabilities}件"
                
                # 高危険度の脆弱性詳細
                local high_vulns
                high_vulns=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.high // 0')
                if [[ "$high_vulns" != "0" ]]; then
                    echo "  - 高危険度: ${high_vulns}件" >> "$REPORT_FILE"
                    add_alert "ERROR" "高危険度脆弱性: ${high_vulns}件"
                fi
            fi
            
            update_json "npmVulnerabilities" "$vulnerabilities"
        else
            echo "- ⚠️ npm audit実行エラー" >> "$REPORT_FILE"
        fi
    else
        echo "- ℹ️ npm auditをスキップ" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# パフォーマンス分析レポート
report_performance_analysis() {
    echo "## ⚡ パフォーマンス分析" >> "$REPORT_FILE"
    
    # ビルド時間測定
    if [[ -f "build/index.js" ]]; then
        local build_time
        if build_time=$(time (npm run build >/dev/null 2>&1) 2>&1 | grep real | awk '{print $2}'); then
            echo "- **ビルド時間**: $build_time" >> "$REPORT_FILE"
        fi
    fi
    
    # データベース応答時間
    local db_response_times=()
    for db_file in context-memory.db persona.db; do
        if [[ -f "$db_file" ]]; then
            local start_time end_time response_time
            start_time=$(date +%s%3N)
            sqlite3 "$db_file" "SELECT 1;" >/dev/null 2>&1
            end_time=$(date +%s%3N)
            response_time=$((end_time - start_time))
            
            echo "- **$db_file 応答時間**: ${response_time}ms" >> "$REPORT_FILE"
            db_response_times+=("$response_time")
        fi
    done
    
    # 平均応答時間
    if [[ ${#db_response_times[@]} -gt 0 ]]; then
        local avg_response_time=0
        for time in "${db_response_times[@]}"; do
            avg_response_time=$((avg_response_time + time))
        done
        avg_response_time=$((avg_response_time / ${#db_response_times[@]}))
        echo "- **平均DB応答時間**: ${avg_response_time}ms" >> "$REPORT_FILE"
        update_json "avgDatabaseResponseTimeMS" "$avg_response_time"
        
        if [[ $avg_response_time -gt 1000 ]]; then
            add_alert "WARNING" "データベース応答時間が遅い: ${avg_response_time}ms"
        fi
    fi
    
    echo "" >> "$REPORT_FILE"
}

# 推奨事項生成
generate_recommendations() {
    echo "## 💡 推奨事項" >> "$REPORT_FILE"
    
    local recommendations=()
    
    # JSON からアラート数を取得
    local error_alerts warn_alerts
    error_alerts=$(jq '[.alerts[] | select(.level == "ERROR")] | length' "$JSON_REPORT")
    warn_alerts=$(jq '[.alerts[] | select(.level == "WARNING")] | length' "$JSON_REPORT")
    
    if [[ $error_alerts -gt 0 ]]; then
        recommendations+=("🚨 **緊急**: ${error_alerts}件のエラーレベル問題を優先的に解決してください")
    fi
    
    if [[ $warn_alerts -gt 5 ]]; then
        recommendations+=("⚠️ **注意**: ${warn_alerts}件の警告があります。定期的な確認を推奨します")
    fi
    
    # リソース使用量に基づく推奨
    local mem_usage
    mem_usage=$(jq -r '.metrics.memoryUsagePercent // 0' "$JSON_REPORT")
    if (( $(echo "$mem_usage > 70" | bc -l) )); then
        recommendations+=("📊 メモリ使用率が高めです(${mem_usage}%)。不要なプロセスの停止を検討してください")
    fi
    
    local disk_usage
    disk_usage=$(jq -r '.metrics.diskUsagePercent // 0' "$JSON_REPORT")
    if [[ $disk_usage -gt 70 ]]; then
        recommendations+=("💾 ディスク使用率が高めです(${disk_usage}%)。ログローテーションやクリーンアップを実行してください")
    fi
    
    # ログに基づく推奨
    local error_count
    error_count=$(jq -r '.metrics.errorCount24h // 0' "$JSON_REPORT")
    if [[ $error_count -gt 10 ]]; then
        recommendations+=("📋 過去24時間で${error_count}件のエラーが発生しています。ログを詳細確認してください")
    fi
    
    # 推奨事項が無い場合
    if [[ ${#recommendations[@]} -eq 0 ]]; then
        recommendations+=("✅ 現在システムは良好に動作しています。定期監視を継続してください")
    fi
    
    # 推奨事項の出力
    for recommendation in "${recommendations[@]}"; do
        echo "- $recommendation" >> "$REPORT_FILE"
        
        # JSON に追加
        local temp_file
        temp_file=$(mktemp)
        jq --arg rec "$recommendation" '.recommendations += [$rec]' "$JSON_REPORT" > "$temp_file"
        mv "$temp_file" "$JSON_REPORT"
    done
    
    echo "" >> "$REPORT_FILE"
}

# サマリー生成
generate_summary() {
    # JSON サマリー更新
    local temp_file
    temp_file=$(mktemp)
    
    jq '.summary = {
        "overallHealth": (if ([.alerts[] | select(.level == "ERROR")] | length) > 0 then "CRITICAL" 
                         elif ([.alerts[] | select(.level == "WARNING")] | length) > 5 then "WARNING"
                         else "HEALTHY" end),
        "totalAlerts": (.alerts | length),
        "errorAlerts": ([.alerts[] | select(.level == "ERROR")] | length),
        "warningAlerts": ([.alerts[] | select(.level == "WARNING")] | length),
        "systemUptime": (.metrics.nodeVersion // "unknown"),
        "lastChecked": (now | strftime("%Y-%m-%d %H:%M:%S"))
    }' "$JSON_REPORT" > "$temp_file"
    mv "$temp_file" "$JSON_REPORT"
    
    # Markdown サマリー
    echo "## 📋 レポートサマリー" >> "$REPORT_FILE"
    
    local overall_health
    overall_health=$(jq -r '.summary.overallHealth' "$JSON_REPORT")
    
    case "$overall_health" in
        "HEALTHY")
            echo "🟢 **総合状態**: 健全" >> "$REPORT_FILE"
            ;;
        "WARNING")
            echo "🟡 **総合状態**: 注意が必要" >> "$REPORT_FILE"
            ;;
        "CRITICAL")
            echo "🔴 **総合状態**: 緊急対応が必要" >> "$REPORT_FILE"
            ;;
    esac
    
    local total_alerts error_alerts warn_alerts
    total_alerts=$(jq -r '.summary.totalAlerts' "$JSON_REPORT")
    error_alerts=$(jq -r '.summary.errorAlerts' "$JSON_REPORT")
    warn_alerts=$(jq -r '.summary.warningAlerts' "$JSON_REPORT")
    
    echo "- **総アラート数**: $total_alerts (エラー: $error_alerts, 警告: $warn_alerts)" >> "$REPORT_FILE"
    echo "- **生成時刻**: $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"
    echo "- **次回レポート予定**: $(date -d '+1 day' '+%Y-%m-%d 09:00')" >> "$REPORT_FILE"
    
    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "*このレポートは \`daily-report.sh\` により自動生成されました*" >> "$REPORT_FILE"
}

# メインレポート生成
main() {
    local start_time
    start_time=$(date +%s)
    
    init_report
    
    echo "📊 システム概要を収集中..."
    report_system_overview
    
    echo "📈 リソース使用状況を分析中..."
    report_resource_usage
    
    echo "🔄 プロセス状況を確認中..."
    report_process_status
    
    echo "🗄️ データベース状況を監査中..."
    report_database_status
    
    echo "📋 ログを分析中..."
    report_log_analysis
    
    echo "🔒 セキュリティ監査を実行中..."
    report_security_audit
    
    echo "⚡ パフォーマンスを分析中..."
    report_performance_analysis
    
    echo "💡 推奨事項を生成中..."
    generate_recommendations
    
    echo "📋 サマリーを生成中..."
    generate_summary
    
    local end_time duration
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo "✅ 日次レポート生成完了!"
    echo "📄 Markdownレポート: $REPORT_FILE"
    echo "📊 JSONレポート: $JSON_REPORT"
    echo "⏱️ 生成時間: ${duration}秒"
    
    # アラートサマリー表示
    local overall_health
    overall_health=$(jq -r '.summary.overallHealth' "$JSON_REPORT")
    
    case "$overall_health" in
        "HEALTHY")
            echo "🟢 システム状態: 健全"
            ;;
        "WARNING")
            echo "🟡 システム状態: 注意が必要"
            ;;
        "CRITICAL")
            echo "🔴 システム状態: 緊急対応が必要"
            exit 1
            ;;
    esac
}

# ヘルプ表示
show_help() {
    cat << EOF
📊 MCP LLM Generator 日次レポート生成ツール

使用方法:
  $0 [オプション]

オプション:
  -h, --help     このヘルプを表示
  -v, --verbose  詳細出力モード
  --json-only    JSON形式のみ出力
  --no-alerts    アラート生成を無効化

例:
  $0                    # 標準レポート生成
  $0 --verbose          # 詳細出力付き
  $0 --json-only        # JSON のみ生成

生成されるファイル:
  - $REPORT_DIR/daily-report-YYYY-MM-DD.md    (Markdown形式)
  - $REPORT_DIR/daily-report-YYYY-MM-DD.json  (JSON形式)

EOF
}

# コマンドライン引数処理
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -v|--verbose)
        set -x
        main
        ;;
    --json-only)
        # JSON のみモード（未実装）
        echo "JSON-only mode is not implemented yet"
        main
        ;;
    *)
        main
        ;;
esac
