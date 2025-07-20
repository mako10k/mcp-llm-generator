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
async function runDemo() {
  console.log('🚀 人格間FunctionCall機能デモ開始');
  console.log('=====================================
');

  // Demo 1: データ分析
  await runDataAnalysisDemo();
  
  console.log('
' + '='.repeat(50) + '
');
  
  // Demo 2: 通知送信  
  await runNotificationDemo();
  
  console.log('
' + '='.repeat(50) + '
');
  
  // Demo 3: システム状態取得
  await runSystemStatusDemo();
  
  console.log('
' + '='.repeat(50) + '
');
  
  // Demo 4: Google検索 (新機能)
  await runGoogleSearchDemo();
  
  console.log('
' + '='.repeat(50) + '
');
  
  // Demo 5: 権限エラーテスト
  await runPermissionErrorDemo();

  console.log('
🎉 全デモ完了！');
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

/**
 * Demo 4: Google検索Function
 */
async function runGoogleSearchDemo(): Promise<void> {
  console.log('🔍 Demo 4: Google検索Function実行');
  console.log('====================================');

  const searchPersonaId = 'search_persona_001';
  const targetPersonaId = 'researcher_persona_001';

  // 検索ペルソナのセットアップ（検索権限付与）
  await setupPersonaWithCapabilities(searchPersonaId, {
    expertise: ['information_retrieval'],
    tools: ['web_search'],
    restrictions: []
  });

  await setupPersonaWithCapabilities(targetPersonaId, {
    expertise: ['research', 'information_analysis'],
    tools: ['googleSearch', 'data_analysis'],
    restrictions: []
  });

  // 検索権限の付与
  const roleStmt = db.prepare(`
    UPDATE persona_roles SET permissions = ? WHERE context_id = ?
  `);
  roleStmt.run(JSON.stringify(['function_call', 'web_search', 'information_access']), searchPersonaId);

  // Function権限設定
  functionRegistry.bindFunctionToPersona(targetPersonaId, 'func_google_search');

  const request: FunctionCallRequest = {
    fromPersonaId: searchPersonaId,
    toPersonaId: targetPersonaId,
    functionName: 'googleSearch',
    parameters: {
      query: 'TypeScript 最新機能',
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
        console.log(`      要約: ${result.snippet.substring(0, 100)}...`);
      });
    }
    
    if (response.data && response.data.summary) {
      console.log(`📝 検索要約: ${response.data.summary}`);
    }
    
    if (response.data && response.data.relatedQueries) {
      console.log(`🔗 関連検索: ${response.data.relatedQueries.slice(0, 3).join(', ')}`);
    }
    
    console.log(`⏱️  実行時間: ${response.executionTimeMs}ms\n`);
  } else {
    console.log('❌ Google検索失敗');
    console.log(`🔒 エラー: ${response.error}\n`);
  }
}

// Demo 実行
runFunctionCallDemo().catch(console.error);
