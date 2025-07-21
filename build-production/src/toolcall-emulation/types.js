/**
 * ToolCall Emulation Types
 * Structured Outputs を活用したツール呼び出しエミュレーション用の型定義
 */
import { z } from 'zod';
// Base Tool Definition Schema
export const ToolParameterSchema = z.object({
    type: z.string(),
    description: z.string(),
    enum: z.array(z.string()).optional(),
    items: z.object({
        type: z.string()
    }).optional()
});
export const ToolFunctionSchema = z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.object({
        type: z.literal('object'),
        properties: z.record(ToolParameterSchema),
        required: z.array(z.string()).optional(),
        additionalProperties: z.literal(false).optional()
    })
});
export const ToolSchema = z.object({
    type: z.literal('function'),
    function: ToolFunctionSchema
});
// Tool Call Result Schema for Structured Outputs
export const ToolCallResultSchema = z.object({
    tool_name: z.string(),
    arguments: z.record(z.any()),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    validation_errors: z.array(z.string()).optional()
});
export const ToolCallEmulationResponseSchema = z.object({
    should_call_tool: z.boolean(),
    tool_calls: z.array(ToolCallResultSchema),
    response_text: z.string(),
    metadata: z.object({
        processing_time: z.number().optional(),
        model_used: z.string().optional(),
        confidence_score: z.number().min(0).max(1).optional()
    }).optional()
});
