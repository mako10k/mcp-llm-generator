/**
 * Context Memory System Integration
 *
 * Integrates the Context Memory System with the existing MCP sampler server.
 * Provides a clean interface for adding context memory capabilities to the server.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequest, CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
export declare class ContextMemoryIntegration {
    private tools;
    private isInitialized;
    constructor(dbPath?: string);
    /**
     * Initialize the Context Memory System with the MCP server
     */
    initialize(server: Server, createMessageCallback?: (messages: any[], options?: any) => Promise<any>): Promise<void>;
    /**
     * Get Context Memory tools for registration with the server
     */
    getTools(): ListToolsResult['tools'];
    /**
     * Handle Context Memory tool calls
     */
    handleToolCall(request: CallToolRequest): Promise<CallToolResult | null>;
    /**
     * Check if a tool is a Context Memory tool
     */
    isContextMemoryTool(toolName: string): boolean;
    /**
     * Get system statistics
     */
    getStatistics(): {
        totalContexts: number;
        activeContexts: number;
        expiredContexts: number;
        totalConversations: number;
        totalPresets: number;
        activePresets: number;
    } | null;
    /**
     * Cleanup expired contexts
     */
    cleanupExpired(): number;
    /**
     * Close the Context Memory System and cleanup resources
     */
    close(): void;
}
export * from './types/index.js';
export * from './utils/index.js';
export { ContextMemoryTools } from './tools/index.js';
export { ContextMemoryDatabase } from './utils/database.js';
