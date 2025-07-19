/**
 * Context Memory System Core Utilities
 * 
 * Provides core functionality for context management, conversation handling,
 * token counting, and other essential operations.
 */

import { Context, Conversation, PersonalityPreset, DEFAULT_PERSONALITY_PRESETS, DEFAULT_VALUES } from '../types/index.js';

// =============================================================================
// Token Counting and Management
// =============================================================================

/**
 * Estimates token count for a text string
 * Based on OpenAI's rough estimation of ~4 characters per token
 */
export function estimateTokenCount(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  // Add some overhead for special tokens and formatting
  return Math.ceil(text.length / 3.5);
}

/**
 * Calculates total token count for a conversation array
 */
export function calculateConversationTokens(conversations: Conversation[]): number {
  return conversations.reduce((total, conv) => total + conv.tokenCount, 0);
}

/**
 * Truncates conversation history to fit within token limits
 * Preserves the most recent messages and always keeps system messages
 */
export function truncateConversationHistory(
  conversations: Conversation[],
  maxTokens: number
): { truncated: Conversation[]; wasTruncated: boolean } {
  if (conversations.length === 0) {
    return { truncated: [], wasTruncated: false };
  }

  // Sort by creation time (newest first) to preserve recent context
  const sorted = [...conversations].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Always preserve system messages
  const systemMessages = sorted.filter(conv => conv.role === 'system');
  const otherMessages = sorted.filter(conv => conv.role !== 'system');

  const systemTokens = calculateConversationTokens(systemMessages);
  let availableTokens = maxTokens - systemTokens;

  if (availableTokens <= 0) {
    // If system messages exceed limit, keep only the most recent system message
    const recentSystem = systemMessages.slice(0, 1);
    return { 
      truncated: recentSystem, 
      wasTruncated: systemMessages.length > 1 || otherMessages.length > 0 
    };
  }

  // Add other messages in reverse chronological order until we hit the limit
  const includedMessages: Conversation[] = [...systemMessages];
  let currentTokens = systemTokens;

  for (const message of otherMessages) {
    if (currentTokens + message.tokenCount <= maxTokens) {
      includedMessages.push(message);
      currentTokens += message.tokenCount;
    } else {
      break;
    }
  }

  // Sort back to chronological order for proper conversation flow
  const result = includedMessages.sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const wasTruncated = result.length < conversations.length;

  return { truncated: result, wasTruncated };
}

// =============================================================================
// Context Management
// =============================================================================

/**
 * Generates a unique context ID
 */
export function generateContextId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `context-${timestamp}-${random}`;
}

/**
 * Creates a new context with validation
 */
export function createContext(input: {
  name: string;
  systemPrompt: string;
  personality?: string;
  temperature?: number;
  maxTokens?: number;
  maxHistoryTokens?: number;
  expiryDays?: number;
}): Context {
  const now = new Date().toISOString();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + (input.expiryDays || DEFAULT_VALUES.context.expiryDays));

  return {
    id: generateContextId(),
    name: input.name.trim(),
    systemPrompt: input.systemPrompt.trim(),
    personality: input.personality?.trim() || 'Custom personality context',
    temperature: Math.max(0, Math.min(1, input.temperature || DEFAULT_VALUES.context.temperature)),
    maxTokens: Math.max(1, input.maxTokens || DEFAULT_VALUES.context.maxTokens),
    maxHistoryTokens: Math.max(1000, input.maxHistoryTokens || DEFAULT_VALUES.context.maxHistoryTokens),
    expiryDays: Math.max(1, input.expiryDays || DEFAULT_VALUES.context.expiryDays),
    createdAt: now,
    updatedAt: now,
    expiresAt: expiryDate.toISOString(),
    isActive: true
  };
}

/**
 * Creates a context from a personality preset with optional overrides
 * Supports both static (DEFAULT_PERSONALITY_PRESETS) and dynamic (database) presets
 */
export function createContextFromPreset(
  presetId: string,
  name: string,
  overrides?: {
    temperature?: number;
    maxTokens?: number;
    maxHistoryTokens?: number;
    expiryDays?: number;
  },
  database?: any  // Optional database instance for dynamic preset lookup
): Context {
  // First, try to find in static presets
  const staticPreset = DEFAULT_PERSONALITY_PRESETS[presetId as keyof typeof DEFAULT_PERSONALITY_PRESETS];
  
  if (staticPreset) {
    return createContext({
      name,
      systemPrompt: staticPreset.systemPrompt,
      personality: staticPreset.defaultPersonality,
      temperature: overrides?.temperature || staticPreset.defaultSettings.temperature,
      maxTokens: overrides?.maxTokens || staticPreset.defaultSettings.maxTokens,
      maxHistoryTokens: overrides?.maxHistoryTokens || staticPreset.defaultSettings.maxHistoryTokens,
      expiryDays: overrides?.expiryDays || staticPreset.defaultSettings.expiryDays
    });
  }

  // If not found in static presets and database provided, try dynamic presets
  if (database) {
    const dynamicPreset = database.getPersonalityPreset(presetId);
    if (dynamicPreset) {
      const defaultSettings = dynamicPreset.defaultSettings ? JSON.parse(dynamicPreset.defaultSettings) : {};
      return createContext({
        name,
        systemPrompt: dynamicPreset.systemPrompt,
        personality: dynamicPreset.defaultPersonality,
        temperature: overrides?.temperature || defaultSettings.temperature || DEFAULT_VALUES.context.temperature,
        maxTokens: overrides?.maxTokens || defaultSettings.maxTokens || DEFAULT_VALUES.context.maxTokens,
        maxHistoryTokens: overrides?.maxHistoryTokens || defaultSettings.maxHistoryTokens || DEFAULT_VALUES.context.maxHistoryTokens,
        expiryDays: overrides?.expiryDays || defaultSettings.expiryDays || DEFAULT_VALUES.context.expiryDays
      });
    }
  }

  throw new Error(`Unknown personality preset: ${presetId}`);
}

/**
 * Updates an existing context with validation
 */
export function updateContext(context: Context, updates: Partial<Context>): Context {
  const updatedContext = { ...context };

  if (updates.name !== undefined) {
    updatedContext.name = updates.name.trim();
  }
  
  if (updates.systemPrompt !== undefined) {
    updatedContext.systemPrompt = updates.systemPrompt.trim();
  }
  
  if (updates.personality !== undefined) {
    updatedContext.personality = updates.personality.trim();
  }
  
  if (updates.temperature !== undefined) {
    updatedContext.temperature = Math.max(0, Math.min(1, updates.temperature));
  }
  
  if (updates.maxTokens !== undefined) {
    updatedContext.maxTokens = Math.max(1, updates.maxTokens);
  }
  
  if (updates.maxHistoryTokens !== undefined) {
    updatedContext.maxHistoryTokens = Math.max(1000, updates.maxHistoryTokens);
  }
  
  if (updates.expiryDays !== undefined) {
    updatedContext.expiryDays = Math.max(1, updates.expiryDays);
    // Recalculate expiry date
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + updatedContext.expiryDays);
    updatedContext.expiresAt = newExpiryDate.toISOString();
  }
  
  if (updates.isActive !== undefined) {
    updatedContext.isActive = updates.isActive;
  }

  updatedContext.updatedAt = new Date().toISOString();
  
  return updatedContext;
}

/**
 * Checks if a context has expired
 */
export function isContextExpired(context: Context): boolean {
  return new Date() > new Date(context.expiresAt);
}

// =============================================================================
// Conversation Management
// =============================================================================

/**
 * Generates a unique conversation ID
 */
export function generateConversationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `conv-${timestamp}-${random}`;
}

/**
 * Creates a new conversation message
 */
export function createConversation(
  contextId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Conversation {
  return {
    id: generateConversationId(),
    contextId,
    role,
    content: content.trim(),
    tokenCount: estimateTokenCount(content),
    createdAt: new Date().toISOString()
  };
}

// =============================================================================
// Personality Preset Management
// =============================================================================

/**
 * Generates a unique preset ID
 */
export function generatePresetId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `preset-${timestamp}-${random}`;
}

/**
 * Creates a new personality preset with validation
 */
export function createPersonalityPreset(input: {
  name: string;
  description: string;
  systemPrompt: string;
  defaultPersonality: string;
  defaultSettings?: {
    temperature?: number;
    maxTokens?: number;
    maxHistoryTokens?: number;
    expiryDays?: number;
  };
  metadata?: Record<string, any>;
}): PersonalityPreset {
  const now = new Date().toISOString();

  return {
    id: generatePresetId(),
    name: input.name.trim(),
    description: input.description.trim(),
    systemPrompt: input.systemPrompt.trim(),
    defaultPersonality: input.defaultPersonality.trim(),
    defaultSettings: {
      temperature: Math.max(0, Math.min(1, input.defaultSettings?.temperature || DEFAULT_VALUES.preset.temperature)),
      maxTokens: Math.max(1, input.defaultSettings?.maxTokens || DEFAULT_VALUES.preset.maxTokens),
      maxHistoryTokens: Math.max(1000, input.defaultSettings?.maxHistoryTokens || DEFAULT_VALUES.preset.maxHistoryTokens),
      expiryDays: Math.max(1, input.defaultSettings?.expiryDays || DEFAULT_VALUES.preset.expiryDays)
    },
    createdAt: now,
    updatedAt: now,
    isActive: true,
    metadata: input.metadata || {}
  };
}

/**
 * Updates an existing personality preset with validation
 */
export function updatePersonalityPreset(preset: PersonalityPreset, updates: Partial<PersonalityPreset>): PersonalityPreset {
  const updatedPreset = { ...preset };

  if (updates.name !== undefined) {
    updatedPreset.name = updates.name.trim();
  }
  
  if (updates.description !== undefined) {
    updatedPreset.description = updates.description.trim();
  }
  
  if (updates.systemPrompt !== undefined) {
    updatedPreset.systemPrompt = updates.systemPrompt.trim();
  }
  
  if (updates.defaultPersonality !== undefined) {
    updatedPreset.defaultPersonality = updates.defaultPersonality.trim();
  }
  
  if (updates.defaultSettings !== undefined) {
    updatedPreset.defaultSettings = {
      temperature: updates.defaultSettings.temperature !== undefined 
        ? Math.max(0, Math.min(1, updates.defaultSettings.temperature))
        : updatedPreset.defaultSettings.temperature,
      maxTokens: updates.defaultSettings.maxTokens !== undefined
        ? Math.max(1, updates.defaultSettings.maxTokens)
        : updatedPreset.defaultSettings.maxTokens,
      maxHistoryTokens: updates.defaultSettings.maxHistoryTokens !== undefined
        ? Math.max(1000, updates.defaultSettings.maxHistoryTokens)
        : updatedPreset.defaultSettings.maxHistoryTokens,
      expiryDays: updates.defaultSettings.expiryDays !== undefined
        ? Math.max(1, updates.defaultSettings.expiryDays)
        : updatedPreset.defaultSettings.expiryDays
    };
  }
  
  if (updates.isActive !== undefined) {
    updatedPreset.isActive = updates.isActive;
  }
  
  if (updates.metadata !== undefined) {
    updatedPreset.metadata = updates.metadata;
  }

  updatedPreset.updatedAt = new Date().toISOString();
  
  return updatedPreset;
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Validates context input parameters
 */
export function validateContextInput(input: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  }

  if (!input.systemPrompt || typeof input.systemPrompt !== 'string' || input.systemPrompt.trim().length === 0) {
    errors.push('System prompt is required and must be a non-empty string');
  }

  if (input.temperature !== undefined && (typeof input.temperature !== 'number' || input.temperature < 0 || input.temperature > 1)) {
    errors.push('Temperature must be a number between 0 and 1');
  }

  if (input.maxTokens !== undefined && (typeof input.maxTokens !== 'number' || input.maxTokens < 1)) {
    errors.push('maxTokens must be a positive number');
  }

  if (input.maxHistoryTokens !== undefined && (typeof input.maxHistoryTokens !== 'number' || input.maxHistoryTokens < 1000)) {
    errors.push('maxHistoryTokens must be at least 1000');
  }

  if (input.expiryDays !== undefined && (typeof input.expiryDays !== 'number' || input.expiryDays < 1)) {
    errors.push('expiryDays must be a positive number');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates preset input parameters
 */
export function validatePresetInput(input: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  }

  if (!input.description || typeof input.description !== 'string' || input.description.trim().length === 0) {
    errors.push('Description is required and must be a non-empty string');
  }

  if (!input.systemPrompt || typeof input.systemPrompt !== 'string' || input.systemPrompt.trim().length === 0) {
    errors.push('System prompt is required and must be a non-empty string');
  }

  if (!input.defaultPersonality || typeof input.defaultPersonality !== 'string' || input.defaultPersonality.trim().length === 0) {
    errors.push('Default personality is required and must be a non-empty string');
  }

  return { isValid: errors.length === 0, errors };
}

// =============================================================================
// List Management and Pagination
// =============================================================================

/**
 * Applies pagination to an array of items
 */
export function paginate<T>(items: T[], page: number, pageSize: number): {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
} {
  const totalCount = items.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = items.slice(startIndex, endIndex);

  return {
    items: paginatedItems,
    totalCount,
    page,
    pageSize,
    hasNext: endIndex < totalCount,
    hasPrev: page > 1
  };
}

/**
 * Filters contexts based on criteria
 */
export function filterContexts(
  contexts: Context[],
  criteria: {
    includeExpired?: boolean;
    nameSearch?: string;
    isActive?: boolean;
  } = {}
): Context[] {
  return contexts.filter(context => {
    // Filter by expiry
    if (!criteria.includeExpired && isContextExpired(context)) {
      return false;
    }

    // Filter by active status
    if (criteria.isActive !== undefined && context.isActive !== criteria.isActive) {
      return false;
    }

    // Filter by name search
    if (criteria.nameSearch && !context.name.toLowerCase().includes(criteria.nameSearch.toLowerCase())) {
      return false;
    }

    return true;
  });
}

/**
 * Filters presets based on criteria
 */
export function filterPresets(
  presets: PersonalityPreset[],
  criteria: {
    includeInactive?: boolean;
    nameSearch?: string;
  } = {}
): PersonalityPreset[] {
  return presets.filter(preset => {
    // Filter by active status
    if (!criteria.includeInactive && !preset.isActive) {
      return false;
    }

    // Filter by name search
    if (criteria.nameSearch && !preset.name.toLowerCase().includes(criteria.nameSearch.toLowerCase())) {
      return false;
    }

    return true;
  });
}
