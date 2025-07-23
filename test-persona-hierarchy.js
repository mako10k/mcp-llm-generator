import Database from 'better-sqlite3';

console.log('🚀 ペルソナ階層構造テスト開始');

try {
  const db = new Database('data/contexts.db');
  
  // 既存のcontextsを確認
  const contexts = db.prepare('SELECT id, name FROM contexts LIMIT 10').all();
  console.log('📋 既存のContexts:', contexts.length);
  
  db.pragma('foreign_keys = OFF');
  
  // 複数のpersona capabilityレコードを作成
  const insertPersona = db.prepare(`
    INSERT OR REPLACE INTO persona_capabilities 
    (context_id, expertise, tools, restrictions, is_public, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  
  const personaConfigs = [
    {
      id: contexts[0]?.id,
      expertise: ['Senior Developer', 'Architecture Design'],
      tools: ['code-review', 'system-design'],
      restrictions: ['no-production-changes']
    },
    {
      id: contexts[1]?.id,
      expertise: ['Technical Analysis', 'Problem Solving'],
      tools: ['analysis', 'debugging'],
      restrictions: ['read-only-access']
    },
    {
      id: contexts[2]?.id,
      expertise: ['Professional Assistant', 'Documentation'],
      tools: ['documentation', 'communication'],
      restrictions: ['business-hours-only']
    },
    {
      id: contexts[3]?.id,
      expertise: ['Support Guide', 'Training'],
      tools: ['training', 'support'],
      restrictions: ['guided-assistance-only']
    },
    {
      id: contexts[4]?.id,
      expertise: ['Technical Review', 'Quality Assurance'],
      tools: ['review', 'testing'],
      restrictions: ['review-scope-only']
    }
  ];
  
  let created = 0;
  for (const config of personaConfigs) {
    if (config.id) {
      const result = insertPersona.run(
        config.id,
        JSON.stringify(config.expertise),
        JSON.stringify(config.tools),
        JSON.stringify(config.restrictions),
        1
      );
      if (result.changes > 0) created++;
    }
  }
  
  console.log(`✅ ${created}個のPersonaレコードを作成`);
  
  // 階層関係を追加
  const insertHierarchy = db.prepare(`
    INSERT OR REPLACE INTO persona_hierarchy 
    (ancestor_id, descendant_id, depth, is_direct, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);
  
  // Senior Developer -> Technical Analysis (direct relationship, depth=1)
  if (contexts[0] && contexts[1]) {
    insertHierarchy.run(contexts[0].id, contexts[1].id, 1, 1);
    console.log('📈 階層関係追加: Senior Developer -> Technical Analysis');
  }
  
  // Technical Analysis -> Professional Assistant (direct relationship, depth=1)
  if (contexts[1] && contexts[2]) {
    insertHierarchy.run(contexts[1].id, contexts[2].id, 1, 1);
    console.log('📈 階層関係追加: Technical Analysis -> Professional Assistant');
  }
  
  // Senior Developer -> Professional Assistant (indirect relationship, depth=2)
  if (contexts[0] && contexts[2]) {
    insertHierarchy.run(contexts[0].id, contexts[2].id, 2, 0);
    console.log('📈 階層関係追加: Senior Developer -> Professional Assistant (間接)');
  }
  
  db.pragma('foreign_keys = ON');
  
  // 結果確認
  const personas = db.prepare('SELECT context_id, expertise FROM persona_capabilities').all();
  console.log('📊 作成されたPersonas:');
  personas.forEach(p => {
    const expertise = JSON.parse(p.expertise);
    console.log(`  ${p.context_id}: ${expertise.join(', ')}`);
  });
  
  const hierarchies = db.prepare('SELECT ancestor_id, descendant_id, depth, is_direct FROM persona_hierarchy').all();
  console.log('🌳 階層関係:');
  hierarchies.forEach(h => {
    const relationship = h.is_direct ? 'direct' : 'indirect';
    console.log(`  ${h.ancestor_id} --[depth:${h.depth}, ${relationship}]--> ${h.descendant_id}`);
  });
  
  db.close();
  console.log('🎉 ペルソナ階層構造テスト完了');
  
} catch (error) {
  console.error('❌ テスト失敗:', error.message);
  console.error('📥 スタックトレース:', error.stack);
}
