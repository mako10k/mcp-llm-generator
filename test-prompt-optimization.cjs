/**
 * SystemPrompt最適化効果検証
 * 旧版vs最適化版のプロンプト長比較
 */

const { SystemPromptGenerator } = require('./build/toolcall-emulation/SystemPromptGenerator.js');
const { OptimizedSystemPromptGenerator } = require('./build/toolcall-emulation/OptimizedSystemPromptGenerator.js');

function tokenCountApprox(text) {
  // おおよそのトークン数（英語単語数 * 0.75 + 記号・改行など）
  return Math.ceil(text.split(/\s+/).length * 0.75 + text.split('\n').length);
}

async function testPromptOptimization() {
  console.log('📊 SystemPrompt最適化効果検証');
  
  try {
    // サンプルツール定義
    const sampleTools = [
      {
        name: 'search_web',
        function: {
          name: 'search_web',
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'number', description: 'Max results' }
            },
            required: ['query']
          }
        }
      },
      {
        name: 'get_weather',
        function: {
          name: 'get_weather',
          description: 'Get weather information for a location',
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

    const sampleContext = {
      availableTools: sampleTools,
      constraints: {
        maxTokens: 2000,
        allowedActions: ['tool_call', 'function_call']
      }
    };

    console.log('\n=== 旧版 SystemPromptGenerator ===');
    const originalGenerator = new SystemPromptGenerator();
    const originalResult = originalGenerator.generateSystemPrompt('Test message', sampleContext);
    
    console.log(`プロンプト文字数: ${originalResult.systemPrompt.length}`);
    console.log(`推定トークン数: ${tokenCountApprox(originalResult.systemPrompt)}`);
    console.log('プロンプト（最初の300文字）:');
    console.log(originalResult.systemPrompt.substring(0, 300) + '...\n');

    console.log('\n=== 最適化版 OptimizedSystemPromptGenerator ===');
    const optimizedGenerator = new OptimizedSystemPromptGenerator();
    const optimizedResult = optimizedGenerator.generateSystemPrompt('Test message', sampleContext);
    
    console.log(`プロンプト文字数: ${optimizedResult.systemPrompt.length}`);
    console.log(`推定トークン数: ${tokenCountApprox(optimizedResult.systemPrompt)}`);
    console.log('プロンプト全文:');
    console.log(optimizedResult.systemPrompt);

    // 効果測定
    const charReduction = originalResult.systemPrompt.length - optimizedResult.systemPrompt.length;
    const tokenReduction = tokenCountApprox(originalResult.systemPrompt) - tokenCountApprox(optimizedResult.systemPrompt);
    const reductionPercent = Math.round((charReduction / originalResult.systemPrompt.length) * 100);

    console.log('\n📈 最適化効果:');
    console.log(`文字数削減: ${charReduction}文字 (${reductionPercent}%削減)`);
    console.log(`トークン削減: ${tokenReduction}トークン`);
    
    const targetTokens = 500;
    const optimizedTokens = tokenCountApprox(optimizedResult.systemPrompt);
    
    if (optimizedTokens <= targetTokens) {
      console.log(`✅ 目標達成: ${optimizedTokens}トークン <= ${targetTokens}トークン`);
    } else {
      console.log(`⚠️ 目標未達成: ${optimizedTokens}トークン > ${targetTokens}トークン`);
    }

  } catch (error) {
    console.error('❌ 検証中にエラーが発生:', error);
    console.error('スタックトレース:', error.stack);
  }
}

testPromptOptimization();
