/**
 * 共有メモリMCPツール実装（ベストプラクティスパターン）
 * SharedMemoryCoreを使用したMCPプロトコル対応層
 *
 * 🟢 ベストプラクティス: server.registerTool()を使用する設計
 * - 各ツールを個別の関数として実装
 * - 統一されたエラーハンドリング
 * - contextMemoryツールと同様のパターン
 */
import { z } from 'zod';
import { SharedMemoryCore, CreateMemoryRequestSchema, SearchMemoryRequestSchema } from '../core/shared-memory-core.js';
/**
 * 共有メモリMCPツール管理クラス
 * ベストプラクティス: ツール登録とビジネスロジックの橋渡し役
 */
export class SharedMemoryToolsManager {
    memoryCore;
    constructor(database) {
        this.memoryCore = new SharedMemoryCore(database);
    }
    /**
     * SharedMemoryCoreインスタンスの取得
     * 個別ツール関数からアクセスするため
     */
    getMemoryCore() {
        return this.memoryCore;
    }
    /**
     * データベース接続のクリーンアップ
     */
    close() {
        this.memoryCore.close();
    }
}
/**
 * 共有メモリ作成ツール実装
 * ベストプラクティス: 統一されたエラーハンドリングと結果形式
 */
export async function createSharedMemoryTool(memoryCore, args) {
    try {
        console.log(`[SharedMemory] Creating memory: ${args.title}`);
        // Zodスキーマで入力検証
        const validatedData = CreateMemoryRequestSchema.parse({
            title: args.title,
            content: args.content,
            permission_level: args.permission_level || 'edit',
            creator_persona_id: args.creator_persona_id
        });
        const result = memoryCore.createMemory(validatedData);
        if (result.success) {
            return {
                content: [{
                        type: 'text',
                        text: `✅ 共有メモ「${validatedData.title}」を作成しました。\nID: ${result.data?.id}\n権限: ${validatedData.permission_level}`
                    }]
            };
        }
        else {
            return {
                isError: true,
                content: [{
                        type: 'text',
                        text: `❌ メモ作成に失敗しました: ${result.error}`
                    }]
            };
        }
    }
    catch (error) {
        console.error('Shared memory create error:', error);
        return {
            isError: true,
            content: [{
                    type: 'text',
                    text: `❌ 入力データの検証に失敗しました: ${error instanceof z.ZodError ? error.message : String(error)}`
                }]
        };
    }
}
/**
 * 共有メモリ検索ツール実装
 */
export async function searchSharedMemoryTool(memoryCore, args) {
    try {
        console.log(`[SharedMemory] Searching memories: ${args.query || 'all'}`);
        // Zodスキーマで入力検証
        const validatedData = SearchMemoryRequestSchema.parse({
            query: args.query,
            limit: args.limit || 10,
            offset: args.offset || 0
        });
        const result = memoryCore.searchMemories(validatedData, args.requester_persona_id);
        if (result.success && result.data?.memories) {
            const memoriesText = result.data.memories.map((memory) => `📝 **${memory.title}**\n` +
                `   ID: ${memory.id}\n` +
                `   作成者: ${memory.owner_persona_id}\n` +
                `   権限: ${memory.permission_level}\n` +
                `   更新: ${memory.updated_at}\n` +
                `   内容: ${memory.content.slice(0, 100)}${memory.content.length > 100 ? '...' : ''}\n`).join('\n');
            return {
                content: [{
                        type: 'text',
                        text: result.data.memories.length > 0
                            ? `🔍 検索結果 (${result.data.memories.length}/${result.data.total}件)\n\n${memoriesText}`
                            : `🔍 検索結果: 該当するメモが見つかりませんでした。`
                    }]
            };
        }
        else {
            return {
                isError: true,
                content: [{
                        type: 'text',
                        text: `❌ 検索に失敗しました: ${result.error}`
                    }]
            };
        }
    }
    catch (error) {
        console.error('Shared memory search error:', error);
        return {
            isError: true,
            content: [{
                    type: 'text',
                    text: `❌ 入力データの検証に失敗しました: ${error instanceof z.ZodError ? error.message : String(error)}`
                }]
        };
    }
}
/**
 * 共有メモリ取得ツール実装
 */
export async function getSharedMemoryTool(memoryCore, args) {
    try {
        console.log(`[SharedMemory] Getting memory: ${args.id}`);
        const result = memoryCore.getMemory(args.id, args.requester_persona_id);
        if (result.success && result.data) {
            const memory = result.data;
            return {
                content: [{
                        type: 'text',
                        text: `📝 **${memory.title}**\n\n` +
                            `**内容:**\n${memory.content}\n\n` +
                            `**詳細情報:**\n` +
                            `- ID: ${memory.id}\n` +
                            `- 作成者: ${memory.owner_persona_id}\n` +
                            `- 権限: ${memory.permission_level}\n` +
                            `- 作成日: ${memory.created_at}\n` +
                            `- 更新日: ${memory.updated_at}\n` +
                            `- 最終更新者: ${memory.last_updated_by}`
                    }]
            };
        }
        else {
            return {
                isError: true,
                content: [{
                        type: 'text',
                        text: `❌ メモ取得に失敗しました: ${result.error}`
                    }]
            };
        }
    }
    catch (error) {
        console.error('Shared memory get error:', error);
        return {
            isError: true,
            content: [{
                    type: 'text',
                    text: `❌ メモ取得中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
}
/**
 * 共有メモリ更新ツール実装
 */
export async function updateSharedMemoryTool(memoryCore, args) {
    try {
        console.log(`[SharedMemory] Updating memory: ${args.id}`);
        const result = memoryCore.updateMemory({
            id: args.id,
            title: args.title,
            content: args.content,
            permission_level: args.permission_level
        }, args.updater_persona_id);
        if (result.success) {
            return {
                content: [{
                        type: 'text',
                        text: `✅ メモを更新しました。\nID: ${args.id}`
                    }]
            };
        }
        else {
            return {
                isError: true,
                content: [{
                        type: 'text',
                        text: `❌ メモ更新に失敗しました: ${result.error}`
                    }]
            };
        }
    }
    catch (error) {
        console.error('Shared memory update error:', error);
        return {
            isError: true,
            content: [{
                    type: 'text',
                    text: `❌ メモ更新中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
}
/**
 * 共有メモリ削除ツール実装
 */
export async function deleteSharedMemoryTool(memoryCore, args) {
    try {
        console.log(`[SharedMemory] Deleting memory: ${args.id}`);
        const result = memoryCore.deleteMemory(args.id, args.deleter_persona_id);
        if (result.success) {
            return {
                content: [{
                        type: 'text',
                        text: `✅ メモを削除しました。\nID: ${args.id}`
                    }]
            };
        }
        else {
            return {
                isError: true,
                content: [{
                        type: 'text',
                        text: `❌ メモ削除に失敗しました: ${result.error}`
                    }]
            };
        }
    }
    catch (error) {
        console.error('Shared memory delete error:', error);
        return {
            isError: true,
            content: [{
                    type: 'text',
                    text: `❌ メモ削除中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
}
/**
 * 共有メモリ通知取得ツール実装
 */
export async function getSharedMemoryNotificationsTool(memoryCore, args) {
    try {
        console.log(`[SharedMemory] Getting notifications for: ${args.persona_id}`);
        const result = memoryCore.getRecentNotifications(args.persona_id, args.limit || 10);
        if (result.success && result.data) {
            const notificationsText = result.data.map((notif) => `🔔 ${notif.message}\n` +
                `   種別: ${notif.type} | 更新者: ${notif.updated_by}\n` +
                `   メモ: ${notif.memory_title} (ID: ${notif.memory_id})\n` +
                `   日時: ${notif.timestamp}\n`).join('\n');
            return {
                content: [{
                        type: 'text',
                        text: result.data.length > 0
                            ? `🔔 最近の通知 (${result.data.length}件)\n\n${notificationsText}`
                            : `🔔 最近の通知はありません。`
                    }]
            };
        }
        else {
            return {
                isError: true,
                content: [{
                        type: 'text',
                        text: `❌ 通知取得に失敗しました: ${result.error}`
                    }]
            };
        }
    }
    catch (error) {
        console.error('Shared memory notifications error:', error);
        return {
            isError: true,
            content: [{
                    type: 'text',
                    text: `❌ 通知取得中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
}
