/**
 * 簡易共有メモリMCPツール
 * シンプルな共有メモ・編集・通知機能
 */

import { z } from 'zod';
import Database from 'better-sqlite3';

// シンプルなスキーマ定義
export const SimpleMemoryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  owner_persona_id: z.string(),
  permission_level: z.enum(['public', 'edit']), // public=見るだけ, edit=編集可能
  created_at: z.string(),
  updated_at: z.string(),
  last_updated_by: z.string()
});

export const CreateMemorySchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(10000),
  permission_level: z.enum(['public', 'edit']).default('edit'),
  creator_persona_id: z.string()
});

export const UpdateMemorySchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(10000).optional(),
  permission_level: z.enum(['public', 'edit']).optional()
});

export const SearchMemorySchema = z.object({
  query: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
  offset: z.number().min(0).default(0)
});

export interface SimpleSharedMemoryManager {
  /**
   * 共有メモの作成
   */
  createMemory(
    data: z.infer<typeof CreateMemorySchema>,
    creatorPersonaId: string
  ): { success: boolean; id?: string; error?: string };

  /**
   * 共有メモの検索
   */
  searchMemories(
    params: z.infer<typeof SearchMemorySchema>,
    requesterPersonaId: string
  ): { 
    success: boolean; 
    memories?: Array<z.infer<typeof SimpleMemoryItemSchema>>; 
    total?: number;
    error?: string;
  };

  /**
   * 共有メモの取得
   */
  getMemory(
    id: string,
    requesterPersonaId: string
  ): { 
    success: boolean; 
    memory?: z.infer<typeof SimpleMemoryItemSchema>; 
    error?: string;
  };

  /**
   * 共有メモの更新
   */
  updateMemory(
    data: z.infer<typeof UpdateMemorySchema>,
    updaterPersonaId: string
  ): { success: boolean; error?: string };

  /**
   * 共有メモの削除
   */
  deleteMemory(
    id: string,
    deleterPersonaId: string
  ): { success: boolean; error?: string };

  /**
   * 最近の変更通知（BIFF機能シンプル版）
   */
  getRecentNotifications(
    personaId: string,
    limit: number
  ): {
    success: boolean;
    notifications?: Array<{
      id: string;
      message: string;
      type: 'created' | 'updated' | 'deleted';
      memory_id: string;
      memory_title: string;
      updated_by: string;
      timestamp: string;
    }>;
    error?: string;
  };
}

/**
 * シンプル実装クラス
 * 既存PersonaManager基盤を活用しつつ最小限の機能
 */
export class SimpleSharedMemoryManagerImpl implements SimpleSharedMemoryManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
    this.initializeTables();
  }

  private initializeTables(): void {
    // シンプルな共有メモテーブル（contextsテーブルのidカラムを正しく参照）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shared_memories (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        owner_persona_id TEXT NOT NULL,
        permission_level TEXT NOT NULL DEFAULT 'edit' CHECK (permission_level IN ('public', 'edit')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_updated_by TEXT NOT NULL,
        FOREIGN KEY (owner_persona_id) REFERENCES contexts(id) ON DELETE CASCADE,
        FOREIGN KEY (last_updated_by) REFERENCES contexts(id) ON DELETE CASCADE
      );
    `);

    // シンプルな通知履歴テーブル（外部キー制約なし版）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_notifications (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        memory_id TEXT NOT NULL,
        action_type TEXT NOT NULL CHECK (action_type IN ('created', 'updated', 'deleted')),
        message TEXT NOT NULL,
        triggered_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // インデックス
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_shared_memories_owner ON shared_memories(owner_persona_id);
      CREATE INDEX IF NOT EXISTS idx_shared_memories_updated ON shared_memories(updated_at);
      CREATE INDEX IF NOT EXISTS idx_memory_notifications_created ON memory_notifications(created_at);
    `);
  }

  createMemory(
    data: z.infer<typeof CreateMemorySchema>
  ): { success: boolean; id?: string; error?: string } {
    try {
      // バリデーション
      const validatedData = CreateMemorySchema.parse(data);

      const stmt = this.db.prepare(`
        INSERT INTO shared_memories (title, content, owner_persona_id, permission_level, last_updated_by)
        VALUES (?, ?, ?, ?, ?)
      `);

            const result = stmt.run(
        validatedData.title,
        validatedData.content,
        validatedData.creator_persona_id,
        validatedData.permission_level,
        validatedData.creator_persona_id
      );

      const memoryId = result.lastInsertRowid?.toString();

      // 通知作成
      this.createNotification(
        memoryId!,
        'created',
        `「${validatedData.title}」が作成されました`,
        validatedData.creator_persona_id
      );

      return { success: true, id: memoryId };
    } catch (error) {
      console.error('Failed to create memory:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  searchMemories(
    params: z.infer<typeof SearchMemorySchema>,
    requesterPersonaId: string
  ): { 
    success: boolean; 
    memories?: Array<z.infer<typeof SimpleMemoryItemSchema>>; 
    total?: number;
    error?: string;
  } {
    try {
      const validatedParams = SearchMemorySchema.parse(params);

      let whereClause = '1=1';
      const queryParams: any[] = [];

      if (validatedParams.query) {
        whereClause += ' AND (title LIKE ? OR content LIKE ?)';
        queryParams.push(`%${validatedParams.query}%`, `%${validatedParams.query}%`);
      }

      // 総数取得
      const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM shared_memories WHERE ${whereClause}`);
      const countResult = countStmt.get(...queryParams) as any;

      // データ取得
      const stmt = this.db.prepare(`
        SELECT * FROM shared_memories 
        WHERE ${whereClause}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `);

      const memories = stmt.all(...queryParams, validatedParams.limit, validatedParams.offset) as any[];

      return {
        success: true,
        memories: memories.map(m => SimpleMemoryItemSchema.parse(m)),
        total: countResult.total
      };
    } catch (error) {
      console.error('Failed to search memories:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  getMemory(
    id: string,
    requesterPersonaId: string
  ): { 
    success: boolean; 
    memory?: z.infer<typeof SimpleMemoryItemSchema>; 
    error?: string;
  } {
    try {
      const stmt = this.db.prepare('SELECT * FROM shared_memories WHERE id = ?');
      const result = stmt.get(id) as any;

      if (!result) {
        return { success: false, error: 'Memory not found' };
      }

      return {
        success: true,
        memory: SimpleMemoryItemSchema.parse(result)
      };
    } catch (error) {
      console.error('Failed to get memory:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  updateMemory(
    data: z.infer<typeof UpdateMemorySchema>,
    updaterPersonaId: string
  ): { success: boolean; error?: string } {
    try {
      const validatedData = UpdateMemorySchema.parse(data);

      // 既存データ取得
      const existing = this.getMemory(validatedData.id, updaterPersonaId);
      if (!existing.success || !existing.memory) {
        return { success: false, error: 'Memory not found' };
      }

      // 編集権限チェック（シンプル版: edit権限のメモのみ編集可能）
      if (existing.memory.permission_level === 'public' && existing.memory.owner_persona_id !== updaterPersonaId) {
        return { success: false, error: 'Permission denied: Cannot edit public memory' };
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (validatedData.title !== undefined) {
        updates.push('title = ?');
        params.push(validatedData.title);
      }

      if (validatedData.content !== undefined) {
        updates.push('content = ?');
        params.push(validatedData.content);
      }

      if (validatedData.permission_level !== undefined) {
        updates.push('permission_level = ?');
        params.push(validatedData.permission_level);
      }

      updates.push('updated_at = datetime("now")');
      updates.push('last_updated_by = ?');
      params.push(updaterPersonaId);

      params.push(validatedData.id);

      const stmt = this.db.prepare(`
        UPDATE shared_memories 
        SET ${updates.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...params);

      // 通知作成
      this.createNotification(
        validatedData.id,
        'updated',
        `「${validatedData.title || existing.memory.title}」が更新されました`,
        updaterPersonaId
      );

      return { success: true };
    } catch (error) {
      console.error('Failed to update memory:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  deleteMemory(
    id: string,
    deleterPersonaId: string
  ): { success: boolean; error?: string } {
    try {
      // 既存データ取得
      const existing = this.getMemory(id, deleterPersonaId);
      if (!existing.success || !existing.memory) {
        return { success: false, error: 'Memory not found' };
      }

      // 削除権限チェック（シンプル版: 所有者のみ削除可能）
      if (existing.memory.owner_persona_id !== deleterPersonaId) {
        return { success: false, error: 'Permission denied: Only owner can delete memory' };
      }

      // 通知作成（削除前）
      this.createNotification(
        id,
        'deleted',
        `「${existing.memory.title}」が削除されました`,
        deleterPersonaId
      );

      const stmt = this.db.prepare('DELETE FROM shared_memories WHERE id = ?');
      stmt.run(id);

      return { success: true };
    } catch (error) {
      console.error('Failed to delete memory:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  getRecentNotifications(
    personaId: string,
    limit: number = 10
  ): {
    success: boolean;
    notifications?: Array<{
      id: string;
      message: string;
      type: 'created' | 'updated' | 'deleted';
      memory_id: string;
      memory_title: string;
      updated_by: string;
      timestamp: string;
    }>;
    error?: string;
  } {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          n.id,
          n.message,
          n.action_type as type,
          n.memory_id,
          COALESCE(sm.title, '(削除済み)') as memory_title,
          n.triggered_by as updated_by,
          n.created_at as timestamp
        FROM memory_notifications n
        LEFT JOIN shared_memories sm ON n.memory_id = sm.id
        ORDER BY n.created_at DESC
        LIMIT ?
      `);

      const notifications = stmt.all(limit) as any[];

      return {
        success: true,
        notifications
      };
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private createNotification(
    memoryId: string,
    actionType: 'created' | 'updated' | 'deleted',
    message: string,
    triggeredBy: string
  ): void {
    try {
      // triggeredBy が contexts テーブルに存在するかチェック（正しい参照先確認）
      const contextExists = this.db.prepare('SELECT 1 FROM contexts WHERE id = ?').get(triggeredBy);
      
      if (!contextExists) {
        console.warn(`Context ${triggeredBy} not found, skipping notification creation`);
        return;
      }

      const stmt = this.db.prepare(`
        INSERT INTO memory_notifications (memory_id, action_type, message, triggered_by)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(memoryId, actionType, message, triggeredBy);
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }
}
