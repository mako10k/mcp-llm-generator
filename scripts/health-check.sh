#!/bin/bash
# Sprint4 Phase 2: ヘルスチェックスクリプト
# health-check.sh - システム状態の包括的監視

set -euo pipefail

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/health-check.log"
ERROR_LOG="$PROJECT_DIR/logs/health-error.log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=80
ALERT_THRESHOLD_DISK=80

# ログ関数
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $*" | tee -a "$ERROR_LOG" >&2
}

warn() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARN] $*" | tee -a "$LOG_FILE" >&2
}

# 初期化
init_check() {
    mkdir -p "$PROJECT_DIR/logs"
    cd "$PROJECT_DIR"
    
    if [[ ! -f "package.json" ]]; then
        error "Not in MCP project directory"
        exit 1
    fi
    
    log "Health check started in $PROJECT_DIR"
}

# MCPプロセス確認
check_mcp_processes() {
    local mcp_pids
    mcp_pids=$(pgrep -f "mcp-llm-generator\|build/index.js" 2>/dev/null || true)
    
    if [[ -z "$mcp_pids" ]]; then
        warn "No MCP LLM Generator processes found"
        return 1
    else
        log "MCP processes found: $mcp_pids"
        
        # プロセス詳細情報
        for pid in $mcp_pids; do
            if ps -p "$pid" > /dev/null 2>&1; then
                local mem_usage cpu_usage
                mem_usage=$(ps -p "$pid" -o %mem --no-headers | tr -d ' ')
                cpu_usage=$(ps -p "$pid" -o %cpu --no-headers | tr -d ' ')
                log "PID $pid: CPU=${cpu_usage}%, Memory=${mem_usage}%"
                
                # アラート閾値チェック
                if (( $(echo "$mem_usage > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
                    warn "High memory usage detected: ${mem_usage}%"
                fi
            fi
        done
        return 0
    fi
}

# データベース接続確認
check_database() {
    local db_files=("context-memory.db" "persona.db")
    local healthy=0
    
    for db_file in "${db_files[@]}"; do
        if [[ -f "$db_file" ]]; then
            log "Checking database: $db_file"
            
            # 整合性チェック
            if sqlite3 "$db_file" "PRAGMA integrity_check;" | grep -q "ok"; then
                log "Database $db_file: OK"
                
                # データベースサイズ監視
                local db_size
                db_size=$(du -sh "$db_file" | cut -f1)
                log "Database $db_file size: $db_size"
                
                # テーブル統計
                local table_count
                table_count=$(sqlite3 "$db_file" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
                log "Database $db_file tables: $table_count"
                
                healthy=$((healthy + 1))
            else
                error "Database integrity check failed: $db_file"
            fi
        else
            warn "Database file not found: $db_file"
        fi
    done
    
    if [[ $healthy -eq 0 ]]; then
        error "No healthy databases found"
        return 1
    fi
    
    return 0
}

# システムリソース確認
check_system_resources() {
    # ディスク容量
    local disk_usage
    disk_usage=$(df "$PROJECT_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    log "Disk usage: ${disk_usage}%"
    
    if [[ $disk_usage -gt $ALERT_THRESHOLD_DISK ]]; then
        warn "High disk usage: ${disk_usage}%"
    fi
    
    # メモリ使用量
    if command -v free >/dev/null 2>&1; then
        local mem_usage
        mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        log "System memory usage: ${mem_usage}%"
        
        if [[ $mem_usage -gt $ALERT_THRESHOLD_MEMORY ]]; then
            warn "High system memory usage: ${mem_usage}%"
        fi
    fi
    
    # CPU負荷平均
    if command -v uptime >/dev/null 2>&1; then
        local load_avg
        load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        log "System load average: $load_avg"
    fi
}

# ネットワーク接続確認
check_network() {
    # 基本的な接続確認
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        log "Network connectivity: OK"
    else
        warn "Network connectivity issue detected"
    fi
    
    # ポート使用状況確認
    if command -v netstat >/dev/null 2>&1; then
        local listening_ports
        listening_ports=$(netstat -tlnp 2>/dev/null | grep LISTEN | wc -l)
        log "Listening ports: $listening_ports"
    fi
}

# 依存関係確認
check_dependencies() {
    # Node.js バージョン
    if command -v node >/dev/null 2>&1; then
        local node_version
        node_version=$(node --version)
        log "Node.js version: $node_version"
    else
        error "Node.js not found"
        return 1
    fi
    
    # npm バージョン
    if command -v npm >/dev/null 2>&1; then
        local npm_version
        npm_version=$(npm --version)
        log "npm version: $npm_version"
    fi
    
    # TypeScript コンパイラ確認
    if [[ -f "node_modules/.bin/tsc" ]]; then
        log "TypeScript compiler: Available"
    else
        warn "TypeScript compiler not found"
    fi
    
    # package.json 整合性
    if npm list --depth=0 >/dev/null 2>&1; then
        log "Package dependencies: OK"
    else
        warn "Package dependency issues detected"
    fi
}

# ログファイルチェック
check_logs() {
    local log_dir="$PROJECT_DIR/logs"
    
    if [[ -d "$log_dir" ]]; then
        # ログディスクサイズ
        local log_size
        log_size=$(du -sh "$log_dir" 2>/dev/null | cut -f1 || echo "unknown")
        log "Log directory size: $log_size"
        
        # 最近のエラーログチェック
        local recent_errors
        if [[ -f "$ERROR_LOG" ]]; then
            recent_errors=$(tail -n 50 "$ERROR_LOG" | grep -c "ERROR" || echo "0")
            log "Recent errors (last 50 lines): $recent_errors"
            
            if [[ $recent_errors -gt 10 ]]; then
                warn "High error rate detected: $recent_errors errors in recent logs"
            fi
        fi
    else
        warn "Log directory not found: $log_dir"
    fi
}

# 設定ファイル確認
check_configuration() {
    local config_files=(
        ".vscode/mcp.json"
        "package.json"
        "tsconfig.json"
    )
    
    for config_file in "${config_files[@]}"; do
        if [[ -f "$config_file" ]]; then
            log "Configuration file OK: $config_file"
            
            # JSON構文チェック
            if [[ "$config_file" == *.json ]]; then
                if jq empty "$config_file" 2>/dev/null; then
                    log "JSON syntax OK: $config_file"
                else
                    error "JSON syntax error: $config_file"
                fi
            fi
        else
            warn "Configuration file missing: $config_file"
        fi
    done
}

# ビルドチェック
check_build() {
    if [[ -d "build" ]]; then
        local build_files
        build_files=$(find build -name "*.js" | wc -l)
        log "Build files count: $build_files"
        
        if [[ $build_files -eq 0 ]]; then
            warn "No built JavaScript files found"
            return 1
        fi
        
        # メインエントリーポイント確認
        if [[ -f "build/index.js" ]]; then
            log "Main entry point: OK"
        else
            error "Main entry point missing: build/index.js"
            return 1
        fi
    else
        error "Build directory not found"
        return 1
    fi
    
    return 0
}

# MCP統合テスト
check_mcp_integration() {
    if [[ -f "build/index.js" ]]; then
        log "Testing MCP integration..."
        
        # 基本的な構文チェック（タイムアウト付き）
        if timeout 10s node -c "build/index.js" 2>/dev/null; then
            log "MCP JavaScript syntax: OK"
        else
            error "MCP JavaScript syntax error or timeout"
            return 1
        fi
        
        # MCP Inspector テスト（バックグラウンド）
        if command -v npx >/dev/null 2>&1; then
            log "MCP Inspector test available"
            # 実際のテストは手動で実行
        fi
    else
        error "Cannot test MCP integration - build/index.js not found"
        return 1
    fi
}

# セキュリティチェック
check_security() {
    # 権限チェック
    local sensitive_files=(
        "*.db"
        "*.env*"
        "logs/*.log"
    )
    
    for pattern in "${sensitive_files[@]}"; do
        while IFS= read -r -d '' file; do
            local perms
            perms=$(stat -c "%a" "$file" 2>/dev/null || echo "unknown")
            if [[ "$perms" == "644" || "$perms" == "600" ]]; then
                log "File permissions OK: $file ($perms)"
            else
                warn "Suspicious file permissions: $file ($perms)"
            fi
        done < <(find . -name "$pattern" -print0 2>/dev/null)
    done
    
    # .env ファイル確認
    if [[ -f ".env" ]]; then
        warn ".env file found - ensure no sensitive data in git"
    fi
    
    # npm audit
    if command -v npm >/dev/null 2>&1; then
        log "Running npm security audit..."
        if npm audit --audit-level=high >/dev/null 2>&1; then
            log "npm security audit: OK"
        else
            warn "npm security vulnerabilities detected"
        fi
    fi
}

# メインの健康診断実行
main() {
    local exit_code=0
    local checks_passed=0
    local checks_total=0
    
    init_check
    
    # チェック実行
    local checks=(
        "check_mcp_processes:MCP Processes"
        "check_database:Database"
        "check_system_resources:System Resources"
        "check_network:Network"
        "check_dependencies:Dependencies"
        "check_logs:Logs"
        "check_configuration:Configuration"
        "check_build:Build"
        "check_mcp_integration:MCP Integration"
        "check_security:Security"
    )
    
    log "Starting comprehensive health check..."
    
    for check_info in "${checks[@]}"; do
        local check_function="${check_info%%:*}"
        local check_name="${check_info##*:}"
        
        checks_total=$((checks_total + 1))
        
        log "Running check: $check_name"
        if $check_function; then
            log "✅ $check_name: PASSED"
            checks_passed=$((checks_passed + 1))
        else
            log "❌ $check_name: FAILED"
            exit_code=1
        fi
        
        echo "---" >> "$LOG_FILE"
    done
    
    # 結果サマリー
    log "Health check completed: $checks_passed/$checks_total checks passed"
    
    if [[ $exit_code -eq 0 ]]; then
        log "🎉 System is healthy"
        echo "OK: All systems healthy"
    else
        error "🚨 System issues detected - see logs for details"
        echo "ERROR: System health issues detected"
    fi
    
    # Prometheus メトリクス出力（オプション）
    cat > "$PROJECT_DIR/logs/health-metrics.prom" << EOF
# HELP mcp_health_check_total Total number of health checks
# TYPE mcp_health_check_total counter
mcp_health_check_total $checks_total

# HELP mcp_health_check_passed Number of passed health checks
# TYPE mcp_health_check_passed counter
mcp_health_check_passed $checks_passed

# HELP mcp_health_check_success Health check success indicator
# TYPE mcp_health_check_success gauge
mcp_health_check_success $([[ $exit_code -eq 0 ]] && echo "1" || echo "0")

# HELP mcp_health_check_timestamp Last health check timestamp
# TYPE mcp_health_check_timestamp gauge
mcp_health_check_timestamp $(date +%s)
EOF
    
    exit $exit_code
}

# スクリプト実行
main "$@"
