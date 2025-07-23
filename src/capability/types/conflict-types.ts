/**
 * System prompt merge conflict types
 * 
 * Defines type-safe structures for conflict detection
 * and resolution in SystemPromptMergeEngine.
 */

/**
 * Legacy conflict format for backward compatibility
 */
export interface LegacyConflictInfo {
  type: 'contradiction' | 'ambiguity' | 'incompatibility';
  description: string;
  manualPart: string;
  autoPart: string;
  suggestedResolution: string;
}

/**
 * Enhanced conflict detection result
 */
export interface ConflictInfo {
  type: 'role_conflict' | 'instruction_conflict' | 'format_conflict';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  affected_sections: string[];
  suggested_resolution?: string;
}

/**
 * Merge operation context
 */
export interface MergeContext {
  primary_prompt: string;
  secondary_prompt: string;
  merge_strategy: 'priority' | 'combine' | 'negotiate';
  preserve_formatting: boolean;
}

/**
 * LLM-based conflict resolution result
 */
export interface ConflictResolution {
  resolved_conflicts: number;
  remaining_conflicts: ConflictInfo[];
  merged_content: string;
  warnings: string[];
}
