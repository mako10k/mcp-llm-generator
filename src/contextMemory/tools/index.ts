/**
 * Context Memory System MCP Tools Implementation
 * 
 * Provides MCP tool implementations for context management, conversation handling,
 * and personality preset operations using the Context Memory System.
 */

import { z } from 'zod';
import { CallToolRequest, CallToolResult, ListToolsResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { ContextMemoryDatabase } from '../utils/database.js';
import {
  Context,
  Conversation,
  PersonalityPreset,
  ContextManageInput,
  ContextManageOutput,
  PersonalityPresetManageInput,
  PersonalityPresetManageOutput,
  ContextChatInput,
  ContextChatOutput,
  ConversationManageInput,
  ConversationManageOutput,
  DEFAULT_VALUES
} from '../types/index.js';
import {
  createContext,
  createContextFromPreset,
  updateContext,
  createConversation,
  createPersonalityPreset,
  updatePersonalityPreset,
  validateContextInput,
  validatePresetInput,
  isContextExpired,
  truncateConversationHistory
} from '../utils/index.js';

// =============================================================================
// Zod Schemas for Input Validation
// =============================================================================

const ContextManageInputSchema = z.object({
  action: z.enum(['create', 'create_from_preset', 'list', 'get', 'update', 'delete']),
  contextId: z.string().optional(),
  name: z.string().optional(),
  systemPrompt: z.string().optional(),
  personality: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(1).optional(),
  maxHistoryTokens: z.number().min(1000).optional(),
  expiryDays: z.number().min(1).optional(),
  presetId: z.string().optional(),
  presetOverrides: z.object({
    name: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
    maxTokens: z.number().min(1).optional(),
    maxHistoryTokens: z.number().min(1000).optional(),
    expiryDays: z.number().min(1).optional(),
  }).optional(),
  page: z.number().min(1).optional(),
  pageSize: z.number().min(1).max(100).optional(),
  includeExpired: z.boolean().optional(),
});

const PersonalityPresetManageInputSchema = z.object({
  action: z.enum(['create', 'list', 'get', 'update', 'delete']),
  presetId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  defaultPersonality: z.string().optional(),
  defaultSettings: z.object({
    temperature: z.number().min(0).max(1).optional(),
    maxTokens: z.number().min(1).optional(),
    maxHistoryTokens: z.number().min(1000).optional(),
    expiryDays: z.number().min(1).optional(),
  }).optional(),
  metadata: z.record(z.any()).optional(),
  page: z.number().min(1).optional(),
  pageSize: z.number().min(1).max(100).optional(),
  includeInactive: z.boolean().optional(),
});

const ContextChatInputSchema = z.object({
  contextId: z.string(),
  message: z.string(),
  maintainPersonality: z.boolean().optional(),
});

const ConversationManageInputSchema = z.object({
  action: z.enum(['list', 'delete', 'clear']),
  contextId: z.string(),
  page: z.number().min(1).optional(),
  pageSize: z.number().min(1).max(100).optional(),
  reverse: z.boolean().optional(),
  conversationIds: z.array(z.string()).optional(),
  olderThan: z.string().optional(),
});

// =============================================================================
// Context Memory Tools Implementation
// =============================================================================

export class ContextMemoryTools {
  private db: ContextMemoryDatabase;
  private createMessageCallback?: (messages: any[], options?: any) => Promise<any>;

  constructor(dbPath?: string) {
    this.db = new ContextMemoryDatabase(dbPath);
  }

  /**
   * Set the callback function for creating LLM messages (sampling)
   */
  setCreateMessageCallback(callback: (messages: any[], options?: any) => Promise<any>): void {
    this.createMessageCallback = callback;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get list of available tools
   */
  getTools(): ListToolsResult['tools'] {
    return [
      {
        name: 'context-manage',
        description: 'Manage context memory instances with personality-driven chat capabilities',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['create', 'create_from_preset', 'list', 'get', 'update', 'delete'],
              description: 'Action to perform'
            },
            contextId: {
              type: 'string',
              description: 'Context ID for operations'
            },
            name: {
              type: 'string',
              description: 'Context name'
            },
            systemPrompt: {
              type: 'string',
              description: 'System prompt for LLM'
            },
            personality: {
              type: 'string',
              description: 'Custom personality description'
            },
            temperature: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Sampling temperature'
            },
            maxTokens: {
              type: 'number',
              minimum: 1,
              description: 'Maximum tokens per response'
            },
            maxHistoryTokens: {
              type: 'number',
              minimum: 1000,
              description: 'Maximum conversation history tokens'
            },
            expiryDays: {
              type: 'number',
              minimum: 1,
              description: 'Expiry duration in days'
            },
            presetId: {
              type: 'string',
              description: 'Personality preset ID for create_from_preset'
            },
            presetOverrides: {
              type: 'object',
              description: 'Parameter overrides for preset-based creation'
            },
            page: {
              type: 'number',
              minimum: 1,
              description: 'Page number for list operation'
            },
            pageSize: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Page size for list operation'
            },
            includeExpired: {
              type: 'boolean',
              description: 'Include expired contexts in list'
            }
          },
          required: ['action']
        }
      },
      {
        name: 'personality-preset-manage',
        description: 'Manage personality presets for context creation',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['create', 'list', 'get', 'update', 'delete'],
              description: 'Action to perform'
            },
            presetId: {
              type: 'string',
              description: 'Preset ID for operations'
            },
            name: {
              type: 'string',
              description: 'Preset name'
            },
            description: {
              type: 'string',
              description: 'Preset description'
            },
            systemPrompt: {
              type: 'string',
              description: 'Core personality system prompt'
            },
            defaultPersonality: {
              type: 'string',
              description: 'Default personality description'
            },
            defaultSettings: {
              type: 'object',
              description: 'Default parameter values'
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata'
            },
            page: {
              type: 'number',
              minimum: 1,
              description: 'Page number for list operation'
            },
            pageSize: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Page size for list operation'
            },
            includeInactive: {
              type: 'boolean',
              description: 'Include inactive presets in list'
            }
          },
          required: ['action']
        }
      },
      {
        name: 'context-chat',
        description: 'Chat with LLM using specific context personality and memory',
        inputSchema: {
          type: 'object',
          properties: {
            contextId: {
              type: 'string',
              description: 'Context ID to chat with'
            },
            message: {
              type: 'string',
              description: 'User message'
            },
            maintainPersonality: {
              type: 'boolean',
              description: 'Whether to maintain personality consistency'
            }
          },
          required: ['contextId', 'message']
        }
      },
      {
        name: 'conversation-manage',
        description: 'Manage conversations within contexts (list, delete, clear)',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['list', 'delete', 'clear'],
              description: 'Action to perform'
            },
            contextId: {
              type: 'string',
              description: 'Context ID'
            },
            page: {
              type: 'number',
              minimum: 1,
              description: 'Page number for list operation'
            },
            pageSize: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Page size for list operation'
            },
            reverse: {
              type: 'boolean',
              description: 'Reverse chronological order'
            },
            conversationIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Conversation IDs to delete'
            },
            olderThan: {
              type: 'string',
              description: 'Delete conversations older than this timestamp'
            }
          },
          required: ['action', 'contextId']
        }
      }
    ];
  }

  /**
   * Handle tool calls
   */
  async handleToolCall(request: CallToolRequest): Promise<CallToolResult> {
    try {
      switch (request.params.name) {
        case 'context-manage':
          return await this.handleContextManage(request.params.arguments);
        case 'personality-preset-manage':
          return await this.handlePersonalityPresetManage(request.params.arguments);
        case 'context-chat':
          return await this.handleContextChat(request.params.arguments);
        case 'conversation-manage':
          return await this.handleConversationManage(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  // =============================================================================
  // Tool Handler Methods
  // =============================================================================

  /**
   * Handle context management operations
   */
  private async handleContextManage(args: any): Promise<CallToolResult> {
    const input = ContextManageInputSchema.parse(args);

    switch (input.action) {
      case 'create':
        return this.handleContextCreate(input);
      case 'create_from_preset':
        return this.handleContextCreateFromPreset(input);
      case 'list':
        return this.handleContextList(input);
      case 'get':
        return this.handleContextGet(input);
      case 'update':
        return this.handleContextUpdate(input);
      case 'delete':
        return this.handleContextDelete(input);
      default:
        throw new Error(`Unknown context action: ${input.action}`);
    }
  }

  private handleContextCreate(input: ContextManageInput): CallToolResult {
    if (!input.name || !input.systemPrompt) {
      return {
        content: [{ type: 'text', text: 'Error: name and systemPrompt are required for create action' }],
        isError: true
      };
    }

    const validation = validateContextInput(input);
    if (!validation.isValid) {
      return {
        content: [{ type: 'text', text: `Validation errors: ${validation.errors.join(', ')}` }],
        isError: true
      };
    }

    const context = createContext({
      name: input.name,
      systemPrompt: input.systemPrompt,
      personality: input.personality,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      maxHistoryTokens: input.maxHistoryTokens,
      expiryDays: input.expiryDays
    });

    const createdContext = this.db.createContext(context);

    // Optimized response - essential information only
    const optimizedOutput = {
      success: true,
      contextId: createdContext.id,
      name: createdContext.name
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
      ]
    };
  }

  private handleContextCreateFromPreset(input: ContextManageInput): CallToolResult {
    if (!input.name || !input.presetId) {
      return {
        content: [{ type: 'text', text: 'Error: name and presetId are required for create_from_preset action' }],
        isError: true
      };
    }

    try {
      const context = createContextFromPreset(
        input.presetId,
        input.name,
        input.presetOverrides
      );

      const createdContext = this.db.createContext(context);

      const output: ContextManageOutput = {
        success: true,
        context: createdContext,
        message: `Context "${createdContext.name}" created from preset "${input.presetId}" with ID: ${createdContext.id}`
      };

      return {
        content: [
          { type: 'text', text: JSON.stringify(output, null, 2) }
        ]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true
      };
    }
  }

  private handleContextList(input: ContextManageInput): CallToolResult {
    const result = this.db.listContexts({
      page: input.page || DEFAULT_VALUES.pagination.page,
      pageSize: input.pageSize || DEFAULT_VALUES.pagination.pageSize,
      includeExpired: input.includeExpired || false
    });

    const output: ContextManageOutput = {
      success: true,
      contexts: result.contexts,
      totalCount: result.totalCount,
      message: `Found ${result.totalCount} contexts (showing page ${result.page} of ${Math.ceil(result.totalCount / result.pageSize)})`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  private handleContextGet(input: ContextManageInput): CallToolResult {
    if (!input.contextId) {
      return {
        content: [{ type: 'text', text: 'Error: contextId is required for get action' }],
        isError: true
      };
    }

    const context = this.db.getContext(input.contextId);
    if (!context) {
      return {
        content: [{ type: 'text', text: `Error: Context with ID ${input.contextId} not found` }],
        isError: true
      };
    }

    const output: ContextManageOutput = {
      success: true,
      context,
      message: `Context "${context.name}" retrieved successfully`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  private handleContextUpdate(input: ContextManageInput): CallToolResult {
    if (!input.contextId) {
      return {
        content: [{ type: 'text', text: 'Error: contextId is required for update action' }],
        isError: true
      };
    }

    const existingContext = this.db.getContext(input.contextId);
    if (!existingContext) {
      return {
        content: [{ type: 'text', text: `Error: Context with ID ${input.contextId} not found` }],
        isError: true
      };
    }

    const updatedContext = updateContext(existingContext, {
      name: input.name,
      systemPrompt: input.systemPrompt,
      personality: input.personality,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      maxHistoryTokens: input.maxHistoryTokens,
      expiryDays: input.expiryDays
    });

    const savedContext = this.db.updateContext(updatedContext);

    const output: ContextManageOutput = {
      success: true,
      context: savedContext,
      message: `Context "${savedContext.name}" updated successfully`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  private handleContextDelete(input: ContextManageInput): CallToolResult {
    if (!input.contextId) {
      return {
        content: [{ type: 'text', text: 'Error: contextId is required for delete action' }],
        isError: true
      };
    }

    const deleted = this.db.deleteContext(input.contextId);
    if (!deleted) {
      return {
        content: [{ type: 'text', text: `Error: Context with ID ${input.contextId} not found` }],
        isError: true
      };
    }

    const output: ContextManageOutput = {
      success: true,
      message: `Context with ID ${input.contextId} deleted successfully`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  /**
   * Handle personality preset management operations
   */
  private async handlePersonalityPresetManage(args: any): Promise<CallToolResult> {
    const input = PersonalityPresetManageInputSchema.parse(args);

    switch (input.action) {
      case 'create':
        return this.handlePresetCreate(input);
      case 'list':
        return this.handlePresetList(input);
      case 'get':
        return this.handlePresetGet(input);
      case 'update':
        return this.handlePresetUpdate(input);
      case 'delete':
        return this.handlePresetDelete(input);
      default:
        throw new Error(`Unknown preset action: ${input.action}`);
    }
  }

  private handlePresetCreate(input: PersonalityPresetManageInput): CallToolResult {
    if (!input.name || !input.description || !input.systemPrompt || !input.defaultPersonality) {
      return {
        content: [{ type: 'text', text: 'Error: name, description, systemPrompt, and defaultPersonality are required for create action' }],
        isError: true
      };
    }

    const validation = validatePresetInput(input);
    if (!validation.isValid) {
      return {
        content: [{ type: 'text', text: `Validation errors: ${validation.errors.join(', ')}` }],
        isError: true
      };
    }

    const preset = createPersonalityPreset({
      name: input.name,
      description: input.description,
      systemPrompt: input.systemPrompt,
      defaultPersonality: input.defaultPersonality,
      defaultSettings: input.defaultSettings,
      metadata: input.metadata
    });

    const createdPreset = this.db.createPersonalityPreset(preset);

    const output: PersonalityPresetManageOutput = {
      success: true,
      preset: createdPreset,
      message: `Personality preset "${createdPreset.name}" created successfully with ID: ${createdPreset.id}`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  private handlePresetList(input: PersonalityPresetManageInput): CallToolResult {
    const result = this.db.listPersonalityPresets({
      page: input.page || DEFAULT_VALUES.pagination.page,
      pageSize: input.pageSize || DEFAULT_VALUES.pagination.pageSize,
      includeInactive: input.includeInactive || false
    });

    const output: PersonalityPresetManageOutput = {
      success: true,
      presets: result.presets,
      totalCount: result.totalCount,
      message: `Found ${result.totalCount} presets (showing page ${result.page} of ${Math.ceil(result.totalCount / result.pageSize)})`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  private handlePresetGet(input: PersonalityPresetManageInput): CallToolResult {
    if (!input.presetId) {
      return {
        content: [{ type: 'text', text: 'Error: presetId is required for get action' }],
        isError: true
      };
    }

    const preset = this.db.getPersonalityPreset(input.presetId);
    if (!preset) {
      return {
        content: [{ type: 'text', text: `Error: Preset with ID ${input.presetId} not found` }],
        isError: true
      };
    }

    const output: PersonalityPresetManageOutput = {
      success: true,
      preset,
      message: `Preset "${preset.name}" retrieved successfully`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  private handlePresetUpdate(input: PersonalityPresetManageInput): CallToolResult {
    if (!input.presetId) {
      return {
        content: [{ type: 'text', text: 'Error: presetId is required for update action' }],
        isError: true
      };
    }

    const existingPreset = this.db.getPersonalityPreset(input.presetId);
    if (!existingPreset) {
      return {
        content: [{ type: 'text', text: `Error: Preset with ID ${input.presetId} not found` }],
        isError: true
      };
    }

    const updatedPreset = updatePersonalityPreset(existingPreset, {
      name: input.name,
      description: input.description,
      systemPrompt: input.systemPrompt,
      defaultPersonality: input.defaultPersonality,
      defaultSettings: input.defaultSettings ? {
        temperature: input.defaultSettings.temperature ?? existingPreset.defaultSettings.temperature,
        maxTokens: input.defaultSettings.maxTokens ?? existingPreset.defaultSettings.maxTokens,
        maxHistoryTokens: input.defaultSettings.maxHistoryTokens ?? existingPreset.defaultSettings.maxHistoryTokens,
        expiryDays: input.defaultSettings.expiryDays ?? existingPreset.defaultSettings.expiryDays
      } : undefined,
      metadata: input.metadata
    });

    const savedPreset = this.db.updatePersonalityPreset(updatedPreset);

    const output: PersonalityPresetManageOutput = {
      success: true,
      preset: savedPreset,
      message: `Preset "${savedPreset.name}" updated successfully`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  private handlePresetDelete(input: PersonalityPresetManageInput): CallToolResult {
    if (!input.presetId) {
      return {
        content: [{ type: 'text', text: 'Error: presetId is required for delete action' }],
        isError: true
      };
    }

    const deleted = this.db.deletePersonalityPreset(input.presetId);
    if (!deleted) {
      return {
        content: [{ type: 'text', text: `Error: Preset with ID ${input.presetId} not found` }],
        isError: true
      };
    }

    const output: PersonalityPresetManageOutput = {
      success: true,
      message: `Preset with ID ${input.presetId} deleted successfully`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  /**
   * Handle context chat operations
   */
  private async handleContextChat(args: any): Promise<CallToolResult> {
    const input = ContextChatInputSchema.parse(args);

    if (!this.createMessageCallback) {
      return {
        content: [{ type: 'text', text: 'Error: LLM sampling capability not available. Make sure the client supports sampling.' }],
        isError: true
      };
    }

    // Get context
    const context = this.db.getContext(input.contextId);
    if (!context) {
      return {
        content: [{ type: 'text', text: `Error: Context with ID ${input.contextId} not found` }],
        isError: true
      };
    }

    // Check if context is expired
    if (isContextExpired(context)) {
      return {
        content: [{ type: 'text', text: `Error: Context "${context.name}" has expired` }],
        isError: true
      };
    }

    try {
      // Create user message
      const userMessage = createConversation(input.contextId, 'user', input.message);
      this.db.createConversation(userMessage);

      // Get conversation history
      const allConversations = this.db.getAllConversations(input.contextId);
      const { truncated: conversationHistory, wasTruncated } = truncateConversationHistory(
        allConversations,
        context.maxHistoryTokens
      );

      // Build messages for LLM
      const messages = [
        {
          role: 'system' as const,
          content: {
            type: 'text' as const,
            text: input.maintainPersonality !== false 
              ? `${context.systemPrompt}\n\nPersonality: ${context.personality}`
              : context.systemPrompt
          }
        },
        ...conversationHistory.slice(1).map(conv => ({
          role: conv.role as 'user' | 'assistant',
          content: {
            type: 'text' as const,
            text: conv.content
          }
        }))
      ];

      // Call LLM
      const response = await this.createMessageCallback(messages, {
        maxTokens: context.maxTokens,
        temperature: context.temperature
      });

      const responseText = response.content?.text || 'No response generated';

      // Create assistant message
      const assistantMessage = createConversation(input.contextId, 'assistant', responseText);
      this.db.createConversation(assistantMessage);

      // Optimized response - eliminate redundancy based on specialist recommendations
      const optimizedOutput = {
        response: responseText,
        historyTokens: conversationHistory.reduce((sum, conv) => sum + conv.tokenCount, 0),
        truncated: wasTruncated
      };

      return {
        content: [
          { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
        ]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error during chat: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true
      };
    }
  }

  /**
   * Handle conversation management operations
   */
  private async handleConversationManage(args: any): Promise<CallToolResult> {
    const input = ConversationManageInputSchema.parse(args);

    switch (input.action) {
      case 'list':
        return this.handleConversationList(input);
      case 'delete':
        return this.handleConversationDelete(input);
      case 'clear':
        return this.handleConversationClear(input);
      default:
        throw new Error(`Unknown conversation action: ${input.action}`);
    }
  }

  private handleConversationList(input: ConversationManageInput): CallToolResult {
    const result = this.db.getConversations(input.contextId, {
      page: input.page || DEFAULT_VALUES.pagination.page,
      pageSize: input.pageSize || DEFAULT_VALUES.pagination.conversationPageSize,
      reverse: input.reverse
    });

    const output: ConversationManageOutput = {
      success: true,
      conversations: result.conversations,
      totalCount: result.totalCount,
      message: `Found ${result.totalCount} conversations (showing page ${result.page} of ${Math.ceil(result.totalCount / result.pageSize)})`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  private handleConversationDelete(input: ConversationManageInput): CallToolResult {
    let deletedCount = 0;

    if (input.conversationIds && input.conversationIds.length > 0) {
      deletedCount = this.db.deleteConversations(input.conversationIds);
    } else if (input.olderThan) {
      deletedCount = this.db.deleteConversationsOlderThan(input.contextId, input.olderThan);
    } else {
      return {
        content: [{ type: 'text', text: 'Error: Either conversationIds or olderThan must be provided for delete action' }],
        isError: true
      };
    }

    const output: ConversationManageOutput = {
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} conversations`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }

  private handleConversationClear(input: ConversationManageInput): CallToolResult {
    const deletedCount = this.db.clearConversations(input.contextId);

    const output: ConversationManageOutput = {
      success: true,
      deletedCount,
      message: `Cleared ${deletedCount} conversations from context`
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ]
    };
  }
}
