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

// Type exports
export type ToolParameter = z.infer<typeof ToolParameterSchema>;
export type ToolFunction = z.infer<typeof ToolFunctionSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type ToolCallResult = z.infer<typeof ToolCallResultSchema>;
export type ToolCallEmulationResponse = z.infer<typeof ToolCallEmulationResponseSchema>;

// Pydantic-style BaseModel interface for TypeScript
export interface BaseModel {
  validate(): boolean;
  toJSON(): string;
  fromJSON(json: string): this;
}

// SystemPrompt Generation Templates
export interface SystemPromptTemplate {
  basePrompt: string;
  toolDescriptions: string;
  outputSchema: string;
  examples: string;
}

// Persona Tool Execution Context
export interface PersonaToolContext {
  personaId: string;
  availableTools: Tool[];
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  constraints: {
    maxTokens?: number;
    temperature?: number;
    allowedTools?: string[];
    forbiddenActions?: string[];
  };
}

// Response Parser Configuration
export interface ResponseParserConfig {
  strictMode: boolean;
  validateSchema: boolean;
  handleRefusal: boolean;
  fallbackOnError: boolean;
  maxRetries: number;
}
