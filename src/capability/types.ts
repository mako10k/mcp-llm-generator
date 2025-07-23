/**
 * Type definitions for CapabilityAwarenessService
 * 
 * Provides strict TypeScript types for prepared SQL statements
 * and database query operations.
 */

import Database from 'better-sqlite3';

/**
 * Database result types
 */
export interface PersonaCapabilityRow {
  context_id: string;
  expertise: string;
  tools: string;
  restrictions: string;
  performance_metrics?: string;
  learning_capabilities?: string;
  is_public: number;
  created_at: string;
  updated_at: string;
}

export interface HierarchyRow {
  ancestor_id: string;
  descendant_id: string;
  depth: number;
}

export interface PersonaRow {
  id: string;  // contexts.id として返される（一貫性のある主キー）
  name: string;  // contexts.name から取得
  parent_context_id?: string;  // 親子関係の場合のみ
}

/**
 * Prepared statement collection with strict typing
 */
export interface PreparedQueries {
  getPersonaCapabilities: Database.Statement<[string]>;
  insertPersonaCapability: Database.Statement<[string, string, string, string, string, string]>;
  updatePersonaCapability: Database.Statement<[string, string, string, string, string, string, string]>;
  deletePersonaCapability: Database.Statement<[string, string]>;
  getPersonaInheritance: Database.Statement<[string]>;
  insertInheritanceRecord: Database.Statement<[string, string, string, string]>;
  getCapabilityHierarchy: Database.Statement<[]>;
  getPersonaStats: Database.Statement<[string]>;
  getDirectParent: Database.Statement<[string]>;
  getDirectChildren: Database.Statement<[string]>;
  getAncestors: Database.Statement<[string]>;
  getDescendants: Database.Statement<[string]>;
  getSiblings: Database.Statement<[string]>;
}

/**
 * Capability awareness operation result types
 */
export interface CapabilityOperationResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Hierarchy analysis result structure
 */
export interface HierarchyAnalysisResult {
  total_personas: number;
  max_depth: number;
  inheritance_chains: string[][];
  optimization_suggestions: string[];
}

/**
 * Hierarchy position information
 */
export interface HierarchyPosition {
  depth: number;
  ancestors: string[];
  descendants: string[];
  is_root: boolean;
  is_leaf: boolean;
}
