/**
 * Context Memory System Integration
 * 
 * Integrates the Context Memory System with the existing MCP sampler server.
 * Provides a clean interface for adding context memory capabilities to the server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequest, CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import { ContextMemoryTools } from './tools/index.js';

// =============================================================================
// Context Memory Integration Class
// =============================================================================

export class ContextMemoryIntegration {
  private tools: ContextMemoryTools;
  private isInitialized: boolean = false;

  constructor(dbPath?: string) {
    this.tools = new ContextMemoryTools(dbPath);
  }

  /**
   * Initialize the Context Memory System with the MCP server
   */
  async initialize(server: Server, createMessageCallback?: (messages: any[], options?: any) => Promise<any>): Promise<void> {
    if (this.isInitialized) {
      console.warn('Context Memory System is already initialized');
      return;
    }

    try {
      // Set up sampling callback if provided
      if (createMessageCallback) {
        this.tools.setCreateMessageCallback(createMessageCallback);
      }

      this.isInitialized = true;
      console.log('Context Memory System initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Context Memory System:', error);
      throw error;
    }
  }

  /**
   * Get Context Memory tools for registration with the server
   */
  getTools(): ListToolsResult['tools'] {
    return this.tools.getTools();
  }

  /**
   * Handle Context Memory tool calls
   */
  async handleToolCall(request: CallToolRequest): Promise<CallToolResult | null> {
    const contextMemoryTools = ['context-manage', 'personality-preset-manage', 'context-chat', 'conversation-manage'];
    
    if (!contextMemoryTools.includes(request.params.name)) {
      return null; // Not a context memory tool
    }

    if (!this.isInitialized) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Context Memory System is not initialized'
          }
        ],
        isError: true
      };
    }

    return await this.tools.handleToolCall(request);
  }

  /**
   * Check if a tool is a Context Memory tool
   */
  isContextMemoryTool(toolName: string): boolean {
    const contextMemoryTools = ['context-manage', 'personality-preset-manage', 'context-chat', 'conversation-manage'];
    return contextMemoryTools.includes(toolName);
  }

  /**
   * Get system statistics
   */
  getStatistics() {
    if (!this.isInitialized) {
      return null;
    }
    // Access database statistics through tools instance
    return this.tools['db']?.getStatistics();
  }

  /**
   * Cleanup expired contexts
   */
  cleanupExpired(): number {
    if (!this.isInitialized) {
      return 0;
    }
    return this.tools['db']?.cleanupExpiredContexts() || 0;
  }

  /**
   * Close the Context Memory System and cleanup resources
   */
  close(): void {
    if (this.isInitialized) {
      this.tools.close();
      this.isInitialized = false;
      console.log('Context Memory System closed');
    }
  }
}

// =============================================================================
// Export Types for Integration
// =============================================================================

export * from './types/index.js';
export * from './utils/index.js';
export { ContextMemoryTools } from './tools/index.js';
export { ContextMemoryDatabase } from './utils/database.js';
