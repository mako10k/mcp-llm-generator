/**
 * Tool Types
 * ツール関連の型定義
 */

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  tool_name: string;
  arguments: Record<string, unknown>;
  confidence: number;
  reasoning: string;
}

export interface ToolResponse {
  should_call_tool: boolean;
  tool_calls: ToolCall[];
  response_text: string;
  metadata?: {
    processing_time?: number;
    model_used?: string;
    confidence_score?: number;
  };
}
