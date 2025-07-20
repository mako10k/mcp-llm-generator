/**
 * Sprint4 Phase 3: FunctionCall機能実演デモ
 * 完成した人格間FunctionCall機能を実際に動作させて確認
 * + Google検索機能追加版
 */

import Database from 'better-sqlite3';
import { PersonaManager } from '../build/utils/personaManager.js';
import { FunctionCallDispatcher, FunctionCallRequest } from '../build/utils/functionCallDispatcher.js';
import { FunctionRegistryManager } from '../build/utils/functionRegistry.js';

// グローバル変数
let db: Database.Database;
let personaManager: PersonaManager;
let functionRegistry: FunctionRegistryManager;
let dispatcher: FunctionCallDispatcher;

/**
 * メインデモ実行
 */
async function runDemo() {
  console.log('🚀 人格間FunctionCall機能デモ開始 (Google検索機能追加版)');
  console.log('='.repeat(60));
  console.log('');

  // 初期化
  await initializeDemo();

  // Demo 1: データ分析
  await runDataAnalysisDemo();
  
  console.log('');
  console.log('='.repeat(50));
  console.log('');
  
  // Demo 2: 通知送信  
  await runNotificationDemo();
  
  console.log('');
  console.log('='.repeat(50));
  console.log('');
  
  // Demo 3: システム状態取得
  await runSystemStatusDemo();
  
  console.log('');
  console.log('='.repeat(50));
  console.log('');
  
  // Demo 4: Google検索 (新機能)
  await runGoogleSearchDemo();
  
  console.log('');
  console.log('='.repeat(50));
  console.log('');
  
  // Demo 5: 権限エラーテスト
  await runPermissionErrorDemo();

  console.log('');
  console.log('🎉 全デモ完了！Google検索機能が正常に動作しました！');
  
  // クリーンアップ
  if (db) {
    db.close();
  }
}

/**
 * デモ環境初期化
 */
async function initializeDemo(): Promise<void> {
  // データベース初期化
  db = new Database(':memory:');
  
  // データベーススキーマの初期化
  initializeTestDatabase(db);
  
  // コンポーネント初期化
  personaManager = new PersonaManager(db);
  functionRegistry = new FunctionRegistryManager(db);
  dispatcher = new FunctionCallDispatcher(personaManager);
}

/**
 * Demo 1: データ分析Function
 */
async function runDataAnalysisDemo(): Promise<void> {
  console.log('📊 Demo 1: データ分析Function実行');
  console.log('==================================');

  const fromPersonaId = 'analyst_persona_001';
  const toPersonaId = 'data_scientist_persona_001';

  // ペルソナセットアップ
  await setupPersonaWithCapabilities(fromPersonaId, {
    expertise: ['data_analysis'],
    tools: ['request_functions'],
    restrictions: []
  });

  await setupPersonaWithCapabilities(toPersonaId, {
    expertise: ['data_analysis', 'statistics'],
    tools: ['analyzeData', 'data_processing'],
    restrictions: []
  });

  // Function権限設定
  functionRegistry.bindFunctionToPersona(toPersonaId, 'func_data_analysis');

  const sampleData = [10, 15, 20, 25, 30, 35, 40, 45, 50];
  
  const request: FunctionCallRequest = {
    fromPersonaId,
    toPersonaId,
    functionName: 'analyzeData',
    parameters: {
      data: sampleData,
      analysis_type: 'statistical',
      options: { include_raw: false }
    },
    priority: 'high'
  };

  console.log(`🔄 データ分析実行中... データ: [${sampleData.join(', ')}]`);
  
  const response = await dispatcher.dispatchFunctionCall(request);

  if (response.success) {
    console.log('✅ データ分析成功！');
    console.log('📈 結果:');
    if (response.data) {
      console.log(`   平均: ${response.data.mean}`);
      console.log(`   標準偏差: ${response.data.std_dev}`);
      console.log(`   分散: ${response.data.variance}`);
      console.log(`   範囲: ${response.data.range}`);
    }
    console.log(`⏱️  実行時間: ${response.executionTimeMs}ms`);
  } else {
    console.log('❌ データ分析失敗');
    console.log(`🔒 エラー: ${response.error}`);
  }
}

/**
 * Demo 2: 通知送信Function
 */
async function runNotificationDemo(): Promise<void> {
  console.log('📧 Demo 2: 通知送信Function実行');
  console.log('=================================');

  const fromPersonaId = 'communicator_persona_001';
  const toPersonaId = 'notification_service_001';

  await setupPersonaWithCapabilities(fromPersonaId, {
    expertise: ['communication'],
    tools: ['send_messages'],
    restrictions: []
  });

  await setupPersonaWithCapabilities(toPersonaId, {
    expertise: ['notification', 'communication'],
    tools: ['sendNotification', 'message_processing'],
    restrictions: []
  });

  functionRegistry.bindFunctionToPersona(toPersonaId, 'func_send_notification');

  const request: FunctionCallRequest = {
    fromPersonaId,
    toPersonaId,
    functionName: 'sendNotification',
    parameters: {
      target: 'development_team',
      message: 'Sprint4 Phase3完成 - Google検索機能追加',
      priority: 'high',
      type: 'milestone_notification'
    },
    priority: 'high'
  };

  console.log(`🔄 通知送信中... メッセージ: "${request.parameters.message}"`);
  
  const response = await dispatcher.dispatchFunctionCall(request);

  if (response.success) {
    console.log('✅ 通知送信成功！');
    console.log('📨 送信結果:');
    if (response.data) {
      console.log(`   通知ID: ${response.data.notification_id}`);
      console.log(`   配信先: ${response.data.target}`);
      console.log(`   送信時刻: ${response.data.sent_at}`);
    }
    console.log(`⏱️  実行時間: ${response.executionTimeMs}ms`);
  } else {
    console.log('❌ 通知送信失敗');
    console.log(`🔒 エラー: ${response.error}`);
  }
}

/**
 * Demo 3: システム状態取得Function
 */
async function runSystemStatusDemo(): Promise<void> {
  console.log('🖥️  Demo 3: システム状態取得Function実行');
  console.log('==========================================');

  const fromPersonaId = 'monitor_persona_001';
  const toPersonaId = 'system_admin_persona_001';

  await setupPersonaWithCapabilities(fromPersonaId, {
    expertise: ['system_monitoring'],
    tools: ['status_check'],
    restrictions: []
  });

  await setupPersonaWithCapabilities(toPersonaId, {
    expertise: ['system_administration', 'monitoring'],
    tools: ['getSystemStatus', 'system_control'],
    restrictions: []
  });

  functionRegistry.bindFunctionToPersona(toPersonaId, 'func_system_status');

  const request: FunctionCallRequest = {
    fromPersonaId,
    toPersonaId,
    functionName: 'getSystemStatus',
    parameters: {
      component: 'all',
      include_details: true
    },
    priority: 'medium'
  };

  console.log('🔄 システム状態確認中...');
  
  const response = await dispatcher.dispatchFunctionCall(request);

  if (response.success) {
    console.log('✅ システム状態取得成功！');
    console.log('🖥️  システム状況:');
    if (response.data) {
      console.log(`   データベース: ${response.data.components.database}`);
      console.log(`   メモリ: ${response.data.components.memory}`);
      console.log(`   CPU: ${response.data.components.cpu}`);
      console.log(`   アクティブFunction数: ${response.data.active_functions}`);
    }
    console.log(`⏱️  実行時間: ${response.executionTimeMs}ms`);
  } else {
    console.log('❌ システム状態取得失敗');
    console.log(`🔒 エラー: ${response.error}`);
  }
}

/**
 * Demo 4: Google検索Function (新機能)
 */
async function runGoogleSearchDemo(): Promise<void> {
  console.log('🔍 Demo 4: Google検索Function実行 (新機能)');
  console.log('===========================================');

  const fromPersonaId = 'search_persona_001';
  const toPersonaId = 'researcher_persona_001';

  // 検索ペルソナのセットアップ（検索権限付与）
  await setupPersonaWithCapabilities(fromPersonaId, {
    expertise: ['information_retrieval'],
    tools: ['web_search'],
    restrictions: []
  });

  await setupPersonaWithCapabilities(toPersonaId, {
    expertise: ['research', 'information_analysis'],
    tools: ['googleSearch', 'data_analysis'],
    restrictions: []
  });

  // 検索権限の付与
  const roleStmt = db.prepare(`
    UPDATE persona_roles SET permissions = ? WHERE context_id = ?
  `);
  roleStmt.run(JSON.stringify(['function_call', 'web_search', 'information_access']), fromPersonaId);

  // Function権限設定
  functionRegistry.bindFunctionToPersona(toPersonaId, 'func_google_search');

  const request: FunctionCallRequest = {
    fromPersonaId,
    toPersonaId,
    functionName: 'googleSearch',
    parameters: {
      query: 'TypeScript 最新機能 2025',
      numResults: 5,
      language: 'ja',
      region: 'JP',
      summaryLength: 'brief'
    },
    priority: 'medium'
  };

  console.log(`🔄 Google検索実行中... クエリ: "${request.parameters.query}"`);
  
  const response = await dispatcher.dispatchFunctionCall(request);

  if (response.success) {
    console.log('✅ Google検索成功！');
    console.log('🔍 検索結果:');
    if (response.data && response.data.searchResults) {
      response.data.searchResults.slice(0, 3).forEach((result: any, index: number) => {
        console.log(`   ${index + 1}. ${result.title}`);
        console.log(`      URL: ${result.url}`);
        console.log(`      要約: ${result.snippet.substring(0, 80)}...`);
      });
    }
    
    if (response.data && response.data.summary) {
      console.log(`📝 検索要約: ${response.data.summary}`);
    }
    
    if (response.data && response.data.relatedQueries) {
      console.log(`🔗 関連検索: ${response.data.relatedQueries.slice(0, 3).join(', ')}`);
    }
    
    console.log(`⏱️  実行時間: ${response.executionTimeMs}ms`);
  } else {
    console.log('❌ Google検索失敗');
    console.log(`🔒 エラー: ${response.error}`);
  }
}

/**
 * Demo 5: 権限エラーテスト
 */
async function runPermissionErrorDemo(): Promise<void> {
  console.log('🔒 Demo 5: 権限エラーテスト');
  console.log('============================');

  const fromPersonaId = 'guest_persona_001';
  const toPersonaId = 'secure_service_001';

  // 権限のないペルソナをセットアップ
  await setupPersonaWithCapabilities(fromPersonaId, {
    expertise: ['basic'],
    tools: ['basic_functions'],
    restrictions: []
  });

  await setupPersonaWithCapabilities(toPersonaId, {
    expertise: ['system_administration'],
    tools: ['getSystemStatus'],
    restrictions: []
  });

  // 権限を制限（basic_accessのみ）
  const roleStmt = db.prepare(`
    UPDATE persona_roles SET permissions = ? WHERE context_id = ?
  `);
  roleStmt.run(JSON.stringify(['basic_access']), fromPersonaId);

  functionRegistry.bindFunctionToPersona(toPersonaId, 'func_system_status');

  const request: FunctionCallRequest = {
    fromPersonaId,
    toPersonaId,
    functionName: 'getSystemStatus',
    parameters: {
      component: 'database'
    }
  };

  console.log('🔄 権限なしでのFunction呼び出し試行中...');
  
  const response = await dispatcher.dispatchFunctionCall(request);

  if (!response.success) {
    console.log('✅ 権限エラーが正常に検出されました！');
    console.log(`🔒 エラー: ${response.error}`);
    console.log(`⏱️  実行時間: ${response.executionTimeMs}ms`);
  } else {
    console.log('❌ 権限チェックに問題があります');
  }
}

// =============================================================================
// ヘルパー関数
// =============================================================================

function initializeTestDatabase(db: Database.Database): void {
  // PersonaManagerのスキーマ
  db.exec(`
    CREATE TABLE IF NOT EXISTS persona_capabilities (
      context_id TEXT PRIMARY KEY,
      expertise TEXT NOT NULL,
      tools TEXT NOT NULL,
      restrictions TEXT NOT NULL,
      performance_metrics TEXT,
      learning_capabilities TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS contexts (
      context_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS persona_roles (
      role_id TEXT PRIMARY KEY,
      context_id TEXT NOT NULL,
      role_type TEXT NOT NULL,
      permissions TEXT NOT NULL,
      role_description TEXT,
      parent_role_id TEXT,
      hierarchy_level INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (context_id) REFERENCES persona_capabilities(context_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_delegations (
      delegation_id TEXT PRIMARY KEY,
      from_context_id TEXT NOT NULL,
      to_context_id TEXT NOT NULL,
      task_description TEXT NOT NULL,
      required_capabilities TEXT NOT NULL,
      priority_level TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (from_context_id) REFERENCES persona_capabilities(context_id),
      FOREIGN KEY (to_context_id) REFERENCES persona_capabilities(context_id)
    )
  `);
}

async function setupPersonaWithCapabilities(
  contextId: string,
  capabilities: {
    expertise: string[];
    tools: string[];
    restrictions: string[];
  }
): Promise<void> {
  // contextsテーブルにレコード作成
  const contextStmt = db.prepare(`
    INSERT OR IGNORE INTO contexts (context_id, name) VALUES (?, ?)
  `);
  contextStmt.run(contextId, `Test Context ${contextId}`);

  // persona_capabilitiesにレコード作成
  const success = personaManager.updatePersonaCapabilities(contextId, capabilities);
  if (!success) {
    throw new Error(`Failed to setup persona ${contextId}`);
  }

  // 基本権限の設定
  const roleStmt = db.prepare(`
    INSERT OR IGNORE INTO persona_roles (
      role_id, context_id, role_type, permissions, hierarchy_level
    ) VALUES (?, ?, ?, ?, ?)
  `);
  
  roleStmt.run(
    `role_${contextId}`,
    contextId,
    'user',
    JSON.stringify(['function_call', 'basic_access']),
    1
  );
}

// デモ実行
runDemo().catch(console.error);
