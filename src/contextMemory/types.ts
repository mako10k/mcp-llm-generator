/**
 * Context Memory System types
 * 
 * Provides type-safe interfaces for context memory functionality
 */

/**
 * MCP Message structure (internal format with system role support)
 */
export interface MCPMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

/**
 * MCP SDK compatible message format (no system role)
 */
export interface MCPSDKMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/**
 * Sampling options for LLM generation
 */
export interface SamplingOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

/**
 * Create message callback function type
 */
export type CreateMessageCallback = (
  messages: MCPMessage[], 
  options?: SamplingOptions
) => Promise<unknown>;

/**
 * Context memory initialization options
 */
export interface ContextMemoryInitOptions {
  dbPath?: string;
  enableSampling?: boolean;
  maxContextSize?: number;
}

/**
 * Type guard to check if a message is MCP SDK compatible
 * @param msg - Message to check
 * @returns true if the message role is 'user' or 'assistant'
 */
export function isMCPSDKMessage(msg: MCPMessage): msg is MCPSDKMessage {
  return msg.role === 'user' || msg.role === 'assistant';
}

/**
 * Convert MCPMessage array to MCP SDK compatible format
 * Filters out system messages and returns only user/assistant messages
 * @param messages - Array of MCPMessage to convert
 * @returns Array of MCPSDKMessage (filtered for SDK compatibility)
 */
export function toMCPSDKMessages(messages: MCPMessage[]): MCPSDKMessage[] {
  return messages.filter(isMCPSDKMessage);
}

/**
 * Convert a single MCPMessage to MCP SDK format if compatible
 * @param message - MCPMessage to convert
 * @returns MCPSDKMessage if compatible, undefined if system message
 */
export function toMCPSDKMessage(message: MCPMessage): MCPSDKMessage | undefined {
  return isMCPSDKMessage(message) ? message : undefined;
}

/**
 * MCP SDK CreateMessage options interface (based on SDK requirements)
 */
export interface CreateMessageOptions {
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}
