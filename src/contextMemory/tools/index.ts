/**
 * Context Memory System MCP Tools Implementation
 * 
 * Provides MCP tool implementations for context management, conversation handling,
 * and personality preset operations using the Context Memory System.
 */

import { z } from 'zod';
import { CallToolRequest, CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import { ContextMemoryDatabase } from '../utils/database.js';
import { PersonaPromptMerger } from '../../utils/PersonaPromptMerger.js';
import { CreateMessageCallback, OpenAITool } from '../types.js';
import {
  ContextManageInput,
  PersonalityPresetManageInput,
  ConversationManageInput,
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
// PATs Tool Execution System
// =============================================================================

/**
 * OpenAI standard tool call interface - matches FineTuning patterns
 */
interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string format as per OpenAI spec
  };
}

/**
 * PATs Tool execution result interface
 */
interface PATsResult {
  success: boolean;
  data?: unknown;
  error?: string;
  toolName: string;
  executionTimeMs: number;
}

/**
 * Google search parameters interface
 */
interface GoogleSearchParams {
  query: string;
  numResults?: number;
  language?: string;
}

/**
 * Google search result interface
 */
interface GoogleSearchResult {
  results: string[];
  totalResults: number;
  query: string;
}

/**
 * Capability awareness result interface
 */
interface CapabilityResult {
  capability_info: string;
  context_id: string;
  analysis: string;
}

/**
 * Type guard for OpenAI standard tool call
 */
function isOpenAIToolCall(obj: unknown): obj is OpenAIToolCall {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  
  const toolCall = obj as Record<string, unknown>;
  return (
    typeof toolCall.id === 'string' &&
    toolCall.type === 'function' &&
    typeof toolCall.function === 'object' &&
    toolCall.function !== null &&
    typeof (toolCall.function as Record<string, unknown>).name === 'string' &&
    typeof (toolCall.function as Record<string, unknown>).arguments === 'string'
  );
}

/**
 * Execute OpenAI standard tool call using unified adapter pattern
 * Maps standard tool call names to existing implementations
 */
async function executeOpenAIToolCall(toolCall: OpenAIToolCall): Promise<PATsResult> {
  const startTime = Date.now();
  
  try {
    // Parse arguments from JSON string (OpenAI standard format)
    let parameters: Record<string, unknown>;
    try {
      parameters = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[Tool Call] Failed to parse arguments JSON:', toolCall.function.arguments);
      return {
        success: false,
        error: `Invalid arguments JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        toolName: toolCall.function.name,
        executionTimeMs: Date.now() - startTime
      };
    }

    const toolName = toolCall.function.name;
    let result: unknown;

    switch (toolName) {
      case 'pats_google_search': {
        // Use existing FunctionExecutionEngine
        const googleResult = await executeGoogleSearchAdapter({
          query: String(parameters.query || ''),
          numResults: Number(parameters.numResults) || 10,
          language: String(parameters.language || 'ja')
        });
        result = googleResult;
        break;
      }

      case 'pats_shared_memory_create': {
        // Use existing shared memory tools - Mock implementation
        // Note: Real implementation needs proper toolManager injection
        result = await mockSharedMemoryCreate({
          title: String(parameters.title || ''),
          content: String(parameters.content || ''),
          creator_persona_id: String(parameters.creator_persona_id || ''),
          permission_level: String(parameters.permission_level || 'edit')
        });
        break;
      }

      case 'pats_shared_memory_search': {
        result = await mockSharedMemorySearch({
          query: String(parameters.query || ''),
          requester_persona_id: String(parameters.requester_persona_id || ''),
          limit: Number(parameters.limit) || 10
        });
        break;
      }

      case 'pats_persona_inspect_capabilities': {
        // Use existing capability awareness tools
        result = await executeCapabilityAwarenessAdapter('persona-inspect-capabilities', parameters);
        break;
      }

      case 'pats_persona_evaluate_interaction': {
        result = await executeCapabilityAwarenessAdapter('persona-evaluate-interaction', parameters);
        break;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    return {
      success: true,
      data: result,
      toolName,
      executionTimeMs: Date.now() - startTime
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      toolName: toolCall.function.name,
      executionTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Legacy function - will be deprecated
 * @deprecated Use executeOpenAIToolCall instead
 */
async function _executePATsTool(functionCall: unknown): Promise<PATsResult> {
  const startTime = Date.now();
  
  console.error('[PATs] DEPRECATED: executePATsTool called with legacy format');
  console.error('[PATs] Received object:', JSON.stringify(functionCall, null, 2));
  
  return {
    success: false,
    error: 'Legacy PATs format no longer supported. Use OpenAI standard tool_calls format.',
    toolName: 'unknown',
    executionTimeMs: Date.now() - startTime
  };
}

/**
 * Adapter for Google Search using existing FunctionExecutionEngine
 * TODO: Replace with proper FunctionExecutionEngine instance injection
 */
async function executeGoogleSearchAdapter(params: GoogleSearchParams): Promise<GoogleSearchResult> {
  // Mock implementation - needs proper FunctionExecutionEngine instance
  return {
    results: [`Mock search result for: ${params.query}`],
    totalResults: 1,
    query: params.query
  };
}

/**
 * Mock shared memory create adapter
 * TODO: Replace with proper shared memory tool injection
 */
async function mockSharedMemoryCreate(params: {
  title: string;
  content: string;
  creator_persona_id: string;
  permission_level: string;
}): Promise<{ id: string; title: string }> {
  return {
    id: 'mock-memory-id',
    title: params.title
  };
}

/**
 * Mock shared memory search adapter
 * TODO: Replace with proper shared memory tool injection
 */
async function mockSharedMemorySearch(params: {
  query: string;
  requester_persona_id: string;
  limit: number;
}): Promise<{ results: Array<{ id: string; title: string; content: string }> }> {
  return {
    results: [
      {
        id: 'mock-result-1',
        title: `Mock result for: ${params.query}`,
        content: 'Mock content'
      }
    ]
  };
}

/**
 * Adapter for Capability Awareness tools
 * TODO: Replace with proper CapabilityAwarenessMCPTools instance injection
 */
async function executeCapabilityAwarenessAdapter(toolName: string, params: Record<string, unknown>): Promise<CapabilityResult> {
  // Mock implementation - needs proper CapabilityAwarenessMCPTools instance
  return {
    capability_info: `Mock capability data for tool: ${toolName}`,
    context_id: String(params.context_id || params.observer_context_id || 'unknown'),
    analysis: 'Mock analysis result'
  };
}

// =============================================================================
// Response Processing Utilities
// =============================================================================

/**
 * Result of parsing LLM response
 */
interface ParsedResponse {
  raw: string;
  parsed?: unknown;
  isStructured: boolean;
  parseError?: string;
}

/**
 * Attempt to parse LLM response as JSON while handling common decorations
 * Based on Web research of LLM output patterns from OpenAI community
 * @param responseText Raw LLM response text
 * @returns ParsedResponse object with parsing results
 */
function tryParseStructuredResponse(responseText: string): ParsedResponse {
  const result: ParsedResponse = {
    raw: responseText,
    isStructured: false
  };

  // Clean the response by removing common LLM decorations
  let cleanedText = responseText.trim();
  
  // Pattern 1: Remove markdown code blocks (```json ... ```)
  cleanedText = cleanedText.replace(/^```json\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  
  // Pattern 2: Remove plaintext code blocks (```plaintext ... ```)
  cleanedText = cleanedText.replace(/^```plaintext\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  
  // Pattern 3: Remove generic code blocks (``` ... ```)
  cleanedText = cleanedText.replace(/^```\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  
  // Pattern 4: Remove common prefixes
  const prefixPatterns = [
    /^Response:\s*/i,
    /^Here is the JSON:\s*/i,
    /^JSON Response:\s*/i,
    /^Output:\s*/i,
    /^Result:\s*/i
  ];
  
  prefixPatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '');
  });
  
  // Final cleanup
  cleanedText = cleanedText.trim();

  // Skip parsing if response is clearly not JSON after cleaning
  if (!cleanedText.startsWith('{') && !cleanedText.startsWith('[')) {
    return result;
  }

  try {
    const parsed = JSON.parse(cleanedText);
    result.parsed = parsed;
    result.isStructured = true;
    
  } catch (error) {
    result.parseError = error instanceof Error ? error.message : 'JSON parse error';
    
    // Log parsing failures for monitoring (include cleaned text for debugging)
    console.error(`[ContextMemory] JSON parsing failed after cleaning: ${result.parseError}`);
    console.error(`[ContextMemory] Cleaned text: ${cleanedText.substring(0, 200)}...`);
  }

  return result;
}

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
  private createMessageCallback?: CreateMessageCallback;
  private promptMerger: PersonaPromptMerger;

  constructor(dbPath?: string) {
    this.db = new ContextMemoryDatabase(dbPath);
    // 最適化プロンプトを有効化（デフォルトで最適化版を使用）
    this.promptMerger = new PersonaPromptMerger(this.db.getDatabase(), {
      useOptimizedPrompts: true
    });
  }

  /**
   * Set the callback function for creating LLM messages (sampling)
   */
  setCreateMessageCallback(callback: CreateMessageCallback): void {
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
  private async handleContextManage(args: unknown): Promise<CallToolResult> {
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
        input.presetOverrides,
        this.db  // Pass database instance for dynamic preset lookup
      );

      const createdContext = this.db.createContext(context);

      // Optimized response - essential creation result only
      const optimizedOutput = {
        success: true,
        context: {
          id: createdContext.id,
          name: createdContext.name,
          personality: createdContext.personality.substring(0, 50) + (createdContext.personality.length > 50 ? '...' : ''),
          status: 'created'
        }
      };

      return {
        content: [
          { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
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

    // Optimized response - essential context summary only
    const optimizedOutput = {
      success: true,
      contexts: result.contexts.map(ctx => ({
        id: ctx.id,
        name: ctx.name,
        isExpired: isContextExpired(ctx)
      })),
      totalCount: result.totalCount,
      page: result.page
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
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

    // Optimized response - essential context details only
    const optimizedOutput = {
      success: true,
      context: {
        id: context.id,
        name: context.name,
        personality: context.personality.substring(0, 100) + (context.personality.length > 100 ? '...' : ''),
        temperature: context.temperature,
        maxTokens: context.maxTokens,
        isActive: context.isActive,
        expiresAt: context.expiresAt
      }
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
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

    // Optimized response - essential update confirmation only
    const optimizedOutput = {
      success: true,
      context: {
        id: savedContext.id,
        name: savedContext.name,
        personality: savedContext.personality.substring(0, 50) + (savedContext.personality.length > 50 ? '...' : ''),
        updatedAt: savedContext.updatedAt,
        status: 'updated'
      }
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
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

    // Optimized response - minimal deletion confirmation
    const optimizedOutput = {
      success: true,
      deleted: {
        id: input.contextId,
        status: 'deleted'
      }
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
      ]
    };
  }

  /**
   * Handle personality preset management operations
   */
  private async handlePersonalityPresetManage(args: unknown): Promise<CallToolResult> {
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

    // Optimized response - essential creation result only
    const optimizedOutput = {
      success: true,
      preset: {
        id: createdPreset.id,
        name: createdPreset.name,
        description: createdPreset.description.substring(0, 50) + (createdPreset.description.length > 50 ? '...' : ''),
        status: 'created'
      }
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
      ]
    };
  }

  private handlePresetList(input: PersonalityPresetManageInput): CallToolResult {
    const result = this.db.listPersonalityPresets({
      page: input.page || DEFAULT_VALUES.pagination.page,
      pageSize: input.pageSize || DEFAULT_VALUES.pagination.pageSize,
      includeInactive: input.includeInactive || false
    });

    // Optimized response - essential preset summary only
    const optimizedOutput = {
      success: true,
      presets: result.presets.map(preset => ({
        id: preset.id,
        name: preset.name,
        description: preset.description.substring(0, 50) + (preset.description.length > 50 ? '...' : ''),
        isActive: preset.isActive
      })),
      totalCount: result.totalCount,
      page: result.page
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
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

    // Optimized response - essential preset details only
    const optimizedOutput = {
      success: true,
      preset: {
        id: preset.id,
        name: preset.name,
        description: preset.description.substring(0, 100) + (preset.description.length > 100 ? '...' : ''),
        systemPrompt: preset.systemPrompt.substring(0, 200) + (preset.systemPrompt.length > 200 ? '...' : ''),
        defaultPersonality: preset.defaultPersonality.substring(0, 100) + (preset.defaultPersonality.length > 100 ? '...' : ''),
        isActive: preset.isActive,
        createdAt: preset.createdAt,
        updatedAt: preset.updatedAt
      }
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
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

    // Optimized response - essential update confirmation only
    const optimizedOutput = {
      success: true,
      preset: {
        id: savedPreset.id,
        name: savedPreset.name,
        description: savedPreset.description.substring(0, 50) + (savedPreset.description.length > 50 ? '...' : ''),
        updatedAt: savedPreset.updatedAt,
        status: 'updated'
      }
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
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

    // Optimized response - minimal deletion confirmation
    const optimizedOutput = {
      success: true,
      deleted: {
        id: input.presetId,
        status: 'deleted'
      }
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
      ]
    };
  }

  /**
   * Handle context chat operations
   */
  private async handleContextChat(args: unknown): Promise<CallToolResult> {
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

      // Build messages for LLM with enhanced prompt merging
      let systemPromptText: string;
      let availableTools: OpenAITool[] = [];
      
      if (input.maintainPersonality !== false) {
        // Step4マージ機能: PersonaPromptMergerを使用してプロンプトを最適化
        try {
          const basePrompt = `${context.systemPrompt}\n\nPersonality: ${context.personality}`;
          
          // 人格専用ツール（PATs: Persona Autonomous Tools）定義を追加
          availableTools = [
            {
              type: 'function',
              function: {
                name: 'pats_google_search',
                description: 'Search the web using Google search - persona autonomous tool',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Search query to perform'
                    },
                    numResults: {
                      type: 'number',
                      description: 'Number of results to return (1-10)',
                      minimum: 1,
                      maximum: 10
                    }
                  },
                  required: ['query']
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'pats_web_fetch',
                description: 'Fetch content from a web URL - persona autonomous tool',
                parameters: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string',
                      description: 'URL to fetch content from'
                    }
                  },
                  required: ['url']
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'pats_shared_memory_create',
                description: 'Create a shared memory item for team collaboration - persona autonomous tool',
                parameters: {
                  type: 'object',
                  properties: {
                    title: {
                      type: 'string',
                      description: 'Title of the memory item'
                    },
                    content: {
                      type: 'string',
                      description: 'Content of the memory item'
                    }
                  },
                  required: ['title', 'content']
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'pats_persona_inspect_capabilities',
                description: 'Inspect and analyze the capabilities of a specific persona context - persona autonomous tool',
                parameters: {
                  type: 'object',
                  properties: {
                    context_id: {
                      type: 'string',
                      description: 'Context ID of the persona to get capability information'
                    }
                  },
                  required: ['context_id']
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'pats_persona_evaluate_interaction',
                description: 'Enable observer persona to evaluate other personas capabilities - persona autonomous tool',
                parameters: {
                  type: 'object',
                  properties: {
                    observer_context_id: {
                      type: 'string',
                      description: 'Observer persona context ID'
                    },
                    target_context_id: {
                      type: 'string',
                      description: 'Target persona context ID to observe'
                    }
                  },
                  required: ['observer_context_id', 'target_context_id']
                }
              }
            }
          ];
          
          const mergeResult = await this.promptMerger.mergeSystemPrompt({
            contextId: input.contextId,
            userSystemPrompt: basePrompt,
            taskContext: input.message,
            availableTools, // ツール定義を追加
            compressionConfig: {
              level: 'light',
              preserveSecurityConstraints: true,
              maxTokens: context.maxTokens,
              compressionStrategy: 'ai_summary'
            }
          });
          
          // MergeResultかMergeErrorかを判定
          if ('mergedSystemPrompt' in mergeResult) {
            systemPromptText = mergeResult.mergedSystemPrompt;
          } else {
            // マージ失敗時は従来の方式を使用
            console.warn('Prompt merge failed, using fallback:', mergeResult.message);
            systemPromptText = basePrompt;
          }
        } catch (error) {
          // エラー時は従来の方式を使用
          console.warn('Prompt merge error, using fallback:', error);
          systemPromptText = `${context.systemPrompt}\n\nPersonality: ${context.personality}`;
        }
      } else {
        systemPromptText = context.systemPrompt;
      }

      // DEBUG: システムプロンプトをSTDERRに出力
      console.error('=== CONTEXT-CHAT SYSTEM PROMPT DEBUG ===');
      console.error(`Context ID: ${input.contextId}`);
      console.error(`Context Name: ${context.name}`);
      console.error(`Maintain Personality: ${input.maintainPersonality !== false}`);
      console.error('Generated System Prompt:');
      console.error('--- START SYSTEM PROMPT ---');
      console.error(systemPromptText);
      console.error('--- END SYSTEM PROMPT ---');
      console.error('==========================================');

      const messages = [
        {
          role: 'system' as const,
          content: {
            type: 'text' as const,
            text: systemPromptText
          }
        },
        ...conversationHistory.map(conv => ({
          role: conv.role as 'user' | 'assistant',
          content: {
            type: 'text' as const,
            text: conv.content
          }
        }))
      ];

      // Function Call loop implementation (max 5 iterations)
      // Note: Simple loop-based approach for handling Function Calls
      
      // Filter out system messages since we'll pass systemPrompt separately
      const userAssistantMessages = messages.filter(msg => msg.role !== 'system');
      const mcpMessages: { role: 'user' | 'assistant'; content: string }[] = userAssistantMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content.text
      }));
      
      const maxLoops = 5;
      let currentLoop = 0;
      let finalResponseText = '';
      let functionCallExecuted = false;
      
      while (currentLoop < maxLoops) {
        currentLoop++;
        
        const response = await this.createMessageCallback(mcpMessages, {
          maxTokens: context.maxTokens,
          temperature: context.temperature,
          tools: availableTools // Pass tools as OpenAI standard parameter
        }, systemPromptText); // Pass systemPrompt as separate parameter

        const responseText = (response as { content?: { text?: string } })?.content?.text || 'No response generated';
        
        // Parse structured response using existing parser
        const parsedResponse = tryParseStructuredResponse(responseText);
        
        // Check if this is an OpenAI standard tool call response
        const isOpenAIToolCallResponse = (obj: unknown): obj is { tool_calls: OpenAIToolCall[] } => {
          return typeof obj === 'object' && obj !== null &&
            'tool_calls' in obj &&
            Array.isArray((obj as { tool_calls: unknown }).tool_calls) &&
            (obj as { tool_calls: unknown[] }).tool_calls.every(call => isOpenAIToolCall(call));
        };
        
        // Check for tool calls in parsed response or raw response structure
        let toolCalls: OpenAIToolCall[] = [];
        let hasToolCalls = false;
        
        if (parsedResponse.isStructured && parsedResponse.parsed && isOpenAIToolCallResponse(parsedResponse.parsed)) {
          // Structured response with tool_calls
          toolCalls = parsedResponse.parsed.tool_calls;
          hasToolCalls = true;
        } else if (typeof parsedResponse.parsed === 'object' && parsedResponse.parsed !== null) {
          // Check if response has tool_calls property directly
          const responseObj = parsedResponse.parsed as Record<string, unknown>;
          if (Array.isArray(responseObj.tool_calls) && responseObj.tool_calls.every(call => isOpenAIToolCall(call))) {
            toolCalls = responseObj.tool_calls as OpenAIToolCall[];
            hasToolCalls = true;
          }
        }
        
        // Also check the raw response object in case it's not parsed as structured
        if (!hasToolCalls) {
          try {
            const rawParsed = JSON.parse(responseText);
            if (isOpenAIToolCallResponse(rawParsed)) {
              toolCalls = rawParsed.tool_calls;
              hasToolCalls = true;
            }
          } catch {
            // Not JSON, continue without tool calls
          }
        }
        
        if (hasToolCalls && toolCalls.length > 0 && currentLoop < maxLoops) {
          // Execute tool calls and add result to message history
          try {
            console.error('[Tool Call] Processing OpenAI standard tool calls:', toolCalls.length);
            
            // Process first tool call (expand to multiple later if needed)
            const toolCall = toolCalls[0];
            console.error('[Tool Call] Executing:', JSON.stringify(toolCall, null, 2));
            
            // Execute OpenAI standard tool call
            const functionResult = await executeOpenAIToolCall(toolCall);
            
            // Add assistant message (tool call response)
            mcpMessages.push({
              role: 'assistant',
              content: responseText
            });
            
            // Add function result as user message (MCP protocol standard)
            mcpMessages.push({
              role: 'user',
              content: `Tool result: ${JSON.stringify(functionResult, null, 2)}`
            });
            
            functionCallExecuted = true;
            continue; // Continue loop for next LLM call
          } catch (functionError) {
            console.error('[Tool Call] Function execution error:', functionError);
            // Function execution failed, treat as final response
            finalResponseText = responseText;
            break;
          }
        } else {
          // Regular response or max loops reached - end the loop
          finalResponseText = responseText;
          break;
        }
      }
      
      // Create assistant message with final response
      const assistantMessage = createConversation(input.contextId, 'assistant', finalResponseText);
      this.db.createConversation(assistantMessage);
      
      // Parse final response
      const finalParsedResponse = tryParseStructuredResponse(finalResponseText);

      // Optimized response - include parsed data if available
      const optimizedOutput = {
        response: finalParsedResponse.isStructured ? finalParsedResponse.parsed : finalResponseText,
        historyTokens: conversationHistory.reduce((sum, conv) => sum + conv.tokenCount, 0),
        truncated: wasTruncated,
        functionCallsExecuted: functionCallExecuted,
        loopsCompleted: currentLoop,
        ...(finalParsedResponse.isStructured && { 
          structured: true,
          raw: finalParsedResponse.raw 
        }),
        ...(finalParsedResponse.parseError && { 
          parseError: finalParsedResponse.parseError 
        })
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
  private async handleConversationManage(args: unknown): Promise<CallToolResult> {
    const input = ConversationManageInputSchema.parse(args);

    switch (input.action) {
      case 'list':
        return await this.handleConversationList(input);
      case 'delete':
        return this.handleConversationDelete(input);
      case 'clear':
        return this.handleConversationClear(input);
      default:
        throw new Error(`Unknown conversation action: ${input.action}`);
    }
  }

  private async handleConversationList(input: ConversationManageInput): Promise<CallToolResult> {
    const result = await this.db.getConversations(input.contextId, {
      page: input.page || DEFAULT_VALUES.pagination.page,
      pageSize: input.pageSize || DEFAULT_VALUES.pagination.conversationPageSize,
      reverse: input.reverse
    });

    // Optimized response - conversation summary only
    const optimizedOutput = {
      success: true,
      conversations: result.conversations.map(conv => ({
        id: conv.id,
        role: conv.role,
        preview: conv.content.substring(0, 50) + (conv.content.length > 50 ? '...' : ''),
        createdAt: conv.createdAt
      })),
      totalCount: result.totalCount,
      page: result.page
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
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

    // Optimized response - minimal deletion summary
    const optimizedOutput = {
      success: true,
      deleted: {
        count: deletedCount,
        status: 'deleted'
      }
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
      ]
    };
  }

  private handleConversationClear(input: ConversationManageInput): CallToolResult {
    const deletedCount = this.db.clearConversations(input.contextId);

    // Optimized response - minimal clear confirmation
    const optimizedOutput = {
      success: true,
      cleared: {
        contextId: input.contextId,
        count: deletedCount,
        status: 'cleared'
      }
    };

    return {
      content: [
        { type: 'text', text: JSON.stringify(optimizedOutput, null, 2) }
      ]
    };
  }
}
