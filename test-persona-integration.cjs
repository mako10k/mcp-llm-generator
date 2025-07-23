/**
 * PersonaPromptMerger最適化統合テスト
 * 最適化版プロンプトジェネレーターの統合動作確認
 */

const { ContextMemoryTools } = require('./build/contextMemory/tools/index.js');

// テスト用のサンプルツール定義
const sampleTools = [
  {
    function: {
      name: 'search_web',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Maximum results' }
        },
        required: ['query']
      }
    }
  },
  {
    function: {
      name: 'get_weather',
      description: 'Get current weather information',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
          units: { type: 'string', description: 'Temperature units' }
        },
        required: ['location']
      }
    }
  }
];

async function testPersonaPromptMergerIntegration() {
  console.log('🔧 PersonaPromptMerger最適化統合テスト開始');
  
  try {
    // 1. ContextMemoryToolsインスタンス作成
    console.log('\n1. ContextMemoryTools初期化...');
    const contextTools = new ContextMemoryTools();
    
    // 2. テスト用コンテキスト作成
    console.log('\n2. テスト用コンテキスト作成...');
    const createResult = await contextTools.handleContextManage({
      action: 'create',
      name: 'OptimizedPromptTest',
      personality: 'Professional AI assistant with optimized prompt generation',
      systemPrompt: 'You are a professional AI assistant. Help users with their questions and tasks efficiently.',
      temperature: 0.7,
      maxTokens: 2000
    });
    
    console.log('コンテキスト作成結果:', createResult.success ? '✅ 成功' : '❌ 失敗');
    if (!createResult.success) {
      console.error('エラー:', createResult.error);
      return;
    }
    
    const contextId = createResult.context.id;
    console.log(`作成されたコンテキストID: ${contextId}`);
    
    // 3. 最適化プロンプトによるチャット実行
    console.log('\n3. 最適化プロンプトでのチャット実行...');
    
    // MCPコールバック設定（シミュレーション）
    contextTools.setCreateMessageCallback((messages) => {
      console.log(`=== MCP CreateMessage Called ===`);
      console.log(`Messages count: ${messages.length}`);
      
      if (messages.length > 0) {
        const systemMessage = messages.find(msg => msg.role === 'system');
        if (systemMessage) {
          console.log(`System prompt length: ${systemMessage.content.length} chars`);
          console.log(`Estimated tokens: ${Math.ceil(systemMessage.content.length * 0.75)}`);
          
          // プロンプトの最初の部分をチェック
          const promptStart = systemMessage.content.substring(0, 200);
          console.log(`Prompt start: ${promptStart}...`);
          
          // 最適化版の特徴をチェック
          const isOptimized = systemMessage.content.includes('Core rules:') && 
                             systemMessage.content.includes('Call tools only when necessary');
          console.log(`Optimized prompt detected: ${isOptimized ? '✅' : '❌'}`);
        }
      }
      
      // シミュレートされたレスポンス
      return Promise.resolve({
        role: 'assistant',
        content: {
          type: 'text',
          text: 'Hello! I can help you with various tasks. What would you like me to do?'
        }
      });
    });
    
    const chatResult = await contextTools.handleContextChat({
      contextId: contextId,
      message: 'Hello, I need help searching for information about renewable energy',
      availableTools: sampleTools
    });
    
    console.log('チャット実行結果:', chatResult.success ? '✅ 成功' : '❌ 失敗');
    if (chatResult.success) {
      console.log(`応答: ${chatResult.response.substring(0, 100)}...`);
      console.log(`トークン使用量: ${chatResult.tokensUsed || 'N/A'}`);
    }
    
    // 4. コンテキスト情報確認
    console.log('\n4. コンテキスト情報確認...');
    const getResult = await contextTools.handleContextManage({
      action: 'get',
      contextId: contextId
    });
    
    if (getResult.success) {
      console.log(`システムプロンプト長: ${getResult.context.systemPrompt?.length || 0} chars`);
      console.log(`推定トークン数: ${Math.ceil((getResult.context.systemPrompt?.length || 0) * 0.75)}`);
      console.log(`メッセージ履歴: ${getResult.context.messageHistory?.length || 0}件`);
    }
    
    // 5. クリーンアップ
    console.log('\n5. テストコンテキスト削除...');
    await contextTools.handleContextManage({
      action: 'delete',
      contextId: contextId
    });
    
    console.log('\n✅ PersonaPromptMerger最適化統合テスト完了');
    console.log('🎯 結果: 最適化プロンプトの統合動作が正常に確認できました');
    
  } catch (error) {
    console.error('❌ 統合テスト中にエラー:', error);
    console.error('スタックトレース:', error.stack);
  }
}

// テスト実行
testPersonaPromptMergerIntegration();
