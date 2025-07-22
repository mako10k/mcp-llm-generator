/**
 * Step3能力自覚システム テストデータセットアップ
 * サンプルペルソナと能力データを作成
 */

const { Database } = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'data/contexts.db');
const db = new Database(dbPath);

console.log('Step3 テストデータセットアップ開始...');

// テストペルソナを作成
const testPersonas = [
  {
    context_id: 'test-persona-001',
    name: 'System Architect',
    personality: 'システム設計・アーキテクチャ専門家',
    system_prompt: 'あなたはシステムアーキテクト専門家です'
  },
  {
    context_id: 'test-persona-002', 
    name: 'Security Engineer',
    personality: 'セキュリティ・安全性専門家',
    system_prompt: 'あなたはセキュリティエンジニア専門家です'
  },
  {
    context_id: 'test-persona-003',
    name: 'QA Engineer', 
    personality: '品質保証・テスト専門家',
    system_prompt: 'あなたは品質保証エンジニア専門家です'
  }
];

// テスト能力データ
const testCapabilities = [
  {
    context_id: 'test-persona-001',
    expertise: 'system-design,architecture,scalability',
    tools: 'design-patterns,architecture-review,system-modeling',
    constraints: 'implementation-details,specific-technologies',
    responsibilities: 'system-architecture,design-decisions,technical-leadership'
  },
  {
    context_id: 'test-persona-002',
    expertise: 'security-analysis,threat-modeling,vulnerability-assessment',
    tools: 'security-scan,penetration-test,security-audit',
    constraints: 'non-security-domains,business-decisions',
    responsibilities: 'security-review,threat-analysis,security-compliance'
  },
  {
    context_id: 'test-persona-003',
    expertise: 'quality-assurance,test-design,bug-analysis',
    tools: 'test-automation,bug-tracking,quality-metrics',
    constraints: 'development-implementation,business-strategy',
    responsibilities: 'quality-control,test-planning,defect-management'
  }
];

// 階層関係データ
const testHierarchy = [
  {
    parent_context_id: 'test-persona-001',
    child_context_id: 'test-persona-002',
    inheritance_type: 'technical-oversight'
  },
  {
    parent_context_id: 'test-persona-001', 
    child_context_id: 'test-persona-003',
    inheritance_type: 'quality-oversight'
  }
];

try {
  // contexts テーブルに挿入
  console.log('テストペルソナを作成中...');
  for (const persona of testPersonas) {
    db.prepare(`
      INSERT OR REPLACE INTO contexts 
      (context_id, name, personality, system_prompt, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(persona.context_id, persona.name, persona.personality, persona.system_prompt);
    console.log(`✓ ペルソナ作成: ${persona.name} (${persona.context_id})`);
  }

  // persona_capabilities テーブルに挿入
  console.log('能力データを作成中...');
  for (const capability of testCapabilities) {
    db.prepare(`
      INSERT OR REPLACE INTO persona_capabilities
      (context_id, expertise, tools, constraints, responsibilities, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      capability.context_id,
      capability.expertise,
      capability.tools,
      capability.constraints,
      capability.responsibilities
    );
    console.log(`✓ 能力データ作成: ${capability.context_id}`);
  }

  // persona_hierarchy テーブルに挿入
  console.log('階層関係を作成中...');
  for (const hierarchy of testHierarchy) {
    db.prepare(`
      INSERT OR REPLACE INTO persona_hierarchy
      (parent_context_id, child_context_id, inheritance_type, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      hierarchy.parent_context_id,
      hierarchy.child_context_id,
      hierarchy.inheritance_type
    );
    console.log(`✓ 階層関係作成: ${hierarchy.parent_context_id} → ${hierarchy.child_context_id}`);
  }

  console.log('\n🟢 Step3テストデータセットアップ完了');
  console.log('作成されたデータ:');
  console.log(`- テストペルソナ: ${testPersonas.length}個`);
  console.log(`- 能力データ: ${testCapabilities.length}個`);
  console.log(`- 階層関係: ${testHierarchy.length}個`);
  
} catch (error) {
  console.error('❌ テストデータセットアップエラー:', error);
  process.exit(1);
} finally {
  db.close();
}
