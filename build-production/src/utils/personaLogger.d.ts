/**
 * PersonaManager専用ロガー
 * エラーハンドリングとデバッグ効率化のための統一ログシステム
 */
export declare enum LogLevel {
    ERROR = "ERROR",
    WARN = "WARN",
    INFO = "INFO",
    DEBUG = "DEBUG"
}
export interface LogContext {
    method: string;
    contextId?: string;
    operation?: string;
    metadata?: Record<string, any>;
}
export declare class PersonaLogger {
    private static instance;
    private isDevelopment;
    private constructor();
    static getInstance(): PersonaLogger;
    /**
     * エラーログ出力（本番環境でも出力）
     */
    error(message: string, context: LogContext, error?: Error): void;
    /**
     * 警告ログ出力
     */
    warn(message: string, context: LogContext): void;
    /**
     * 情報ログ出力（成功時）
     */
    info(message: string, context: LogContext): void;
    /**
     * デバッグログ出力（開発環境のみ）
     */
    debug(message: string, context: LogContext): void;
    /**
     * 外部キー制約エラーの詳細ログ
     */
    logForeignKeyError(method: string, fromContextId: string, toContextId: string, checkResults: {
        from_exists: boolean;
        to_exists: boolean;
    }): void;
    /**
     * データベース操作の詳細ログ
     */
    logDatabaseOperation(method: string, operation: string, success: boolean, contextId?: string, metadata?: Record<string, any>): void;
    /**
     * 実行時間測定付きログ
     */
    logPerformance(method: string, operation: string, startTime: number, contextId?: string): void;
}
/**
 * パフォーマンス測定デコレータ
 */
export declare function logPerformance(operation: string): (target: any, propertyName: string, descriptor: PropertyDescriptor) => void;
/**
 * エラーハンドリングデコレータ
 */
export declare function handleErrors(operation: string): (target: any, propertyName: string, descriptor: PropertyDescriptor) => void;
