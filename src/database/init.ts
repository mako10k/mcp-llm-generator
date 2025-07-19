#!/usr/bin/env node
/**
 * Sprint4 Phase 1: データベース初期化スクリプト
 * ペルソナ管理統合システムのテーブル作成
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initializeDatabase() {
  console.log('🚀 Sprint4 Phase 1: データベース初期化開始');
  
  try {
    // データベース接続
    const dbPath = join(__dirname, '../../persona.db');
    const db = new Database(dbPath);
    
    console.log(`📁 データベースパス: ${dbPath}`);
    
    // スキーマファイル読み込み
    const schemaPath = join(__dirname, 'persona_schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    console.log('📄 スキーマファイル読み込み完了');
    
    // スキーマを分割してバッチ実行
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    let created = 0;
    let indexed = 0;
    let viewed = 0;
    let triggered = 0;
    
    for (const statement of statements) {
      try {
        db.exec(statement + ';');
        
        if (statement.includes('CREATE TABLE')) {
          created++;
          console.log(`✅ テーブル作成: ${statement.match(/CREATE TABLE.*?(\w+)/)?.[1]}`);
        } else if (statement.includes('CREATE INDEX')) {
          indexed++;
        } else if (statement.includes('CREATE VIEW')) {
          viewed++;
        } else if (statement.includes('CREATE TRIGGER')) {
          triggered++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('already exists')) {
          console.error(`❌ Statement error: ${statement.substring(0, 50)}...`);
          console.error(errorMessage);
        }
      }
    }
    
    // サマリー表示
    console.log('\n📊 データベース初期化完了:');
    console.log(`   - テーブル: ${created}個作成`);
    console.log(`   - インデックス: ${indexed}個作成`);
    console.log(`   - ビュー: ${viewed}個作成`);
    console.log(`   - トリガー: ${triggered}個作成`);
    
    // テーブル確認
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{name: string}>;
    console.log('\n📋 作成されたテーブル:');
    tables.forEach(table => {
      console.log(`   - ${table.name}`);
    });
    
    // 必須テーブルの存在確認
    const requiredTables = [
      'persona_capabilities',
      'persona_roles', 
      'task_delegations',
      'persona_lineage'
    ];
    
    const missingTables = requiredTables.filter(tableName => 
      !tables.some(table => table.name === tableName)
    );
    
    if (missingTables.length > 0) {
      console.error(`❌ 必須テーブルが不足: ${missingTables.join(', ')}`);
      process.exit(1);
    }
    
    console.log('✅ 全ての必須テーブルが正常に作成されました');
    
    // サンプルデータの挿入（開発用）
    await insertSampleData(db);
    
    db.close();
    console.log('🎉 データベース初期化が完了しました\n');
    
  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
    process.exit(1);
  }
}

async function insertSampleData(db: Database.Database) {
  console.log('\n🌱 サンプルデータ挿入開始...');
  
  try {
    // まずcontextsテーブルにサンプルコンテキスト挿入
    const sampleContexts = [
      { context_id: 'system_architect', name: 'System Architect', description: 'システム設計責任者' },
      { context_id: 'security_specialist', name: 'Security Specialist', description: 'セキュリティ専門家' },
      { context_id: 'performance_expert', name: 'Performance Expert', description: 'パフォーマンス専門家' }
    ];
    
    const contextStmt = db.prepare(`
      INSERT OR REPLACE INTO contexts (context_id, name, description)
      VALUES (?, ?, ?)
    `);
    
    sampleContexts.forEach(ctx => {
      contextStmt.run(ctx.context_id, ctx.name, ctx.description);
    });
    
    // サンプルペルソナ能力
    const sampleCapabilities = [
      {
        context_id: 'system_architect',
        expertise: ['system_design', 'architecture_patterns', 'scalability', 'performance_optimization'],
        tools: ['plantuml', 'architecture_review', 'system_analysis'],
        restrictions: ['no_direct_implementation', 'review_only'],
        is_public: 1
      },
      {
        context_id: 'security_specialist', 
        expertise: ['security_analysis', 'threat_modeling', 'vulnerability_assessment', 'secure_coding'],
        tools: ['security_scan', 'penetration_test', 'audit_tools'],
        restrictions: ['security_focused_only', 'no_deployment'],
        is_public: 1
      },
      {
        context_id: 'performance_expert',
        expertise: ['performance_analysis', 'optimization', 'profiling', 'benchmarking'],
        tools: ['profiler', 'benchmark_suite', 'monitoring_tools'],
        restrictions: ['analysis_only', 'no_code_changes'],
        is_public: 1
      }
    ];
    
    const capabilityStmt = db.prepare(`
      INSERT OR REPLACE INTO persona_capabilities 
      (context_id, expertise, tools, restrictions, is_public) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    sampleCapabilities.forEach(cap => {
      capabilityStmt.run(
        cap.context_id,
        JSON.stringify(cap.expertise),
        JSON.stringify(cap.tools),
        JSON.stringify(cap.restrictions),
        cap.is_public
      );
    });
    
    // サンプルロール
    const sampleRoles = [
      {
        role_id: 'role_architect_admin',
        context_id: 'system_architect',
        role_type: 'admin',
        permissions: ['design_review', 'architecture_approval', 'system_oversight'],
        role_description: 'システム設計の最終責任者',
        hierarchy_level: 1
      },
      {
        role_id: 'role_security_specialist', 
        context_id: 'security_specialist',
        role_type: 'specialist',
        permissions: ['security_review', 'vulnerability_scan', 'threat_analysis'],
        role_description: 'セキュリティ専門家',
        hierarchy_level: 2
      },
      {
        role_id: 'role_performance_assistant',
        context_id: 'performance_expert',
        role_type: 'assistant',
        permissions: ['performance_analysis', 'benchmark_execution'],
        role_description: 'パフォーマンス分析アシスタント',
        hierarchy_level: 3
      }
    ];
    
    const roleStmt = db.prepare(`
      INSERT OR REPLACE INTO persona_roles 
      (role_id, context_id, role_type, permissions, role_description, hierarchy_level) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    sampleRoles.forEach(role => {
      roleStmt.run(
        role.role_id,
        role.context_id,
        role.role_type,
        JSON.stringify(role.permissions),
        role.role_description,
        role.hierarchy_level
      );
    });
    
    console.log('✅ サンプルデータ挿入完了');
    
  } catch (error) {
    console.error('❌ サンプルデータ挿入エラー:', error);
    throw error;
  }
}

// 実行
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

export { initializeDatabase };
