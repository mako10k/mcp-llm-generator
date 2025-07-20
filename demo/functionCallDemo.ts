/**
 * Sprint4 Phase 3: FunctionCall機能実演デモ
 * 完成した人格間FunctionCall機能を実際に動作させて確認
 */

import Database from 'better-sqlite3';
import { PersonaManager } from '../build/utils/personaManager.js';
import { FunctionCallDispatcher, FunctionCallRequest } from '../build/utils/functionCallDispatcher.js';
import { FunctionRegistryManager } from '../build/utils/functionRegistry.js';

/**
 * メインデモ実行
 */
async function runFunctionCallDemo() {
  console.log('🚀 FunctionCall機能実演デモ開始\n');

  // データベースとコンポーネント初期化
  const db = new Database(':memory:');
  await initializeDemo(db);
  
  const personaManager = new PersonaManager(db);
  const functionRegistry = new FunctionRegistryManager(db);
  const dispatcher = new FunctionCallDispatcher(personaManager);

  console.log('✅ システム初期化完了\n');

  // Demo 1: データ分析Function
  await demonstrateDataAnalysis(personaManager, functionRegistry, dispatcher);
  
  // Demo 2: 通知送信Function  
  await demonstrateNotification(personaManager, functionRegistry, dispatcher);
  
  // Demo 3: システム状態取得Function
  await demonstrateSystemStatus(personaManager, functionRegistry, dispatcher);

  // Demo 4: 権限エラーの実演
  await demonstratePermissionError(personaManager, functionRegistry, dispatcher);

  db.close();
  console.log('\n🎉 デモ完了！人格間FunctionCall機能が正常に動作しています。');
}

/**
 * データベース初期化
 */
async function initializeDemo(db: Database.Database) {
  // PersonaManagerスキーマ
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

/**
 * ペルソナセットアップヘルパー
 */
async function setupPersona(
  manager: PersonaManager,
  contextId: string,
  name: string,
  capabilities: {
    expertise: string[];
    tools: string[];
    restrictions: string[];
  }
) {
  // contextsテーブルにレコード作成
  const contextStmt = manager['db'].prepare(`
    INSERT OR IGNORE INTO contexts (context_id, name) VALUES (?, ?)
  `);
  contextStmt.run(contextId, name);

  // persona_capabilitiesにレコード作成
  manager.updatePersonaCapabilities(contextId, capabilities);

  // 基本権限の設定
  const roleStmt = manager['db'].prepare(`
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

/**
 * Demo 1: データ分析Function実演
 */
async function demonstrateDataAnalysis(
  personaManager: PersonaManager,
  functionRegistry: FunctionRegistryManager,
  dispatcher: FunctionCallDispatcher
) {
  console.log('📊 Demo 1: データ分析Function実演');
  console.log('===============================');

  // ペルソナセットアップ
  const fromPersonaId = 'data_scientist';
  const toPersonaId = 'data_analyst';

  await setupPersona(personaManager, fromPersonaId, 'データサイエンティスト', {
    expertise: ['research', 'statistics'],
    tools: ['request_functions'],
    restrictions: []
  });

  await setupPersona(personaManager, toPersonaId, 'データアナリスト', {
    expertise: ['data_analysis', 'statistics'],
    tools: ['analyzeData', 'data_processing'],
    restrictions: []
  });

  // Function権限付与
  functionRegistry.bindFunctionToPersona(toPersonaId, 'func_data_analysis');

  // サンプルデータでテスト
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
    console.log(JSON.stringify(response.data, null, 2));
    console.log(`⏱️  実行時間: ${response.executionTimeMs}ms\n`);
  } else {
    console.log(`❌ エラー: ${response.error}\n`);
  }
}

/**
 * Demo 2: 通知送信Function実演
 */
async function demonstrateNotification(
  personaManager: PersonaManager,
  functionRegistry: FunctionRegistryManager,
  dispatcher: FunctionCallDispatcher
) {
  console.log('📢 Demo 2: 通知送信Function実演');
  console.log('===============================');

  const fromPersonaId = 'project_manager';
  const toPersonaId = 'communication_bot';

  await setupPersona(personaManager, fromPersonaId, 'プロジェクトマネージャー', {
    expertise: ['project_management', 'coordination'],
    tools: ['request_functions'],
    restrictions: []
  });

  await setupPersona(personaManager, toPersonaId, 'コミュニケーションボット', {
    expertise: ['communication', 'messaging'],
    tools: ['sendNotification', 'messaging'],
    restrictions: []
  });

  functionRegistry.bindFunctionToPersona(toPersonaId, 'func_send_notification');

  const request: FunctionCallRequest = {
    fromPersonaId,
    toPersonaId,
    functionName: 'sendNotification',
    parameters: {
      target: 'development_team',
      message: 'スプリント4 Phase3が完成しました！FunctionCall機能が稼働中です。',
      priority: 'high'
    }
  };

  console.log('🔄 通知送信中...');
  
  const response = await dispatcher.dispatchFunctionCall(request);

  if (response.success) {
    console.log('✅ 通知送信成功！');
    console.log('📩 通知詳細:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log(`⏱️  実行時間: ${response.executionTimeMs}ms\n`);
  } else {
    console.log(`❌ エラー: ${response.error}\n`);
  }
}

/**
 * Demo 3: システム状態取得Function実演
 */
async function demonstrateSystemStatus(
  personaManager: PersonaManager,
  functionRegistry: FunctionRegistryManager,
  dispatcher: FunctionCallDispatcher
) {
  console.log('🖥️  Demo 3: システム状態取得Function実演');
  console.log('========================================');

  const fromPersonaId = 'system_admin';
  const toPersonaId = 'monitoring_agent';

  await setupPersona(personaManager, fromPersonaId, 'システム管理者', {
    expertise: ['system_administration', 'monitoring'],
    tools: ['admin_functions'],
    restrictions: []
  });

  await setupPersona(personaManager, toPersonaId, '監視エージェント', {
    expertise: ['system_monitoring', 'diagnostics'],
    tools: ['getSystemStatus', 'monitoring'],
    restrictions: []
  });

  functionRegistry.bindFunctionToPersona(toPersonaId, 'func_system_status');

  const request: FunctionCallRequest = {
    fromPersonaId,
    toPersonaId,
    functionName: 'getSystemStatus',
    parameters: {
      component: 'all'
    }
  };

  console.log('🔄 システム状態取得中...');
  
  const response = await dispatcher.dispatchFunctionCall(request);

  if (response.success) {
    console.log('✅ システム状態取得成功！');
    console.log('📊 システム状態:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log(`⏱️  実行時間: ${response.executionTimeMs}ms\n`);
  } else {
    console.log(`❌ エラー: ${response.error}\n`);
  }
}

/**
 * Demo 4: 権限エラー実演
 */
async function demonstratePermissionError(
  personaManager: PersonaManager,
  functionRegistry: FunctionRegistryManager,
  dispatcher: FunctionCallDispatcher
) {
  console.log('🔒 Demo 4: 権限エラー実演');
  console.log('=========================');

  const fromPersonaId = 'guest_user';
  const toPersonaId = 'secure_system';

  await setupPersona(personaManager, fromPersonaId, 'ゲストユーザー', {
    expertise: ['basic'],
    tools: ['basic_functions'],
    restrictions: []
  });

  await setupPersona(personaManager, toPersonaId, 'セキュアシステム', {
    expertise: ['system_control'],
    tools: ['getSystemStatus'],
    restrictions: []
  });

  // ゲストユーザーのfunction_call権限を削除
  const roleStmt = personaManager['db'].prepare(`
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
    console.log(`⏱️  実行時間: ${response.executionTimeMs}ms\n`);
  } else {
    console.log('❌ 権限チェックに問題があります\n');
  }
}

// デモ実行
runFunctionCallDemo().catch(console.error);
