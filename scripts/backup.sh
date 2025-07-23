#!/bin/bash
# Sprint4 Phase 2: バックアップスクリプト
# backup.sh - データベースとログの自動バックアップシステム

set -euo pipefail

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
BACKUP_DATE=$(date '+%Y%m%d_%H%M%S')
LOG_FILE="$PROJECT_DIR/logs/backup.log"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPRESSION="${COMPRESSION:-true}"
REMOTE_BACKUP="${REMOTE_BACKUP:-false}"

# ログ関数
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $*" | tee -a "$LOG_FILE" >&2
}

warn() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARN] $*" | tee -a "$LOG_FILE" >&2
}

# 初期化
init_backup() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$PROJECT_DIR/logs"
    cd "$PROJECT_DIR"
    
    log "Backup started: $BACKUP_DATE"
    log "Backup directory: $BACKUP_DIR"
    log "Retention period: $RETENTION_DAYS days"
}

# バックアップ関数
backup_databases() {
    log "Starting database backup..."
    
    local db_backup_dir="$BACKUP_DIR/databases/$BACKUP_DATE"
    mkdir -p "$db_backup_dir"
    
    local backup_count=0
    local failed_count=0
    
    # データベースファイル一覧
    local db_files=()
    while IFS= read -r -d '' db_file; do
        db_files+=("$db_file")
    done < <(find . -maxdepth 1 -name "*.db" -print0 2>/dev/null)
    
    if [[ ${#db_files[@]} -eq 0 ]]; then
        warn "No database files found"
        return 0
    fi
    
    for db_file in "${db_files[@]}"; do
        local db_name
        db_name=$(basename "$db_file")
        local backup_file="$db_backup_dir/$db_name"
        
        log "Backing up database: $db_name"
        
        # SQLite整合性チェック
        if sqlite3 "$db_file" "PRAGMA integrity_check;" | grep -q "ok"; then
            log "Database integrity OK: $db_name"
            
            # SQLiteバックアップ（オンライン）
            if sqlite3 "$db_file" ".backup '$backup_file'"; then
                log "Database backup successful: $db_name"
                backup_count=$((backup_count + 1))
                
                # バックアップファイル検証
                if sqlite3 "$backup_file" "PRAGMA integrity_check;" | grep -q "ok"; then
                    log "Backup verification OK: $db_name"
                else
                    error "Backup verification failed: $db_name"
                    failed_count=$((failed_count + 1))
                fi
                
                # ファイルサイズ比較
                local original_size backup_size
                original_size=$(stat -c%s "$db_file" 2>/dev/null || echo "0")
                backup_size=$(stat -c%s "$backup_file" 2>/dev/null || echo "0")
                
                if [[ $backup_size -gt 0 && $backup_size -ge $((original_size * 90 / 100)) ]]; then
                    log "Backup size verification OK: $db_name (${backup_size} bytes)"
                else
                    warn "Backup size verification warning: $db_name (original: ${original_size}, backup: ${backup_size})"
                fi
                
            else
                error "Database backup failed: $db_name"
                failed_count=$((failed_count + 1))
            fi
        else
            error "Database integrity check failed: $db_name"
            failed_count=$((failed_count + 1))
        fi
    done
    
    # データベースバックアップサマリー
    log "Database backup completed: $backup_count successful, $failed_count failed"
    
    return $failed_count
}

# ログバックアップ
backup_logs() {
    log "Starting log backup..."
    
    local log_backup_dir="$BACKUP_DIR/logs/$BACKUP_DATE"
    mkdir -p "$log_backup_dir"
    
    local logs_dir="$PROJECT_DIR/logs"
    
    if [[ ! -d "$logs_dir" ]]; then
        warn "Logs directory not found: $logs_dir"
        return 0
    fi
    
    # ログファイルをコピー
    local log_count=0
    find "$logs_dir" -name "*.log" -type f | while read -r log_file; do
        local log_name
        log_name=$(basename "$log_file")
        local backup_log_file="$log_backup_dir/$log_name"
        
        if cp "$log_file" "$backup_log_file"; then
            log "Log backup successful: $log_name"
            log_count=$((log_count + 1))
        else
            error "Log backup failed: $log_name"
        fi
    done
    
    # レポートファイルもバックアップ
    if [[ -d "$logs_dir/reports" ]]; then
        local reports_backup_dir="$log_backup_dir/reports"
        mkdir -p "$reports_backup_dir"
        
        find "$logs_dir/reports" -name "*.md" -o -name "*.json" | while read -r report_file; do
            local report_name
            report_name=$(basename "$report_file")
            
            if cp "$report_file" "$reports_backup_dir/$report_name"; then
                log "Report backup successful: $report_name"
            else
                error "Report backup failed: $report_name"
            fi
        done
    fi
    
    log "Log backup completed"
}

# 設定ファイルバックアップ
backup_configs() {
    log "Starting configuration backup..."
    
    local config_backup_dir="$BACKUP_DIR/configs/$BACKUP_DATE"
    mkdir -p "$config_backup_dir"
    
    # 重要な設定ファイル
    local config_files=(
        "package.json"
        "package-lock.json"
        "tsconfig.json"
        ".vscode/mcp.json"
        ".gitignore"
        "README.md"
    )
    
    for config_file in "${config_files[@]}"; do
        if [[ -f "$config_file" ]]; then
            local config_name
            config_name=$(basename "$config_file")
            local config_dir
            config_dir=$(dirname "$config_file")
            
            # ディレクトリ構造を保持
            if [[ "$config_dir" != "." ]]; then
                mkdir -p "$config_backup_dir/$config_dir"
                local backup_config_file="$config_backup_dir/$config_file"
            else
                local backup_config_file="$config_backup_dir/$config_name"
            fi
            
            if cp "$config_file" "$backup_config_file"; then
                log "Config backup successful: $config_file"
            else
                error "Config backup failed: $config_file"
            fi
        else
            warn "Config file not found: $config_file"
        fi
    done
    
    log "Configuration backup completed"
}

# ソースコードバックアップ
backup_source() {
    log "Starting source code backup..."
    
    local source_backup_dir="$BACKUP_DIR/source/$BACKUP_DATE"
    mkdir -p "$source_backup_dir"
    
    # Git情報保持
    if [[ -d ".git" ]]; then
        local git_info="$source_backup_dir/git-info.txt"
        {
            echo "Git Commit: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
            echo "Git Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
            echo "Git Status:"
            git status --porcelain 2>/dev/null || echo "Git status unavailable"
            echo ""
            echo "Git Log (last 5 commits):"
            git log --oneline -5 2>/dev/null || echo "Git log unavailable"
        } > "$git_info"
        log "Git information saved: git-info.txt"
    fi
    
    # ソースファイルのアーカイブ
    local source_dirs=("src" "scripts" "tests")
    local archive_file="$source_backup_dir/source-code.tar.gz"
    
    local tar_args=()
    for dir in "${source_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            tar_args+=("$dir")
        fi
    done
    
    if [[ ${#tar_args[@]} -gt 0 ]]; then
        if tar -czf "$archive_file" "${tar_args[@]}" 2>/dev/null; then
            log "Source code archive created: source-code.tar.gz"
            
            # アーカイブサイズ
            local archive_size
            archive_size=$(du -sh "$archive_file" | cut -f1)
            log "Source code archive size: $archive_size"
        else
            error "Source code archive creation failed"
        fi
    else
        warn "No source directories found for backup"
    fi
    
    log "Source code backup completed"
}

# 圧縮処理
compress_backup() {
    if [[ "$COMPRESSION" != "true" ]]; then
        log "Compression disabled, skipping..."
        return 0
    fi
    
    log "Starting backup compression..."
    
    local current_backup_dir="$BACKUP_DIR/$BACKUP_DATE"
    local compressed_file="$BACKUP_DIR/backup-$BACKUP_DATE.tar.gz"
    
    # バックアップディレクトリを作成して移動
    if [[ ! -d "$current_backup_dir" ]]; then
        mkdir -p "$current_backup_dir"
        
        # 各種バックアップを統合
        for backup_type in databases logs configs source; do
            local type_dir="$BACKUP_DIR/$backup_type/$BACKUP_DATE"
            if [[ -d "$type_dir" ]]; then
                mv "$type_dir" "$current_backup_dir/$backup_type"
            fi
        done
    fi
    
    # 圧縮実行
    if tar -czf "$compressed_file" -C "$BACKUP_DIR" "$BACKUP_DATE"; then
        log "Backup compression successful: backup-$BACKUP_DATE.tar.gz"
        
        # 圧縮サイズ確認
        local compressed_size
        compressed_size=$(du -sh "$compressed_file" | cut -f1)
        log "Compressed backup size: $compressed_size"
        
        # 元のディレクトリを削除
        if rm -rf "$current_backup_dir"; then
            log "Original backup directory cleaned up"
        fi
        
        # 各種バックアップディレクトリも削除
        for backup_type in databases logs configs source; do
            local type_parent_dir="$BACKUP_DIR/$backup_type"
            if [[ -d "$type_parent_dir" && -z "$(ls -A "$type_parent_dir")" ]]; then
                rmdir "$type_parent_dir" 2>/dev/null || true
            fi
        done
        
    else
        error "Backup compression failed"
        return 1
    fi
    
    log "Backup compression completed"
}

# 古いバックアップの削除
cleanup_old_backups() {
    log "Starting old backup cleanup (retention: $RETENTION_DAYS days)..."
    
    local deleted_count=0
    local cleanup_errors=0
    
    # 圧縮バックアップファイルのクリーンアップ
    find "$BACKUP_DIR" -name "backup-*.tar.gz" -type f -mtime +$RETENTION_DAYS | while read -r old_backup; do
        if rm -f "$old_backup"; then
            log "Deleted old backup: $(basename "$old_backup")"
            deleted_count=$((deleted_count + 1))
        else
            error "Failed to delete old backup: $(basename "$old_backup")"
            cleanup_errors=$((cleanup_errors + 1))
        fi
    done
    
    # 古いディレクトリの削除
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "2*" -mtime +$RETENTION_DAYS | while read -r old_dir; do
        if rm -rf "$old_dir"; then
            log "Deleted old backup directory: $(basename "$old_dir")"
            deleted_count=$((deleted_count + 1))
        else
            error "Failed to delete old backup directory: $(basename "$old_dir")"
            cleanup_errors=$((cleanup_errors + 1))
        fi
    done
    
    # 各種バックアップタイプディレクトリの古いバックアップも削除
    for backup_type in databases logs configs source; do
        local type_dir="$BACKUP_DIR/$backup_type"
        if [[ -d "$type_dir" ]]; then
            find "$type_dir" -maxdepth 1 -type d -name "2*" -mtime +$RETENTION_DAYS | while read -r old_type_dir; do
                if rm -rf "$old_type_dir"; then
                    log "Deleted old $backup_type backup: $(basename "$old_type_dir")"
                    deleted_count=$((deleted_count + 1))
                else
                    error "Failed to delete old $backup_type backup: $(basename "$old_type_dir")"
                    cleanup_errors=$((cleanup_errors + 1))
                fi
            done
        fi
    done
    
    log "Cleanup completed: $deleted_count items deleted, $cleanup_errors errors"
    
    return $cleanup_errors
}

# リモートバックアップ（オプション）
remote_backup() {
    if [[ "$REMOTE_BACKUP" != "true" ]]; then
        log "Remote backup disabled, skipping..."
        return 0
    fi
    
    log "Starting remote backup..."
    
    # 環境変数から設定を読み取り
    local remote_host="${REMOTE_HOST:-}"
    local remote_path="${REMOTE_PATH:-}"
    local remote_user="${REMOTE_USER:-}"
    
    if [[ -z "$remote_host" || -z "$remote_path" ]]; then
        warn "Remote backup configuration incomplete (REMOTE_HOST, REMOTE_PATH required)"
        return 0
    fi
    
    local compressed_file="$BACKUP_DIR/backup-$BACKUP_DATE.tar.gz"
    
    if [[ ! -f "$compressed_file" ]]; then
        error "Compressed backup file not found: $compressed_file"
        return 1
    fi
    
    # rsync によるリモート転送
    local rsync_cmd="rsync -avz --progress"
    
    if [[ -n "$remote_user" ]]; then
        local remote_dest="$remote_user@$remote_host:$remote_path/"
    else
        local remote_dest="$remote_host:$remote_path/"
    fi
    
    if $rsync_cmd "$compressed_file" "$remote_dest"; then
        log "Remote backup successful to: $remote_dest"
    else
        error "Remote backup failed to: $remote_dest"
        return 1
    fi
    
    log "Remote backup completed"
}

# バックアップ検証
verify_backup() {
    log "Starting backup verification..."
    
    local verification_errors=0
    local compressed_file="$BACKUP_DIR/backup-$BACKUP_DATE.tar.gz"
    
    if [[ -f "$compressed_file" ]]; then
        # 圧縮ファイルの整合性チェック
        if tar -tzf "$compressed_file" >/dev/null 2>&1; then
            log "Compressed backup integrity OK"
            
            # 内容一覧表示（ログ用）
            local file_count
            file_count=$(tar -tzf "$compressed_file" | wc -l)
            log "Compressed backup contains $file_count files/directories"
            
        else
            error "Compressed backup integrity check failed"
            verification_errors=$((verification_errors + 1))
        fi
    else
        # 個別バックアップの検証
        for backup_type in databases logs configs source; do
            local backup_dir="$BACKUP_DIR/$backup_type/$BACKUP_DATE"
            if [[ -d "$backup_dir" ]]; then
                local item_count
                item_count=$(find "$backup_dir" -type f | wc -l)
                log "$backup_type backup contains $item_count files"
                
                if [[ $item_count -eq 0 ]]; then
                    warn "$backup_type backup directory is empty"
                fi
            else
                warn "$backup_type backup directory not found"
            fi
        done
    fi
    
    log "Backup verification completed: $verification_errors errors"
    return $verification_errors
}

# バックアップレポート生成
generate_backup_report() {
    log "Generating backup report..."
    
    local report_file="$PROJECT_DIR/logs/backup-report-$BACKUP_DATE.md"
    
    {
        echo "# 🗄️ バックアップレポート"
        echo "**実行日時**: $(date '+%Y年%m月%d日 %H:%M:%S')"
        echo "**バックアップID**: $BACKUP_DATE"
        echo ""
        
        echo "## 📊 バックアップサマリー"
        
        # バックアップサイズ統計
        if [[ -f "$BACKUP_DIR/backup-$BACKUP_DATE.tar.gz" ]]; then
            local backup_size
            backup_size=$(du -sh "$BACKUP_DIR/backup-$BACKUP_DATE.tar.gz" | cut -f1)
            echo "- **バックアップサイズ**: $backup_size"
            echo "- **バックアップ形式**: 圧縮アーカイブ (.tar.gz)"
        else
            echo "- **バックアップ形式**: 個別ディレクトリ"
        fi
        
        echo "- **保存期間**: ${RETENTION_DAYS}日"
        echo "- **バックアップ先**: $BACKUP_DIR"
        
        if [[ "$REMOTE_BACKUP" == "true" ]]; then
            echo "- **リモートバックアップ**: 有効"
        else
            echo "- **リモートバックアップ**: 無効"
        fi
        
        echo ""
        
        echo "## 📁 バックアップ内容"
        
        # 各バックアップタイプの詳細
        for backup_type in databases logs configs source; do
            echo "### ${backup_type^} Backup"
            
            local backup_dir="$BACKUP_DIR/$backup_type/$BACKUP_DATE"
            if [[ -d "$backup_dir" ]]; then
                local item_count size
                item_count=$(find "$backup_dir" -type f | wc -l)
                size=$(du -sh "$backup_dir" | cut -f1)
                echo "- **ファイル数**: $item_count"
                echo "- **サイズ**: $size"
                
                # ファイル一覧（最大10件）
                echo "- **主要ファイル**:"
                find "$backup_dir" -type f -printf "  - %f (%s bytes)\n" | head -10
                
                if [[ $item_count -gt 10 ]]; then
                    echo "  - ... (他 $((item_count - 10))件)"
                fi
            else
                echo "- ❌ バックアップが見つかりません"
            fi
            
            echo ""
        done
        
        echo "## 🔍 検証結果"
        echo "- **整合性チェック**: 実行済み"
        echo "- **ファイル数検証**: 実行済み"
        echo "- **サイズ検証**: 実行済み"
        echo ""
        
        echo "## 📋 次回バックアップ"
        echo "- **予定日時**: $(date -d '+1 day' '+%Y年%m月%d日 02:00')"
        echo "- **実行コマンド**: \`./scripts/backup.sh\`"
        echo ""
        
        echo "---"
        echo "*このレポートは \`backup.sh\` により自動生成されました*"
        
    } > "$report_file"
    
    log "Backup report generated: backup-report-$BACKUP_DATE.md"
}

# ヘルプ表示
show_help() {
    cat << EOF
🗄️ MCP LLM Generator バックアップツール

使用方法:
  $0 [オプション]

オプション:
  -h, --help          このヘルプを表示
  -d, --dir DIR       バックアップディレクトリを指定 (デフォルト: ./backups)
  -r, --retention N   保存期間を日数で指定 (デフォルト: 30日)
  -c, --compress      圧縮を有効化 (デフォルト: true)
  --no-compress       圧縮を無効化
  --remote            リモートバックアップを有効化
  --verify-only       バックアップ検証のみ実行
  --cleanup-only      古いバックアップの削除のみ実行

環境変数:
  BACKUP_DIR          バックアップディレクトリ
  RETENTION_DAYS      保存期間（日数）
  COMPRESSION         圧縮有効化 (true/false)
  REMOTE_BACKUP       リモートバックアップ有効化 (true/false)
  REMOTE_HOST         リモートホスト
  REMOTE_PATH         リモートパス
  REMOTE_USER         リモートユーザー

例:
  $0                           # 標準バックアップ実行
  $0 -d /backup -r 60          # カスタムディレクトリと保存期間
  $0 --remote                  # リモートバックアップ付き
  $0 --verify-only             # 検証のみ
  $0 --cleanup-only            # クリーンアップのみ

EOF
}

# メイン実行
main() {
    local start_time
    start_time=$(date +%s)
    
    init_backup
    
    local backup_errors=0
    
    # バックアップ実行
    log "=== データベースバックアップ ==="
    if ! backup_databases; then
        backup_errors=$((backup_errors + 1))
    fi
    
    log "=== ログバックアップ ==="
    if ! backup_logs; then
        backup_errors=$((backup_errors + 1))
    fi
    
    log "=== 設定ファイルバックアップ ==="
    if ! backup_configs; then
        backup_errors=$((backup_errors + 1))
    fi
    
    log "=== ソースコードバックアップ ==="
    if ! backup_source; then
        backup_errors=$((backup_errors + 1))
    fi
    
    log "=== バックアップ圧縮 ==="
    if ! compress_backup; then
        backup_errors=$((backup_errors + 1))
    fi
    
    log "=== リモートバックアップ ==="
    if ! remote_backup; then
        backup_errors=$((backup_errors + 1))
    fi
    
    log "=== バックアップ検証 ==="
    if ! verify_backup; then
        backup_errors=$((backup_errors + 1))
    fi
    
    log "=== 古いバックアップ削除 ==="
    if ! cleanup_old_backups; then
        backup_errors=$((backup_errors + 1))
    fi
    
    log "=== バックアップレポート生成 ==="
    generate_backup_report
    
    local end_time duration
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    log "Backup completed in ${duration} seconds with $backup_errors errors"
    
    if [[ $backup_errors -eq 0 ]]; then
        log "✅ All backup operations successful"
        echo "SUCCESS: Backup completed successfully"
        exit 0
    else
        error "❌ Backup completed with $backup_errors errors"
        echo "ERROR: Backup completed with errors"
        exit 1
    fi
}

# コマンドライン引数処理
VERIFY_ONLY=false
CLEANUP_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -d|--dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -r|--retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESSION=true
            shift
            ;;
        --no-compress)
            COMPRESSION=false
            shift
            ;;
        --remote)
            REMOTE_BACKUP=true
            shift
            ;;
        --verify-only)
            VERIFY_ONLY=true
            shift
            ;;
        --cleanup-only)
            CLEANUP_ONLY=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# 特殊モード実行
if [[ "$VERIFY_ONLY" == "true" ]]; then
    init_backup
    verify_backup
    exit $?
elif [[ "$CLEANUP_ONLY" == "true" ]]; then
    init_backup
    cleanup_old_backups
    exit $?
else
    main
fi
