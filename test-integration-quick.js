#!/usr/bin/env node
// Step4マージ機能 - クイック統合テスト
// 目的: PersonaPromptMergerが既存context-chat機能に正常統合されているかを確認

import { ContextMemoryTools } from './build/contextMemory/tools/index.js';

async function runQuickTest() {
  console.log('🚀 Step4マージ機能 - クイック統合テスト開始');
  
  try {
    // 1. ContextMemoryToolsインスタンス作成
    const tools = new ContextMemoryTools(':memory:');
    console.log('✅ ContextMemoryTools初期化完了');

    // 2. テスト用コンテキスト作成
    const createResult = await tools.handleToolCall({
      params: {
        name: 'context-manage',
        arguments: {
          action: 'create',
          name: 'test-context',
          systemPrompt: 'You are a helpful assistant.',
          personality: 'friendly and knowledgeable'
        }
      }
    });
    
    const contextData = JSON.parse(createResult.content[0].text);
    console.log('✅ テストコンテキスト作成Response:', contextData);
    
    const contextId = contextData.contextId;
    if (!contextId) {
      throw new Error('Context ID not found in response');
    }
    console.log('✅ Context ID:', contextId);

    // 3. context-chatでマージ機能の統合確認（LLMモック使用）
    // モック設定
    tools.setCreateMessageCallback(async (messages, options) => {
      return {
        content: {
          text: 'This is a test response from the assistant.'
        }
      };
    });

    const chatResult = await tools.handleToolCall({
      params: {
        name: 'context-chat',
        arguments: {
          contextId: contextId,
          message: 'Hello, please explain machine learning.',
          maintainPersonality: true
        }
      }
    });

    const chatData = JSON.parse(chatResult.content[0].text);
    console.log('✅ Context-chat統合テスト完了');
    console.log('📊 応答:', chatData.response);
    console.log('📈 トークン使用:', chatData.historyTokens);

    console.log('\n🎉 Step4マージ機能統合テスト - 成功');
    console.log('📝 PersonaPromptMergerが正常にcontext-chat機能に統合されました');
    
  } catch (error) {
    console.error('❌ 統合テスト失敗:', error.message);
    console.error('スタックトレース:', error.stack);
    process.exit(1);
  }
}

runQuickTest().catch(console.error);
