/**
 * ParameterFormatter 統合テスト
 * 既存SystemPromptGeneratorの formatParameters との互換性を検証
 */

import { describe, test, expect } from 'vitest';
import { ParameterFormatter } from '../toolcall-emulation/prompt-builders/ParameterFormatter.js';

describe('ParameterFormatter 統合テスト', () => {
  // テスト用のパラメータデータ
  const testParameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '検索クエリ'
      },
      limit: {
        type: 'number',
        description: '結果の最大件数'
      },
      includeMetadata: {
        type: 'boolean',
        description: 'メタデータを含めるかどうか'
      }
    },
    required: ['query']
  };

  describe('format メソッド', () => {
    test('必須パラメータのみの場合', () => {
      const result = ParameterFormatter.format(
        testParameters,
        ['query'],
        []
      );

      expect(result).toContain('**Required**:');
      expect(result).toContain('- `query` (string): 検索クエリ');
      expect(result).not.toContain('**Optional**:');
    });

    test('必須・オプションパラメータ混在の場合', () => {
      const result = ParameterFormatter.format(
        testParameters,
        ['query'],
        ['limit', 'includeMetadata']
      );

      expect(result).toContain('**Required**:');
      expect(result).toContain('- `query` (string): 検索クエリ');
      expect(result).toContain('**Optional**:');
      expect(result).toContain('- `limit` (number): 結果の最大件数');
      expect(result).toContain('- `includeMetadata` (boolean): メタデータを含めるかどうか');
    });

    test('オプションパラメータのみの場合', () => {
      const result = ParameterFormatter.format(
        testParameters,
        [],
        ['limit', 'includeMetadata']
      );

      expect(result).not.toContain('**Required**:');
      expect(result).toContain('**Optional**:');
      expect(result).toContain('- `limit` (number): 結果の最大件数');
    });

    test('パラメータが存在しない場合', () => {
      const result = ParameterFormatter.format(
        testParameters,
        [],
        []
      );

      expect(result).toBe('');
    });
  });

  describe('classify メソッド', () => {
    test('パラメータの分類が正しく行われる', () => {
      const result = ParameterFormatter.classify(testParameters);

      expect(result.required).toEqual(['query']);
      expect(result.optional).toEqual(['limit', 'includeMetadata']);
    });

    test('requiredが未定義の場合', () => {
      const paramsWithoutRequired = {
        ...testParameters,
        required: undefined
      };

      const result = ParameterFormatter.classify(paramsWithoutRequired);

      expect(result.required).toEqual([]);
      expect(result.optional).toEqual(['query', 'limit', 'includeMetadata']);
    });
  });

  describe('validate メソッド', () => {
    test('正常なパラメータの検証', () => {
      const result = ParameterFormatter.validate(testParameters);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('propertiesが不足している場合', () => {
      const invalidParams = {
        required: ['query']
      };

      const result = ParameterFormatter.validate(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing properties object');
    });

    test('requiredが配列でない場合', () => {
      const invalidParams = {
        ...testParameters,
        required: 'query' // 文字列で指定（不正）
      };

      const result = ParameterFormatter.validate(invalidParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Required field must be an array');
    });
  });

  describe('既存ロジックとの互換性テスト', () => {
    test('既存formatParametersと同じ出力を生成することを検証', () => {
      // 既存ロジックをシミュレート
      const existingFormatParameters = (
        parameters: any,
        requiredParams: string[],
        optionalParams: string[]
      ): string => {
        const allParams = { ...parameters.properties };
        const formatted: string[] = [];

        // 必須パラメータ
        if (requiredParams.length > 0) {
          formatted.push('**Required**:');
          requiredParams.forEach(param => {
            const paramDef = allParams[param];
            formatted.push(`- \`${param}\` (${paramDef.type}): ${paramDef.description}`);
          });
        }

        // オプショナルパラメータ
        if (optionalParams.length > 0) {
          formatted.push('**Optional**:');
          optionalParams.forEach(param => {
            const paramDef = allParams[param];
            formatted.push(`- \`${param}\` (${paramDef.type}): ${paramDef.description}`);
          });
        }

        return formatted.join('\n');
      };

      const { required, optional } = ParameterFormatter.classify(testParameters);
      
      const newResult = ParameterFormatter.format(testParameters, required, optional);
      const existingResult = existingFormatParameters(testParameters, required, optional);

      expect(newResult).toBe(existingResult);
    });
  });
});
