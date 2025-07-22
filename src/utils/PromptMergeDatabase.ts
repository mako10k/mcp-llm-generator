// Step4マージ機能 - データベース拡張
// 作成日: 2025年7月22日
// 目的: ContextMemoryDatabaseにPromptMergeHistory機能を追加

import Database from 'better-sqlite3';
import { 
  PromptMergeHistory, 
  ErrorDetails, 
  RollbackDetails, 
  CapabilityInfo 
} from '../types/promptMerge.js';

/**
 * Step4マージ機能用のデータベース拡張クラス
 * 既存のContextMemoryDatabaseを拡張
 */
export class PromptMergeDatabase {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
    this.initializeMergeSchema();
  }

  /**
   * Step4マージ機能用のテーブル初期化
   */
  private initializeMergeSchema(): void {
    // PromptMergeHistoryテーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prompt_merge_history (
        id TEXT PRIMARY KEY,
        context_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        original_user_prompt TEXT NOT NULL,
        original_capabilities TEXT NOT NULL, -- JSON string
        original_task_context TEXT,
        merged_result TEXT NOT NULL, -- JSON string
        compression_settings TEXT NOT NULL, -- JSON string
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'rolled_back')),
        error_info TEXT, -- JSON string (ErrorDetails)
        rollback_info TEXT, -- JSON string (RollbackDetails)
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
      );
    `);

    // インデックス作成
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_prompt_merge_context_id ON prompt_merge_history(context_id);
      CREATE INDEX IF NOT EXISTS idx_prompt_merge_status ON prompt_merge_history(status);
      CREATE INDEX IF NOT EXISTS idx_prompt_merge_timestamp ON prompt_merge_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_prompt_merge_version ON prompt_merge_history(context_id, version);
    `);

    console.log('✅ Step4 PromptMerge database schema initialized');
  }

  /**
   * マージ履歴の保存
   */
  saveMergeHistory(history: PromptMergeHistory): void {
    const stmt = this.db.prepare(`
      INSERT INTO prompt_merge_history (
        id, context_id, timestamp, original_user_prompt, original_capabilities,
        original_task_context, merged_result, compression_settings, version,
        status, error_info, rollback_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      history.id,
      history.contextId,
      history.timestamp.toISOString(),
      history.originalUserPrompt,
      JSON.stringify(history.originalCapabilities),
      history.originalTaskContext || null,
      JSON.stringify(history.mergedResult),
      JSON.stringify(history.compressionSettings),
      history.version,
      history.status,
      history.errorInfo ? JSON.stringify(history.errorInfo) : null,
      history.rollbackInfo ? JSON.stringify(history.rollbackInfo) : null
    );
  }

  /**
   * マージ履歴の取得
   */
  getMergeHistory(id: string): PromptMergeHistory | null {
    const stmt = this.db.prepare(`
      SELECT * FROM prompt_merge_history WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToMergeHistory(row);
  }

  /**
   * コンテキストIDによるマージ履歴一覧取得
   */
  getMergeHistoriesByContext(contextId: string, limit: number = 50): PromptMergeHistory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM prompt_merge_history 
      WHERE context_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const rows = stmt.all(contextId, limit) as any[];
    return rows.map(row => this.mapRowToMergeHistory(row));
  }

  /**
   * 最新バージョンの取得
   */
  getLatestVersion(contextId: string): number {
    const stmt = this.db.prepare(`
      SELECT MAX(version) as max_version 
      FROM prompt_merge_history 
      WHERE context_id = ? AND status = 'success'
    `);

    const result = stmt.get(contextId) as any;
    return result?.max_version || 0;
  }

  /**
   * 特定バージョンのマージ履歴取得
   */
  getMergeHistoryByVersion(contextId: string, version: number): PromptMergeHistory | null {
    const stmt = this.db.prepare(`
      SELECT * FROM prompt_merge_history 
      WHERE context_id = ? AND version = ?
    `);

    const row = stmt.get(contextId, version) as any;
    if (!row) return null;

    return this.mapRowToMergeHistory(row);
  }

  /**
   * マージ履歴の更新（ステータス変更等）
   */
  updateMergeHistory(id: string, updates: Partial<PromptMergeHistory>): void {
    const setClause: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      setClause.push('status = ?');
      values.push(updates.status);
    }

    if (updates.errorInfo) {
      setClause.push('error_info = ?');
      values.push(JSON.stringify(updates.errorInfo));
    }

    if (updates.rollbackInfo) {
      setClause.push('rollback_info = ?');
      values.push(JSON.stringify(updates.rollbackInfo));
    }

    if (setClause.length === 0) return;

    setClause.push('updated_at = datetime("now")');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE prompt_merge_history 
      SET ${setClause.join(', ')} 
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  /**
   * 古いマージ履歴のクリーンアップ
   */
  cleanupOldMergeHistory(contextId: string, keepVersions: number = 10): number {
    const stmt = this.db.prepare(`
      DELETE FROM prompt_merge_history 
      WHERE context_id = ? 
      AND version NOT IN (
        SELECT version FROM prompt_merge_history 
        WHERE context_id = ? 
        ORDER BY version DESC 
        LIMIT ?
      )
    `);

    const result = stmt.run(contextId, contextId, keepVersions);
    return result.changes;
  }

  /**
   * データベース行をPromptMergeHistoryオブジェクトにマップ
   */
  private mapRowToMergeHistory(row: any): PromptMergeHistory {
    return {
      id: row.id,
      contextId: row.context_id,
      timestamp: new Date(row.timestamp),
      originalUserPrompt: row.original_user_prompt,
      originalCapabilities: JSON.parse(row.original_capabilities),
      originalTaskContext: row.original_task_context,
      mergedResult: JSON.parse(row.merged_result),
      compressionSettings: JSON.parse(row.compression_settings),
      version: row.version,
      status: row.status,
      errorInfo: row.error_info ? JSON.parse(row.error_info) : undefined,
      rollbackInfo: row.rollback_info ? JSON.parse(row.rollback_info) : undefined
    };
  }

  /**
   * トランザクション実行（better-sqlite3のネイティブトランザクション）
   */
  runInTransaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  /**
   * データベース接続のクリーンアップ
   */
  close(): void {
    this.db.close();
  }
}
