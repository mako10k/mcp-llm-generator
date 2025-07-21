/**
 * Sprint4 Phase 3: Function実行エンジン
 * 実際のFunction処理を実行するエンジンクラス
 */
import type Database from 'better-sqlite3';
/**
 * Function実行パラメータ
 */
export interface FunctionExecutionParams {
    functionId: string;
    functionName: string;
    parameters: Record<string, any>;
    fromPersonaId: string;
    toPersonaId: string;
    requestId: string;
    timeout?: number;
}
/**
 * Function実行結果
 */
export interface FunctionExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    executionTimeMs: number;
    metadata?: {
        functionName: string;
        fromPersonaId: string;
        toPersonaId: string;
        resourcesUsed?: {
            memoryMb: number;
            cpuMs: number;
        };
    };
}
/**
 * Function実行エンジン
 * 各種Functionの実際の処理を実行
 */
export declare class FunctionExecutionEngine {
    private logger;
    private db;
    private googleSearch;
    constructor(db: Database.Database);
    /**
     * Function実行のメインエントリーポイント
     */
    executeFunction(params: FunctionExecutionParams): Promise<FunctionExecutionResult>;
    /**
     * データ分析Function実行
     */
    private executeDataAnalysis;
    /**
     * 通知送信Function実行
     */
    private executeSendNotification;
    /**
     * システム状態取得Function実行
     */
    private executeGetSystemStatus;
    /**
     * 統計計算
     */
    private calculateStatistics;
    /**
     * トレンド分析
     */
    private analyzeTrend;
    /**
     * 相関分析
     */
    private calculateCorrelation;
    /**
     * 回帰分析
     */
    private calculateRegression;
    /**
     * Google検索Function実行
     */
    private executeGoogleSearch;
    /**
     * メモリ使用量の推定
     */
    private estimateMemoryUsage;
}
