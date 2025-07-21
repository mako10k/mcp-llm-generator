/**
 * メインMCPサーバーに共有メモリツールを統合（ベストプラクティス版）
 * server.registerTool()を使用したモダンな統合方法
 */
import { SharedMemoryToolsManager } from './shared-memory-tools.js';
import Database from 'better-sqlite3';
/**
 * 🟢 ベストプラクティス: server.registerTool()による統合
 * contextMemoryツールと同様のパターンに統一
 */
export declare function registerSharedMemoryTools(server: any, database: Database.Database): SharedMemoryToolsManager;
/**
 * 🧪 基本機能テスト（ベストプラクティス版）
 * 新しいツール登録方法でのテスト
 */
export declare function testSharedMemoryBestPractices(): Promise<void>;
