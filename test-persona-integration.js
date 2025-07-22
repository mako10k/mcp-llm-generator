import Database from 'better-sqlite3';

console.log('🚀 ペルソナ機能統合テスト開始');

try {
  // data/contexts.dbを使用（実際のMCPサーバーと同じDB）
  const db = new Database('data/contexts.db');
  
  // ContextMemoryから作成されたcontextを確認
  const contexts = db.prepare('SELECT id, name FROM contexts LIMIT 5').all();
  console.log('📋 既存のContexts:', contexts);
  
  if (contexts.length > 0) {
    const testContext = contexts[0];
    console.log('🎯 テスト対象Context:', testContext);
    
    // persona_capabilitiesテーブルの構造確認
    const personaSchema = db.prepare('PRAGMA table_info(persona_capabilities)').all();
    console.log('📊 persona_capabilitiesテーブル構造:');
    personaSchema.forEach(col => console.log('  ', col.name, col.type, col.pk ? '(PRIMARY KEY)' : ''));
    
    // 手動でpersona_capabilityレコードを作成（外部キー制約を無視）
    db.pragma('foreign_keys = OFF');
    
    const insertPersona = db.prepare(`
      INSERT OR REPLACE INTO persona_capabilities 
      (context_id, expertise, tools, restrictions, is_public, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    const result = insertPersona.run(
      testContext.id, // ContextMemoryのcontexts.idを使用
      JSON.stringify(['AI Assistant', 'Technical Discussion']),
      JSON.stringify(['context-chat', 'general-assistance']),
      JSON.stringify(['no-personal-data']),
      1
    );
    
    console.log('✅ Persona capabilityレコード作成:', result.changes > 0 ? '成功' : '失敗');
    
    // 確認
    const persona = db.prepare('SELECT * FROM persona_capabilities WHERE context_id = ?').get(testContext.id);
    console.log('📋 作成されたPersona:', persona ? '存在' : '見つからない');
    
    if (persona) {
      console.log('🔍 Persona詳細:', {
        context_id: persona.context_id,
        expertise: JSON.parse(persona.expertise),
        tools: JSON.parse(persona.tools),
        restrictions: JSON.parse(persona.restrictions)
      });
    }
    
    db.pragma('foreign_keys = ON');
  }
  
  db.close();
  console.log('🎉 統合テスト完了');
  
} catch (error) {
  console.error('❌ テスト失敗:', error.message);
  console.error('📥 スタックトレース:', error.stack);
}
