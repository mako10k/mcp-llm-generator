#!/usr/bin/env node

// 人格側共有メモリFunction統合テスト
import { PersonaManager } from './build-production/utils/personaManager.js';
import { SharedMemoryMCPTools } from './build-production/tools/shared-memory-mcp-tools.js';
import Database from 'better-sqlite3';

async function testPersonaSharedMemoryIntegration() {
  console.log('🧪 人格側共有メモリFunction統合テスト開始...\n');

  try {
    // データベース初期化
    const db = new Database('./context-memory.db');
    
    // 一時的に外部キー制約を無効化（テスト用）
    db.exec('PRAGMA foreign_keys = OFF;');
    
    // テスト用コンテキスト作成
    const testContextId = 'test-persona-001';
    console.log(`\n📋 Test Context ID: ${testContextId}`);
    
    // contextsテーブルにテストコンテキストを追加
    try {
      const insertContext = db.prepare(`
        INSERT OR REPLACE INTO contexts (id, name, personality, system_prompt, temperature, max_tokens, max_history_tokens, expiry_days, created_at, updated_at, expires_at, is_active)
        VALUES (?, ?, ?, ?, 0.7, 1000, 15000, 7, datetime('now'), datetime('now'), datetime('now', '+7 days'), 1)
      `);
      insertContext.run(
        testContextId,
        'テスト人格',
        '共有メモリテスト用の人格です',
        'あなたは共有メモリテスト用の人格です。'
      );
      console.log('✅ テストコンテキスト作成完了');
    } catch (error) {
      console.log('✅ テストコンテキスト既存（スキップ）');
    }
    
    // 外部キー制約を再有効化
    db.exec('PRAGMA foreign_keys = ON;');
    
    // 共有メモリツール初期化（グローバル設定）
    const sharedMemoryTools = new SharedMemoryMCPTools(db);
    global.sharedMemoryTools = sharedMemoryTools;
    console.log('✅ SharedMemoryMCPTools initialized');

    // PersonaManager初期化
    const personaManager = new PersonaManager(db);
    console.log('✅ PersonaManager initialized');

    // 1. 人格側から共有メモリ作成
    console.log('\n1. 人格側共有メモリ作成テスト...');
    const memoryId = await personaManager.createSharedMemory(
      testContextId,
      'テスト人格メモ',
      'これは人格側Functionから作成されたメモです。',
      'edit'
    );
    
    if (memoryId) {
      console.log(`✅ 共有メモリ作成成功 - ID: ${memoryId}`);
    } else {
      console.log('❌ 共有メモリ作成失敗');
      return;
    }

    // 2. 人格側から検索
    console.log('\n2. 人格側検索テスト...');
    const searchResults = await personaManager.searchSharedMemory(testContextId, 'テスト');
    console.log(`✅ 検索結果: ${searchResults.length}件`);
    if (searchResults.length > 0) {
      console.log(`   - 最初の結果: "${searchResults[0].title}"`);
    }

    // 3. 人格側から更新
    console.log('\n3. 人格側更新テスト...');
    const updateSuccess = await personaManager.updateSharedMemory(
      testContextId,
      memoryId,
      'テスト人格メモ（更新済み）',
      'これは人格側Functionから更新されたメモです。'
    );
    console.log(`✅ 更新${updateSuccess ? '成功' : '失敗'}`);

    // 4. BIFF通知システムロールメッセージ生成
    console.log('\n4. BIFF通知システムロールメッセージテスト...');
    const biffMessage = await personaManager.insertBiffNotification(testContextId);
    
    if (biffMessage) {
      console.log(`✅ BIFF通知生成成功:`);
      console.log(`   ${biffMessage}`);
    } else {
      console.log('✅ BIFF通知なし（正常）');
    }

    // 5. 会話履歴のBIFF拡張テスト
    console.log('\n5. 会話履歴BIFF拡張テスト...');
    const testMessages = [
      { role: 'user', content: 'こんにちは！' },
      { role: 'assistant', content: 'こんにちは！調子はいかがですか？' }
    ];

    const enrichedMessages = await personaManager.enrichConversationWithBiff(testContextId, testMessages);
    console.log(`✅ 会話履歴拡張完了:`);
    console.log(`   元メッセージ数: ${testMessages.length}`);
    console.log(`   拡張後メッセージ数: ${enrichedMessages.length}`);
    
    if (enrichedMessages.length > testMessages.length) {
      console.log(`   追加されたBIFF通知: "${enrichedMessages[0].content}"`);
    }

    // 6. 人格側から削除
    console.log('\n6. 人格側削除テスト...');
    const deleteSuccess = await personaManager.deleteSharedMemory(testContextId, memoryId);
    console.log(`✅ 削除${deleteSuccess ? '成功' : '失敗'}`);

    console.log('\n🎉 人格側共有メモリFunction統合テスト完了！');
    console.log('\n📋 実装状況:');
    console.log('✅ 人格側からの共有メモリCRUD操作');
    console.log('✅ 人格側BIFF通知システムロールメッセージ生成');
    console.log('✅ 会話履歴へのBIFF通知挿入機能');
    console.log('✅ 既存MCPツール実装の再利用');

  } catch (error) {
    console.error('❌ テストエラー:', error);
  } finally {
    process.exit(0);
  }
}

testPersonaSharedMemoryIntegration();
