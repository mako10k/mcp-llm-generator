/**
 * Optimized System Prompt Generator
 * 簡潔なプロンプト生成（500トークン以下目標）
 */

import { 
  PromptGeneratorConfig,
  GeneratedPrompt,
  PromptContext
} from '../types/prompt.js';
import { Tool } from '../types/tool.js';

export class OptimizedSystemPromptGenerator {
  private config: PromptGeneratorConfig;

  constructor(config: PromptGeneratorConfig = {
    includeExamples: false, // 例は最小限に
    strictMode: true,
    personaAware: false, // 別レイヤーで処理
    contextLengthLimit: 4000,
    includeToolValidation: true
  }) {
    this.config = config;
  }

  /**
   * 最適化されたシステムプロンプト生成
   */
  generateSystemPrompt(
    userMessage: string,
    context: PromptContext
  ): GeneratedPrompt {
    // 簡潔なベースプロンプト
    const basePrompt = this.buildConciseBasePrompt();
    
    // ツール記述（簡潔版）
    const toolDescriptions = this.generateConciseToolDescriptions(context.availableTools);
    
    // 出力スキーマ（必須のみ）
    const outputSchema = this.generateConciseOutputSchema();
    
    // 最小限の例（必要時のみ）
    const examples = this.config.includeExamples ? this.generateMinimalExample() : '';

    // 組み立て
    const systemPrompt = [
      basePrompt,
      toolDescriptions,
      outputSchema,
      examples
    ].filter(section => section.trim()).join('\n\n');

    const metadata = {
      toolCount: context.availableTools.length,
      promptLength: systemPrompt.length,
      schemaComplexity: context.availableTools.length,
      personaIncluded: false, // 最適化版では無効
      generatedAt: new Date()
    };

    return {
      systemPrompt,
      userPrompt: userMessage, // そのまま返す
      metadata
    };
  }

  /**
   * 簡潔なベースプロンプト - OpenAI標準対応
   */
  private buildConciseBasePrompt(): string {
    return `You are a helpful assistant with access to various tools. When you need to use tools, respond using the standard OpenAI function calling format.

Core guidelines:
1. Use tools only when necessary for the user's request
2. Use exact parameter names and types as specified
3. Follow the standard tool_calls format precisely
4. Respond naturally in text when not using tools`;
  }

  /**
   * 簡潔なツール記述
   */
  private generateConciseToolDescriptions(tools: Tool[]): string {
    if (tools.length === 0) {
      return 'No tools available.';
    }

    const descriptions = tools.map(tool => {
      const func = tool.function;
      const required = func.parameters.required || [];
      const props = func.parameters.properties || {};
      
      // パラメータの簡潔な記述
      const paramList = Object.keys(props).map(param => {
        const isRequired = required.includes(param);
        const paramDef = props[param] as { type?: string; description?: string };
        const type = paramDef.type || 'any';
        return `${param}(${type})${isRequired ? '*' : ''}`;
      }).join(', ');

      return `**${func.name}**: ${func.description}\nParams: ${paramList || 'none'}`;
    }).join('\n\n');

    return `Available tools:\n${descriptions}`;
  }

  /**
   * 簡潔な出力スキーマ - OpenAI標準形式
   */
  private generateConciseOutputSchema(): string {
    return `When you need to use tools, respond with standard OpenAI function calling format:

\`\`\`json
{
  "tool_calls": [
    {
      "id": "call_xxx",
      "type": "function",
      "function": {
        "name": "function_name",
        "arguments": "{\\"param\\": \\"value\\"}"
      }
    }
  ]
}
\`\`\`

Otherwise, respond naturally in text. The system will automatically handle tool execution when you use the standard tool_calls format.`;
  }

  /**
   * 最小限の例 - OpenAI標準形式
   */
  private generateMinimalExample(): string {
    return `Example:
User: "Search for AI news"
Assistant: I'll search for AI news for you.

\`\`\`json
{
  "tool_calls": [
    {
      "id": "call_001",
      "type": "function",
      "function": {
        "name": "pats_google_search",
        "arguments": "{\\"query\\": \\"AI news\\", \\"numResults\\": 5}"
      }
    }
  ]
}
\`\`\``;
  }
}
