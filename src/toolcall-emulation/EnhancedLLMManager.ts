/**
 * Enhanced LLM Manager with Structured Outputs Support
 * OpenAI Structured Outputs機能を統合したLLMManager拡張
 */

import { LLMProviderManager, LLMManagerConfig } from '../llm/LLMProviderManager.js';
import { LLMResponse, Message, LLMRequestOptions } from '../llm/LLMProvider.js';
import { 
  Tool, 
  ToolCallEmulationResponse, 
  ToolCallEmulationResponseSchema,
  BaseModel,
  ResponseParserConfig 
} from './types.js';
import { z } from 'zod';

export interface StructuredOutputOptions extends LLMRequestOptions {
  schema?: z.ZodSchema<any>;
  strict?: boolean;
  responseFormat?: 'json_object' | 'json_schema';
  validateResponse?: boolean;
  provider?: string;
  maxRetries?: number;
}

export interface ToolCallEmulationOptions {
  availableTools: Tool[];
  persona?: string;
  context?: string;
  strictMode?: boolean;
  confidenceThreshold?: number;
  maxRetries?: number;
}

export class EnhancedLLMManager extends LLMProviderManager {
  private parserConfig: ResponseParserConfig;

  constructor(config: LLMManagerConfig = {}, parserConfig: ResponseParserConfig = {
    strictMode: true,
    validateSchema: true,
    handleRefusal: true,
    fallbackOnError: true,
    maxRetries: 3
  }) {
    super(config);
    this.parserConfig = parserConfig;
  }

  /**
   * Structured Outputs を使用したメッセージ生成
   */
  async generateWithStructuredOutput<T>(
    messages: Message[],
    schema: z.ZodSchema<T>,
    options: StructuredOutputOptions = {}
  ): Promise<{
    content: T;
    raw: LLMResponse;
    metadata: {
      parseSuccess: boolean;
      validationErrors?: string[];
      confidence?: number;
    }
  }> {
    const provider = this.getProvider(options.provider);
    if (!provider) {
      throw new Error(`Provider not available for structured output generation`);
    }

    // OpenAI Structured Outputs 専用オプション
    const structuredOptions: LLMRequestOptions = {
      ...options,
      metadata: {
        ...options.metadata,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_response',
            schema: this.zodSchemaToJsonSchema(schema),
            strict: options.strict ?? this.parserConfig.strictMode
          }
        }
      }
    };

    let retries = 0;
    const maxRetries = options.maxRetries ?? this.parserConfig.maxRetries;

    while (retries <= maxRetries) {
      try {
        const response = await provider.generateMessage(messages, structuredOptions);
        
        // Refusal チェック
        if (this.parserConfig.handleRefusal && this.isRefusal(response)) {
          throw new Error(`Model refused to generate response: ${response.content}`);
        }

        // JSON パース試行
        const parsed = this.parseStructuredResponse(response.content, schema);
        
        return {
          content: parsed.data!,
          raw: response,
          metadata: {
            parseSuccess: parsed.success,
            validationErrors: parsed.errors,
            confidence: this.calculateConfidence(response, parsed.success)
          }
        };

      } catch (error) {
        retries++;
        console.warn(`Structured output generation attempt ${retries} failed:`, error);
        
        if (retries > maxRetries) {
          if (this.parserConfig.fallbackOnError) {
            return this.fallbackResponse(schema);
          }
          throw error;
        }
        
        // リトライ前の待機
        await this.delay(Math.pow(2, retries) * 1000);
      }
    }

    throw new Error('Max retries exceeded for structured output generation');
  }

  /**
   * ToolCall Emulation の実行
   */
  async emulateToolCalls(
    userMessage: string,
    options: ToolCallEmulationOptions
  ): Promise<ToolCallEmulationResponse> {
    const systemPrompt = this.generateToolCallSystemPrompt(options);
    
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    const structuredOptions: StructuredOutputOptions = {
      schema: ToolCallEmulationResponseSchema,
      strict: options.strictMode ?? true,
      provider: 'openai', // Structured Outputs は OpenAI 専用
      temperature: 0.1, // 低温度で一貫性確保
      maxTokens: 4000
    };

    const result = await this.generateWithStructuredOutput(
      messages,
      ToolCallEmulationResponseSchema,
      structuredOptions
    );

    // 信頼度フィルタリング
    if (options.confidenceThreshold) {
      result.content.tool_calls = result.content.tool_calls.filter(
        call => call.confidence >= (options.confidenceThreshold || 0.8)
      );
    }

    return result.content;
  }

  /**
   * System Prompt を動的生成
   */
  private generateToolCallSystemPrompt(options: ToolCallEmulationOptions): string {
    const toolDescriptions = options.availableTools.map(tool => 
      `## ${tool.function.name}\n${tool.function.description}\n` +
      `Parameters: ${JSON.stringify(tool.function.parameters, null, 2)}`
    ).join('\n\n');

    return `You are a precise tool call analyzer. Your task is to determine if the user's request requires tool usage and provide structured output.

Available Tools:
${toolDescriptions}

${options.persona ? `Persona Context: ${options.persona}` : ''}
${options.context ? `Additional Context: ${options.context}` : ''}

IMPORTANT INSTRUCTIONS:
1. Analyze the user's request carefully
2. Determine if any tools should be called
3. For each tool call, provide confidence score (0.0-1.0)
4. Include reasoning for your decisions
5. Generate response text that addresses the user's request
6. Follow the exact JSON schema format
7. Set should_call_tool to true only if tool calls are necessary
8. Ensure all required parameters are properly filled

Output Format: Follow the structured schema exactly with no additional properties.`;
  }

  /**
   * Zod Schema を JSON Schema に変換
   */
  private zodSchemaToJsonSchema(schema: z.ZodSchema<any>): any {
    // 簡易的な変換実装（実際のプロダクションでは zod-to-json-schema ライブラリを使用）
    try {
      const sample = schema.parse({});
      return this.inferSchemaFromSample(sample);
    } catch {
      // フォールバック用のGeneric schema
      return {
        type: 'object',
        additionalProperties: false
      };
    }
  }

  /**
   * サンプルから schema を推論
   */
  private inferSchemaFromSample(sample: any): any {
    if (typeof sample === 'object' && sample !== null) {
      const properties: any = {};
      const required: string[] = [];
      
      for (const [key, value] of Object.entries(sample)) {
        if (value !== undefined) {
          properties[key] = this.inferSchemaFromSample(value);
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required,
        additionalProperties: false
      };
    }
    
    return { type: typeof sample };
  }

  /**
   * 構造化レスポンスのパース
   */
  private parseStructuredResponse<T>(
    content: string, 
    schema: z.ZodSchema<T>
  ): { success: boolean; data?: T; errors?: string[] } {
    try {
      const jsonData = JSON.parse(content);
      const validated = schema.parse(jsonData);
      return { success: true, data: validated };
    } catch (error) {
      const errors = error instanceof z.ZodError 
        ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        : [`Parse error: ${error instanceof Error ? error.message : String(error)}`];
      
      return { success: false, errors };
    }
  }

  /**
   * Refusal 検出
   */
  private isRefusal(response: LLMResponse): boolean {
    const refusalPhrases = [
      "I can't assist with that",
      "I'm sorry, I can't",
      "I cannot help with",
      "I'm not able to"
    ];
    
    return refusalPhrases.some(phrase => 
      response.content.toLowerCase().includes(phrase.toLowerCase())
    );
  }

  /**
   * 信頼度計算
   */
  private calculateConfidence(response: LLMResponse, parseSuccess: boolean): number {
    let confidence = parseSuccess ? 0.8 : 0.3;
    
    // 使用量ベースの調整
    if (response.usage) {
      const ratio = response.usage.outputTokens / (response.usage.inputTokens + response.usage.outputTokens);
      confidence += ratio * 0.2;
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * フォールバック レスポンス
   */
  private fallbackResponse<T>(schema: z.ZodSchema<T>): any {
    try {
      const fallback = schema.parse({});
      return {
        content: fallback,
        raw: { content: '{}', model: 'fallback' } as LLMResponse,
        metadata: { parseSuccess: false, confidence: 0.1 }
      };
    } catch {
      throw new Error('Unable to create fallback response');
    }
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
