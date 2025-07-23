/**
 * Sprint4 Phase 2: Function Registry System
 * 人格別実行可能Function定義・セキュリティ制約・権限管理
 */

import Database from 'better-sqlite3';
import { PersonaLogger } from './personaLogger.js';
import { FunctionCallCapability, PersonaFunctionRegistry } from './functionCallDispatcher.js';
import { DatabaseInitializer } from '../database/DatabaseInitializer';

// =============================================================================
// Type Definitions
// =============================================================================

export interface FunctionDefinition {
  id: string;
  name: string;
  description: string;
  category: 'data_analysis' | 'communication' | 'system_control' | 'information_retrieval' | 'custom';
  parameters: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
    default?: any;
    validation?: {
      min?: number;
      max?: number;
      pattern?: string;
      enum?: any[];
    };
  }>;
  security: {
    level: 'public' | 'protected' | 'private' | 'admin_only';
    required_permissions: string[];
    restricted_contexts?: string[];
    audit_required: boolean;
  };
  execution: {
    timeout_ms: number;
    max_retries: number;
    background_allowed: boolean;
    resource_limits?: {
      memory_mb?: number;
      cpu_percentage?: number;
    };
  };
  metadata: {
    version: string;
    author: string;
    created_at: string;
    updated_at: string;
    tags: string[];
  };
}

export interface PersonaFunctionBinding {
  persona_id: string;
  function_id: string;
  is_enabled: boolean;
  custom_config?: Record<string, any>;
  security_overrides?: {
    timeout_ms?: number;
    max_retries?: number;
    additional_permissions?: string[];
  };
  created_at: string;
  updated_at: string;
}

export interface FunctionExecutionContext {
  requestId: string;
  fromPersonaId: string;
  toPersonaId: string;
  functionId: string;
  parameters: Record<string, any>;
  security: {
    user_permissions: string[];
    context_restrictions: string[];
  };
  execution: {
    timeout_ms: number;
    retries_remaining: number;
    started_at: string;
  };
}

// =============================================================================
// Function Registry Manager
// =============================================================================

export class FunctionRegistryManager {
  private db: Database.Database;
  private logger: PersonaLogger;
  private dbInitializer: DatabaseInitializer;
  private functionDefinitions: Map<string, FunctionDefinition> = new Map();
  private personaBindings: Map<string, PersonaFunctionBinding[]> = new Map();

  constructor(database: Database.Database) {
    this.db = database;
    this.dbInitializer = new DatabaseInitializer(this.db);
    this.logger = PersonaLogger.getInstance();
    
    this.initializeDatabase();
    this.loadDefaultFunctions();
    
    this.logger.info('Function Registry Manager initialized', {
      method: 'constructor',
      contextId: 'function-registry-manager',
      operation: 'registry_initialization'
    });
  }

  /**
   * データベーステーブルの初期化
   */
  private initializeDatabase(): void {
    // Use centralized DatabaseInitializer for consistent schema management
    this.dbInitializer.initializeAll();
    
    // Function Registry specific tables
    this.initializeFunctionTables();
  }

  private initializeFunctionTables(): void {
    const methodName = 'initializeFunctionTables';
    
    try {
      // Function定義テーブル
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS function_definitions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          parameters TEXT NOT NULL,
          security TEXT NOT NULL,
          execution TEXT NOT NULL,
          metadata TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);

      // ペルソナFunction関連付けテーブル  
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS persona_function_bindings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          persona_id TEXT NOT NULL,
          function_id TEXT NOT NULL,
          is_enabled INTEGER DEFAULT 1,
          custom_config TEXT,
          security_overrides TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (persona_id) REFERENCES persona_capabilities(context_id),
          FOREIGN KEY (function_id) REFERENCES function_definitions(id),
          UNIQUE(persona_id, function_id)
        )
      `);

      // Function実行履歴テーブル
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS function_execution_logs (
          id TEXT PRIMARY KEY,
          request_id TEXT NOT NULL,
          from_persona_id TEXT NOT NULL,
          to_persona_id TEXT NOT NULL,
          function_id TEXT NOT NULL,
          parameters TEXT NOT NULL,
          result TEXT,
          error TEXT,
          execution_time_ms INTEGER,
          retry_count INTEGER DEFAULT 0,
          security_check_passed INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (from_persona_id) REFERENCES persona_capabilities(context_id),
          FOREIGN KEY (to_persona_id) REFERENCES persona_capabilities(context_id),
          FOREIGN KEY (function_id) REFERENCES function_definitions(id)
        )
      `);

      this.logger.debug('Function registry database tables initialized', {
        method: methodName,
        operation: 'database_schema_creation'
      });

    } catch (error) {
      this.logger.error(
        'Failed to initialize function registry database',
        {
          method: methodName,
          operation: 'database_initialization_error'
        },
        error as Error
      );
      throw error;
    }
  }

  /**
   * デフォルトFunction定義の読み込み
   */
  private loadDefaultFunctions(): void {
    const methodName = 'loadDefaultFunctions';
    
    const defaultFunctions: FunctionDefinition[] = [
      {
        id: 'func_data_analysis',
        name: 'analyzeData',
        description: 'データ分析・統計処理を実行する',
        category: 'data_analysis',
        parameters: {
          data: {
            type: 'object',
            description: '分析対象のデータセット',
            required: true
          },
          analysis_type: {
            type: 'string',
            description: '分析タイプ (statistical, trend, correlation)',
            required: true,
            validation: {
              enum: ['statistical', 'trend', 'correlation', 'regression']
            }
          },
          options: {
            type: 'object',
            description: '分析オプション',
            required: false,
            default: {}
          }
        },
        security: {
          level: 'protected',
          required_permissions: ['data_analysis', 'read_data'],
          audit_required: true
        },
        execution: {
          timeout_ms: 30000,
          max_retries: 2,
          background_allowed: true,
          resource_limits: {
            memory_mb: 512,
            cpu_percentage: 50
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tags: ['data', 'analysis', 'statistics']
        }
      },
      {
        id: 'func_send_notification',
        name: 'sendNotification',
        description: '他の人格やシステムに通知を送信する',
        category: 'communication',
        parameters: {
          target: {
            type: 'string',
            description: '通知先（persona_id or system）',
            required: true
          },
          message: {
            type: 'string',
            description: '通知メッセージ',
            required: true,
            validation: {
              min: 1,
              max: 1000
            }
          },
          priority: {
            type: 'string',
            description: '優先度',
            required: false,
            default: 'medium',
            validation: {
              enum: ['low', 'medium', 'high', 'urgent']
            }
          }
        },
        security: {
          level: 'public',
          required_permissions: ['send_notification'],
          audit_required: false
        },
        execution: {
          timeout_ms: 5000,
          max_retries: 3,
          background_allowed: false
        },
        metadata: {
          version: '1.0.0',
          author: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tags: ['communication', 'notification']
        }
      },
      {
        id: 'func_system_status',
        name: 'getSystemStatus',
        description: 'システム・プロセス状況を取得する',
        category: 'system_control',
        parameters: {
          component: {
            type: 'string',
            description: '確認対象コンポーネント',
            required: false,
            default: 'all',
            validation: {
              enum: ['all', 'database', 'memory', 'processes', 'network']
            }
          }
        },
        security: {
          level: 'protected',
          required_permissions: ['system_monitor', 'read_system'],
          audit_required: true
        },
        execution: {
          timeout_ms: 10000,
          max_retries: 1,
          background_allowed: false
        },
        metadata: {
          version: '1.0.0',
          author: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tags: ['system', 'monitoring', 'status']
        }
      },
      {
        id: 'func_google_search',
        name: 'googleSearch',
        description: 'Google検索を実行して情報を取得する',
        category: 'information_retrieval',
        parameters: {
          query: {
            type: 'string',
            description: '検索クエリ',
            required: true
          },
          numResults: {
            type: 'number',
            description: '取得する検索結果数',
            required: false,
            default: 10,
            validation: {
              min: 1,
              max: 50
            }
          },
          language: {
            type: 'string',
            description: '検索言語設定',
            required: false,
            default: 'ja',
            validation: {
              enum: ['ja', 'en', 'es', 'fr', 'de', 'zh']
            }
          },
          region: {
            type: 'string',
            description: '検索地域設定',
            required: false,
            default: 'JP',
            validation: {
              enum: ['JP', 'US', 'GB', 'FR', 'DE', 'CN']
            }
          },
          imageSearch: {
            type: 'boolean',
            description: '画像検索モード',
            required: false,
            default: false
          },
          summaryLength: {
            type: 'string',
            description: '検索結果要約の詳細度',
            required: false,
            default: 'brief',
            validation: {
              enum: ['brief', 'detailed']
            }
          }
        },
        security: {
          level: 'public',
          required_permissions: ['web_search', 'information_access'],
          audit_required: true
        },
        execution: {
          timeout_ms: 15000,
          max_retries: 2,
          background_allowed: true,
          resource_limits: {
            memory_mb: 256,
            cpu_percentage: 30
          }
        },
        metadata: {
          version: '1.0.0',
          author: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tags: ['search', 'google', 'information', 'web']
        }
      }
    ];

    for (const func of defaultFunctions) {
      this.registerFunction(func);
    }

    this.logger.info(`Loaded ${defaultFunctions.length} default functions`, {
      method: methodName,
      operation: 'default_functions_loaded',
      metadata: {
        function_count: defaultFunctions.length
      }
    });
  }

  /**
   * Function定義の登録
   */
  registerFunction(functionDef: FunctionDefinition): boolean {
    const methodName = 'registerFunction';
    
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO function_definitions (
          id, name, description, category, parameters, security, execution, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        functionDef.id,
        functionDef.name,
        functionDef.description,
        functionDef.category,
        JSON.stringify(functionDef.parameters),
        JSON.stringify(functionDef.security),
        JSON.stringify(functionDef.execution),
        JSON.stringify(functionDef.metadata)
      );

      this.functionDefinitions.set(functionDef.id, functionDef);

      this.logger.logDatabaseOperation(
        methodName,
        'function_definition_registration',
        true,
        functionDef.id,
        {
          function_name: functionDef.name,
          category: functionDef.category,
          security_level: functionDef.security.level
        }
      );

      return true;

    } catch (error) {
      this.logger.error(
        'Failed to register function definition',
        {
          method: methodName,
          operation: 'function_registration_error',
          metadata: {
            function_id: functionDef.id,
            function_name: functionDef.name
          }
        },
        error as Error
      );
      return false;
    }
  }

  /**
   * ペルソナにFunction実行権限を付与
   */
  bindFunctionToPersona(
    personaId: string, 
    functionId: string, 
    config?: {
      isEnabled?: boolean;
      customConfig?: Record<string, any>;
      securityOverrides?: Record<string, any>;
    }
  ): boolean {
    const methodName = 'bindFunctionToPersona';
    
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO persona_function_bindings (
          persona_id, function_id, is_enabled, custom_config, security_overrides
        ) VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        personaId,
        functionId,
        config?.isEnabled !== false ? 1 : 0,
        config?.customConfig ? JSON.stringify(config.customConfig) : null,
        config?.securityOverrides ? JSON.stringify(config.securityOverrides) : null
      );

      // キャッシュの更新
      this.refreshPersonaBindings(personaId);

      this.logger.logDatabaseOperation(
        methodName,
        'persona_function_binding',
        true,
        `${personaId}_${functionId}`,
        {
          persona_id: personaId,
          function_id: functionId,
          is_enabled: config?.isEnabled !== false
        }
      );

      return true;

    } catch (error) {
      this.logger.error(
        'Failed to bind function to persona',
        {
          method: methodName,
          operation: 'function_binding_error',
          metadata: {
            persona_id: personaId,
            function_id: functionId
          }
        },
        error as Error
      );
      return false;
    }
  }

  /**
   * ペルソナの利用可能Function一覧取得
   */
  getPersonaFunctions(personaId: string): FunctionCallCapability[] {
    const methodName = 'getPersonaFunctions';
    
    try {
      const stmt = this.db.prepare(`
        SELECT fd.*, pfb.is_enabled, pfb.custom_config, pfb.security_overrides
        FROM function_definitions fd
        JOIN persona_function_bindings pfb ON fd.id = pfb.function_id
        WHERE pfb.persona_id = ? AND pfb.is_enabled = 1 AND fd.is_active = 1
      `);

      const rows = stmt.all(personaId) as any[];
      
      const capabilities: FunctionCallCapability[] = rows.map(row => {
        const security = JSON.parse(row.security);
        const execution = JSON.parse(row.execution);
        const parameters = JSON.parse(row.parameters);

        return {
          functionName: row.name,
          description: row.description,
          parameters: Object.fromEntries(
            Object.entries(parameters).map(([key, param]: [string, any]) => [
              key,
              {
                type: param.type,
                description: param.description,
                required: param.required
              }
            ])
          ),
          security_level: security.level,
          execution_timeout_ms: execution.timeout_ms
        };
      });

      this.logger.debug(`Retrieved ${capabilities.length} functions for persona`, {
        method: methodName,
        contextId: personaId,
        operation: 'persona_functions_retrieved',
        metadata: {
          function_count: capabilities.length
        }
      });

      return capabilities;

    } catch (error) {
      this.logger.error(
        'Failed to get persona functions',
        {
          method: methodName,
          operation: 'get_persona_functions_error',
          metadata: { persona_id: personaId }
        },
        error as Error
      );
      return [];
    }
  }

  /**
   * Function実行権限の検証
   */
  validateFunctionExecution(
    fromPersonaId: string,
    toPersonaId: string,
    functionId: string,
    userPermissions: string[]
  ): {
    valid: boolean;
    reason?: string;
    executionConfig?: {
      timeout_ms: number;
      max_retries: number;
      audit_required: boolean;
    };
  } {
    const methodName = 'validateFunctionExecution';
    
    try {
      // Function定義の取得
      const functionDef = this.functionDefinitions.get(functionId);
      if (!functionDef) {
        return { valid: false, reason: 'Function not found' };
      }

      // ペルソナバインディングの確認
      const stmt = this.db.prepare(`
        SELECT * FROM persona_function_bindings 
        WHERE persona_id = ? AND function_id = ? AND is_enabled = 1
      `);
      
      const binding = stmt.get(toPersonaId, functionId) as any;
      if (!binding) {
        return { valid: false, reason: 'Function not bound to target persona' };
      }

      // 権限チェック
      const requiredPermissions = functionDef.security.required_permissions;
      const hasPermissions = requiredPermissions.every(perm => 
        userPermissions.includes(perm) || userPermissions.includes('admin')
      );
      
      if (!hasPermissions) {
        this.logger.warn('Insufficient permissions for function execution', {
          method: methodName,
          operation: 'permission_denied',
          metadata: {
            required_permissions: requiredPermissions,
            user_permissions: userPermissions,
            function_id: functionId
          }
        });
        return { valid: false, reason: 'Insufficient permissions' };
      }

      // セキュリティレベルチェック
      if (functionDef.security.level === 'admin_only' && !userPermissions.includes('admin')) {
        return { valid: false, reason: 'Admin-only function' };
      }

      return {
        valid: true,
        executionConfig: {
          timeout_ms: functionDef.execution.timeout_ms,
          max_retries: functionDef.execution.max_retries,
          audit_required: functionDef.security.audit_required
        }
      };

    } catch (error) {
      this.logger.error(
        'Function execution validation failed',
        {
          method: methodName,
          operation: 'validation_error',
          metadata: {
            from_persona_id: fromPersonaId,
            to_persona_id: toPersonaId,
            function_id: functionId
          }
        },
        error as Error
      );
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * ペルソナバインディングキャッシュの更新
   */
  private refreshPersonaBindings(personaId: string): void {
    const stmt = this.db.prepare(`
      SELECT * FROM persona_function_bindings WHERE persona_id = ?
    `);
    
    const bindings = stmt.all(personaId) as any[];
    this.personaBindings.set(personaId, bindings.map(row => ({
      persona_id: row.persona_id,
      function_id: row.function_id,
      is_enabled: row.is_enabled === 1,
      custom_config: row.custom_config ? JSON.parse(row.custom_config) : undefined,
      security_overrides: row.security_overrides ? JSON.parse(row.security_overrides) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    })));
  }
}
