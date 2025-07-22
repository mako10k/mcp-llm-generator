/**
 * System Prompt Generator
 * 動的スキーマ定義とコンテキスト対応のシステムプロンプト生成器
 */

import { 
  PromptGeneratorConfig,
  GeneratedPrompt,
  PromptContext,
  SystemPromptTemplate
} from '../types/prompt.js';
import { Tool } from '../types/tool.js';
import { ParameterFormatter } from './prompt-builders/ParameterFormatter.js';
import { ToolUsageHintGenerator } from './utils/ToolUsageHintGenerator.js';
import { PersonaBuilder } from './prompt-builders/PersonaBuilder.js';
import { PersonaCapabilities } from '../types/persona.js';

// [TEMPORARY COMMENTED OUT] - Moved to types/prompt.ts for centralized type management
// export interface PromptGeneratorConfig {
//   includeExamples: boolean;
//   strictMode: boolean;
//   personaAware: boolean;
//   contextLengthLimit: number;
//   includeToolValidation: boolean;
// }

// export interface GeneratedPrompt {
//   systemPrompt: string;
//   userPrompt: string;
//   metadata: {
//     toolCount: number;
//     promptLength: number;
//     schemaComplexity: number;
//     personaIncluded: boolean;
//     generatedAt: Date;
//   };
// }

// export interface PromptContext {
//   availableTools: Tool[];
//   persona?: PersonaCapabilities;
//   conversationHistory?: Array<{
//     role: 'user' | 'assistant';
//     content: string;
//     timestamp: Date;
//   }>;
//   constraints?: {
//     maxTokens?: number;
//     allowedActions?: string[];
//     forbiddenActions?: string[];
//   };
//   sessionContext?: {
//     sessionId: string;
//     duration: number;
//     previousInteractions: number;
//   };
// }

export class SystemPromptGenerator {
  private config: PromptGeneratorConfig;
  private templateCache: Map<string, SystemPromptTemplate> = new Map();
  
  // Feature Flags for step-by-step integration
  private useParameterFormatter: boolean;
  private usePersonaBuilder: boolean;

  constructor(config: PromptGeneratorConfig = {
    includeExamples: true,
    strictMode: true,
    personaAware: true,
    contextLengthLimit: 8000,
    includeToolValidation: true
  }) {
    this.config = config;
    
    // Feature Flags: Default to false for safety, can be enabled via env vars
    this.useParameterFormatter = process.env.USE_PARAMETER_FORMATTER === 'true';
    this.usePersonaBuilder = process.env.USE_PERSONA_BUILDER === 'true';
    
    this.initializeTemplates();
  }

  /**
   * メインのプロンプト生成メソッド
   */
  generateSystemPrompt(
    userMessage: string,
    context: PromptContext
  ): GeneratedPrompt {
    // ベースプロンプトの構築
    const basePrompt = this.buildBasePrompt();
    
    // ツール記述の生成
    const toolDescriptions = this.generateToolDescriptions(context.availableTools);
    
    // 出力スキーマの生成
    const outputSchema = this.generateOutputSchema();
    
    // 例の生成
    const examples = this.config.includeExamples ? this.generateExamples(context) : '';
    
    // 人格統合
    const personaSection = this.config.personaAware && context.persona 
      ? this.generatePersonaSection(context.persona) : '';
    
    // 制約事項の生成
    const constraints = this.generateConstraints(context);
    
    // コンテキスト情報の生成
    const contextInfo = this.generateContextInfo(context);

    // 最終的なシステムプロンプトの組み立て
    const systemPrompt = this.assembleSystemPrompt({
      basePrompt,
      toolDescriptions,
      outputSchema,
      examples,
      personaSection,
      constraints,
      contextInfo
    });

    // ユーザープロンプトの拡張
    const userPrompt = this.enhanceUserPrompt(userMessage, context);

    const metadata = {
      toolCount: context.availableTools.length,
      promptLength: systemPrompt.length,
      schemaComplexity: this.calculateSchemaComplexity(context.availableTools),
      personaIncluded: !!context.persona,
      generatedAt: new Date()
    };

    return {
      systemPrompt,
      userPrompt,
      metadata
    };
  }

  /**
   * ベースプロンプトの構築
   */
  private buildBasePrompt(): string {
    return `You are a precision tool call analyzer designed to determine when and how to use available tools.

Your core responsibilities:
1. Analyze user requests to determine if tool usage is required
2. Select appropriate tools based on request context and available options
3. Generate properly formatted tool calls with accurate parameters
4. Provide clear reasoning for your decisions
5. Maintain high confidence scores for reliable tool usage

Key Principles:
- Only call tools when genuinely necessary for the user's request
- Ensure all required parameters are properly filled
- Provide confidence scores between 0.0 and 1.0
- Include clear reasoning for each decision
- Follow the exact output schema format`;
  }

  /**
   * ツール記述の生成
   */
  private generateToolDescriptions(tools: Tool[]): string {
    if (tools.length === 0) {
      return 'No tools are currently available.';
    }

    const descriptions = tools.map(tool => {
      const func = tool.function;
      const requiredParams = func.parameters.required || [];
      const optionalParams = Object.keys(func.parameters.properties || {})
        .filter(param => !requiredParams.includes(param));

      return `## ${func.name}
**Description**: ${func.description}

**Parameters**:
${this.formatParameters(func.parameters, requiredParams, optionalParams)}

**Usage**: Call this tool when ${this.generateUsageHint(func)}`;
    }).join('\n\n');

    return `## Available Tools

${descriptions}`;
  }

  /**
   * パラメータのフォーマット - Feature Flag による段階的統合
   */
  private formatParameters(
    parameters: any, 
    requiredParams: string[], 
    optionalParams: string[]
  ): string {
    // Feature Flag: 新しいParameterFormatterまたは既存ロジックを使用
    if (this.useParameterFormatter) {
      return ParameterFormatter.format(parameters, requiredParams, optionalParams);
    }

    // 既存ロジック（ロールバック用に保持）
    const allParams = { ...parameters.properties };
    const formatted: string[] = [];

    // 必須パラメータ
    if (requiredParams.length > 0) {
      formatted.push('**Required**:');
      requiredParams.forEach(param => {
        const paramDef = allParams[param];
        formatted.push(`- \`${param}\` (${paramDef.type}): ${paramDef.description}`);
      });
    }

    // オプショナルパラメータ
    if (optionalParams.length > 0) {
      formatted.push('**Optional**:');
      optionalParams.forEach(param => {
        const paramDef = allParams[param];
        formatted.push(`- \`${param}\` (${paramDef.type}): ${paramDef.description}`);
      });
    }

    return formatted.join('\n');
  }

  /**
   * 使用ヒントの生成（ToolUsageHintGeneratorを使用）
   */
  private generateUsageHint(func: { name: string; [key: string]: unknown }): string {
    return ToolUsageHintGenerator.generateUsageHint(func);
  }

  /**
   * 出力スキーマの生成
   */
  private generateOutputSchema(): string {
    return `## Output Format

You MUST respond with a JSON object that follows this exact schema:

\`\`\`json
{
  "should_call_tool": boolean,
  "tool_calls": [
    {
      "tool_name": "string",
      "arguments": {
        // Tool-specific parameters as key-value pairs
      },
      "confidence": number, // 0.0 to 1.0
      "reasoning": "string"
    }
  ],
  "response_text": "string",
  "metadata": {
    "processing_time": number, // optional
    "model_used": "string", // optional
    "confidence_score": number // optional, 0.0 to 1.0
  }
}
\`\`\`

**Critical Requirements**:
- Set \`should_call_tool\` to \`true\` only if tools are necessary
- Include \`tool_calls\` array even if empty
- Provide confidence scores between 0.0 and 1.0
- Include clear reasoning for each tool call
- Generate appropriate response text regardless of tool usage
- No additional properties allowed (strict mode)`;
  }

  /**
   * 例の生成
   */
  private generateExamples(context: PromptContext): string {
    void context; // eslint未使用変数対応
    if (!this.config.includeExamples) return '';

    return `## Examples

### Example 1: Tool Call Required
User: "Search for recent articles about AI"
Response:
\`\`\`json
{
  "should_call_tool": true,
  "tool_calls": [
    {
      "tool_name": "search_articles",
      "arguments": {
        "query": "AI recent articles",
        "time_range": "recent"
      },
      "confidence": 0.9,
      "reasoning": "User explicitly requested a search for recent AI articles, which matches the search_articles tool functionality"
    }
  ],
  "response_text": "I'll search for recent articles about AI for you.",
  "metadata": {
    "confidence_score": 0.9
  }
}
\`\`\`

### Example 2: No Tool Required
User: "What is artificial intelligence?"
Response:
\`\`\`json
{
  "should_call_tool": false,
  "tool_calls": [],
  "response_text": "Artificial intelligence (AI) is a branch of computer science that aims to create machines capable of performing tasks that typically require human intelligence...",
  "metadata": {
    "confidence_score": 0.8
  }
}
\`\`\``;
  }

  /**
   * 人格セクションの生成
   * Feature Flag により新しいPersonaBuilderと既存ロジックを切り替え
   */
  private generatePersonaSection(persona: PersonaCapabilities): string {
    if (this.usePersonaBuilder) {
      // New PersonaBuilder implementation
      const builder = new PersonaBuilder();
      // PersonaBuilderにPromptContextを渡す
      const context: PromptContext = {
        availableTools: [], // 最小限の構成
        persona: persona
      };
      return builder.build(context);
    }
    
    // Existing legacy implementation
    return `## Persona Context

You are operating with the following capabilities and constraints:

**Expertise Areas**: ${persona.expertise?.join(', ') || 'General'}
**Available Tools**: ${persona.tools?.join(', ') || 'All available'}
**Restrictions**: ${persona.restrictions?.join(', ') || 'None'}

Adapt your tool selection and reasoning to align with these persona characteristics.`;
  }

  /**
   * 制約事項の生成
   */
  private generateConstraints(context: PromptContext): string {
    const constraints: string[] = [];

    if (context.constraints?.maxTokens) {
      constraints.push(`- Maximum response tokens: ${context.constraints.maxTokens}`);
    }

    if (context.constraints?.allowedActions?.length) {
      constraints.push(`- Allowed actions: ${context.constraints.allowedActions.join(', ')}`);
    }

    if (context.constraints?.forbiddenActions?.length) {
      constraints.push(`- Forbidden actions: ${context.constraints.forbiddenActions.join(', ')}`);
    }

    if (this.config.strictMode) {
      constraints.push('- Strict schema compliance required');
      constraints.push('- No additional properties allowed in output');
    }

    if (this.config.includeToolValidation) {
      constraints.push('- All tool parameters must be validated');
      constraints.push('- Confidence scores must reflect actual certainty');
    }

    return constraints.length > 0 
      ? `## Constraints\n\n${constraints.join('\n')}`
      : '';
  }

  /**
   * コンテキスト情報の生成
   */
  private generateContextInfo(context: PromptContext): string {
    const info: string[] = [];

    if (context.conversationHistory?.length) {
      const recentHistory = context.conversationHistory.slice(-3);
      info.push('**Recent Conversation**:');
      recentHistory.forEach((msg) => {
        info.push(`${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
      });
    }

    if (context.sessionContext) {
      info.push(`**Session**: ${context.sessionContext.sessionId}`);
      info.push(`**Previous Interactions**: ${context.sessionContext.previousInteractions}`);
    }

    return info.length > 0 
      ? `## Context Information\n\n${info.join('\n')}`
      : '';
  }

  /**
   * システムプロンプトの組み立て
   */
  private assembleSystemPrompt(sections: {
    basePrompt: string;
    toolDescriptions: string;
    outputSchema: string;
    examples: string;
    personaSection: string;
    constraints: string;
    contextInfo: string;
  }): string {
    const parts = [
      sections.basePrompt,
      sections.toolDescriptions,
      sections.outputSchema,
      sections.examples,
      sections.personaSection,
      sections.constraints,
      sections.contextInfo
    ].filter(part => part.trim().length > 0);

    let assembled = parts.join('\n\n');

    // 長さ制限の適用
    if (assembled.length > this.config.contextLengthLimit) {
      assembled = this.truncatePrompt(assembled);
    }

    return assembled;
  }

  /**
   * ユーザープロンプトの拡張
   */
  private enhanceUserPrompt(userMessage: string, context: PromptContext): string {
    void context; // eslint未使用変数対応
    // Phase 1A では基本的なラッピングのみ実装
    return `User Request: ${userMessage}

Please analyze this request and determine if any tools should be called. Respond with the exact JSON format specified.`;
  }

  /**
   * スキーマ複雑度の計算
   */
  private calculateSchemaComplexity(tools: Tool[]): number {
    return tools.reduce((complexity, tool) => {
      const paramCount = Object.keys(tool.function.parameters.properties || {}).length;
      const requiredCount = tool.function.parameters.required?.length || 0;
      return complexity + paramCount + (requiredCount * 0.5);
    }, 0);
  }

  /**
   * プロンプトの切り詰め
   */
  private truncatePrompt(prompt: string): string {
    const lines = prompt.split('\n');
    let truncated = '';
    
    for (const line of lines) {
      if (truncated.length + line.length + 1 <= this.config.contextLengthLimit) {
        truncated += line + '\n';
      } else {
        truncated += '\n... (truncated for length)';
        break;
      }
    }
    
    return truncated;
  }

  /**
   * テンプレートの初期化
   */
  private initializeTemplates(): void {
    // 将来の拡張用のテンプレートキャッシュシステム
    this.templateCache.set('default', {
      basePrompt: this.buildBasePrompt(),
      toolDescriptions: '',
      outputSchema: this.generateOutputSchema(),
      examples: ''
    });
  }

  /**
   * カスタムテンプレートの追加
   */
  addTemplate(name: string, template: SystemPromptTemplate): void {
    this.templateCache.set(name, template);
  }

  /**
   * 統計情報の取得
   */
  getGenerationStatistics(): {
    templatesCount: number;
    averagePromptLength: number;
    cacheHitRate: number;
  } {
    return {
      templatesCount: this.templateCache.size,
      averagePromptLength: 0, // 実装に応じて計算
      cacheHitRate: 0 // 実装に応じて計算
    };
  }
}

// jscpd:ignore-start
function formatPrompt(_parameters: Record<string, string>): string {
  // ...既存のフォーマットロジック...
  return '';
}

function buildPersonaPrompt(personaData: Record<string, string>): string {
  return formatPrompt(personaData);
}
// jscpd:ignore-end

// 修正箇所
buildPersonaPrompt({ key: 'value' });
