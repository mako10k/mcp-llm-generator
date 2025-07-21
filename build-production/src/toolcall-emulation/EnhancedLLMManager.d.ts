/**
 * Enhanced LLM Manager with Structured Outputs Support
 * OpenAI Structured Outputs機能を統合したLLMManager拡張
 */
import { LLMProviderManager, LLMManagerConfig } from '../llm/LLMProviderManager.js';
import { LLMResponse, Message, LLMRequestOptions } from '../llm/LLMProvider.js';
import { Tool, ToolCallEmulationResponse, ResponseParserConfig } from './types.js';
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
export declare class EnhancedLLMManager extends LLMProviderManager {
    private parserConfig;
    constructor(config?: LLMManagerConfig, parserConfig?: ResponseParserConfig);
    /**
     * Structured Outputs を使用したメッセージ生成
     */
    generateWithStructuredOutput<T>(messages: Message[], schema: z.ZodSchema<T>, options?: StructuredOutputOptions): Promise<{
        content: T;
        raw: LLMResponse;
        metadata: {
            parseSuccess: boolean;
            validationErrors?: string[];
            confidence?: number;
        };
    }>;
    /**
     * ToolCall Emulation の実行
     */
    emulateToolCalls(userMessage: string, options: ToolCallEmulationOptions): Promise<ToolCallEmulationResponse>;
    /**
     * System Prompt を動的生成
     */
    private generateToolCallSystemPrompt;
    /**
     * Zod Schema を JSON Schema に変換
     */
    private zodSchemaToJsonSchema;
    /**
     * サンプルから schema を推論
     */
    private inferSchemaFromSample;
    /**
     * 構造化レスポンスのパース
     */
    private parseStructuredResponse;
    /**
     * Refusal 検出
     */
    private isRefusal;
    /**
     * 信頼度計算
     */
    private calculateConfidence;
    /**
     * フォールバック レスポンス
     */
    private fallbackResponse;
    /**
     * 遅延ユーティリティ
     */
    private delay;
}
