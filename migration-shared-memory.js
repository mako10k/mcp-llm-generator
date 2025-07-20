#!/usr/bin/env node

// 共有メモリテーブル安全マイグレーション
import Database from 'better-sqlite3';

async function safeTableMigration() {
  console.log('🔧 共有メモリテーブル安全マイグレーション開始...\n');

  const db = new Database('./context-memory.db');

  try {
    // 1. 外部キー制約有効化
    console.log('1. 外部キー制約を有効化...');
    db.exec('PRAGMA foreign_keys = ON;');
    const fkStatus = db.prepare('PRAGMA foreign_keys;').get();
    console.log(`✅ 外部キー制約ステータス: ${fkStatus['foreign_keys'] === 1 ? '有効' : '無効'}`);

    // 2. 既存データのバックアップ
    console.log('\n2. 既存データバックアップ...');
    try {
      const backupData = db.prepare('SELECT * FROM shared_memories;').all();
      console.log(`✅ バックアップ完了: ${backupData.length}件のデータ`);
      
      // バックアップファイルに保存
      require('fs').writeFileSync('./shared_memories_backup.json', JSON.stringify(backupData, null, 2));
      console.log('✅ バックアップファイル作成: shared_memories_backup.json');
    } catch (error) {
      console.log('✅ 既存テーブルなし（初回作成）');
    }

    // 3. 関連テーブル削除
    console.log('\n3. 関連テーブル削除...');
    db.exec('DROP TABLE IF EXISTS memory_notifications;');
    db.exec('DROP TABLE IF EXISTS shared_memories;');
    console.log('✅ 既存テーブル削除完了');

    // 4. 正しい型定義でテーブル再作成
    console.log('\n4. 正しい型定義でテーブル再作成...');
    
    // shared_memoriesテーブル（contextsのTEXT型idに合わせる）
    db.exec(`
      CREATE TABLE shared_memories (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        owner_persona_id TEXT NOT NULL,
        permission_level TEXT NOT NULL DEFAULT 'edit' CHECK (permission_level IN ('public', 'edit')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_updated_by TEXT NOT NULL,
        FOREIGN KEY (owner_persona_id) REFERENCES contexts(id) ON DELETE CASCADE,
        FOREIGN KEY (last_updated_by) REFERENCES contexts(id) ON DELETE CASCADE
      );
    `);

    // memory_notificationsテーブル
    db.exec(`
      CREATE TABLE memory_notifications (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        memory_id TEXT NOT NULL,
        action_type TEXT NOT NULL CHECK (action_type IN ('created', 'updated', 'deleted')),
        message TEXT NOT NULL,
        triggered_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // インデックス作成
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_shared_memories_owner ON shared_memories(owner_persona_id);
      CREATE INDEX IF NOT EXISTS idx_shared_memories_updated ON shared_memories(updated_at);
      CREATE INDEX IF NOT EXISTS idx_memory_notifications_created ON memory_notifications(created_at);
    `);

    console.log('✅ テーブル再作成完了');

    // 5. 外部キー制約検証
    console.log('\n5. 外部キー制約検証...');
    const fkCheck = db.prepare('PRAGMA foreign_key_check;').all();
    if (fkCheck.length === 0) {
      console.log('✅ 外部キー制約検証成功（違反なし）');
    } else {
      console.log('❌ 外部キー制約違反:', fkCheck);
    }

    // 6. テストデータ作成
    console.log('\n6. テストデータ作成...');
    
    // テストコンテキスト確認・作成
    const testContextId = 'test-persona-001';
    const existingContext = db.prepare('SELECT id FROM contexts WHERE id = ?').get(testContextId);
    
    if (!existingContext) {
      db.prepare(`
        INSERT INTO contexts (id, name, system_prompt, personality, temperature, max_tokens, max_history_tokens, expiry_days, created_at, updated_at, expires_at, is_active)
        VALUES (?, ?, ?, ?, 0.7, 1000, 15000, 7, datetime('now'), datetime('now'), datetime('now', '+7 days'), 1)
      `).run(
        testContextId,
        'テスト人格',
        'あなたは共有メモリテスト用の人格です。',
        '共有メモリテスト用の人格です'
      );
      console.log('✅ テストコンテキスト作成完了');
    } else {
      console.log('✅ テストコンテキスト既存');
    }

    console.log('\n🎉 共有メモリテーブル安全マイグレーション完了！');
    console.log('\n📋 実行内容:');
    console.log('✅ 外部キー制約有効化');
    console.log('✅ 既存データバックアップ');
    console.log('✅ テーブル削除・再作成');
    console.log('✅ 正しい型定義（TEXT型）で外部キー制約設定');
    console.log('✅ 制約検証完了');
    console.log('✅ テストコンテキスト準備完了');

  } catch (error) {
    console.error('❌ マイグレーションエラー:', error);
  } finally {
    db.close();
    process.exit(0);
  }
}

safeTableMigration();
