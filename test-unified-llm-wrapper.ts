/**
 * UnifiedLLMWrapper 動作検証スクリプト
 * 各プロバイダー・各モードでの基本動作を検証
 */

import { UnifiedLLMWrapper, ProviderType } from './src/llm/UnifiedLLMWrapper.js';
import { LLMProviderManager } from './src/llm/LLMProviderManager.js';
import { Tool } from './src/types/tool.js';

// テスト用ツール定義
const testTools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '指定した場所の現在の天気情報を取得します',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: '場所名（例：東京、大阪）'
          },
          unit: {
            type: 'string',
            description: '温度の単位',
            enum: ['celsius', 'fahrenheit']
          }
        },
        required: ['location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: '簡単な計算を実行します',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '計算式（例：2 + 3 * 4）'
          }
        },
        required: ['expression']
      }
    }
  }
];

// テストケース定義
const testCases = [
  {
    name: '基本的なメッセージ生成（ツール不要）',
    messages: [
      { role: 'user' as const, content: 'こんにちは！今日はいい天気ですね。' }
    ],
    useTools: false,
    expectedBehavior: 'プロンプト統合なしで自然な会話応答'
  },
  {
    name: 'ツール呼び出し候補（天気情報）',
    messages: [
      { role: 'user' as const, content: '東京の今日の天気を教えてください。' }
    ],
    useTools: true,
    expectedBehavior: 'get_weatherツールの呼び出し判定'
  },
  {
    name: 'ツール呼び出し候補（計算）',
    messages: [
      { role: 'user' as const, content: '15 × 23 の結果を計算してください。' }
    ],
    useTools: true,
    expectedBehavior: 'calculateツールの呼び出し判定'
  },
  {
    name: '複合判定（ツール不要）',
    messages: [
      { role: 'user' as const, content: '天気について一般的な話を聞かせてください。' }
    ],
    useTools: true,
    expectedBehavior: 'ツールを使わない自然な応答（shouldCallTool: false）'
  }
];

// 検証実行クラス
class UnifiedLLMWrapperTester {
  private wrapper: UnifiedLLMWrapper;

  constructor() {
    const providerManager = new LLMProviderManager();
    this.wrapper = new UnifiedLLMWrapper(providerManager);
  }

  /**
   * 全テストケースを実行
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 UnifiedLLMWrapper 動作検証開始\n');
    
    const providers: ProviderType[] = ['mcp-internal'];
    
    for (const provider of providers) {
      console.log(`\n📋 プロバイダー: ${provider}`);
      console.log('='.repeat(50));
      
      // プロバイダー能力情報を表示
      await this.showProviderCapabilities(provider);
      
      // 各テストケース実行
      for (const testCase of testCases) {
        await this.runTestCase(testCase, provider);
      }
    }
    
    console.log('\n✅ 全体検証完了');
  }

  /**
   * プロバイダー能力を表示
   */
  private async showProviderCapabilities(provider: ProviderType): Promise<void> {
    const capabilities = this.wrapper.getProviderCapabilities(provider);
    
    console.log('🔧 プロバイダー能力:');
    console.log(`  - Structured Outputs: ${capabilities.supportsNativeStructuredOutputs ? '✅' : '❌'}`);
    console.log(`  - Function Call Emulation: ${capabilities.supportsFunctionCallEmulation ? '✅' : '❌'}`);
    console.log(`  - Recommended Mode: ${capabilities.recommendedMode}`);
    console.log(`  - Max Tokens: ${capabilities.maxTokens.toLocaleString()}`);
    console.log();
  }

  /**
   * 個別テストケースを実行
   */
  private async runTestCase(testCase: typeof testCases[0], provider: ProviderType): Promise<void> {
    console.log(`\n🧪 テストケース: ${testCase.name}`);
    console.log(`   期待動作: ${testCase.expectedBehavior}`);
    
    try {
      if (testCase.useTools) {
        // ツール込みで実行
        const result = await this.wrapper.generateWithTools(
          testCase.messages,
          testTools,
          { 
            provider,
            maxTokens: 1000
          }
        );
        
        console.log(`   🤖 応答: "${result.content.slice(0, 100)}${result.content.length > 100 ? '...' : ''}"`);
        console.log(`   🔧 ツール呼び出し判定: ${result.shouldCallTool ? '✅ Yes' : '❌ No'}`);
        console.log(`   📊 エミュレーションモード: ${result.emulationMode ? '✅ Yes' : '❌ No'}`);
        
        if (result.shouldCallTool && result.toolCalls.length > 0) {
          console.log(`   🛠️  ツール詳細:`);
          result.toolCalls.forEach((call, index) => {
            console.log(`      ${index + 1}. ${call.toolName}(${JSON.stringify(call.arguments)})`);
            console.log(`         信頼度: ${call.confidence.toFixed(2)}, 理由: "${call.reasoning}"`);
          });
        }
        
      } else {
        // 基本メッセージ生成
        const result = await this.wrapper.generate(
          testCase.messages,
          { 
            provider,
            maxTokens: 500
          }
        );
        
        console.log(`   🤖 応答: "${result.content.slice(0, 150)}${result.content.length > 150 ? '...' : ''}"`);
      }
      
      console.log('   ✅ テスト成功');
      
    } catch (error) {
      console.log(`   ❌ テスト失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * フォールバック機能のテスト
   */
  async testFallbackBehavior(): Promise<void> {
    console.log('\n🔄 フォールバック機能テスト');
    console.log('='.repeat(30));
    
    // ネイティブモード強制→エミュレーションフォールバック
    try {
      const result = await this.wrapper.generateWithTools(
        [{ role: 'user', content: '東京の天気を教えて' }],
        testTools,
        { 
          provider: 'mcp-internal', // ネイティブ未対応
          useNative: true, // ネイティブ強制
          autoFallback: true // フォールバック有効
        }
      );
      
      console.log(`フォールバック結果: ${result.emulationMode ? '✅ エミュレーションモード' : '❌ ネイティブモード'}`);
      
    } catch (error) {
      console.log(`フォールバックエラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// メイン実行
async function main(): Promise<void> {
  const tester = new UnifiedLLMWrapperTester();
  
  try {
    await tester.runAllTests();
    await tester.testFallbackBehavior();
    
  } catch (error) {
    console.error('検証スクリプト実行エラー:', error);
    process.exit(1);
  }
}

// 実行条件チェック
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { UnifiedLLMWrapperTester };
