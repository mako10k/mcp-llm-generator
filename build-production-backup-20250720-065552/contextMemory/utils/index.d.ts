/**
 * Context Memory System Core Utilities
 *
 * Provides core functionality for context management, conversation handling,
 * token counting, and other essential operations.
 */
import { Context, Conversation, PersonalityPreset } from '../types/index.js';
/**
 * Estimates token count for a text string
 * Based on OpenAI's rough estimation of ~4 characters per token
 */
export declare function estimateTokenCount(text: string): number;
/**
 * Calculates total token count for a conversation array
 */
export declare function calculateConversationTokens(conversations: Conversation[]): number;
/**
 * Truncates conversation history to fit within token limits
 * Preserves the most recent messages and always keeps system messages
 */
export declare function truncateConversationHistory(conversations: Conversation[], maxTokens: number): {
    truncated: Conversation[];
    wasTruncated: boolean;
};
/**
 * Generates a unique context ID
 */
export declare function generateContextId(): string;
/**
 * Creates a new context with validation
 */
export declare function createContext(input: {
    name: string;
    systemPrompt: string;
    personality?: string;
    temperature?: number;
    maxTokens?: number;
    maxHistoryTokens?: number;
    expiryDays?: number;
}): Context;
/**
 * Creates a context from a personality preset with optional overrides
 * Supports both static (DEFAULT_PERSONALITY_PRESETS) and dynamic (database) presets
 */
export declare function createContextFromPreset(presetId: string, name: string, overrides?: {
    temperature?: number;
    maxTokens?: number;
    maxHistoryTokens?: number;
    expiryDays?: number;
}, database?: any): Context;
/**
 * Updates an existing context with validation
 */
export declare function updateContext(context: Context, updates: Partial<Context>): Context;
/**
 * Checks if a context has expired
 */
export declare function isContextExpired(context: Context): boolean;
/**
 * Generates a unique conversation ID
 */
export declare function generateConversationId(): string;
/**
 * Creates a new conversation message
 */
export declare function createConversation(contextId: string, role: 'user' | 'assistant' | 'system', content: string): Conversation;
/**
 * Generates a unique preset ID
 */
export declare function generatePresetId(): string;
/**
 * Creates a new personality preset with validation
 */
export declare function createPersonalityPreset(input: {
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
}): PersonalityPreset;
/**
 * Updates an existing personality preset with validation
 */
export declare function updatePersonalityPreset(preset: PersonalityPreset, updates: Partial<PersonalityPreset>): PersonalityPreset;
/**
 * Validates context input parameters
 */
export declare function validateContextInput(input: any): {
    isValid: boolean;
    errors: string[];
};
/**
 * Validates preset input parameters
 */
export declare function validatePresetInput(input: any): {
    isValid: boolean;
    errors: string[];
};
/**
 * Applies pagination to an array of items
 */
export declare function paginate<T>(items: T[], page: number, pageSize: number): {
    items: T[];
    totalCount: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrev: boolean;
};
/**
 * Filters contexts based on criteria
 */
export declare function filterContexts(contexts: Context[], criteria?: {
    includeExpired?: boolean;
    nameSearch?: string;
    isActive?: boolean;
}): Context[];
/**
 * Filters presets based on criteria
 */
export declare function filterPresets(presets: PersonalityPreset[], criteria?: {
    includeInactive?: boolean;
    nameSearch?: string;
}): PersonalityPreset[];
