/**
 * Context Memory System MCP Tools Implementation
 *
 * Provides MCP tool implementations for context management, conversation handling,
 * and personality preset operations using the Context Memory System.
 */
import { CallToolRequest, CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
export declare class ContextMemoryTools {
    private db;
    private createMessageCallback?;
    constructor(dbPath?: string);
    /**
     * Set the callback function for creating LLM messages (sampling)
     */
    setCreateMessageCallback(callback: (messages: any[], options?: any) => Promise<any>): void;
    /**
     * Close database connection
     */
    close(): void;
    /**
     * Get list of available tools
     */
    getTools(): ListToolsResult['tools'];
    /**
     * Handle tool calls
     */
    handleToolCall(request: CallToolRequest): Promise<CallToolResult>;
    /**
     * Handle context management operations
     */
    private handleContextManage;
    private handleContextCreate;
    private handleContextCreateFromPreset;
    private handleContextList;
    private handleContextGet;
    private handleContextUpdate;
    private handleContextDelete;
    /**
     * Handle personality preset management operations
     */
    private handlePersonalityPresetManage;
    private handlePresetCreate;
    private handlePresetList;
    private handlePresetGet;
    private handlePresetUpdate;
    private handlePresetDelete;
    /**
     * Handle context chat operations
     */
    private handleContextChat;
    /**
     * Handle conversation management operations
     */
    private handleConversationManage;
    private handleConversationList;
    private handleConversationDelete;
    private handleConversationClear;
}
