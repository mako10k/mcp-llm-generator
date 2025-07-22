/**
 * Database Row Type Definitions
 * 
 * Provides strict TypeScript types for better-sqlite3 database row results,
 * eliminating any type usage throughout the contextMemory database layer.
 */

/**
 * Context table row structure
 */
export interface ContextRow {
  id: string;
  name: string;
  system_prompt: string;
  personality: string;
  temperature: number;
  max_tokens: number;
  max_history_tokens: number;
  expiry_days: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  is_active: number;
}

/**
 * Conversation table row structure
 */
export interface ConversationRow {
  id: string;
  context_id: string;
  role: string;
  content: string;
  token_count: number;
  created_at: string;
}

/**
 * Personality preset table row structure
 */
export interface PersonalityPresetRow {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  default_personality: string;
  default_temperature: number;
  default_max_tokens: number;
  default_max_history_tokens: number;
  default_expiry_days: number;
  created_at: string;
  updated_at: string;
  is_active: number;
  metadata: string;
}

/**
 * Statistics query result structure
 */
export interface ContextStatsRow {
  total: number;
  active: number;
  expired: number;
}

export interface ConversationStatsRow {
  total: number;
}

export interface PresetStatsRow {
  total: number;
  active: number;
}

export interface CountRow {
  count: number;
}

/**
 * Filter parameters with strict typing
 */
export interface ListContextFilters {
  page?: number;
  pageSize?: number;
  includeExpired?: boolean;
  nameSearch?: string;
  isActive?: boolean;
}

export interface ListConversationFilters {
  page?: number;
  pageSize?: number;
  reverse?: boolean;
}

export interface ListPresetFilters {
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
  nameSearch?: string;
}
