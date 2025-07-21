/**
 * 共有メモリMCPツール実装（ベストプラクティスパターン）
 * SharedMemoryCoreを使用したMCPプロトコル対応層
 *
 * 🟢 ベストプラクティス: server.registerTool()を使用する設計
 * - 各ツールを個別の関数として実装
 * - 統一されたエラーハンドリング
 * - contextMemoryツールと同様のパターン
 */
import Database from 'better-sqlite3';
import { SharedMemoryCore } from '../core/shared-memory-core.js';
/**
 * 共有メモリMCPツール管理クラス
 * ベストプラクティス: ツール登録とビジネスロジックの橋渡し役
 */
export declare class SharedMemoryToolsManager {
    private memoryCore;
    constructor(database: Database.Database);
    /**
     * SharedMemoryCoreインスタンスの取得
     * 個別ツール関数からアクセスするため
     */
    getMemoryCore(): SharedMemoryCore;
    /**
     * データベース接続のクリーンアップ
     */
    close(): void;
}
/**
 * 共有メモリ作成ツール実装
 * ベストプラクティス: 統一されたエラーハンドリングと結果形式
 */
export declare function createSharedMemoryTool(memoryCore: SharedMemoryCore, args: {
    title: string;
    content: string;
    permission_level?: 'public' | 'edit';
    creator_persona_id: string;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
} | {
    isError: boolean;
    content: {
        type: string;
        text: string;
    }[];
}>;
/**
 * 共有メモリ検索ツール実装
 */
export declare function searchSharedMemoryTool(memoryCore: SharedMemoryCore, args: {
    query?: string;
    limit?: number;
    offset?: number;
    requester_persona_id: string;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
} | {
    isError: boolean;
    content: {
        type: string;
        text: string;
    }[];
}>;
/**
 * 共有メモリ取得ツール実装
 */
export declare function getSharedMemoryTool(memoryCore: SharedMemoryCore, args: {
    id: string;
    requester_persona_id: string;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
} | {
    isError: boolean;
    content: {
        type: string;
        text: string;
    }[];
}>;
/**
 * 共有メモリ更新ツール実装
 */
export declare function updateSharedMemoryTool(memoryCore: SharedMemoryCore, args: {
    id: string;
    title?: string;
    content?: string;
    permission_level?: 'public' | 'edit';
    updater_persona_id: string;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
} | {
    isError: boolean;
    content: {
        type: string;
        text: string;
    }[];
}>;
/**
 * 共有メモリ削除ツール実装
 */
export declare function deleteSharedMemoryTool(memoryCore: SharedMemoryCore, args: {
    id: string;
    deleter_persona_id: string;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
} | {
    isError: boolean;
    content: {
        type: string;
        text: string;
    }[];
}>;
/**
 * 共有メモリ通知取得ツール実装
 */
export declare function getSharedMemoryNotificationsTool(memoryCore: SharedMemoryCore, args: {
    persona_id: string;
    limit?: number;
}): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
} | {
    isError: boolean;
    content: {
        type: string;
        text: string;
    }[];
}>;
