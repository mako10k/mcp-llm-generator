/**
 * Context Memory System Database Layer
 *
 * Provides SQLite database operations for contexts, conversations, and personality presets.
 * Uses better-sqlite3 for synchronous database operations with proper transaction support.
 */
import { Context, Conversation, PersonalityPreset } from '../types/index.js';
export declare class ContextMemoryDatabase {
    private db;
    constructor(dbPath?: string);
    /**
     * Initialize database schema with proper indexes
     */
    private initializeSchema;
    /**
     * Seed database with default personality presets
     */
    private seedDefaultPresets;
    /**
     * Close database connection
     */
    close(): void;
    /**
     * Create a new context
     */
    createContext(context: Context): Context;
    /**
     * Get context by ID
     */
    getContext(id: string): Context | null;
    /**
     * Update an existing context
     */
    updateContext(context: Context): Context;
    /**
     * Delete a context and all its conversations
     */
    deleteContext(id: string): boolean;
    /**
     * List contexts with filtering and pagination
     */
    listContexts(options?: {
        page?: number;
        pageSize?: number;
        includeExpired?: boolean;
        nameSearch?: string;
        isActive?: boolean;
    }): {
        contexts: Context[];
        totalCount: number;
        page: number;
        pageSize: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    /**
     * Create a new conversation message
     */
    createConversation(conversation: Conversation): Conversation;
    /**
     * Get conversations for a context
     */
    getConversations(contextId: string, options?: {
        page?: number;
        pageSize?: number;
        reverse?: boolean;
    }): {
        conversations: Conversation[];
        totalCount: number;
        page: number;
        pageSize: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    /**
     * Get all conversations for a context (for chat history)
     */
    getAllConversations(contextId: string): Conversation[];
    /**
     * Delete conversations by IDs
     */
    deleteConversations(conversationIds: string[]): number;
    /**
     * Delete conversations older than a specific date
     */
    deleteConversationsOlderThan(contextId: string, olderThan: string): number;
    /**
     * Clear all conversations for a context
     */
    clearConversations(contextId: string): number;
    /**
     * Create a new personality preset
     */
    createPersonalityPreset(preset: PersonalityPreset): PersonalityPreset;
    /**
     * Get personality preset by ID
     */
    getPersonalityPreset(id: string): PersonalityPreset | null;
    /**
     * Update an existing personality preset
     */
    updatePersonalityPreset(preset: PersonalityPreset): PersonalityPreset;
    /**
     * Delete a personality preset
     */
    deletePersonalityPreset(id: string): boolean;
    /**
     * List personality presets with filtering and pagination
     */
    listPersonalityPresets(options?: {
        page?: number;
        pageSize?: number;
        includeInactive?: boolean;
        nameSearch?: string;
    }): {
        presets: PersonalityPreset[];
        totalCount: number;
        page: number;
        pageSize: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    /**
     * Delete expired contexts and their conversations
     */
    cleanupExpiredContexts(): number;
    /**
     * Get database statistics
     */
    getStatistics(): {
        totalContexts: number;
        activeContexts: number;
        expiredContexts: number;
        totalConversations: number;
        totalPresets: number;
        activePresets: number;
    };
    /**
     * Convert database row to Context object
     */
    private rowToContext;
    /**
     * Convert database row to Conversation object
     */
    private rowToConversation;
    /**
     * Convert database row to PersonalityPreset object
     */
    private rowToPersonalityPreset;
}
