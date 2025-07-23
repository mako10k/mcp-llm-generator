/**
 * Type-safe MCP Tool Definitions
 * 
 * Provides strict TypeScript types for MCP tool schema definitions,
 * eliminating any type usage and ensuring compile-time type safety.
 */

import { z } from 'zod';

/**
 * MCP Tool Definition structure with strict typing
 */
export interface MCPToolDefinition {
  description: string;
  inputSchema: z.ZodTypeAny;
}

/**
 * Collection of MCP tool definitions with string keys
 */
export type MCPToolDefinitions = Record<string, MCPToolDefinition>;

/**
 * Type-safe MCP tool response types
 */
export interface MCPToolHandler<TInput = unknown, TOutput = unknown> {
  (input: TInput): Promise<TOutput>;
}

/**
 * MCP Tool Registry for managing tool definitions and handlers
 */
export interface MCPToolRegistry {
  getToolDefinitions(): MCPToolDefinitions;
  handleToolCall(toolName: string, args: unknown): Promise<unknown>;
}
