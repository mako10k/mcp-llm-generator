#!/usr/bin/env node
/**
 * Phase 1: RBAC システム用データベースマイグレーション
 * persona_hierarchy テーブルと inherited_permissions カラムの追加
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
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
    const dbPath = join(__dirname, '../../persona.db');
    const db = new Database(dbPath);
    
    console.log(`📁 データベースパス: ${dbPath}`);
    
    // バックアップ作成
    const backupPath = join(__dirname, `../../persona_backup_${Date.now()}.db`);
    db.backup(backupPath);
    console.log(`💾 バックアップ作成: ${backupPath}`);
    
    // RBAC拡張スキーマファイル読み込み
    const schemaPath = join(__dirname, '../../../src/database/rbac_extension_schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    console.log('📄 RBAC拡張スキーマファイル読み込み完了');
    
    // 既存テーブル確認
    const existingTables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('persona_hierarchy', 'persona_permission_cache')
    `).all() as Array<{ name: string }>;
    
    if (existingTables.length > 0) {
      console.log('⚠️  一部のRBACテーブルが既に存在します:', existingTables.map(t => t.name));
    }
    
    // inherited_permissions カラムの存在確認
    const roleTableInfo = db.prepare(`PRAGMA table_info(persona_roles)`).all() as Array<{ name: string }>;
    const hasInheritedPermissions = roleTableInfo.some(col => col.name === 'inherited_permissions');
    
    if (hasInheritedPermissions) {
      console.log('⚠️  inherited_permissions カラムは既に存在します');
    }
    
    // スキーマを分割してバッチ実行
    // 複数行のSQL文を正しく分割するために改良
    const statements: string[] = [];
    let currentStatement = '';
    const lines = schema.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // コメント行や空行をスキップ
      if (!trimmedLine || trimmedLine.startsWith('--')) {
        continue;
      }
      
      currentStatement += ' ' + trimmedLine;
      
      // ステートメント終了判定
      if (trimmedLine.endsWith(';')) {
        const cleanStatement = currentStatement.trim();
        if (cleanStatement.length > 0) {
          statements.push(cleanStatement.slice(0, -1)); // 末尾のセミコロンを除去
        }
        currentStatement = '';
      }
    }
    
    // 最後のステートメントが残っている場合
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`📋 実行予定ステートメント数: ${statements.length}`);
    
    // デバッグ: 各ステートメントの先頭を表示
    statements.forEach((stmt, index) => {
      console.log(`  ${index + 1}. ${stmt.substring(0, 80)}...`);
    });
    
    // トランザクション開始
    const transaction = db.transaction(() => {
      for (const statement of statements) {
        try {
          db.exec(statement + ';');
          
          // 実行結果のカウント
          if (statement.includes('CREATE TABLE')) {
            result.tablesCreated++;
            const tableName = statement.match(/CREATE TABLE.*?(\w+)/)?.[1];
            console.log(`✅ テーブル作成: ${tableName}`);
          } else if (statement.includes('ALTER TABLE') && statement.includes('ADD COLUMN')) {
            result.columnsAdded++;
            const columnName = statement.match(/ADD COLUMN\s+(\w+)/)?.[1];
            console.log(`✅ カラム追加: ${columnName}`);
          } else if (statement.includes('CREATE INDEX')) {
            result.indexesCreated++;
            const indexName = statement.match(/CREATE INDEX.*?(\w+)/)?.[1];
            console.log(`✅ インデックス作成: ${indexName}`);
          } else if (statement.includes('CREATE VIEW')) {
            result.viewsCreated++;
            const viewName = statement.match(/CREATE VIEW.*?(\w+)/)?.[1];
            console.log(`✅ ビュー作成: ${viewName}`);
          } else if (statement.includes('CREATE TRIGGER')) {
            result.triggersCreated++;
            const triggerName = statement.match(/CREATE TRIGGER.*?(\w+)/)?.[1];
            console.log(`✅ トリガー作成: ${triggerName}`);
          }
          
        } catch (error: unknown) {
          const errorMsg = `ステートメント実行エラー: ${error instanceof Error ? error.message : String(error)}\nSQL: ${statement.substring(0, 100)}...`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
          throw error; // トランザクション全体をロールバック
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
    const integrityCheck = db.pragma('integrity_check') as string[];
    if (integrityCheck[0] !== 'ok') {
      throw new Error(`データベース整合性エラー: ${integrityCheck.join(', ')}`);
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
