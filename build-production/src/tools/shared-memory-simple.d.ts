/**
 * 簡易共有メモリMCPツール
 * シンプルな共有メモ・編集・通知機能
 */
import { z } from 'zod';
import Database from 'better-sqlite3';
export declare const SimpleMemoryItemSchema: z.ZodObject<{
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
export declare const CreateMemorySchema: z.ZodObject<{
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
export declare const UpdateMemorySchema: z.ZodObject<{
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
export declare const SearchMemorySchema: z.ZodObject<{
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
export interface SimpleSharedMemoryManager {
    /**
     * 共有メモの作成
     */
    createMemory(data: z.infer<typeof CreateMemorySchema>, creatorPersonaId: string): {
        success: boolean;
        id?: string;
        error?: string;
    };
    /**
     * 共有メモの検索
     */
    searchMemories(params: z.infer<typeof SearchMemorySchema>, requesterPersonaId: string): {
        success: boolean;
        memories?: Array<z.infer<typeof SimpleMemoryItemSchema>>;
        total?: number;
        error?: string;
    };
    /**
     * 共有メモの取得
     */
    getMemory(id: string, requesterPersonaId: string): {
        success: boolean;
        memory?: z.infer<typeof SimpleMemoryItemSchema>;
        error?: string;
    };
    /**
     * 共有メモの更新
     */
    updateMemory(data: z.infer<typeof UpdateMemorySchema>, updaterPersonaId: string): {
        success: boolean;
        error?: string;
    };
    /**
     * 共有メモの削除
     */
    deleteMemory(id: string, deleterPersonaId: string): {
        success: boolean;
        error?: string;
    };
    /**
     * 最近の変更通知（BIFF機能シンプル版）
     */
    getRecentNotifications(personaId: string, limit: number): {
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
export declare class SimpleSharedMemoryManagerImpl implements SimpleSharedMemoryManager {
    private db;
    constructor(database: Database.Database);
    private initializeTables;
    createMemory(data: z.infer<typeof CreateMemorySchema>): {
        success: boolean;
        id?: string;
        error?: string;
    };
    searchMemories(params: z.infer<typeof SearchMemorySchema>, requesterPersonaId: string): {
        success: boolean;
        memories?: Array<z.infer<typeof SimpleMemoryItemSchema>>;
        total?: number;
        error?: string;
    };
    getMemory(id: string, requesterPersonaId: string): {
        success: boolean;
        memory?: z.infer<typeof SimpleMemoryItemSchema>;
        error?: string;
    };
    updateMemory(data: z.infer<typeof UpdateMemorySchema>, updaterPersonaId: string): {
        success: boolean;
        error?: string;
    };
    deleteMemory(id: string, deleterPersonaId: string): {
        success: boolean;
        error?: string;
    };
    getRecentNotifications(personaId: string, limit?: number): {
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
    private createNotification;
}
