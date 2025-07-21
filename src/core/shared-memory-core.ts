/**
 * SharedMemoryCore - 共有メモリの核となるビジネスロジック層
 * 
 * MCPツールとPersonaManager両方から利用される共通インターフェース
 * 純粋なビジネスロジックのみを含み、MCPプロトコルやPersonaManager固有の依存を持たない
 */

import { z, ZodError } from 'zod';
import Database from 'better-sqlite3';

// 共有メモリのスキーマ定義
export const SharedMemoryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  owner_persona_id: z.string(),
  permission_level: z.enum(['public', 'edit']),
  created_at: z.string(),
  updated_at: z.string(),
  last_updated_by: z.string()
});

export const CreateMemoryRequestSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(10000),
  permission_level: z.enum(['public', 'edit']).default('edit'),
  creator_persona_id: z.string()
});

export const UpdateMemoryRequestSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(10000).optional(),
  permission_level: z.enum(['public', 'edit']).optional()
});

export const SearchMemoryRequestSchema = z.object({
  query: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
  offset: z.number().min(0).default(0)
});

export const NotificationSchema = z.object({
  id: z.string(),
  memory_id: z.string(),
  memory_title: z.string(),
  type: z.string(),
  message: z.string(),
  updated_by: z.string(),
  timestamp: z.string()
});

// 共有メモリコアの結果型定義
export type SharedMemoryResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type SharedMemoryItem = z.infer<typeof SharedMemoryItemSchema>;
export type CreateMemoryRequest = z.infer<typeof CreateMemoryRequestSchema>;
export type UpdateMemoryRequest = z.infer<typeof UpdateMemoryRequestSchema>;
export type SearchMemoryRequest = z.infer<typeof SearchMemoryRequestSchema>;
export type NotificationItem = z.infer<typeof NotificationSchema>;

/**
 * SharedMemoryCore - 核となるビジネスロジック実装
 * 
 * 責任範囲:
 * - 共有メモリのCRUD操作
 * - 権限管理とアクセス制御
 * - 通知機能（BIFF）
 * - データベース操作とトランザクション管理
 */
export class SharedMemoryCore {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
    this.initializeTables();
  }

  /**
   * データベーステーブルの初期化
   */
  private initializeTables(): void {
    // 共有メモリテーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shared_memories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        owner_persona_id TEXT NOT NULL,
        permission_level TEXT NOT NULL DEFAULT 'edit',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_updated_by TEXT NOT NULL
      )
    `);

    // 通知テーブル（BIFF機能）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shared_memory_notifications (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        memory_title TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (memory_id) REFERENCES shared_memories (id) ON DELETE CASCADE
      )
    `);

    // インデックスの作成
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_shared_memories_owner ON shared_memories(owner_persona_id);
      CREATE INDEX IF NOT EXISTS idx_shared_memories_updated ON shared_memories(updated_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON shared_memory_notifications(timestamp);
    `);
  }

  /**
   * 共有メモの作成
   */
  createMemory(request: CreateMemoryRequest): SharedMemoryResult<{ id: string }> {
    try {
      // バリデーション
      const validatedData = CreateMemoryRequestSchema.parse(request);

      const memoryId = `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const stmt = this.db.prepare(`
        INSERT INTO shared_memories (id, title, content, owner_persona_id, permission_level, last_updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        memoryId,
        validatedData.title,
        validatedData.content,
        validatedData.creator_persona_id,
        validatedData.permission_level,
        validatedData.creator_persona_id
      );

      // 通知の作成
      this.insertNotification(
        memoryId,
        validatedData.title,
        'created', // テスト仕様に合わせて修正
        'メモリが作成されました。',
        validatedData.creator_persona_id
      );

      return { success: true, data: { id: memoryId } };
    } catch (error) {
      if (error instanceof ZodError) {
        return { success: false, error: error.errors.map(e => e.message).join(', ') };
      }
      return { success: false, error: '予期しないエラーが発生しました。' };
    }
  }

  /**
   * 共有メモの検索
   */
  searchMemories(
    request: SearchMemoryRequest,
    requesterPersonaId: string
  ): SharedMemoryResult<{ memories: SharedMemoryItem[]; total: number }> {
    try {
      const validatedParams = SearchMemoryRequestSchema.parse(request);
      
      let whereClause = '';
      let params: any[] = [];
      
      if (validatedParams.query) {
        whereClause = 'WHERE (title LIKE ? OR content LIKE ?)';
        const searchPattern = `%${validatedParams.query}%`;
        params = [searchPattern, searchPattern];
      }
      
      // 総数取得
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as total FROM shared_memories ${whereClause}
      `);
      const totalResult = countStmt.get(...params) as { total: number };
      
      // データ取得
      const selectStmt = this.db.prepare(`
        SELECT * FROM shared_memories 
        ${whereClause}
        ORDER BY updated_at DESC 
        LIMIT ? OFFSET ?
      `);
      
      const memories = selectStmt.all(
        ...params,
        validatedParams.limit,
        validatedParams.offset
      ) as SharedMemoryItem[];

      return {
        success: true,
        data: {
          memories,
          total: totalResult.total
        }
      };
    } catch (error) {
      console.error('Failed to search memories:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 共有メモの取得
   */
  getMemory(id: string, requesterPersonaId: string): SharedMemoryResult<SharedMemoryItem> {
    try {
      const stmt = this.db.prepare('SELECT * FROM shared_memories WHERE id = ?');
      const memory = stmt.get(id) as SharedMemoryItem | undefined;

      if (!memory) {
        return { 
          success: false, 
          error: 'Memory not found' 
        };
      }

      return { 
        success: true, 
        data: memory 
      };
    } catch (error) {
      console.error('Failed to get memory:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 共有メモの更新
   */
  updateMemory(
    request: UpdateMemoryRequest,
    updaterPersonaId: string
  ): SharedMemoryResult<void> {
    try {
      const validatedData = UpdateMemoryRequestSchema.parse(request);
      
      // 既存メモの取得
      const existingMemory = this.db.prepare('SELECT * FROM shared_memories WHERE id = ?')
        .get(validatedData.id) as SharedMemoryItem | undefined;
      
      if (!existingMemory) {
        return { 
          success: false, 
          error: 'Memory not found' 
        };
      }

      // 権限チェック
      if (existingMemory.permission_level === 'public' && 
          existingMemory.owner_persona_id !== updaterPersonaId) {
        return { 
          success: false, 
          error: 'No permission to update this memory' 
        };
      }

      // 更新実行
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      
      if (validatedData.title !== undefined) {
        updateFields.push('title = ?');
        updateValues.push(validatedData.title);
      }
      
      if (validatedData.content !== undefined) {
        updateFields.push('content = ?');
        updateValues.push(validatedData.content);
      }
      
      if (validatedData.permission_level !== undefined) {
        updateFields.push('permission_level = ?');
        updateValues.push(validatedData.permission_level);
      }
      
      updateFields.push('updated_at = datetime(\'now\')');
      updateFields.push('last_updated_by = ?');
      updateValues.push(updaterPersonaId);
      updateValues.push(validatedData.id);

      const updateStmt = this.db.prepare(`
        UPDATE shared_memories 
        SET ${updateFields.join(', ')} 
        WHERE id = ?
      `);
      
      updateStmt.run(...updateValues);

      // 通知の作成
      this.insertNotification(
        validatedData.id,
        validatedData.title || existingMemory.title,
        'updated',
        `「${validatedData.title || existingMemory.title}」が更新されました`,
        updaterPersonaId
      );

      return { success: true };
    } catch (error) {
      console.error('Failed to update memory:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 共有メモの削除
   */
  deleteMemory(id: string, deleterPersonaId: string): SharedMemoryResult<void> {
    try {
      // 既存メモの取得
      const existingMemory = this.db.prepare('SELECT * FROM shared_memories WHERE id = ?')
        .get(id) as SharedMemoryItem | undefined;
      
      if (!existingMemory) {
        return { 
          success: false, 
          error: 'Memory not found' 
        };
      }

      // 権限チェック（所有者のみ削除可能）
      if (existingMemory.owner_persona_id !== deleterPersonaId) {
        return { 
          success: false, 
          error: 'Only the owner can delete this memory' 
        };
      }

      // 削除実行
      const deleteStmt = this.db.prepare('DELETE FROM shared_memories WHERE id = ?');
      deleteStmt.run(id);

      // 通知の作成
      this.insertNotification(
        id,
        existingMemory.title,
        'deleted',
        `「${existingMemory.title}」が削除されました`,
        deleterPersonaId
      );

      return { success: true };
    } catch (error) {
      console.error('Failed to delete memory:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 最近の通知取得（BIFF機能）
   */
  getRecentNotifications(
    personaId: string,
    limit: number = 10
  ): SharedMemoryResult<NotificationItem[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM shared_memory_notifications 
        ORDER BY timestamp DESC 
        LIMIT ?
      `);
      
      const notifications = stmt.all(limit) as NotificationItem[];

      return { 
        success: true, 
        data: notifications 
      };
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 通知の取得
   */
  getNotifications(personaId: string): SharedMemoryResult<NotificationItem[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM shared_memory_notifications
        WHERE updated_by = ?
        ORDER BY timestamp DESC
      `);

      const rows: NotificationItem[] = stmt.all(personaId) as NotificationItem[];

      return { success: true, data: rows };
    } catch (error) {
      console.error('Failed to retrieve notifications:', error);
      return { success: false, error: '通知の取得に失敗しました。' };
    }
  }

  /**
   * 通知の挿入（内部メソッド）
   */
  private insertNotification(
    memoryId: string,
    memoryTitle: string,
    type: string,
    message: string,
    updatedBy: string
  ): void {
    try {
      const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const stmt = this.db.prepare(`
        INSERT INTO shared_memory_notifications (id, memory_id, memory_title, type, message, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(notificationId, memoryId, memoryTitle, type, message, updatedBy);
    } catch (error) {
      console.error('Failed to insert notification:', error);
      // 通知の失敗はメイン処理を止めない
    }
  }

  /**
   * データベース接続のクリーンアップ
   */
  close(): void {
    this.db.close();
  }
}
