/**
 * Response Parser
 * 型安全なStructured Output解析システム
 */
import { z } from 'zod';
import { ToolCallEmulationResponse, ResponseParserConfig } from './types.js';
export interface ParseResult<T> {
    success: boolean;
    data?: T;
    errors?: ParseError[];
    metadata: {
        rawContent: string;
        parseTime: number;
        confidence: number;
        refusal?: boolean;
        retryCount: number;
    };
}
export interface ParseError {
    type: 'validation' | 'format' | 'schema' | 'refusal' | 'network';
    field?: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
}
export interface ValidationReport {
    isValid: boolean;
    score: number;
    errors: ParseError[];
    warnings: ParseError[];
    suggestions: string[];
}
export declare class ResponseParser {
    private config;
    private parseAttempts;
    constructor(config?: ResponseParserConfig);
    /**
     * ToolCall Emulation レスポンスのパース
     */
    parseToolCallResponse(rawContent: string, requestId?: string): Promise<ParseResult<ToolCallEmulationResponse>>;
    /**
     * 汎用スキーマパーサー
     */
    parseWithSchema<T>(rawContent: string, schema: z.ZodSchema<T>, requestId?: string): Promise<ParseResult<T>>;
    /**
     * Refusal検出
     */
    private detectRefusal;
    /**
     * JSONパース
     */
    private parseJSON;
    /**
     * JSON文字列のクリーニング
     */
    private cleanJSONString;
    /**
     * スキーマ検証
     */
    private validateSchema;
    /**
     * ToolCall固有の検証
     */
    private validateToolCalls;
    /**
     * 信頼度計算
     */
    private calculateConfidence;
    /**
     * 検証スコア計算
     */
    private calculateValidationScore;
    /**
     * 統計情報の取得
     */
    getParsingStatistics(): {
        totalAttempts: number;
        successRate: number;
        averageParseTime: number;
        commonErrors: Array<{
            error: string;
            count: number;
        }>;
    };
    /**
     * キャッシュクリア
     */
    clearStatistics(): void;
    /**
     * 診断レポート生成
     */
    generateDiagnosticReport(parseResults: ParseResult<any>[]): {
        summary: string;
        recommendations: string[];
        performance: {
            successRate: number;
            averageConfidence: number;
            averageParseTime: number;
        };
    };
}
