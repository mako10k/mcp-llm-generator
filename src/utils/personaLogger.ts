/**
 * PersonaManager専用ロガー
 * エラーハンドリングとデバッグ効率化のための統一ログシステム
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

export interface LogContext {
  method: string;
  contextId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export class PersonaLogger {
  private static instance: PersonaLogger;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  public static getInstance(): PersonaLogger {
    if (!PersonaLogger.instance) {
      PersonaLogger.instance = new PersonaLogger();
    }
    return PersonaLogger.instance;
  }

  /**
   * エラーログ出力（本番環境でも出力）
   */
  error(message: string, context: LogContext, error?: Error): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: LogLevel.ERROR,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined
      } : undefined
    };

    console.error(`❌ [${timestamp}] PersonaManager.${context.method}: ${message}`, {
      contextId: context.contextId,
      operation: context.operation,
      metadata: context.metadata,
      error: logEntry.error
    });
  }

  /**
   * 警告ログ出力
   */
  warn(message: string, context: LogContext): void {
    const timestamp = new Date().toISOString();
    console.warn(`⚠️ [${timestamp}] PersonaManager.${context.method}: ${message}`, {
      contextId: context.contextId,
      operation: context.operation,
      metadata: context.metadata
    });
  }

  /**
   * 情報ログ出力（成功時）
   */
  info(message: string, context: LogContext): void {
    const timestamp = new Date().toISOString();
    console.log(`✅ [${timestamp}] PersonaManager.${context.method}: ${message}`, {
      contextId: context.contextId,
      operation: context.operation,
      metadata: context.metadata
    });
  }

  /**
   * デバッグログ出力（開発環境のみ）
   */
  debug(message: string, context: LogContext): void {
    if (!this.isDevelopment) return;

    const timestamp = new Date().toISOString();
    console.debug(`🔍 [${timestamp}] PersonaManager.${context.method}: ${message}`, {
      contextId: context.contextId,
      operation: context.operation,
      metadata: context.metadata
    });
  }

  /**
   * 外部キー制約エラーの詳細ログ
   */
  logForeignKeyError(method: string, fromContextId: string, toContextId: string, checkResults: {from_exists: boolean, to_exists: boolean}): void {
    this.error(
      'Foreign key constraint validation failed',
      {
        method,
        operation: 'foreign_key_check',
        metadata: {
          from_context_id: fromContextId,
          to_context_id: toContextId,
          from_exists: checkResults.from_exists,
          to_exists: checkResults.to_exists,
          suggestion: 'Use updatePersonaCapabilities() to create persona_capabilities records before task delegation'
        }
      }
    );
  }

  /**
   * データベース操作の詳細ログ
   */
  logDatabaseOperation(method: string, operation: string, success: boolean, contextId?: string, metadata?: Record<string, any>): void {
    if (success) {
      this.info(
        `Database operation successful: ${operation}`,
        {
          method,
          contextId,
          operation,
          metadata
        }
      );
    } else {
      this.error(
        `Database operation failed: ${operation}`,
        {
          method,
          contextId,
          operation,
          metadata
        }
      );
    }
  }

  /**
   * 実行時間測定付きログ
   */
  logPerformance(method: string, operation: string, startTime: number, contextId?: string): void {
    const duration = Date.now() - startTime;
    const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    
    const message = `Operation completed in ${duration}ms${duration > 1000 ? ' (slow)' : ''}`;
    
    if (level === LogLevel.WARN) {
      this.warn(message, {
        method,
        contextId,
        operation,
        metadata: { duration_ms: duration }
      });
    } else {
      this.debug(message, {
        method,
        contextId,
        operation,
        metadata: { duration_ms: duration }
      });
    }
  }
}

/**
 * パフォーマンス測定デコレータ
 */
export function logPerformance(operation: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const logger = PersonaLogger.getInstance();

    descriptor.value = function (...args: any[]) {
      const startTime = Date.now();
      const contextId = args[0] || 'unknown';
      
      try {
        const result = method.apply(this, args);
        logger.logPerformance(propertyName, operation, startTime, contextId);
        return result;
      } catch (error) {
        logger.logPerformance(propertyName, operation, startTime, contextId);
        throw error;
      }
    };
  };
}

/**
 * エラーハンドリングデコレータ
 */
export function handleErrors(operation: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const logger = PersonaLogger.getInstance();

    descriptor.value = function (...args: any[]) {
      const contextId = args[0] || 'unknown';
      
      try {
        return method.apply(this, args);
      } catch (error) {
        logger.error(
          `Operation failed: ${operation}`,
          {
            method: propertyName,
            contextId,
            operation,
            metadata: { args: args.slice(1) }
          },
          error as Error
        );
        return null;
      }
    };
  };
}
