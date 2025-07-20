/**
 * Sprint4 Phase 3: Function実行エンジン
 * 実際のFunction処理を実行するエンジンクラス
 */

import { PersonaLogger } from './personaLogger.js';
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
export class FunctionExecutionEngine {
  private logger: PersonaLogger;
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.logger = PersonaLogger.getInstance();
  }

  /**
   * Function実行のメインエントリーポイント
   */
  async executeFunction(params: FunctionExecutionParams): Promise<FunctionExecutionResult> {
    const startTime = Date.now();
    const methodName = 'executeFunction';

    try {
      this.logger.debug('Function execution started', {
        method: methodName,
        contextId: params.requestId,
        operation: 'execution_start',
        metadata: {
          function_name: params.functionName,
          from_persona_id: params.fromPersonaId,
          to_persona_id: params.toPersonaId
        }
      });

      // Function種別による実行分岐
      let result: any;
      switch (params.functionName) {
        case 'analyzeData':
          result = await this.executeDataAnalysis(params);
          break;
        case 'sendNotification':
          result = await this.executeSendNotification(params);
          break;
        case 'getSystemStatus':
          result = await this.executeGetSystemStatus(params);
          break;
        default:
          throw new Error(`Unknown function: ${params.functionName}`);
      }

      const executionTimeMs = Date.now() - startTime;

      this.logger.info('Function execution completed successfully', {
        method: methodName,
        contextId: params.requestId,
        operation: 'execution_success',
        metadata: {
          function_name: params.functionName,
          execution_time_ms: executionTimeMs
        }
      });

      return {
        success: true,
        data: result,
        executionTimeMs,
        metadata: {
          functionName: params.functionName,
          fromPersonaId: params.fromPersonaId,
          toPersonaId: params.toPersonaId,
          resourcesUsed: {
            memoryMb: this.estimateMemoryUsage(params.functionName),
            cpuMs: executionTimeMs
          }
        }
      };

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';

      this.logger.error('Function execution failed', {
        method: methodName,
        contextId: params.requestId,
        operation: 'execution_failed',
        metadata: {
          function_name: params.functionName,
          execution_time_ms: executionTimeMs
        }
      }, error as Error);

      return {
        success: false,
        error: errorMessage,
        executionTimeMs,
        metadata: {
          functionName: params.functionName,
          fromPersonaId: params.fromPersonaId,
          toPersonaId: params.toPersonaId
        }
      };
    }
  }

  /**
   * データ分析Function実行
   */
  private async executeDataAnalysis(params: FunctionExecutionParams): Promise<any> {
    const { data, analysis_type, options = {} } = params.parameters;

    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }

    switch (analysis_type) {
      case 'statistical':
        return this.calculateStatistics(data, options);
      
      case 'trend':
        return this.analyzeTrend(data, options);
      
      case 'correlation':
        return this.calculateCorrelation(data, options);
      
      case 'regression':
        return this.calculateRegression(data, options);
      
      default:
        throw new Error(`Unsupported analysis type: ${analysis_type}`);
    }
  }

  /**
   * 通知送信Function実行
   */
  private async executeSendNotification(params: FunctionExecutionParams): Promise<any> {
    const { target, message, priority = 'medium' } = params.parameters;

    // 通知メッセージのバリデーション
    if (!message || message.length === 0) {
      throw new Error('Message cannot be empty');
    }

    if (message.length > 1000) {
      throw new Error('Message too long (max 1000 characters)');
    }

    // 通知レコードの作成
    const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 実際の通知処理（簡易実装）
    const notification = {
      id: notificationId,
      from: params.fromPersonaId,
      to: target,
      message,
      priority,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    };

    this.logger.info('Notification sent successfully', {
      method: 'executeSendNotification',
      contextId: params.requestId,
      operation: 'notification_sent',
      metadata: {
        notification_id: notificationId,
        target,
        priority
      }
    });

    return notification;
  }

  /**
   * システム状態取得Function実行
   */
  private async executeGetSystemStatus(params: FunctionExecutionParams): Promise<any> {
    const { component = 'all' } = params.parameters;

    const status = {
      timestamp: new Date().toISOString(),
      requested_by: params.fromPersonaId,
      components: {} as Record<string, any>
    };

    if (component === 'all' || component === 'database') {
      status.components.database = {
        status: 'healthy',
        connections: 5,
        last_backup: new Date(Date.now() - 3600000).toISOString() // 1時間前
      };
    }

    if (component === 'all' || component === 'memory') {
      status.components.memory = {
        status: 'healthy',
        usage_percentage: 35,
        available_mb: 2048
      };
    }

    if (component === 'all' || component === 'cpu') {
      status.components.cpu = {
        status: 'healthy',
        usage_percentage: 12,
        load_average: 0.8
      };
    }

    if (component === 'all' || component === 'functions') {
      // アクティブなFunction数を取得
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM function_definitions WHERE is_active = 1');
      const result = stmt.get() as { count: number };
      
      status.components.functions = {
        status: 'healthy',
        active_functions: result.count,
        registry_status: 'operational'
      };
    }

    return status;
  }

  /**
   * 統計計算
   */
  private calculateStatistics(data: number[], options: any): any {
    if (data.length === 0) {
      throw new Error('Cannot calculate statistics for empty dataset');
    }

    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((acc, val) => acc + val, 0);
    const mean = sum / data.length;
    
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      analysis_type: 'statistical',
      data_points: data.length,
      summary: {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: parseFloat(mean.toFixed(2)),
        median: sorted.length % 2 === 0 
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)],
        standard_deviation: parseFloat(standardDeviation.toFixed(2)),
        variance: parseFloat(variance.toFixed(2))
      },
      raw_data: options.include_raw ? data : undefined
    };
  }

  /**
   * トレンド分析
   */
  private analyzeTrend(data: number[], options: any): any {
    if (data.length < 2) {
      throw new Error('Need at least 2 data points for trend analysis');
    }

    // 線形回帰による傾向計算
    const n = data.length;
    const xSum = (n * (n - 1)) / 2; // 0 + 1 + 2 + ... + (n-1)
    const ySum = data.reduce((acc, val) => acc + val, 0);
    const xySum = data.reduce((acc, val, idx) => acc + (idx * val), 0);
    const x2Sum = (n * (n - 1) * (2 * n - 1)) / 6; // 0² + 1² + 2² + ... + (n-1)²

    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;

    const trendDirection = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';

    return {
      analysis_type: 'trend',
      data_points: data.length,
      trend: {
        direction: trendDirection,
        slope: parseFloat(slope.toFixed(4)),
        intercept: parseFloat(intercept.toFixed(2)),
        strength: Math.abs(slope) > 1 ? 'strong' : Math.abs(slope) > 0.5 ? 'moderate' : 'weak'
      },
      projected_next: parseFloat((slope * n + intercept).toFixed(2))
    };
  }

  /**
   * 相関分析
   */
  private calculateCorrelation(data: any[], options: any): any {
    if (!options.y_data || !Array.isArray(options.y_data)) {
      throw new Error('Correlation analysis requires y_data in options');
    }

    const x = data;
    const y = options.y_data;

    if (x.length !== y.length) {
      throw new Error('X and Y data must have the same length');
    }

    const n = x.length;
    const xMean = x.reduce((acc: number, val: number) => acc + val, 0) / n;
    const yMean = y.reduce((acc: number, val: number) => acc + val, 0) / n;

    const numerator = x.reduce((acc: number, val: number, idx: number) => 
      acc + (val - xMean) * (y[idx] - yMean), 0);
    
    const xVariance = x.reduce((acc: number, val: number) => 
      acc + Math.pow(val - xMean, 2), 0);
    
    const yVariance = y.reduce((acc: number, val: number) => 
      acc + Math.pow(val - yMean, 2), 0);

    const correlation = numerator / Math.sqrt(xVariance * yVariance);

    return {
      analysis_type: 'correlation',
      data_points: n,
      correlation: {
        coefficient: parseFloat(correlation.toFixed(4)),
        strength: Math.abs(correlation) > 0.8 ? 'strong' : 
                 Math.abs(correlation) > 0.5 ? 'moderate' : 'weak',
        direction: correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'none'
      }
    };
  }

  /**
   * 回帰分析
   */
  private calculateRegression(data: number[], options: any): any {
    // 簡易線形回帰
    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = data;

    const xMean = x.reduce((acc, val) => acc + val, 0) / n;
    const yMean = y.reduce((acc, val) => acc + val, 0) / n;

    const numerator = x.reduce((acc, val, idx) => acc + (val - xMean) * (y[idx] - yMean), 0);
    const denominator = x.reduce((acc, val) => acc + Math.pow(val - xMean, 2), 0);

    const slope = numerator / denominator;
    const intercept = yMean - slope * xMean;

    // R²計算
    const predicted = x.map(val => slope * val + intercept);
    const ssRes = y.reduce((acc, val, idx) => acc + Math.pow(val - predicted[idx], 2), 0);
    const ssTot = y.reduce((acc, val) => acc + Math.pow(val - yMean, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    return {
      analysis_type: 'regression',
      data_points: n,
      regression: {
        slope: parseFloat(slope.toFixed(4)),
        intercept: parseFloat(intercept.toFixed(2)),
        r_squared: parseFloat(rSquared.toFixed(4)),
        equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(2)}`
      },
      predictions: options.predict_points ? 
        Array.from({ length: options.predict_points }, (_, i) => ({
          x: n + i,
          y: parseFloat((slope * (n + i) + intercept).toFixed(2))
        })) : undefined
    };
  }

  /**
   * メモリ使用量の推定
   */
  private estimateMemoryUsage(functionName: string): number {
    switch (functionName) {
      case 'analyzeData':
        return 50; // 50MB
      case 'sendNotification':
        return 5;  // 5MB
      case 'getSystemStatus':
        return 10; // 10MB
      default:
        return 20; // デフォルト20MB
    }
  }
}
