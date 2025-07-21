/**
 * メインMCPサーバーに共有メモリツールを統合（ベストプラクティス版）
 * server.registerTool()を使用したモダンな統合方法
 */
import { SharedMemoryToolsManager, createSharedMemoryTool, searchSharedMemoryTool, getSharedMemoryTool, updateSharedMemoryTool, deleteSharedMemoryTool, getSharedMemoryNotificationsTool } from './shared-memory-tools.js';
import Database from 'better-sqlite3';
import { z } from 'zod';
/**
 * 🟢 ベストプラクティス: server.registerTool()による統合
 * contextMemoryツールと同様のパターンに統一
 */
export function registerSharedMemoryTools(server, database) {
    const manager = new SharedMemoryToolsManager(database);
    const memoryCore = manager.getMemoryCore();
    // 共有メモリ作成ツール
    server.registerTool("shared-memory-create", {
        title: "Create Shared Memory",
        description: "Create a new shared memory item for team collaboration.",
        inputSchema: {
            title: z.string().min(1).max(200).describe("Title of the memory item"),
            content: z.string().max(10000).describe("Content of the memory item"),
            permission_level: z.enum(['public', 'edit']).optional().default('edit').describe("Access permission: public=read-only, edit=editable by anyone"),
            creator_persona_id: z.string().describe("ID of the creating persona")
        },
        annotations: {
            readOnlyHint: false,
            openWorldHint: false
        }
    }, async (args, extra) => {
        return await createSharedMemoryTool(memoryCore, args);
    });
    // 共有メモリ検索ツール
    server.registerTool("shared-memory-search", {
        title: "Search Shared Memory",
        description: "Search shared memory items by title or content.",
        inputSchema: {
            query: z.string().optional().describe("Search keyword to find in title or content"),
            limit: z.number().min(1).max(50).optional().default(10).describe("Maximum number of results to return"),
            offset: z.number().min(0).optional().default(0).describe("Number of results to skip for pagination"),
            requester_persona_id: z.string().describe("ID of the requesting persona")
        },
        annotations: {
            readOnlyHint: true,
            openWorldHint: false
        }
    }, async (args, extra) => {
        return await searchSharedMemoryTool(memoryCore, args);
    });
    // 共有メモリ取得ツール
    server.registerTool("shared-memory-get", {
        title: "Get Shared Memory",
        description: "Get detailed information of a specific shared memory item.",
        inputSchema: {
            id: z.string().describe("ID of the memory item to retrieve"),
            requester_persona_id: z.string().describe("ID of the requesting persona")
        },
        annotations: {
            readOnlyHint: true,
            openWorldHint: false
        }
    }, async (args, extra) => {
        return await getSharedMemoryTool(memoryCore, args);
    });
    // 共有メモリ更新ツール
    server.registerTool("shared-memory-update", {
        title: "Update Shared Memory",
        description: "Update a shared memory item. Only editable items or owned items can be updated.",
        inputSchema: {
            id: z.string().describe("ID of the memory item to update"),
            title: z.string().min(1).max(200).optional().describe("New title (optional)"),
            content: z.string().max(10000).optional().describe("New content (optional)"),
            permission_level: z.enum(['public', 'edit']).optional().describe("New access permission (optional)"),
            updater_persona_id: z.string().describe("ID of the updating persona")
        },
        annotations: {
            readOnlyHint: false,
            openWorldHint: false
        }
    }, async (args, extra) => {
        return await updateSharedMemoryTool(memoryCore, args);
    });
    // 共有メモリ削除ツール
    server.registerTool("shared-memory-delete", {
        title: "Delete Shared Memory",
        description: "Delete a shared memory item. Only the owner can delete the item.",
        inputSchema: {
            id: z.string().describe("ID of the memory item to delete"),
            deleter_persona_id: z.string().describe("ID of the deleting persona")
        },
        annotations: {
            readOnlyHint: false,
            openWorldHint: false
        }
    }, async (args, extra) => {
        return await deleteSharedMemoryTool(memoryCore, args);
    });
    // 共有メモリ通知ツール
    server.registerTool("shared-memory-notifications", {
        title: "Shared Memory Notifications",
        description: "Get recent change notifications for shared memory items.",
        inputSchema: {
            persona_id: z.string().describe("ID of the persona requesting notifications"),
            limit: z.number().min(1).max(50).optional().default(10).describe("Maximum number of notifications to return")
        },
        annotations: {
            readOnlyHint: true,
            openWorldHint: false
        }
    }, async (args, extra) => {
        return await getSharedMemoryNotificationsTool(memoryCore, args);
    });
    return manager;
}
/**
 * 🧪 基本機能テスト（ベストプラクティス版）
 * 新しいツール登録方法でのテスト
 */
export async function testSharedMemoryBestPractices() {
    console.log('🧪 共有メモリベストプラクティステスト開始...');
    // テスト用データベース
    const testDb = new Database(':memory:');
    // コンテキストテーブル作成（PersonaManager基盤模擬）
    testDb.exec(`
    CREATE TABLE contexts (
      context_id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    
    INSERT INTO contexts (context_id, name) VALUES 
    ('test-user-1', 'テストユーザー1'),
    ('test-user-2', 'テストユーザー2');
  `);
    const manager = new SharedMemoryToolsManager(testDb);
    const memoryCore = manager.getMemoryCore();
    // 🟢 ベストプラクティス: 個別関数による直接テスト
    // 1. メモ作成テスト
    const createResult = await createSharedMemoryTool(memoryCore, {
        title: 'ベストプラクティステストメモ',
        content: 'これは新しいツール登録方法でのテストです。',
        permission_level: 'edit',
        creator_persona_id: 'test-user-1'
    });
    console.log('📝 作成結果:', createResult);
    // 2. 検索テスト
    const searchResult = await searchSharedMemoryTool(memoryCore, {
        query: 'ベストプラクティス',
        requester_persona_id: 'test-user-2'
    });
    console.log('🔍 検索結果:', searchResult);
    // 3. 通知確認テスト
    const notificationsResult = await getSharedMemoryNotificationsTool(memoryCore, {
        persona_id: 'test-user-1',
        limit: 5
    });
    console.log('🔔 通知結果:', notificationsResult);
    manager.close();
    console.log('✅ 共有メモリベストプラクティステスト完了');
}
// テスト実行
async function runTestIfMain() {
    if (import.meta.url === `file://${process.argv[1]}`) {
        await testSharedMemoryBestPractices();
    }
}
runTestIfMain().catch(console.error);
