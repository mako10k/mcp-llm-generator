// Step4マージ機能 - OriginalDataManager
// 作成日: 2025年7月22日
// 目的: マージ前のオリジナルデータの保存と復元管理

import Database from 'better-sqlite3';

// 型定義
interface CapabilityInfo {
  category: string;
  description: string;
  priority: number;
  [key: string]: unknown;
}

interface ContextMetadata {
  version: string;
  lastModified: string;
  [key: string]: unknown;
}

// データベース行の型定義
interface SnapshotRow {
  snapshot_id: string;
  context_id: string;
  original_prompt: string;
  original_capabilities: string;
  original_metadata: string | null;
  timestamp: string;
  merge_operation_id: string;
}

export interface OriginalDataSnapshot {
  snapshotId: string;
  contextId: string;
  originalPrompt: string;
  originalCapabilities: CapabilityInfo[];
  originalMetadata: ContextMetadata;
  timestamp: string;
  mergeOperationId: string;
}

/**
 * オリジナルデータ管理クラス
 * マージ操作前のデータスナップショットの保存・復元を管理
 */
export class OriginalDataManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
    this.initializeTables();
  }

  /**
   * データベース行をOriginalDataSnapshotオブジェクトにマップ（重複排除）
   */
  private mapRowToSnapshot(row: SnapshotRow): OriginalDataSnapshot {
    return {
      snapshotId: row.snapshot_id,
      contextId: row.context_id,
      originalPrompt: row.original_prompt,
      originalCapabilities: JSON.parse(row.original_capabilities),
      originalMetadata: row.original_metadata ? JSON.parse(row.original_metadata) : null,
      timestamp: row.timestamp,
      mergeOperationId: row.merge_operation_id
    };
  }

  /**
   * データベーステーブルの初期化
   */
  private initializeTables(): void {
    const createSnapshotTable = this.db.prepare(`
      CREATE TABLE IF NOT EXISTS original_data_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        context_id TEXT NOT NULL,
        original_prompt TEXT NOT NULL,
        original_capabilities TEXT NOT NULL, -- JSON
        original_metadata TEXT, -- JSON
        timestamp TEXT NOT NULL,
        merge_operation_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_context_id (context_id),
        INDEX idx_merge_operation_id (merge_operation_id),
        INDEX idx_timestamp (timestamp)
      )
    `);

    createSnapshotTable.run();
  }

  /**
   * データスナップショットの作成
   */
  async createSnapshot(
    contextId: string,
    originalPrompt: string,
    originalCapabilities: CapabilityInfo[],
    originalMetadata: ContextMetadata,
    mergeOperationId: string
  ): Promise<string> {
    const snapshotId = this.generateSnapshotId();
    const timestamp = new Date().toISOString();

    const insertSnapshot = this.db.prepare(`
      INSERT INTO original_data_snapshots (
        snapshot_id, context_id, original_prompt, 
        original_capabilities, original_metadata, 
        timestamp, merge_operation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertSnapshot.run(
      snapshotId,
      contextId,
      originalPrompt,
      JSON.stringify(originalCapabilities),
      originalMetadata ? JSON.stringify(originalMetadata) : null,
      timestamp,
      mergeOperationId
    );

    return snapshotId;
  }

  /**
   * スナップショットの取得
   */
  async getSnapshot(snapshotId: string): Promise<OriginalDataSnapshot | null> {
    const selectSnapshot = this.db.prepare(`
      SELECT * FROM original_data_snapshots WHERE snapshot_id = ?
    `);

    const row = selectSnapshot.get(snapshotId) as SnapshotRow | undefined;
    if (!row) return null;

    return this.mapRowToSnapshot(row);
  }

  /**
   * コンテキストIDによるスナップショット一覧の取得
   */
  async getSnapshotsByContext(contextId: string): Promise<OriginalDataSnapshot[]> {
    const selectSnapshots = this.db.prepare(`
      SELECT * FROM original_data_snapshots 
      WHERE context_id = ? 
      ORDER BY created_at DESC
    `);

    const rows = selectSnapshots.all(contextId) as SnapshotRow[];
    return rows.map(row => this.mapRowToSnapshot(row));
  }

  /**
   * マージ操作IDによるスナップショットの取得
   */
  async getSnapshotByMergeOperation(mergeOperationId: string): Promise<OriginalDataSnapshot | null> {
    const selectSnapshot = this.db.prepare(`
      SELECT * FROM original_data_snapshots WHERE merge_operation_id = ?
    `);

    const row = selectSnapshot.get(mergeOperationId) as SnapshotRow | undefined;
    if (!row) return null;

    return this.mapRowToSnapshot(row);
  }

  /**
   * データの復元
   * 指定されたスナップショットIDからオリジナルデータを復元
   */
  async restoreData(snapshotId: string): Promise<{
    contextId: string;
    originalPrompt: string;
    originalCapabilities: CapabilityInfo[];
    originalMetadata: ContextMetadata;
  } | null> {
    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot) return null;

    return {
      contextId: snapshot.contextId,
      originalPrompt: snapshot.originalPrompt,
      originalCapabilities: snapshot.originalCapabilities,
      originalMetadata: snapshot.originalMetadata
    };
  }

  /**
   * 古いスナップショットのクリーンアップ
   */
  async cleanupOldSnapshots(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleteOldSnapshots = this.db.prepare(`
      DELETE FROM original_data_snapshots 
      WHERE created_at < ?
    `);

    const result = deleteOldSnapshots.run(cutoffDate.toISOString());
    return result.changes;
  }

  /**
   * 特定のコンテキストのスナップショット削除
   */
  async deleteContextSnapshots(contextId: string): Promise<number> {
    const deleteSnapshots = this.db.prepare(`
      DELETE FROM original_data_snapshots WHERE context_id = ?
    `);

    const result = deleteSnapshots.run(contextId);
    return result.changes;
  }

  /**
   * 特定のマージ操作のスナップショット削除
   */
  async deleteMergeOperationSnapshot(mergeOperationId: string): Promise<number> {
    const deleteSnapshot = this.db.prepare(`
      DELETE FROM original_data_snapshots WHERE merge_operation_id = ?
    `);

    const result = deleteSnapshot.run(mergeOperationId);
    return result.changes;
  }

  /**
   * スナップショット統計の取得
   */
  async getSnapshotStatistics(): Promise<{
    totalSnapshots: number;
    snapshotsByContext: { [contextId: string]: number };
    oldestSnapshot: string | null;
    newestSnapshot: string | null;
  }> {
    // 総スナップショット数
    const totalCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM original_data_snapshots
    `).get() as { count: number };

    // コンテキスト別の統計
    const contextStats = this.db.prepare(`
      SELECT context_id, COUNT(*) as count 
      FROM original_data_snapshots 
      GROUP BY context_id
    `).all() as { context_id: string; count: number }[];

    const snapshotsByContext: { [contextId: string]: number } = {};
    contextStats.forEach(stat => {
      snapshotsByContext[stat.context_id] = stat.count;
    });

    // 最古・最新のスナップショット
    const oldestSnapshot = this.db.prepare(`
      SELECT timestamp FROM original_data_snapshots 
      ORDER BY created_at ASC LIMIT 1
    `).get() as { timestamp: string } | undefined;

    const newestSnapshot = this.db.prepare(`
      SELECT timestamp FROM original_data_snapshots 
      ORDER BY created_at DESC LIMIT 1
    `).get() as { timestamp: string } | undefined;

    return {
      totalSnapshots: totalCount.count,
      snapshotsByContext,
      oldestSnapshot: oldestSnapshot?.timestamp || null,
      newestSnapshot: newestSnapshot?.timestamp || null
    };
  }

  /**
   * スナップショットIDの生成
   */
  private generateSnapshotId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `snapshot_${timestamp}_${random}`;
  }

  /**
   * データベース接続のクローズ
   */
  close(): void {
    // better-sqlite3はDatabase.close()でクローズ
    // ただし、共有データベースの場合は外部で管理
  }
}
