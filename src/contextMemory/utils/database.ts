/**
 * Context Memory System Database Layer
 * 
 * Provides SQLite database operations for contexts, conversations, and personality presets.
 * Uses better-sqlite3 for synchronous database operations with proper transaction support.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { Context, Conversation, PersonalityPreset, DEFAULT_PERSONALITY_PRESETS } from '../types/index.js';
import { paginate, filterContexts, filterPresets } from '../utils/index.js';

// =============================================================================
// Database Connection and Schema
// =============================================================================

export class ContextMemoryDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    // Default to SQLite file in project root, or use in-memory for testing
    const defaultPath = dbPath || path.join(process.cwd(), 'context-memory.db');
    this.db = new Database(defaultPath);
    
    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');

    this.initializeSchema();
    this.seedDefaultPresets();
  }

  /**
   * Initialize database schema with proper indexes
   */
  private initializeSchema(): void {
    // Contexts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contexts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        personality TEXT NOT NULL,
        temperature REAL NOT NULL DEFAULT 0.7,
        max_tokens INTEGER NOT NULL DEFAULT 1000,
        max_history_tokens INTEGER NOT NULL DEFAULT 15000,
        expiry_days INTEGER NOT NULL DEFAULT 7,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      )
    `);

    // Conversations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        context_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        token_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (context_id) REFERENCES contexts (id) ON DELETE CASCADE
      )
    `);

    // Personality presets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS personality_presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        default_personality TEXT NOT NULL,
        default_temperature REAL NOT NULL DEFAULT 0.7,
        default_max_tokens INTEGER NOT NULL DEFAULT 1000,
        default_max_history_tokens INTEGER NOT NULL DEFAULT 15000,
        default_expiry_days INTEGER NOT NULL DEFAULT 7,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        metadata TEXT DEFAULT '{}'
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_contexts_active ON contexts (is_active);
      CREATE INDEX IF NOT EXISTS idx_contexts_expires_at ON contexts (expires_at);
      CREATE INDEX IF NOT EXISTS idx_contexts_name ON contexts (name);
      
      CREATE INDEX IF NOT EXISTS idx_conversations_context_id ON conversations (context_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations (created_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_role ON conversations (role);
      
      CREATE INDEX IF NOT EXISTS idx_presets_active ON personality_presets (is_active);
      CREATE INDEX IF NOT EXISTS idx_presets_name ON personality_presets (name);
    `);
  }

  /**
   * Seed database with default personality presets
   */
  private seedDefaultPresets(): void {
    const insertPreset = this.db.prepare(`
      INSERT OR IGNORE INTO personality_presets (
        id, name, description, system_prompt, default_personality,
        default_temperature, default_max_tokens, default_max_history_tokens, default_expiry_days,
        created_at, updated_at, is_active, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    for (const [key, preset] of Object.entries(DEFAULT_PERSONALITY_PRESETS)) {
      insertPreset.run(
        preset.id,
        preset.name,
        preset.description,
        preset.systemPrompt,
        preset.defaultPersonality,
        preset.defaultSettings.temperature,
        preset.defaultSettings.maxTokens,
        preset.defaultSettings.maxHistoryTokens,
        preset.defaultSettings.expiryDays,
        now,
        now,
        1,
        JSON.stringify({})
      );
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  // =============================================================================
  // Context Operations
  // =============================================================================

  /**
   * Create a new context
   */
  createContext(context: Context): Context {
    const stmt = this.db.prepare(`
      INSERT INTO contexts (
        id, name, system_prompt, personality, temperature, max_tokens,
        max_history_tokens, expiry_days, created_at, updated_at, expires_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      context.id,
      context.name,
      context.systemPrompt,
      context.personality,
      context.temperature,
      context.maxTokens,
      context.maxHistoryTokens,
      context.expiryDays,
      context.createdAt,
      context.updatedAt,
      context.expiresAt,
      context.isActive ? 1 : 0
    );

    return context;
  }

  /**
   * Get context by ID
   */
  getContext(id: string): Context | null {
    const stmt = this.db.prepare(`
      SELECT * FROM contexts WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.rowToContext(row);
  }

  /**
   * Update an existing context
   */
  updateContext(context: Context): Context {
    const stmt = this.db.prepare(`
      UPDATE contexts SET
        name = ?, system_prompt = ?, personality = ?, temperature = ?,
        max_tokens = ?, max_history_tokens = ?, expiry_days = ?,
        updated_at = ?, expires_at = ?, is_active = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      context.name,
      context.systemPrompt,
      context.personality,
      context.temperature,
      context.maxTokens,
      context.maxHistoryTokens,
      context.expiryDays,
      context.updatedAt,
      context.expiresAt,
      context.isActive ? 1 : 0,
      context.id
    );

    if (result.changes === 0) {
      throw new Error(`Context with id ${context.id} not found`);
    }

    return context;
  }

  /**
   * Delete a context and all its conversations
   */
  deleteContext(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM contexts WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * List contexts with filtering and pagination
   */
  listContexts(options: {
    page?: number;
    pageSize?: number;
    includeExpired?: boolean;
    nameSearch?: string;
    isActive?: boolean;
  } = {}): {
    contexts: Context[];
    totalCount: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;

    // Build WHERE clause based on filters
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (!options.includeExpired) {
      whereClauses.push('datetime(expires_at) > datetime(\'now\')');
    }

    if (options.isActive !== undefined) {
      whereClauses.push('is_active = ?');
      params.push(options.isActive ? 1 : 0);
    }

    if (options.nameSearch) {
      whereClauses.push('name LIKE ?');
      params.push(`%${options.nameSearch}%`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM contexts ${whereClause}`);
    const { count: totalCount } = countStmt.get(...params) as { count: number };

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const listStmt = this.db.prepare(`
      SELECT * FROM contexts ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = listStmt.all(...params, pageSize, offset) as any[];
    const contexts = rows.map(row => this.rowToContext(row));

    return {
      contexts,
      totalCount,
      page,
      pageSize,
      hasNext: offset + pageSize < totalCount,
      hasPrev: page > 1
    };
  }

  // =============================================================================
  // Conversation Operations
  // =============================================================================

  /**
   * Create a new conversation message
   */
  createConversation(conversation: Conversation): Conversation {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, context_id, role, content, token_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      conversation.id,
      conversation.contextId,
      conversation.role,
      conversation.content,
      conversation.tokenCount,
      conversation.createdAt
    );

    return conversation;
  }

  /**
   * Get conversations for a context
   */
  getConversations(contextId: string, options: {
    page?: number;
    pageSize?: number;
    reverse?: boolean;
  } = {}): {
    conversations: Conversation[];
    totalCount: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const orderBy = options.reverse !== false ? 'DESC' : 'ASC';

    // Get total count
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM conversations WHERE context_id = ?
    `);
    const { count: totalCount } = countStmt.get(contextId) as { count: number };

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const listStmt = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE context_id = ?
      ORDER BY created_at ${orderBy}
      LIMIT ? OFFSET ?
    `);

    const rows = listStmt.all(contextId, pageSize, offset) as any[];
    const conversations = rows.map(row => this.rowToConversation(row));

    return {
      conversations,
      totalCount,
      page,
      pageSize,
      hasNext: offset + pageSize < totalCount,
      hasPrev: page > 1
    };
  }

  /**
   * Get all conversations for a context (for chat history)
   */
  getAllConversations(contextId: string): Conversation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE context_id = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(contextId) as any[];
    return rows.map(row => this.rowToConversation(row));
  }

  /**
   * Delete conversations by IDs
   */
  deleteConversations(conversationIds: string[]): number {
    if (conversationIds.length === 0) return 0;

    const placeholders = conversationIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM conversations WHERE id IN (${placeholders})`);
    const result = stmt.run(...conversationIds);
    return result.changes;
  }

  /**
   * Delete conversations older than a specific date
   */
  deleteConversationsOlderThan(contextId: string, olderThan: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM conversations 
      WHERE context_id = ? AND datetime(created_at) < datetime(?)
    `);
    const result = stmt.run(contextId, olderThan);
    return result.changes;
  }

  /**
   * Clear all conversations for a context
   */
  clearConversations(contextId: string): number {
    const stmt = this.db.prepare(`DELETE FROM conversations WHERE context_id = ?`);
    const result = stmt.run(contextId);
    return result.changes;
  }

  // =============================================================================
  // Personality Preset Operations
  // =============================================================================

  /**
   * Create a new personality preset
   */
  createPersonalityPreset(preset: PersonalityPreset): PersonalityPreset {
    const stmt = this.db.prepare(`
      INSERT INTO personality_presets (
        id, name, description, system_prompt, default_personality,
        default_temperature, default_max_tokens, default_max_history_tokens, default_expiry_days,
        created_at, updated_at, is_active, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      preset.id,
      preset.name,
      preset.description,
      preset.systemPrompt,
      preset.defaultPersonality,
      preset.defaultSettings.temperature,
      preset.defaultSettings.maxTokens,
      preset.defaultSettings.maxHistoryTokens,
      preset.defaultSettings.expiryDays,
      preset.createdAt,
      preset.updatedAt,
      preset.isActive ? 1 : 0,
      JSON.stringify(preset.metadata || {})
    );

    return preset;
  }

  /**
   * Get personality preset by ID
   */
  getPersonalityPreset(id: string): PersonalityPreset | null {
    const stmt = this.db.prepare(`
      SELECT * FROM personality_presets WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.rowToPersonalityPreset(row);
  }

  /**
   * Update an existing personality preset
   */
  updatePersonalityPreset(preset: PersonalityPreset): PersonalityPreset {
    const stmt = this.db.prepare(`
      UPDATE personality_presets SET
        name = ?, description = ?, system_prompt = ?, default_personality = ?,
        default_temperature = ?, default_max_tokens = ?, default_max_history_tokens = ?, default_expiry_days = ?,
        updated_at = ?, is_active = ?, metadata = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      preset.name,
      preset.description,
      preset.systemPrompt,
      preset.defaultPersonality,
      preset.defaultSettings.temperature,
      preset.defaultSettings.maxTokens,
      preset.defaultSettings.maxHistoryTokens,
      preset.defaultSettings.expiryDays,
      preset.updatedAt,
      preset.isActive ? 1 : 0,
      JSON.stringify(preset.metadata || {}),
      preset.id
    );

    if (result.changes === 0) {
      throw new Error(`Personality preset with id ${preset.id} not found`);
    }

    return preset;
  }

  /**
   * Delete a personality preset
   */
  deletePersonalityPreset(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM personality_presets WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * List personality presets with filtering and pagination
   */
  listPersonalityPresets(options: {
    page?: number;
    pageSize?: number;
    includeInactive?: boolean;
    nameSearch?: string;
  } = {}): {
    presets: PersonalityPreset[];
    totalCount: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;

    // Build WHERE clause based on filters
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (!options.includeInactive) {
      whereClauses.push('is_active = 1');
    }

    if (options.nameSearch) {
      whereClauses.push('name LIKE ?');
      params.push(`%${options.nameSearch}%`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM personality_presets ${whereClause}`);
    const { count: totalCount } = countStmt.get(...params) as { count: number };

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const listStmt = this.db.prepare(`
      SELECT * FROM personality_presets ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = listStmt.all(...params, pageSize, offset) as any[];
    const presets = rows.map(row => this.rowToPersonalityPreset(row));

    return {
      presets,
      totalCount,
      page,
      pageSize,
      hasNext: offset + pageSize < totalCount,
      hasPrev: page > 1
    };
  }

  // =============================================================================
  // Cleanup Operations
  // =============================================================================

  /**
   * Delete expired contexts and their conversations
   */
  cleanupExpiredContexts(): number {
    const stmt = this.db.prepare(`
      DELETE FROM contexts 
      WHERE datetime(expires_at) <= datetime('now')
    `);
    const result = stmt.run();
    return result.changes;
  }

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
  } {
    const stats = {
      totalContexts: 0,
      activeContexts: 0,
      expiredContexts: 0,
      totalConversations: 0,
      totalPresets: 0,
      activePresets: 0
    };

    // Context statistics
    const contextStatsStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN datetime(expires_at) <= datetime('now') THEN 1 ELSE 0 END) as expired
      FROM contexts
    `);
    const contextStats = contextStatsStmt.get() as any;
    stats.totalContexts = contextStats.total;
    stats.activeContexts = contextStats.active;
    stats.expiredContexts = contextStats.expired;

    // Conversation statistics
    const conversationStatsStmt = this.db.prepare(`SELECT COUNT(*) as total FROM conversations`);
    const conversationStats = conversationStatsStmt.get() as any;
    stats.totalConversations = conversationStats.total;

    // Preset statistics
    const presetStatsStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
      FROM personality_presets
    `);
    const presetStats = presetStatsStmt.get() as any;
    stats.totalPresets = presetStats.total;
    stats.activePresets = presetStats.active;

    return stats;
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Convert database row to Context object
   */
  private rowToContext(row: any): Context {
    return {
      id: row.id,
      name: row.name,
      systemPrompt: row.system_prompt,
      personality: row.personality,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      maxHistoryTokens: row.max_history_tokens,
      expiryDays: row.expiry_days,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      isActive: row.is_active === 1
    };
  }

  /**
   * Convert database row to Conversation object
   */
  private rowToConversation(row: any): Conversation {
    return {
      id: row.id,
      contextId: row.context_id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      tokenCount: row.token_count,
      createdAt: row.created_at
    };
  }

  /**
   * Convert database row to PersonalityPreset object
   */
  private rowToPersonalityPreset(row: any): PersonalityPreset {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      systemPrompt: row.system_prompt,
      defaultPersonality: row.default_personality,
      defaultSettings: {
        temperature: row.default_temperature,
        maxTokens: row.default_max_tokens,
        maxHistoryTokens: row.default_max_history_tokens,
        expiryDays: row.default_expiry_days
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active === 1,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }
}
