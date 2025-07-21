/**
 * ToolCall Emulation Types
 * Structured Outputs を活用したツール呼び出しエミュレーション用の型定義
 */
import { z } from 'zod';
export declare const ToolParameterSchema: z.ZodObject<{
    type: z.ZodString;
    description: z.ZodString;
    enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    items: z.ZodOptional<z.ZodObject<{
        type: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: string;
    }, {
        type: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    description: string;
    type: string;
    enum?: string[] | undefined;
    items?: {
        type: string;
    } | undefined;
}, {
    description: string;
    type: string;
    enum?: string[] | undefined;
    items?: {
        type: string;
    } | undefined;
}>;
export declare const ToolFunctionSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    parameters: z.ZodObject<{
        type: z.ZodLiteral<"object">;
        properties: z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodString;
            description: z.ZodString;
            enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            items: z.ZodOptional<z.ZodObject<{
                type: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: string;
            }, {
                type: string;
            }>>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            type: string;
            enum?: string[] | undefined;
            items?: {
                type: string;
            } | undefined;
        }, {
            description: string;
            type: string;
            enum?: string[] | undefined;
            items?: {
                type: string;
            } | undefined;
        }>>;
        required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        additionalProperties: z.ZodOptional<z.ZodLiteral<false>>;
    }, "strip", z.ZodTypeAny, {
        type: "object";
        properties: Record<string, {
            description: string;
            type: string;
            enum?: string[] | undefined;
            items?: {
                type: string;
            } | undefined;
        }>;
        required?: string[] | undefined;
        additionalProperties?: false | undefined;
    }, {
        type: "object";
        properties: Record<string, {
            description: string;
            type: string;
            enum?: string[] | undefined;
            items?: {
                type: string;
            } | undefined;
        }>;
        required?: string[] | undefined;
        additionalProperties?: false | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, {
            description: string;
            type: string;
            enum?: string[] | undefined;
            items?: {
                type: string;
            } | undefined;
        }>;
        required?: string[] | undefined;
        additionalProperties?: false | undefined;
    };
}, {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, {
            description: string;
            type: string;
            enum?: string[] | undefined;
            items?: {
                type: string;
            } | undefined;
        }>;
        required?: string[] | undefined;
        additionalProperties?: false | undefined;
    };
}>;
export declare const ToolSchema: z.ZodObject<{
    type: z.ZodLiteral<"function">;
    function: z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        parameters: z.ZodObject<{
            type: z.ZodLiteral<"object">;
            properties: z.ZodRecord<z.ZodString, z.ZodObject<{
                type: z.ZodString;
                description: z.ZodString;
                enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                items: z.ZodOptional<z.ZodObject<{
                    type: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    type: string;
                }, {
                    type: string;
                }>>;
            }, "strip", z.ZodTypeAny, {
                description: string;
                type: string;
                enum?: string[] | undefined;
                items?: {
                    type: string;
                } | undefined;
            }, {
                description: string;
                type: string;
                enum?: string[] | undefined;
                items?: {
                    type: string;
                } | undefined;
            }>>;
            required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            additionalProperties: z.ZodOptional<z.ZodLiteral<false>>;
        }, "strip", z.ZodTypeAny, {
            type: "object";
            properties: Record<string, {
                description: string;
                type: string;
                enum?: string[] | undefined;
                items?: {
                    type: string;
                } | undefined;
            }>;
            required?: string[] | undefined;
            additionalProperties?: false | undefined;
        }, {
            type: "object";
            properties: Record<string, {
                description: string;
                type: string;
                enum?: string[] | undefined;
                items?: {
                    type: string;
                } | undefined;
            }>;
            required?: string[] | undefined;
            additionalProperties?: false | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, {
                description: string;
                type: string;
                enum?: string[] | undefined;
                items?: {
                    type: string;
                } | undefined;
            }>;
            required?: string[] | undefined;
            additionalProperties?: false | undefined;
        };
    }, {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, {
                description: string;
                type: string;
                enum?: string[] | undefined;
                items?: {
                    type: string;
                } | undefined;
            }>;
            required?: string[] | undefined;
            additionalProperties?: false | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, {
                description: string;
                type: string;
                enum?: string[] | undefined;
                items?: {
                    type: string;
                } | undefined;
            }>;
            required?: string[] | undefined;
            additionalProperties?: false | undefined;
        };
    };
    type: "function";
}, {
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, {
                description: string;
                type: string;
                enum?: string[] | undefined;
                items?: {
                    type: string;
                } | undefined;
            }>;
            required?: string[] | undefined;
            additionalProperties?: false | undefined;
        };
    };
    type: "function";
}>;
export declare const ToolCallResultSchema: z.ZodObject<{
    tool_name: z.ZodString;
    arguments: z.ZodRecord<z.ZodString, z.ZodAny>;
    confidence: z.ZodNumber;
    reasoning: z.ZodString;
    validation_errors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    arguments: Record<string, any>;
    tool_name: string;
    confidence: number;
    reasoning: string;
    validation_errors?: string[] | undefined;
}, {
    arguments: Record<string, any>;
    tool_name: string;
    confidence: number;
    reasoning: string;
    validation_errors?: string[] | undefined;
}>;
export declare const ToolCallEmulationResponseSchema: z.ZodObject<{
    should_call_tool: z.ZodBoolean;
    tool_calls: z.ZodArray<z.ZodObject<{
        tool_name: z.ZodString;
        arguments: z.ZodRecord<z.ZodString, z.ZodAny>;
        confidence: z.ZodNumber;
        reasoning: z.ZodString;
        validation_errors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        arguments: Record<string, any>;
        tool_name: string;
        confidence: number;
        reasoning: string;
        validation_errors?: string[] | undefined;
    }, {
        arguments: Record<string, any>;
        tool_name: string;
        confidence: number;
        reasoning: string;
        validation_errors?: string[] | undefined;
    }>, "many">;
    response_text: z.ZodString;
    metadata: z.ZodOptional<z.ZodObject<{
        processing_time: z.ZodOptional<z.ZodNumber>;
        model_used: z.ZodOptional<z.ZodString>;
        confidence_score: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        processing_time?: number | undefined;
        model_used?: string | undefined;
        confidence_score?: number | undefined;
    }, {
        processing_time?: number | undefined;
        model_used?: string | undefined;
        confidence_score?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    should_call_tool: boolean;
    tool_calls: {
        arguments: Record<string, any>;
        tool_name: string;
        confidence: number;
        reasoning: string;
        validation_errors?: string[] | undefined;
    }[];
    response_text: string;
    metadata?: {
        processing_time?: number | undefined;
        model_used?: string | undefined;
        confidence_score?: number | undefined;
    } | undefined;
}, {
    should_call_tool: boolean;
    tool_calls: {
        arguments: Record<string, any>;
        tool_name: string;
        confidence: number;
        reasoning: string;
        validation_errors?: string[] | undefined;
    }[];
    response_text: string;
    metadata?: {
        processing_time?: number | undefined;
        model_used?: string | undefined;
        confidence_score?: number | undefined;
    } | undefined;
}>;
export type ToolParameter = z.infer<typeof ToolParameterSchema>;
export type ToolFunction = z.infer<typeof ToolFunctionSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type ToolCallResult = z.infer<typeof ToolCallResultSchema>;
export type ToolCallEmulationResponse = z.infer<typeof ToolCallEmulationResponseSchema>;
export interface BaseModel {
    validate(): boolean;
    toJSON(): string;
    fromJSON(json: string): this;
}
export interface SystemPromptTemplate {
    basePrompt: string;
    toolDescriptions: string;
    outputSchema: string;
    examples: string;
}
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
export interface ResponseParserConfig {
    strictMode: boolean;
    validateSchema: boolean;
    handleRefusal: boolean;
    fallbackOnError: boolean;
    maxRetries: number;
}
