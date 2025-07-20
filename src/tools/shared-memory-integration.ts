/**
 * メインMCPサーバーに共有メモリツールを統合
 * 既存のindex.tsに追加する形で統合
 */

import { SharedMemoryMCPTools } from './shared-memory-mcp-tools.js';
import Database from 'better-sqlite3';

// 共有メモリツールの統合例（メインindex.tsに追加）
export function integrateSharedMemoryTools(server: any, database: Database.Database) {
  const sharedMemoryTools = new SharedMemoryMCPTools(database);
  
  // ツール定義の追加
  const memoryTools = sharedMemoryTools.getTools();
  
  memoryTools.forEach(tool => {
    server.setRequestHandler('tools/call', async (request: any) => {
      if (request.params.name === tool.name) {
        return await sharedMemoryTools.handleToolCall(
          request.params.name, 
          request.params.arguments
        );
      }
    });
  });
  
  // tools/listハンドラーに追加
  server.setRequestHandler('tools/list', async () => {
    const existingTools = await server.getRequestHandler('tools/list')?.() || { tools: [] };
    
    return {
      tools: [
        ...existingTools.tools,
        ...memoryTools
      ]
    };
  });
  
  return sharedMemoryTools;
}

/**
 * 簡単な使用例・テスト関数
 */
export async function testSharedMemoryBasicUsage() {
  console.log('🧪 共有メモリ基本機能テスト開始...');
  
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
  
  const memoryTools = new SharedMemoryMCPTools(testDb);
  
  // テストでは通知機能は無効化（外部キー制約回避）
  console.log('⚠️ テスト環境では通知機能を簡略化します');
  
  // 1. メモ作成テスト
  const createResult = await memoryTools.handleToolCall('shared-memory-create', {
    title: 'テスト共有メモ',
    content: 'これは共有メモのテストです。誰でも閲覧・編集できます。',
    permission_level: 'edit',
    creator_persona_id: 'test-user-1'
  });
  
  console.log('📝 作成結果:', createResult);
  
  // 2. 検索テスト
  const searchResult = await memoryTools.handleToolCall('shared-memory-search', {
    query: 'テスト',
    requester_persona_id: 'test-user-2'
  });
  
  console.log('🔍 検索結果:', searchResult);
  
  // 3. 通知確認テスト
  const notificationsResult = await memoryTools.handleToolCall('shared-memory-notifications', {
    persona_id: 'test-user-1',
    limit: 5
  });
  
  console.log('🔔 通知結果:', notificationsResult);
  
  testDb.close();
  console.log('✅ 共有メモリ基本機能テスト完了');
}

// 簡単実用性テスト実行
async function runTestIfMain() {
  if (import.meta.url === `file://${process.argv[1]}`) {
    await testSharedMemoryBasicUsage();
  }
}

runTestIfMain().catch(console.error);
