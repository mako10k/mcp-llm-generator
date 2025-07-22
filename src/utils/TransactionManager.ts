// Step4マージ機能 - TransactionManager
// 作成日: 2025年7月22日
// 実装方針: better-sqlite3ネイティブトランザクションのラッパー

import Database from 'better-sqlite3';
import { PromptMergeDatabase } from './PromptMergeDatabase.js';

// 型定義
interface BackupData {
  contextId: string;
  timestamp: string;
  data: {
    [key: string]: unknown;
  };
}

/**
 * Step4マージ機能用のトランザクション管理クラス
 * better-sqlite3のネイティブトランザクション機能をラップ
 * All-or-Nothing原則を保証
 */
export class TransactionManager {
  private db: Database.Database;
  private mergeDb: PromptMergeDatabase;

  constructor(database: Database.Database, mergeDatabase: PromptMergeDatabase) {
    this.db = database;
    this.mergeDb = mergeDatabase;
  }

  /**
   * トランザクション内でマージ処理を実行
   * better-sqlite3のネイティブトランザクションを使用
   */
  runMergeTransaction<T>(fn: () => T): T {
    // better-sqlite3の同期トランザクション
    const transaction = this.db.transaction(() => {
      return fn();
    });

    return transaction();
  }

  /**
   * 段階的トランザクション管理（複雑なマージ処理用）
   * 複数ステップでロールバックポイントを管理
   */
  async runStepwiseTransaction<T>(steps: Array<() => T>): Promise<T[]> {
    return this.runMergeTransaction(() => {
      const results: T[] = [];
      
      for (const step of steps) {
        const result = step();
        results.push(result);
      }
      return results;
    });
  }

  /**
   * マージ履歴保存用のセーフトランザクション
   */
  runSafeHistorySave<T>(
    saveOperation: () => T,
    rollbackCallback?: () => void
  ): T {
    try {
      return this.runMergeTransaction(saveOperation);
    } catch (error) {
      // ロールバック完了後のクリーンアップ
      if (rollbackCallback) {
        try {
          rollbackCallback();
        } catch (callbackError) {
          console.error('Rollback callback failed:', callbackError);
        }
      }
      throw error;
    }
  }

  /**
   * 条件付きトランザクション実行
   * 事前条件チェック付き
   */
  runConditionalTransaction<T>(
    preconditionCheck: () => boolean,
    operation: () => T,
    onPreconditionFailed?: () => void
  ): T {
    return this.runMergeTransaction(() => {
      // 事前条件チェック
      if (!preconditionCheck()) {
        if (onPreconditionFailed) {
          onPreconditionFailed();
        }
        throw new Error('Transaction precondition failed');
      }

      return operation();
    });
  }

  /**
   * バックアップ付きトランザクション
   * 重要なデータ変更の際のセーフティネット
   */
  runBackupTransaction<T>(
    contextId: string,
    operation: () => T
  ): { result: T; backupData: BackupData } {
    return this.runMergeTransaction(() => {
      // 現在の状態をバックアップ
      const backupData = this.createBackup(contextId);

      try {
        const result = operation();
        return { result, backupData };
      } catch (error) {
        // エラー時は自動ロールバック（better-sqlite3が処理）
        console.log('Transaction failed, automatic rollback performed');
        throw error;
      }
    });
  }

  /**
   * 現在の状態のバックアップ作成
   */
  private createBackup(contextId: string): BackupData {
    // 現在のマージ履歴とコンテキスト情報をバックアップ
    const latestVersion = this.mergeDb.getLatestVersion(contextId);
    const latestHistory = latestVersion > 0 
      ? this.mergeDb.getMergeHistoryByVersion(contextId, latestVersion)
      : null;

    return {
      contextId,
      timestamp: new Date().toISOString(),
      data: {
        latestVersion,
        latestHistory
      }
    };
  }

  /**
   * トランザクション統計情報
   */
  getTransactionStats(): {
    supported: boolean;
    autoCommit: boolean;
    inTransaction: boolean;
  } {
    return {
      supported: true, // better-sqlite3は完全にサポート
      autoCommit: !this.db.inTransaction,
      inTransaction: this.db.inTransaction
    };
  }

  /**
   * 診断情報取得
   */
  getDiagnosticInfo(): {
    dbPath: string;
    journalMode: string;
    transactionSupport: boolean;
    connectionStatus: string;
  } {
    try {
      const journalMode = this.db.pragma('journal_mode', { simple: true }) as string;
      
      return {
        dbPath: this.db.name,
        journalMode,
        transactionSupport: true,
        connectionStatus: this.db.open ? 'open' : 'closed'
      };
    } catch (error) {
      return {
        dbPath: 'unknown',
        journalMode: 'unknown',
        transactionSupport: false,
        connectionStatus: 'error'
      };
    }
  }
}
