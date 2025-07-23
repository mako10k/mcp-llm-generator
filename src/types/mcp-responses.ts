import { z } from 'zod';

/**
 * MCP Tool Response Schema
 * MCP仕様に準拠した応答形式の型定義
 */

// MCP Content Types
export const MCPTextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string()
});

export const MCPImageContentSchema = z.object({
  type: z.literal('image'),
  data: z.string(),
  mimeType: z.string()
});

export const MCPContentSchema = z.union([
  MCPTextContentSchema,
  MCPImageContentSchema
]);

// MCP Tool Response
export const MCPToolResponseSchema = z.object({
  content: z.array(MCPContentSchema),
  isError: z.boolean().optional()
});

// Capability Awareness Specific Response Types
export const SelfAwarenessResponseSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string()
  }))
});

export const OtherAwarenessResponseSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string()
  }))
});

export const InheritanceResponseSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string()
  }))
});

export const CapabilityMatrixResponseSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string()
  }))
});

export const HierarchyAnalysisResponseSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string()
  }))
});

// Type exports
export type MCPToolResponse = z.infer<typeof MCPToolResponseSchema>;
export type MCPContent = z.infer<typeof MCPContentSchema>;
export type SelfAwarenessResponse = z.infer<typeof SelfAwarenessResponseSchema>;
export type OtherAwarenessResponse = z.infer<typeof OtherAwarenessResponseSchema>;
export type InheritanceResponse = z.infer<typeof InheritanceResponseSchema>;
export type CapabilityMatrixResponse = z.infer<typeof CapabilityMatrixResponseSchema>;
export type HierarchyAnalysisResponse = z.infer<typeof HierarchyAnalysisResponseSchema>;

// Utility function to create MCP text response
export function createMCPTextResponse(text: string): MCPToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: text
      }
    ]
  };
}

// Utility function to create MCP error response
export function createMCPErrorResponse(errorMessage: string): MCPToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${errorMessage}`
      }
    ],
    isError: true
  };
}
