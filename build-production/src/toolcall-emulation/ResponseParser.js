/**
 * Response Parser
 * 型安全なStructured Output解析システム
 */
import { z } from 'zod';
import { ToolCallEmulationResponseSchema } from './types.js';
export class ResponseParser {
    config;
    parseAttempts = new Map();
    constructor(config = {
        strictMode: true,
        validateSchema: true,
        handleRefusal: true,
        fallbackOnError: true,
        maxRetries: 3
    }) {
        this.config = config;
    }
    /**
     * ToolCall Emulation レスポンスのパース
     */
    async parseToolCallResponse(rawContent, requestId) {
        const startTime = Date.now();
        const retryCount = requestId ? (this.parseAttempts.get(requestId) || 0) : 0;
        if (requestId) {
            this.parseAttempts.set(requestId, retryCount + 1);
        }
        try {
            // Refusal チェック
            if (this.config.handleRefusal && this.detectRefusal(rawContent)) {
                return {
                    success: false,
                    errors: [{
                            type: 'refusal',
                            message: 'Model refused to provide structured response',
                            severity: 'error'
                        }],
                    metadata: {
                        rawContent,
                        parseTime: Date.now() - startTime,
                        confidence: 0,
                        refusal: true,
                        retryCount
                    }
                };
            }
            // JSONパース試行
            const jsonData = this.parseJSON(rawContent);
            if (!jsonData.success) {
                return {
                    success: false,
                    errors: jsonData.errors,
                    metadata: {
                        rawContent,
                        parseTime: Date.now() - startTime,
                        confidence: 0,
                        retryCount
                    }
                };
            }
            // スキーマ検証
            const validationResult = this.validateSchema(jsonData.data, ToolCallEmulationResponseSchema);
            if (!validationResult.success || !validationResult.data) {
                return {
                    success: false,
                    errors: validationResult.errors,
                    metadata: {
                        rawContent,
                        parseTime: Date.now() - startTime,
                        confidence: 0,
                        retryCount
                    }
                };
            }
            // ToolCall固有の検証
            const validatedData = validationResult.data;
            const toolCallValidation = this.validateToolCalls(validatedData);
            return {
                success: true,
                data: validatedData,
                errors: toolCallValidation.errors,
                metadata: {
                    rawContent,
                    parseTime: Date.now() - startTime,
                    confidence: this.calculateConfidence(validatedData, toolCallValidation),
                    retryCount
                }
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [{
                        type: 'validation',
                        message: `Unexpected parsing error: ${error instanceof Error ? error.message : String(error)}`,
                        severity: 'error'
                    }],
                metadata: {
                    rawContent,
                    parseTime: Date.now() - startTime,
                    confidence: 0,
                    retryCount
                }
            };
        }
    }
    /**
     * 汎用スキーマパーサー
     */
    async parseWithSchema(rawContent, schema, requestId) {
        const startTime = Date.now();
        const retryCount = requestId ? (this.parseAttempts.get(requestId) || 0) : 0;
        try {
            const jsonData = this.parseJSON(rawContent);
            if (!jsonData.success) {
                return {
                    success: false,
                    errors: jsonData.errors,
                    metadata: {
                        rawContent,
                        parseTime: Date.now() - startTime,
                        confidence: 0,
                        retryCount
                    }
                };
            }
            const validationResult = this.validateSchema(jsonData.data, schema);
            return {
                success: validationResult.success,
                data: validationResult.data,
                errors: validationResult.errors,
                metadata: {
                    rawContent,
                    parseTime: Date.now() - startTime,
                    confidence: validationResult.success ? 0.9 : 0.1,
                    retryCount
                }
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [{
                        type: 'validation',
                        message: `Schema parsing error: ${error instanceof Error ? error.message : String(error)}`,
                        severity: 'error'
                    }],
                metadata: {
                    rawContent,
                    parseTime: Date.now() - startTime,
                    confidence: 0,
                    retryCount
                }
            };
        }
    }
    /**
     * Refusal検出
     */
    detectRefusal(content) {
        const refusalPatterns = [
            /I can't assist with that/i,
            /I'm sorry, I can't/i,
            /I cannot help with/i,
            /I'm not able to/i,
            /I don't have the ability to/i,
            /I'm not allowed to/i,
            /I cannot provide/i,
            /I'm unable to/i
        ];
        return refusalPatterns.some(pattern => pattern.test(content));
    }
    /**
     * JSONパース
     */
    parseJSON(content) {
        try {
            // JSONブロックの抽出試行
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonString = jsonMatch ? jsonMatch[1] : content;
            // パース試行
            const parsed = JSON.parse(jsonString.trim());
            return { success: true, data: parsed };
        }
        catch (error) {
            // フォールバック: より寛容なパース
            try {
                const cleaned = this.cleanJSONString(content);
                const parsed = JSON.parse(cleaned);
                return { success: true, data: parsed };
            }
            catch (fallbackError) {
                return {
                    success: false,
                    errors: [{
                            type: 'format',
                            message: `JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`,
                            severity: 'error'
                        }]
                };
            }
        }
    }
    /**
     * JSON文字列のクリーニング
     */
    cleanJSONString(content) {
        // 一般的なマークダウンの除去
        let cleaned = content
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .replace(/^[^{]*/g, '') // JSON開始まで削除
            .replace(/[^}]*$/g, ''); // JSON終了以降削除
        // 末尾のカンマを修正
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
        return cleaned.trim();
    }
    /**
     * スキーマ検証
     */
    validateSchema(data, schema) {
        try {
            const validated = schema.parse(data);
            return { success: true, data: validated };
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.errors.map(err => ({
                    type: 'schema',
                    field: err.path.join('.'),
                    message: err.message,
                    severity: 'error'
                }));
                return { success: false, errors };
            }
            return {
                success: false,
                errors: [{
                        type: 'validation',
                        message: `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
                        severity: 'error'
                    }]
            };
        }
    }
    /**
     * ToolCall固有の検証
     */
    validateToolCalls(response) {
        const errors = [];
        const warnings = [];
        const suggestions = [];
        // 基本的な一貫性チェック
        if (response.should_call_tool && response.tool_calls.length === 0) {
            warnings.push({
                type: 'validation',
                message: 'should_call_tool is true but no tool_calls provided',
                severity: 'warning'
            });
        }
        if (!response.should_call_tool && response.tool_calls.length > 0) {
            warnings.push({
                type: 'validation',
                message: 'should_call_tool is false but tool_calls are provided',
                severity: 'warning'
            });
        }
        // 各ToolCallの検証
        response.tool_calls.forEach((toolCall, index) => {
            // 信頼度チェック
            if (toolCall.confidence < 0 || toolCall.confidence > 1) {
                errors.push({
                    type: 'validation',
                    field: `tool_calls[${index}].confidence`,
                    message: 'Confidence must be between 0 and 1',
                    severity: 'error'
                });
            }
            // 低信頼度の警告
            if (toolCall.confidence < 0.5) {
                warnings.push({
                    type: 'validation',
                    field: `tool_calls[${index}].confidence`,
                    message: `Low confidence score: ${toolCall.confidence}`,
                    severity: 'warning'
                });
                suggestions.push(`Consider providing more context for ${toolCall.tool_name}`);
            }
            // 引数の検証
            if (!toolCall.arguments || Object.keys(toolCall.arguments).length === 0) {
                warnings.push({
                    type: 'validation',
                    field: `tool_calls[${index}].arguments`,
                    message: 'Tool call has no arguments',
                    severity: 'warning'
                });
            }
            // 理由の検証
            if (!toolCall.reasoning || toolCall.reasoning.trim().length < 10) {
                warnings.push({
                    type: 'validation',
                    field: `tool_calls[${index}].reasoning`,
                    message: 'Reasoning is too short or missing',
                    severity: 'warning'
                });
                suggestions.push('Provide more detailed reasoning for tool calls');
            }
        });
        // レスポンステキストの検証
        if (!response.response_text || response.response_text.trim().length === 0) {
            warnings.push({
                type: 'validation',
                field: 'response_text',
                message: 'Response text is empty',
                severity: 'warning'
            });
        }
        const score = this.calculateValidationScore(errors, warnings);
        return {
            isValid: errors.length === 0,
            score,
            errors,
            warnings,
            suggestions
        };
    }
    /**
     * 信頼度計算
     */
    calculateConfidence(response, validation) {
        let confidence = validation.score;
        // ツール呼び出しの信頼度を考慮
        if (response.tool_calls.length > 0) {
            const avgToolConfidence = response.tool_calls.reduce((sum, call) => sum + call.confidence, 0) / response.tool_calls.length;
            confidence = (confidence + avgToolConfidence) / 2;
        }
        // エラーや警告による減点
        confidence -= validation.errors.length * 0.2;
        confidence -= validation.warnings.length * 0.1;
        return Math.max(0, Math.min(1, confidence));
    }
    /**
     * 検証スコア計算
     */
    calculateValidationScore(errors, warnings) {
        const errorPenalty = errors.length * 0.3;
        const warningPenalty = warnings.length * 0.1;
        return Math.max(0, 1.0 - errorPenalty - warningPenalty);
    }
    /**
     * 統計情報の取得
     */
    getParsingStatistics() {
        const totalAttempts = Array.from(this.parseAttempts.values()).reduce((sum, count) => sum + count, 0);
        return {
            totalAttempts,
            successRate: 0, // 実装に応じて計算
            averageParseTime: 0, // 実装に応じて計算
            commonErrors: [] // 実装に応じて計算
        };
    }
    /**
     * キャッシュクリア
     */
    clearStatistics() {
        this.parseAttempts.clear();
    }
    /**
     * 診断レポート生成
     */
    generateDiagnosticReport(parseResults) {
        const successful = parseResults.filter(r => r.success);
        const failed = parseResults.filter(r => !r.success);
        const successRate = parseResults.length > 0 ? successful.length / parseResults.length : 0;
        const avgConfidence = successful.length > 0
            ? successful.reduce((sum, r) => sum + r.metadata.confidence, 0) / successful.length
            : 0;
        const avgParseTime = parseResults.length > 0
            ? parseResults.reduce((sum, r) => sum + r.metadata.parseTime, 0) / parseResults.length
            : 0;
        const recommendations = [];
        if (successRate < 0.8) {
            recommendations.push('Consider improving prompt clarity or model selection');
        }
        if (avgConfidence < 0.7) {
            recommendations.push('Review tool definitions and examples for better model understanding');
        }
        if (avgParseTime > 1000) {
            recommendations.push('Consider optimizing parsing logic or reducing response complexity');
        }
        return {
            summary: `Parsed ${parseResults.length} responses with ${(successRate * 100).toFixed(1)}% success rate`,
            recommendations,
            performance: {
                successRate,
                averageConfidence: avgConfidence,
                averageParseTime: avgParseTime
            }
        };
    }
}
