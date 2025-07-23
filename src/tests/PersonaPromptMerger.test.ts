// Step4マージ機能 - 基本テスト
// 作成日: 2025年7月22日
// テスト対象: PersonaPromptMerger基本機能

import { describe, it, expect, beforeEach } from 'vitest';
import { PersonaPromptMerger } from '../utils/PersonaPromptMerger.js';
import { MergeInputParams } from '../types/promptMerge.js';
import Database from 'better-sqlite3';

describe('PersonaPromptMerger', () => {
  let merger: PersonaPromptMerger;
  let db: Database.Database;

  beforeEach(() => {
    // インメモリデータベースでテスト用インスタンスを作成
    db = new Database(':memory:');
    merger = new PersonaPromptMerger(db);
  });

  describe('基本的なマージ機能', () => {
    it('正常なマージ処理が実行される', async () => {
      const params: MergeInputParams = {
        contextId: 'test-context-001',
        userSystemPrompt: 'You are a helpful programming assistant.',
        taskContext: 'Code review task'
      };

      const result = await merger.mergeSystemPrompt(params);

      // エラーでないことを確認
      expect(result).not.toHaveProperty('code');
      
      if ('mergedSystemPrompt' in result) {
        expect(result.mergedSystemPrompt).toContain('helpful programming assistant');
        expect(result.tokenCount).toBeGreaterThan(0);
        expect(result.originalTokenCount).toBeGreaterThan(0);
        expect(Array.isArray(result.conflicts)).toBe(true);
      }
    });

    it('必須パラメータが不足している場合エラーを返す', async () => {
      const params: MergeInputParams = {
        contextId: '',
        userSystemPrompt: '',
      };

      const result = await merger.mergeSystemPrompt(params);

      // エラーが返されることを確認
      expect(result).toHaveProperty('code');
      
      if ('code' in result) {
        expect(result.code).toBe('MERGE_FAILED');
        expect(result.details.rollbackPerformed).toBe(true);
      }
    });

    it('トークン数計算が正常に動作する', async () => {
      const params: MergeInputParams = {
        contextId: 'test-context-002',
        userSystemPrompt: 'Short prompt.',
        taskContext: 'Simple task'
      };

      const result = await merger.mergeSystemPrompt(params);

      if ('mergedSystemPrompt' in result) {
        expect(result.tokenCount).toBeGreaterThan(0);
        expect(result.originalTokenCount).toBeGreaterThan(0);
        expect(typeof result.tokenReduction).toBe('number');
      }
    });
  });

  describe('エラー処理', () => {
    it('長すぎるプロンプトでエラーが発生する', async () => {
      const longPrompt = 'A'.repeat(50000); // 非常に長いプロンプト
      
      const params: MergeInputParams = {
        contextId: 'test-context-003',
        userSystemPrompt: longPrompt,
      };

      const result = await merger.mergeSystemPrompt(params);

      // エラーが返されることを確認
      expect(result).toHaveProperty('code');
      
      if ('code' in result) {
        expect(result.code).toBe('MERGE_FAILED');
        expect(result.message).toContain('too long');
      }
    });
  });

  describe('圧縮設定', () => {
    it('圧縮設定が正しく処理される', async () => {
      const params: MergeInputParams = {
        contextId: 'test-context-004',
        userSystemPrompt: 'You are a detailed programming assistant with extensive capabilities.',
        compressionConfig: {
          level: 'medium',
          preserveSecurityConstraints: true,
          maxTokens: 1000,
          compressionStrategy: 'ai_summary'
        }
      };

      const result = await merger.mergeSystemPrompt(params);

      if ('mergedSystemPrompt' in result) {
        expect(result.compressionDetails).toBeDefined();
        expect(typeof result.compressionDetails.compressionApplied).toBe('boolean');
        expect(Array.isArray(result.compressionDetails.removedRedundancy)).toBe(true);
        expect(Array.isArray(result.compressionDetails.preservedInformation)).toBe(true);
      }
    });
  });
});
