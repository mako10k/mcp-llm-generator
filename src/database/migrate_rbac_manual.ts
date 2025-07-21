#!/usr/bin/env node
/**
 * Phase 1: RBAC システム用データベースマイグレーション (手動実行版)
 * persona_hierarchy テーブルと inherited_permissions カラムの追加
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MigrationResult {
  success: boolean;
  tablesCreated: number;
  columnsAdded: number;
  indexesCreated: number;
  viewsCreated: number;
  triggersCreated: number;
  errors: string[];
}

async function runRBACMigration(): Promise<MigrationResult> {
  console.log('🚀 Phase 1: RBAC データベースマイグレーション開始');
  
  const result: MigrationResult = {
    success: false,
    tablesCreated: 0,
    columnsAdded: 0,
    indexesCreated: 0,
    viewsCreated: 0,
    triggersCreated: 0,
    errors: []
  };

  try {
    // データベース接続
    const dbPath = join(__dirname, '../../../persona.db'); // プロジェクトルートのpersona.db
    console.log(`📁 データベースパス: ${dbPath}`);
    
    // パスの存在確認
    const fs = await import('fs');
    if (!fs.existsSync(dbPath)) {
      throw new Error(`データベースファイルが存在しません: ${dbPath}`);
    }
    
    const db = new Database(dbPath);
    
    // バックアップ作成
    const backupPath = join(__dirname, `../../persona_backup_${Date.now()}.db`);
    db.backup(backupPath);
    console.log(`💾 バックアップ作成: ${backupPath}`);
    
    // 既存テーブル確認
    const existingTables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('persona_hierarchy', 'persona_permission_cache')
    `).all() as Array<{ name: string }>;
    
    if (existingTables.length > 0) {
      console.log('⚠️  一部のRBACテーブルが既に存在します:', existingTables.map(t => t.name));
    }
    
    // inherited_permissions カラムの存在確認
    try {
      const roleTableInfo = db.prepare(`PRAGMA table_info(persona_roles)`).all() as Array<{ name: string }>;
      const hasInheritedPermissions = roleTableInfo.some(col => col.name === 'inherited_permissions');
      
      if (hasInheritedPermissions) {
        console.log('⚠️  inherited_permissions カラムは既に存在します');
      }
    } catch (error) {
      console.error('⚠️  persona_rolesテーブル情報取得エラー:', error);
    }
    
    // 手動でステートメントを順次実行
    const statements = [
      // 1. persona_hierarchy テーブル作成
      `CREATE TABLE IF NOT EXISTS persona_hierarchy (
        ancestor_id TEXT NOT NULL,
        descendant_id TEXT NOT NULL,
        depth INTEGER NOT NULL,
        is_direct BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (ancestor_id, descendant_id),
        FOREIGN KEY (ancestor_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
        FOREIGN KEY (descendant_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
        CHECK (depth >= 0)
      )`,
      
      // 2. inherited_permissions カラム追加
      `ALTER TABLE persona_roles ADD COLUMN inherited_permissions TEXT DEFAULT '[]'`,
      
      // 3. persona_permission_cache テーブル作成
      `CREATE TABLE IF NOT EXISTS persona_permission_cache (
        context_id TEXT PRIMARY KEY,
        effective_permissions TEXT NOT NULL DEFAULT '[]',
        effective_tools TEXT NOT NULL DEFAULT '[]',
        effective_memory_scope TEXT DEFAULT '',
        last_computed DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_valid BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (context_id) REFERENCES contexts(context_id) ON DELETE CASCADE
      )`,
      
      // インデックス作成
      `CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_ancestor ON persona_hierarchy(ancestor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_descendant ON persona_hierarchy(descendant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_depth ON persona_hierarchy(depth)`,
      `CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_direct ON persona_hierarchy(is_direct)`,
      `CREATE INDEX IF NOT EXISTS idx_permission_cache_valid ON persona_permission_cache(is_valid)`,
      `CREATE INDEX IF NOT EXISTS idx_permission_cache_computed ON persona_permission_cache(last_computed)`
    ];
    
    console.log(`📋 実行予定ステートメント数: ${statements.length}`);
    
    // トランザクション開始
    const transaction = db.transaction(() => {
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          console.log(`  実行中 ${i + 1}/${statements.length}: ${statement.split('\n')[0].substring(0, 60)}...`);
          db.exec(statement);
          
          // 実行結果のカウント
          if (statement.includes('CREATE TABLE')) {
            result.tablesCreated++;
            console.log(`✅ テーブル作成完了`);
          } else if (statement.includes('ALTER TABLE') && statement.includes('ADD COLUMN')) {
            result.columnsAdded++;
            console.log(`✅ カラム追加完了`);
          } else if (statement.includes('CREATE INDEX')) {
            result.indexesCreated++;
            console.log(`✅ インデックス作成完了`);
          }
          
        } catch (error: unknown) {
          const errorMsg = `ステートメント ${i + 1} 実行エラー: ${error instanceof Error ? error.message : String(error)}`;
          
          // カラム重複エラーは無視（既に存在する場合）
          if (error instanceof Error && error.message.includes('duplicate column name')) {
            console.log(`⚠️  カラムは既に存在: inherited_permissions`);
            continue;
          }
          
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
          throw error;
        }
      }
    });
    
    // トランザクション実行
    transaction();
    
    // 自分自身への階層レコードを挿入（既存の全人格に対して）
    const existingContexts = db.prepare(`
      SELECT DISTINCT context_id FROM persona_capabilities
    `).all() as Array<{ context_id: string }>;
    
    const insertSelfHierarchy = db.prepare(`
      INSERT OR IGNORE INTO persona_hierarchy (ancestor_id, descendant_id, depth, is_direct) 
      VALUES (?, ?, 0, FALSE)
    `);
    
    for (const context of existingContexts) {
      insertSelfHierarchy.run(context.context_id, context.context_id);
    }
    
    console.log(`✅ 既存人格の自己参照階層レコード作成: ${existingContexts.length}件`);
    
    // データベース整合性チェック
    const integrityCheck = db.pragma('integrity_check');
    console.log('🔍 整合性チェック結果:', integrityCheck);
    
    // 結果の確認（配列または文字列の可能性があるため）
    const isOk = Array.isArray(integrityCheck) 
      ? integrityCheck[0] === 'ok' || (typeof integrityCheck[0] === 'object' && integrityCheck[0].integrity_check === 'ok')
      : integrityCheck === 'ok';
      
    if (!isOk) {
      throw new Error(`データベース整合性エラー: ${JSON.stringify(integrityCheck)}`);
    }
    
    console.log('✅ データベース整合性チェック: OK');
    
    // 最適化実行
    db.pragma('optimize');
    console.log('✅ データベース最適化完了');
    
    db.close();
    
    result.success = true;
    
    console.log('\n🎉 Phase 1: RBAC データベースマイグレーション完了!');
    console.log(`📊 作成されたテーブル: ${result.tablesCreated}`);
    console.log(`📊 追加されたカラム: ${result.columnsAdded}`);
    console.log(`📊 作成されたインデックス: ${result.indexesCreated}`);
    console.log(`📊 作成されたビュー: ${result.viewsCreated}`);
    console.log(`📊 作成されたトリガー: ${result.triggersCreated}`);
    
    return result;
    
  } catch (error: unknown) {
    result.errors.push(`マイグレーション実行エラー: ${error instanceof Error ? error.message : String(error)}`);
    console.error('❌ マイグレーションに失敗しました:', error);
    result.success = false;
    return result;
  }
}

// スクリプトが直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  runRBACMigration()
    .then(result => {
      if (result.success) {
        console.log('✅ マイグレーション成功');
        process.exit(0);
      } else {
        console.error('❌ マイグレーション失敗:', result.errors);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ 予期しないエラー:', error);
      process.exit(1);
    });
}

export { runRBACMigration, type MigrationResult };
