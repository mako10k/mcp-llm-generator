/**
 * Database Initialization Management
 * 
 * Centralized database schema definition and initialization management
 * to prevent schema inconsistency across multiple service classes and test files.
 */

import Database from 'better-sqlite3';

export type TableName = 
  | 'contexts'
  | 'persona_capabilities'
  | 'persona_hierarchy'
  | 'persona_roles'
  | 'task_delegations'
  | 'persona_lineage'
  | 'shared_memories';

export class DatabaseInitializer {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Centralized schema definitions for all tables
   * Single source of truth for database structure
   */
  private static readonly schemas: Record<TableName, string> = {
    contexts: `
      CREATE TABLE IF NOT EXISTS contexts (
        context_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,

    persona_capabilities: `
      CREATE TABLE IF NOT EXISTS persona_capabilities (
        context_id TEXT PRIMARY KEY,
        expertise TEXT NOT NULL DEFAULT '[]',
        tools TEXT NOT NULL DEFAULT '[]', 
        restrictions TEXT NOT NULL DEFAULT '[]',
        performance_metrics TEXT,
        learning_capabilities TEXT,
        is_public BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (context_id) REFERENCES contexts(context_id) ON DELETE CASCADE
      )
    `,

    persona_hierarchy: `
      CREATE TABLE IF NOT EXISTS persona_hierarchy (
        ancestor_id TEXT NOT NULL,
        descendant_id TEXT NOT NULL,
        depth INTEGER NOT NULL,
        is_direct BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (ancestor_id, descendant_id),
        FOREIGN KEY (ancestor_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
        FOREIGN KEY (descendant_id) REFERENCES contexts(context_id) ON DELETE CASCADE
      )
    `,

    persona_roles: `
      CREATE TABLE IF NOT EXISTS persona_roles (
        role_id TEXT PRIMARY KEY,
        context_id TEXT NOT NULL,
        role_type TEXT NOT NULL CHECK (role_type IN ('admin', 'specialist', 'assistant', 'observer', 'guest')),
        permissions TEXT NOT NULL DEFAULT '[]',
        role_description TEXT,
        parent_role_id TEXT,
        hierarchy_level INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (context_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
        FOREIGN KEY (parent_role_id) REFERENCES persona_roles(role_id) ON DELETE SET NULL
      )
    `,

    task_delegations: `
      CREATE TABLE IF NOT EXISTS task_delegations (
        delegation_id TEXT PRIMARY KEY,
        from_context_id TEXT NOT NULL,
        to_context_id TEXT NOT NULL,
        task_description TEXT NOT NULL,
        required_capabilities TEXT NOT NULL DEFAULT '[]',
        priority_level TEXT NOT NULL DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'urgent')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'failed', 'cancelled')),
        result_data TEXT,
        delegation_metadata TEXT,
        scheduled_at DATETIME,
        started_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_context_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
        FOREIGN KEY (to_context_id) REFERENCES contexts(context_id) ON DELETE CASCADE
      )
    `,

    persona_lineage: `
      CREATE TABLE IF NOT EXISTS persona_lineage (
        lineage_id TEXT PRIMARY KEY,
        parent_context_id TEXT NOT NULL,
        child_context_id TEXT NOT NULL,
        merge_strategy TEXT NOT NULL DEFAULT 'additive' CHECK (merge_strategy IN ('additive', 'override', 'selective', 'weighted')),
        merge_rules TEXT,
        inheritance_percentage REAL DEFAULT 1.0 CHECK (inheritance_percentage >= 0.0 AND inheritance_percentage <= 1.0),
        merge_metadata TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_context_id) REFERENCES contexts(context_id) ON DELETE CASCADE,
        FOREIGN KEY (child_context_id) REFERENCES contexts(context_id) ON DELETE CASCADE
      )
    `,

    shared_memories: `
      CREATE TABLE IF NOT EXISTS shared_memories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        creator_persona_id TEXT NOT NULL,
        permission_level TEXT NOT NULL DEFAULT 'edit' CHECK (permission_level IN ('public', 'edit')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  };

  /**
   * Performance optimization indexes for all tables
   */
  private static readonly indexes: string[] = [
    // persona_capabilities indexes
    'CREATE INDEX IF NOT EXISTS idx_persona_capabilities_context ON persona_capabilities(context_id)',
    'CREATE INDEX IF NOT EXISTS idx_persona_capabilities_public ON persona_capabilities(is_public) WHERE is_public = 1',
    
    // persona_hierarchy indexes
    'CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_ancestor ON persona_hierarchy(ancestor_id)',
    'CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_descendant ON persona_hierarchy(descendant_id)',
    'CREATE INDEX IF NOT EXISTS idx_persona_hierarchy_depth ON persona_hierarchy(depth)',
    
    // persona_roles indexes
    'CREATE INDEX IF NOT EXISTS idx_persona_roles_context ON persona_roles(context_id)',
    'CREATE INDEX IF NOT EXISTS idx_persona_roles_type ON persona_roles(role_type)',
    'CREATE INDEX IF NOT EXISTS idx_persona_roles_hierarchy ON persona_roles(hierarchy_level)',
    'CREATE INDEX IF NOT EXISTS idx_persona_roles_active ON persona_roles(is_active) WHERE is_active = 1',
    
    // task_delegations indexes
    'CREATE INDEX IF NOT EXISTS idx_task_delegations_from ON task_delegations(from_context_id)',
    'CREATE INDEX IF NOT EXISTS idx_task_delegations_to ON task_delegations(to_context_id)',
    'CREATE INDEX IF NOT EXISTS idx_task_delegations_status ON task_delegations(status)',
    
    // persona_lineage indexes
    'CREATE INDEX IF NOT EXISTS idx_persona_lineage_parent ON persona_lineage(parent_context_id)',
    'CREATE INDEX IF NOT EXISTS idx_persona_lineage_child ON persona_lineage(child_context_id)',
    'CREATE INDEX IF NOT EXISTS idx_persona_lineage_active ON persona_lineage(is_active) WHERE is_active = 1',
    
    // shared_memories indexes
    'CREATE INDEX IF NOT EXISTS idx_shared_memories_creator ON shared_memories(creator_persona_id)',
    'CREATE INDEX IF NOT EXISTS idx_shared_memories_permission ON shared_memories(permission_level)'
  ];

  /**
   * Initialize all database tables and indexes
   * This is the primary method for database initialization
   */
  public initializeAll(): void {
    try {
      // Create all tables in proper order (respecting foreign key dependencies)
      const tableOrder: TableName[] = [
        'contexts',
        'persona_capabilities',
        'persona_hierarchy',
        'persona_roles',
        'task_delegations',
        'persona_lineage',
        'shared_memories'
      ];

      for (const tableName of tableOrder) {
        this.initializeTable(tableName);
      }

      // Create all performance indexes
      this.initializeIndexes();

      console.log('Database initialization completed successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize a specific table
   */
  public initializeTable(tableName: TableName): void {
    try {
      const schema = DatabaseInitializer.schemas[tableName];
      if (!schema) {
        throw new Error(`Schema not found for table: ${tableName}`);
      }
      
      this.db.exec(schema);
      console.log(`Table initialized: ${tableName}`);
    } catch (error) {
      console.error(`Failed to initialize table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Initialize all database indexes for performance optimization
   */
  public initializeIndexes(): void {
    try {
      for (const indexSql of DatabaseInitializer.indexes) {
        this.db.exec(indexSql);
      }
      console.log('Database indexes initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database indexes:', error);
      throw error;
    }
  }

  /**
   * Clear all data from tables (useful for tests)
   * Preserves table structure but removes all data
   */
  public clearAllData(): void {
    try {
      // Disable foreign key constraints temporarily
      this.db.exec('PRAGMA foreign_keys = OFF');
      
      // Clear tables in reverse order to respect foreign key dependencies
      const tableOrder: TableName[] = [
        'shared_memories',
        'persona_lineage',
        'task_delegations',
        'persona_roles',
        'persona_hierarchy',
        'persona_capabilities',
        'contexts'
      ];

      for (const tableName of tableOrder) {
        this.db.exec(`DELETE FROM ${tableName}`);
      }

      // Re-enable foreign key constraints
      this.db.exec('PRAGMA foreign_keys = ON');
      
      console.log('All table data cleared successfully');
    } catch (error) {
      console.error('Failed to clear table data:', error);
      throw error;
    }
  }

  /**
   * Drop all tables (useful for complete reset)
   * WARNING: This will destroy all data and table structure
   */
  public dropAllTables(): void {
    try {
      // Disable foreign key constraints
      this.db.exec('PRAGMA foreign_keys = OFF');
      
      // Drop tables in reverse order
      const tableOrder: TableName[] = [
        'shared_memories',
        'persona_lineage',
        'task_delegations',
        'persona_roles',
        'persona_hierarchy',
        'persona_capabilities',
        'contexts'
      ];

      for (const tableName of tableOrder) {
        this.db.exec(`DROP TABLE IF EXISTS ${tableName}`);
      }

      // Re-enable foreign key constraints
      this.db.exec('PRAGMA foreign_keys = ON');
      
      console.log('All tables dropped successfully');
    } catch (error) {
      console.error('Failed to drop tables:', error);
      throw error;
    }
  }

  /**
   * Get the schema definition for a specific table
   */
  public static getTableSchema(tableName: TableName): string {
    return DatabaseInitializer.schemas[tableName];
  }

  /**
   * Get all table names
   */
  public static getTableNames(): TableName[] {
    return Object.keys(DatabaseInitializer.schemas) as TableName[];
  }

  /**
   * Validate database integrity (checks if all required tables exist)
   */
  public validateSchema(): { isValid: boolean; missingTables: string[] } {
    const missingTables: string[] = [];
    
    for (const tableName of DatabaseInitializer.getTableNames()) {
      const result = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(tableName);
      
      if (!result) {
        missingTables.push(tableName);
      }
    }

    return {
      isValid: missingTables.length === 0,
      missingTables
    };
  }
}
