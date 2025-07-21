/**
 * PersonaManager専用ロガー
 * エラーハンドリングとデバッグ効率化のための統一ログシステム
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "ERROR";
    LogLevel["WARN"] = "WARN";
    LogLevel["INFO"] = "INFO";
    LogLevel["DEBUG"] = "DEBUG";
})(LogLevel || (LogLevel = {}));
export class PersonaLogger {
    static instance;
    isDevelopment;
    constructor() {
        this.isDevelopment = process.env.NODE_ENV !== 'production';
    }
    static getInstance() {
        if (!PersonaLogger.instance) {
            PersonaLogger.instance = new PersonaLogger();
        }
        return PersonaLogger.instance;
    }
    /**
     * エラーログ出力（本番環境でも出力）
     */
    error(message, context, error) {
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
    warn(message, context) {
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
    info(message, context) {
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
    debug(message, context) {
        if (!this.isDevelopment)
            return;
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
    logForeignKeyError(method, fromContextId, toContextId, checkResults) {
        this.error('Foreign key constraint validation failed', {
            method,
            operation: 'foreign_key_check',
            metadata: {
                from_context_id: fromContextId,
                to_context_id: toContextId,
                from_exists: checkResults.from_exists,
                to_exists: checkResults.to_exists,
                suggestion: 'Use updatePersonaCapabilities() to create persona_capabilities records before task delegation'
            }
        });
    }
    /**
     * データベース操作の詳細ログ
     */
    logDatabaseOperation(method, operation, success, contextId, metadata) {
        if (success) {
            this.info(`Database operation successful: ${operation}`, {
                method,
                contextId,
                operation,
                metadata
            });
        }
        else {
            this.error(`Database operation failed: ${operation}`, {
                method,
                contextId,
                operation,
                metadata
            });
        }
    }
    /**
     * 実行時間測定付きログ
     */
    logPerformance(method, operation, startTime, contextId) {
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
        }
        else {
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
export function logPerformance(operation) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        const logger = PersonaLogger.getInstance();
        descriptor.value = function (...args) {
            const startTime = Date.now();
            const contextId = args[0] || 'unknown';
            try {
                const result = method.apply(this, args);
                logger.logPerformance(propertyName, operation, startTime, contextId);
                return result;
            }
            catch (error) {
                logger.logPerformance(propertyName, operation, startTime, contextId);
                throw error;
            }
        };
    };
}
/**
 * エラーハンドリングデコレータ
 */
export function handleErrors(operation) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        const logger = PersonaLogger.getInstance();
        descriptor.value = function (...args) {
            const contextId = args[0] || 'unknown';
            try {
                return method.apply(this, args);
            }
            catch (error) {
                logger.error(`Operation failed: ${operation}`, {
                    method: propertyName,
                    contextId,
                    operation,
                    metadata: { args: args.slice(1) }
                }, error);
                return null;
            }
        };
    };
}
