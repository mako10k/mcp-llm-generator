#!/bin/bash
# Sprint4 Phase 2: 緊急時対応スクリプト
# emergency-response.sh - システム障害時の自動復旧システム

set -euo pipefail

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/emergency-response.log"
INCIDENT_DIR="$PROJECT_DIR/logs/incidents"
INCIDENT_ID="incident-$(date '+%Y%m%d_%H%M%S')"
ALERT_EMAIL="${ALERT_EMAIL:-}"
MAX_RECOVERY_ATTEMPTS=3
RECOVERY_TIMEOUT=300  # 5分

# 緊急度レベル
declare -A SEVERITY_LEVELS=(
    ["CRITICAL"]="🔴 CRITICAL"
    ["HIGH"]="🟠 HIGH"
    ["MEDIUM"]="🟡 MEDIUM"
    ["LOW"]="🟢 LOW"
)

# ログ関数
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [EMERGENCY] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $*" | tee -a "$LOG_FILE" >&2
}

warn() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARN] $*" | tee -a "$LOG_FILE" >&2
}

# 初期化
init_emergency_response() {
    mkdir -p "$PROJECT_DIR/logs"
    mkdir -p "$INCIDENT_DIR"
    cd "$PROJECT_DIR"
    
    log "🚨 Emergency response activated: $INCIDENT_ID"
    log "Incident directory: $INCIDENT_DIR"
    
    # インシデントファイル作成
    cat > "$INCIDENT_DIR/$INCIDENT_ID.json" << EOF
{
  "incidentId": "$INCIDENT_ID",
  "startTime": "$(date -Iseconds)",
  "severity": "UNKNOWN",
  "status": "INVESTIGATING",
  "description": "",
  "detectedIssues": [],
  "recoveryActions": [],
  "timeline": []
}
EOF
}

# インシデント情報更新
update_incident() {
    local field="$1"
    local value="$2"
    local temp_file
    temp_file=$(mktemp)
    
    jq --arg field "$field" --arg value "$value" \
       '.[$field] = $value | .timeline += [{"timestamp": (now | strftime("%Y-%m-%d %H:%M:%S")), "action": ("Updated " + $field), "details": $value}]' \
       "$INCIDENT_DIR/$INCIDENT_ID.json" > "$temp_file"
    mv "$temp_file" "$INCIDENT_DIR/$INCIDENT_ID.json"
}

add_recovery_action() {
    local action="$1"
    local result="$2"
    local temp_file
    temp_file=$(mktemp)
    
    jq --arg action "$action" --arg result "$result" \
       '.recoveryActions += [{"action": $action, "result": $result, "timestamp": (now | strftime("%Y-%m-%d %H:%M:%S"))}] | 
        .timeline += [{"timestamp": (now | strftime("%Y-%m-%d %H:%M:%S")), "action": "Recovery Action", "details": ($action + " - " + $result)}]' \
       "$INCIDENT_DIR/$INCIDENT_ID.json" > "$temp_file"
    mv "$temp_file" "$INCIDENT_DIR/$INCIDENT_ID.json"
}

# システム状態診断
diagnose_system() {
    log "🔍 Starting system diagnosis..."
    
    local issues=()
    local severity="LOW"
    
    # MCPプロセス確認
    local mcp_pids
    mcp_pids=$(pgrep -f "mcp-llm-generator\|build/index.js" 2>/dev/null || true)
    
    if [[ -z "$mcp_pids" ]]; then
        issues+=("No MCP processes running")
        severity="HIGH"
        log "❌ No MCP processes detected"
    else
        log "✅ MCP processes found: $mcp_pids"
        
        # プロセスの健全性チェック
        for pid in $mcp_pids; do
            if ! ps -p "$pid" > /dev/null 2>&1; then
                issues+=("MCP process $pid not responding")
                severity="MEDIUM"
            fi
        done
    fi
    
    # データベース接続確認
    local db_files=("context-memory.db" "persona.db")
    for db_file in "${db_files[@]}"; do
        if [[ -f "$db_file" ]]; then
            if ! sqlite3 "$db_file" "SELECT 1;" >/dev/null 2>&1; then
                issues+=("Database connection failed: $db_file")
                severity="CRITICAL"
                log "❌ Database connection failed: $db_file"
            else
                log "✅ Database accessible: $db_file"
            fi
        else
            issues+=("Database file missing: $db_file")
            severity="CRITICAL"
            log "❌ Database file missing: $db_file"
        fi
    done
    
    # ディスク容量確認
    local disk_usage
    disk_usage=$(df "$PROJECT_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 95 ]]; then
        issues+=("Critical disk usage: ${disk_usage}%")
        severity="CRITICAL"
        log "❌ Critical disk usage: ${disk_usage}%"
    elif [[ $disk_usage -gt 85 ]]; then
        issues+=("High disk usage: ${disk_usage}%")
        if [[ "$severity" == "LOW" ]]; then severity="MEDIUM"; fi
        log "⚠️ High disk usage: ${disk_usage}%"
    fi
    
    # メモリ使用量確認
    if command -v free >/dev/null 2>&1; then
        local mem_usage
        mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        if [[ $mem_usage -gt 95 ]]; then
            issues+=("Critical memory usage: ${mem_usage}%")
            severity="CRITICAL"
            log "❌ Critical memory usage: ${mem_usage}%"
        elif [[ $mem_usage -gt 80 ]]; then
            issues+=("High memory usage: ${mem_usage}%")
            if [[ "$severity" == "LOW" ]]; then severity="MEDIUM"; fi
            log "⚠️ High memory usage: ${mem_usage}%"
        fi
    fi
    
    # ネットワーク接続確認
    if ! ping -c 1 -W 5 8.8.8.8 >/dev/null 2>&1; then
        issues+=("Network connectivity issue")
        if [[ "$severity" == "LOW" ]]; then severity="MEDIUM"; fi
        log "❌ Network connectivity issue"
    else
        log "✅ Network connectivity OK"
    fi
    
    # 最近のエラーログ確認
    if [[ -f "$PROJECT_DIR/logs/health-error.log" ]]; then
        local recent_errors
        recent_errors=$(tail -50 "$PROJECT_DIR/logs/health-error.log" | grep -c "ERROR" || echo "0")
        if [[ $recent_errors -gt 10 ]]; then
            issues+=("High error rate: $recent_errors recent errors")
            if [[ "$severity" == "LOW" || "$severity" == "MEDIUM" ]]; then severity="HIGH"; fi
            log "❌ High error rate detected: $recent_errors recent errors"
        fi
    fi
    
    # 診断結果の更新
    update_incident "severity" "$severity"
    update_incident "status" "DIAGNOSED"
    
    local issues_json
    issues_json=$(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .)
    local temp_file
    temp_file=$(mktemp)
    jq --argjson issues "$issues_json" '.detectedIssues = $issues' \
       "$INCIDENT_DIR/$INCIDENT_ID.json" > "$temp_file"
    mv "$temp_file" "$INCIDENT_DIR/$INCIDENT_ID.json"
    
    log "🔍 Diagnosis completed: ${#issues[@]} issues found, severity: $severity"
    
    echo "$severity"
}

# MCP プロセス復旧
recover_mcp_processes() {
    log "🔄 Attempting MCP process recovery..."
    
    local attempts=0
    local max_attempts=$MAX_RECOVERY_ATTEMPTS
    
    while [[ $attempts -lt $max_attempts ]]; do
        attempts=$((attempts + 1))
        log "Recovery attempt $attempts/$max_attempts"
        
        # 既存プロセス終了
        local existing_pids
        existing_pids=$(pgrep -f "mcp-llm-generator\|build/index.js" 2>/dev/null || true)
        if [[ -n "$existing_pids" ]]; then
            log "Terminating existing processes: $existing_pids"
            for pid in $existing_pids; do
                if kill -TERM "$pid" 2>/dev/null; then
                    sleep 2
                    if ps -p "$pid" > /dev/null 2>&1; then
                        kill -KILL "$pid" 2>/dev/null || true
                    fi
                fi
            done
        fi
        
        # プロジェクトのビルド
        log "Building project..."
        if timeout $RECOVERY_TIMEOUT npm run build >/dev/null 2>&1; then
            log "Build successful"
        else
            error "Build failed on attempt $attempts"
            continue
        fi
        
        # サーバー起動
        log "Starting MCP server..."
        
        # バックグラウンドでサーバー起動
        node build/index.js >/dev/null 2>&1 &
        local new_pid=$!
        sleep 5
        
        # プロセス確認
        if ps -p "$new_pid" > /dev/null 2>&1; then
                log "✅ MCP server started successfully (PID: $new_pid)"
                add_recovery_action "MCP Process Recovery" "Success on attempt $attempts"
            log "✅ MCP server started successfully (PID: $new_pid)"
            add_recovery_action "MCP Process Recovery" "Success on attempt $attempts"
            return 0
        else
            log "❌ MCP server failed to start on attempt $attempts"
        fi
        
        sleep 10
    done
    
    error "❌ MCP process recovery failed after $max_attempts attempts"
    add_recovery_action "MCP Process Recovery" "Failed after $max_attempts attempts"
    return 1
}

# データベース復旧
recover_database() {
    local db_file="$1"
    log "🗄️ Attempting database recovery: $db_file"
    
    if [[ ! -f "$db_file" ]]; then
        log "Database file missing: $db_file"
        
        # バックアップからの復元
        local latest_backup
        latest_backup=$(find "$PROJECT_DIR/backups" -name "*.tar.gz" -o -name "$db_file" | sort -r | head -1)
        
        if [[ -n "$latest_backup" && -f "$latest_backup" ]]; then
            log "Found backup: $latest_backup"
            
            if [[ "$latest_backup" == *.tar.gz ]]; then
                # 圧縮バックアップから復元
                if tar -xzf "$latest_backup" -C "$PROJECT_DIR" --wildcards "*/$db_file"; then
                    log "✅ Database restored from backup: $db_file"
                    add_recovery_action "Database Restore" "Success from $latest_backup"
                    return 0
                fi
            else
                # 直接復元
                if cp "$latest_backup" "$PROJECT_DIR/$db_file"; then
                    log "✅ Database restored from backup: $db_file"
                    add_recovery_action "Database Restore" "Success from $latest_backup"
                    return 0
                fi
            fi
        fi
        
        # 新しいデータベース作成
        log "Creating new database: $db_file"
        if [[ -f "src/database/init.ts" ]]; then
            if timeout $RECOVERY_TIMEOUT npm run init-db >/dev/null 2>&1; then
                log "✅ New database created: $db_file"
                add_recovery_action "Database Creation" "Success - new database"
                return 0
            fi
        fi
        
        error "❌ Database recovery failed: $db_file"
        add_recovery_action "Database Recovery" "Failed - $db_file"
        return 1
    fi
    
    # 既存データベースの修復
    log "Attempting database repair: $db_file"
    
    # バックアップ作成
    cp "$db_file" "$db_file.emergency-backup-$(date +%s)"
    
    # 整合性チェック
    if sqlite3 "$db_file" "PRAGMA integrity_check;" | grep -q "ok"; then
        log "✅ Database integrity OK: $db_file"
        return 0
    fi
    
    # 修復試行
    if sqlite3 "$db_file" ".recover" > "${db_file}.recovered" 2>/dev/null; then
        if sqlite3 "${db_file}.recovered" "PRAGMA integrity_check;" | grep -q "ok"; then
            mv "${db_file}.recovered" "$db_file"
            log "✅ Database repaired: $db_file"
            add_recovery_action "Database Repair" "Success - $db_file"
            return 0
        fi
    fi
    
    error "❌ Database repair failed: $db_file"
    add_recovery_action "Database Repair" "Failed - $db_file"
    return 1
}

# ディスク容量復旧
recover_disk_space() {
    log "💾 Attempting disk space recovery..."
    
    local initial_usage
    initial_usage=$(df "$PROJECT_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    log "Initial disk usage: ${initial_usage}%"
    
    # ログファイル圧縮・削除
    log "Cleaning up log files..."
    
    # 古いログファイル削除（7日以上）
    find "$PROJECT_DIR/logs" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # 大きなログファイル圧縮
    find "$PROJECT_DIR/logs" -name "*.log" -size +10M | while read -r large_log; do
        if gzip "$large_log" 2>/dev/null; then
            log "Compressed large log: $(basename "$large_log")"
        fi
    done
    
    # 古いバックアップ削除
    log "Cleaning up old backups..."
    find "$PROJECT_DIR/backups" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true
    find "$PROJECT_DIR/backups" -type d -empty -delete 2>/dev/null || true
    
    # node_modules 再構築（開発環境の場合）
    if [[ -d "node_modules" ]] && [[ -f "package-lock.json" ]]; then
        log "Cleaning node_modules..."
        rm -rf node_modules
        if npm ci --only=production >/dev/null 2>&1; then
            log "Node modules rebuilt (production only)"
        fi
    fi
    
    # 一時ファイル削除
    find "$PROJECT_DIR" -name "*.tmp" -o -name "*.temp" -delete 2>/dev/null || true
    
    local final_usage
    final_usage=$(df "$PROJECT_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    local saved_space=$((initial_usage - final_usage))
    log "Disk cleanup completed: ${final_usage}% usage (saved ${saved_space}%)"
    
    if [[ $final_usage -lt 85 ]]; then
        add_recovery_action "Disk Space Recovery" "Success - ${saved_space}% space recovered"
        return 0
    else
        add_recovery_action "Disk Space Recovery" "Partial - ${saved_space}% space recovered"
        return 1
    fi
}

# ネットワーク復旧
recover_network() {
    log "🌐 Attempting network recovery..."
    
    # DNS確認
    if ! nslookup google.com >/dev/null 2>&1; then
        log "DNS resolution issue detected"
        
        # DNS設定確認
        if [[ -f "/etc/resolv.conf" ]]; then
            log "Current DNS configuration:"
            cat /etc/resolv.conf | grep nameserver | head -3 | while read -r line; do
                log "  $line"
            done
        fi
    fi
    
    # 基本的な接続確認
    local connectivity_tests=(
        "8.8.8.8"      # Google DNS
        "1.1.1.1"      # Cloudflare DNS
        "208.67.222.222" # OpenDNS
    )
    
    local working_dns=""
    for dns in "${connectivity_tests[@]}"; do
        if ping -c 1 -W 5 "$dns" >/dev/null 2>&1; then
            working_dns="$dns"
            break
        fi
    done
    
    if [[ -n "$working_dns" ]]; then
        log "✅ Network connectivity restored via $working_dns"
        add_recovery_action "Network Recovery" "Success - connectivity via $working_dns"
        return 0
    else
        log "❌ Network connectivity recovery failed"
        add_recovery_action "Network Recovery" "Failed - no connectivity"
        return 1
    fi
}

# システム全体復旧
full_system_recovery() {
    log "🔄 Starting full system recovery..."
    
    local recovery_success=0
    local total_recoveries=0
    
    # プロセス復旧
    total_recoveries=$((total_recoveries + 1))
    if recover_mcp_processes; then
        recovery_success=$((recovery_success + 1))
    fi
    
    # データベース復旧
    for db_file in context-memory.db persona.db; do
        total_recoveries=$((total_recoveries + 1))
        if recover_database "$db_file"; then
            recovery_success=$((recovery_success + 1))
        fi
    done
    
    # ディスク容量復旧
    local disk_usage
    disk_usage=$(df "$PROJECT_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 85 ]]; then
        total_recoveries=$((total_recoveries + 1))
        if recover_disk_space; then
            recovery_success=$((recovery_success + 1))
        fi
    fi
    
    # ネットワーク復旧
    if ! ping -c 1 -W 5 8.8.8.8 >/dev/null 2>&1; then
        total_recoveries=$((total_recoveries + 1))
        if recover_network; then
            recovery_success=$((recovery_success + 1))
        fi
    fi
    
    log "Recovery completed: $recovery_success/$total_recoveries successful"
    
    if [[ $recovery_success -eq $total_recoveries ]]; then
        update_incident "status" "RESOLVED"
        log "✅ Full system recovery successful"
        return 0
    else
        update_incident "status" "PARTIALLY_RESOLVED"
        log "⚠️ Partial system recovery: $recovery_success/$total_recoveries"
        return 1
    fi
}

# アラート送信
send_alert() {
    local severity="$1"
    local message="$2"
    
    log "📧 Sending alert: $severity - $message"
    
    # メール送信（設定されている場合）
    if [[ -n "$ALERT_EMAIL" ]] && command -v mail >/dev/null 2>&1; then
        local subject="🚨 MCP Emergency Alert - $severity"
        local body="Incident ID: $INCIDENT_ID
Time: $(date)
Severity: $severity
Message: $message

Project: $PROJECT_DIR
Log: $LOG_FILE

This is an automated alert from the MCP emergency response system."
        
        echo "$body" | mail -s "$subject" "$ALERT_EMAIL" 2>/dev/null || \
            warn "Failed to send email alert to $ALERT_EMAIL"
    fi
    
    # システムログ記録
    if command -v logger >/dev/null 2>&1; then
        logger -t "mcp-emergency" "$severity: $message (Incident: $INCIDENT_ID)"
    fi
    
    # デスクトップ通知（GUI環境の場合）
    if [[ -n "${DISPLAY:-}" ]] && command -v notify-send >/dev/null 2>&1; then
        notify-send "MCP Emergency Alert" "$severity: $message" --urgency=critical 2>/dev/null || true
    fi
}

# インシデントレポート生成
generate_incident_report() {
    log "📋 Generating incident report..."
    
    local report_file="$INCIDENT_DIR/$INCIDENT_ID-report.md"
    local incident_data
    incident_data=$(cat "$INCIDENT_DIR/$INCIDENT_ID.json")
    
    {
        echo "# 🚨 緊急事態対応レポート"
        echo "**インシデントID**: $INCIDENT_ID"
        echo "**発生日時**: $(echo "$incident_data" | jq -r '.startTime')"
        echo "**終了日時**: $(date -Iseconds)"
        echo "**重要度**: $(echo "$incident_data" | jq -r '.severity')"
        echo "**ステータス**: $(echo "$incident_data" | jq -r '.status')"
        echo ""
        
        echo "## 🔍 検出された問題"
        echo "$incident_data" | jq -r '.detectedIssues[]' | while read -r issue; do
            echo "- $issue"
        done
        echo ""
        
        echo "## 🔄 実行された復旧アクション"
        echo "$incident_data" | jq -c '.recoveryActions[]' | while read -r action; do
            local action_name result timestamp
            action_name=$(echo "$action" | jq -r '.action')
            result=$(echo "$action" | jq -r '.result')
            timestamp=$(echo "$action" | jq -r '.timestamp')
            echo "- **$timestamp**: $action_name - $result"
        done
        echo ""
        
        echo "## ⏰ タイムライン"
        echo "$incident_data" | jq -c '.timeline[]' | while read -r timeline_item; do
            local timestamp action details
            timestamp=$(echo "$timeline_item" | jq -r '.timestamp')
            action=$(echo "$timeline_item" | jq -r '.action')
            details=$(echo "$timeline_item" | jq -r '.details')
            echo "- **$timestamp**: $action - $details"
        done
        echo ""
        
        echo "## 📊 システム状態"
        echo "**プロジェクトディレクトリ**: $PROJECT_DIR"
        echo "**ログファイル**: $LOG_FILE"
        
        # 現在のシステム状態
        echo ""
        echo "### 現在の状態"
        
        # プロセス状態
        local current_pids
        current_pids=$(pgrep -f "mcp-llm-generator\|build/index.js" 2>/dev/null || echo "None")
        echo "- **MCPプロセス**: $current_pids"
        
        # ディスク使用量
        local current_disk
        current_disk=$(df "$PROJECT_DIR" | awk 'NR==2 {print $5}')
        echo "- **ディスク使用量**: $current_disk"
        
        # メモリ使用量
        if command -v free >/dev/null 2>&1; then
            local current_mem
            current_mem=$(free | awk 'NR==2{printf "%.0f%%", $3*100/$2}')
            echo "- **メモリ使用量**: $current_mem"
        fi
        
        echo ""
        echo "## 💡 推奨事項"
        
        local status
        status=$(echo "$incident_data" | jq -r '.status')
        
        if [[ "$status" == "RESOLVED" ]]; then
            echo "- ✅ インシデントは正常に解決されました"
            echo "- 📊 システム監視を継続してください"
            echo "- 🔍 根本原因分析を実施することを推奨します"
        elif [[ "$status" == "PARTIALLY_RESOLVED" ]]; then
            echo "- ⚠️ インシデントは部分的に解決されました"
            echo "- 🔧 未解決の問題について手動対応が必要です"
            echo "- 📞 技術サポートへの連絡を検討してください"
        else
            echo "- 🚨 インシデントは未解決です"
            echo "- 🔧 手動での緊急対応が必要です"
            echo "- 📞 即座に技術サポートへ連絡してください"
        fi
        
        echo ""
        echo "---"
        echo "*このレポートは \`emergency-response.sh\` により自動生成されました*"
        
    } > "$report_file"
    
    log "Incident report generated: $INCIDENT_ID-report.md"
}

# ヘルプ表示
show_help() {
    cat << EOF
🚨 MCP LLM Generator 緊急事態対応システム

使用方法:
  $0 [オプション] [重要度]

重要度:
  CRITICAL    システムが完全に停止
  HIGH        主要機能に重大な影響
  MEDIUM      一部機能に影響
  LOW         軽微な問題
  AUTO        自動診断（デフォルト）

オプション:
  -h, --help           このヘルプを表示
  -d, --diagnose-only  診断のみ実行（復旧は行わない）
  -r, --recover-only   復旧のみ実行（診断をスキップ）
  --no-alert          アラート送信を無効化
  --timeout N         復旧タイムアウト（秒）

環境変数:
  ALERT_EMAIL         アラート送信先メールアドレス

例:
  $0                       # 自動診断と復旧
  $0 CRITICAL              # 重要度を指定して対応
  $0 --diagnose-only       # 診断のみ
  $0 --recover-only HIGH   # 復旧のみ

緊急時の手動実行:
  # プロセス確認
  pgrep -f "mcp-llm-generator"
  
  # 強制再起動
  pkill -f "mcp-llm-generator"
  cd $PROJECT_DIR && npm run build && node build/index.js &
  
  # データベース確認
  sqlite3 context-memory.db "PRAGMA integrity_check;"

EOF
}

# メイン実行
main() {
    local specified_severity="${1:-AUTO}"
    local diagnose_only=false
    local recover_only=false
    local no_alert=false
    
    # 引数処理
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--diagnose-only)
                diagnose_only=true
                shift
                ;;
            -r|--recover-only)
                recover_only=true
                shift
                ;;
            --no-alert)
                no_alert=true
                shift
                ;;
            --timeout)
                RECOVERY_TIMEOUT="$2"
                shift 2
                ;;
            CRITICAL|HIGH|MEDIUM|LOW)
                specified_severity="$1"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    init_emergency_response
    
    local detected_severity="$specified_severity"
    
    # 診断実行
    if [[ "$recover_only" != "true" ]]; then
        detected_severity=$(diagnose_system)
        
        if [[ "$specified_severity" != "AUTO" ]]; then
            # 指定された重要度の方が高い場合は上書き
            case "$specified_severity" in
                CRITICAL) detected_severity="CRITICAL" ;;
                HIGH) 
                    if [[ "$detected_severity" != "CRITICAL" ]]; then
                        detected_severity="HIGH"
                    fi
                    ;;
            esac
        fi
    fi
    
    # デフォルト重要度の設定
    if [[ -z "$detected_severity" ]]; then
        detected_severity="MEDIUM"
    fi
    
    # 重要度表示用の記号取得
    local severity_icon
    case "$detected_severity" in
        "CRITICAL") severity_icon="🔴 CRITICAL" ;;
        "HIGH") severity_icon="🟠 HIGH" ;;
        "MEDIUM") severity_icon="🟡 MEDIUM" ;;
        "LOW") severity_icon="🟢 LOW" ;;
        *) severity_icon="🟡 MEDIUM" ;;
    esac
    
    log "$severity_icon Emergency response for severity: $detected_severity"
    
    # アラート送信
    if [[ "$no_alert" != "true" ]]; then
        send_alert "$detected_severity" "Emergency response activated (Incident: $INCIDENT_ID)"
    fi
    
    # 復旧実行（診断のみモード以外）
    local recovery_result=0
    if [[ "$diagnose_only" != "true" ]]; then
        case "$detected_severity" in
            CRITICAL|HIGH)
                log "Initiating full system recovery..."
                if ! full_system_recovery; then
                    recovery_result=1
                fi
                ;;
            MEDIUM)
                log "Initiating targeted recovery..."
                # 中程度の問題に対する限定的復旧
                local mcp_pids
                mcp_pids=$(pgrep -f "mcp-llm-generator\|build/index.js" 2>/dev/null || true)
                if [[ -z "$mcp_pids" ]]; then
                    if ! recover_mcp_processes; then
                        recovery_result=1
                    fi
                fi
                ;;
            LOW)
                log "Low severity - monitoring only"
                update_incident "status" "MONITORING"
                ;;
        esac
    fi
    
    # 最終診断
    if [[ "$recovery_result" -eq 0 && "$diagnose_only" != "true" ]]; then
        log "🔍 Performing post-recovery verification..."
        local final_severity
        final_severity=$(diagnose_system)
        
        if [[ "$final_severity" == "LOW" ]]; then
            log "✅ System recovery verified - all systems healthy"
            update_incident "status" "RESOLVED"
        else
            log "⚠️ System partially recovered - some issues remain ($final_severity)"
            update_incident "status" "PARTIALLY_RESOLVED"
            recovery_result=1
        fi
    fi
    
    # インシデントレポート生成
    generate_incident_report
    
    # 最終アラート
    if [[ "$no_alert" != "true" ]]; then
        local final_status
        final_status=$(jq -r '.status' "$INCIDENT_DIR/$INCIDENT_ID.json")
        send_alert "$detected_severity" "Emergency response completed - Status: $final_status"
    fi
    
    log "🚨 Emergency response completed: $INCIDENT_ID"
    echo "Incident ID: $INCIDENT_ID"
    echo "Report: $INCIDENT_DIR/$INCIDENT_ID-report.md"
    
    if [[ $recovery_result -eq 0 ]]; then
        echo "✅ Emergency response successful"
        exit 0
    else
        echo "❌ Emergency response completed with issues"
        exit 1
    fi
}

# 信号ハンドリング
trap 'log "Emergency response interrupted"; update_incident "status" "INTERRUPTED"; exit 130' INT TERM

# スクリプト実行
main "$@"
