/**
 * SharedMemoryCore - 共有メモリの核となるビジネスロジック層
 *
 * MCPツールとPersonaManager両方から利用される共通インターフェース
 * 純粋なビジネスロジックのみを含み、MCPプロトコルやPersonaManager固有の依存を持たない
 */
import { z } from 'zod';
import Database from 'better-sqlite3';
export declare const SharedMemoryItemSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    content: z.ZodString;
    owner_persona_id: z.ZodString;
    permission_level: z.ZodEnum<["public", "edit"]>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    last_updated_by: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    content: string;
    owner_persona_id: string;
    permission_level: "public" | "edit";
    created_at: string;
    updated_at: string;
    last_updated_by: string;
}, {
    id: string;
    title: string;
    content: string;
    owner_persona_id: string;
    permission_level: "public" | "edit";
    created_at: string;
    updated_at: string;
    last_updated_by: string;
}>;
export declare const CreateMemoryRequestSchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodString;
    permission_level: z.ZodDefault<z.ZodEnum<["public", "edit"]>>;
    creator_persona_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    content: string;
    permission_level: "public" | "edit";
    creator_persona_id: string;
}, {
    title: string;
    content: string;
    creator_persona_id: string;
    permission_level?: "public" | "edit" | undefined;
}>;
export declare const UpdateMemoryRequestSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    permission_level: z.ZodOptional<z.ZodEnum<["public", "edit"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title?: string | undefined;
    content?: string | undefined;
    permission_level?: "public" | "edit" | undefined;
}, {
    id: string;
    title?: string | undefined;
    content?: string | undefined;
    permission_level?: "public" | "edit" | undefined;
}>;
export declare const SearchMemoryRequestSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    query?: string | undefined;
}, {
    query?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const NotificationSchema: z.ZodObject<{
    id: z.ZodString;
    memory_id: z.ZodString;
    memory_title: z.ZodString;
    type: z.ZodString;
    message: z.ZodString;
    updated_by: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    message: string;
    type: string;
    memory_id: string;
    memory_title: string;
    updated_by: string;
    timestamp: string;
}, {
    id: string;
    message: string;
    type: string;
    memory_id: string;
    memory_title: string;
    updated_by: string;
    timestamp: string;
}>;
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
export declare class SharedMemoryCore {
    private db;
    constructor(database: Database.Database);
    /**
     * データベーステーブルの初期化
     */
    private initializeTables;
    /**
     * 共有メモの作成
     */
    createMemory(request: CreateMemoryRequest): SharedMemoryResult<{
        id: string;
    }>;
    /**
     * 共有メモの検索
     */
    searchMemories(request: SearchMemoryRequest, requesterPersonaId: string): SharedMemoryResult<{
        memories: SharedMemoryItem[];
        total: number;
    }>;
    /**
     * 共有メモの取得
     */
    getMemory(id: string, requesterPersonaId: string): SharedMemoryResult<SharedMemoryItem>;
    /**
     * 共有メモの更新
     */
    updateMemory(request: UpdateMemoryRequest, updaterPersonaId: string): SharedMemoryResult<void>;
    /**
     * 共有メモの削除
     */
    deleteMemory(id: string, deleterPersonaId: string): SharedMemoryResult<void>;
    /**
     * 最近の通知取得（BIFF機能）
     */
    getRecentNotifications(personaId: string, limit?: number): SharedMemoryResult<NotificationItem[]>;
    /**
     * 通知の取得
     */
    getNotifications(personaId: string): SharedMemoryResult<NotificationItem[]>;
    /**
     * 通知の挿入（内部メソッド）
     */
    private insertNotification;
    /**
     * データベース接続のクリーンアップ
     */
    close(): void;
}
