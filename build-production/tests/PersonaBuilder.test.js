/**
 * PersonaBuilder 統合テスト
 * 既存SystemPromptGeneratorの generatePersonaSection との互換性を検証
 */
import { describe, test, expect } from 'vitest';
import { PersonaBuilder } from '../src/toolcall-emulation/prompt-builders/PersonaBuilder.js';
describe('PersonaBuilder 統合テスト', () => {
    // テスト用のペルソナデータ
    const testPersona = {
        expertise: ['AI/ML', 'Backend Development', 'System Architecture'],
        tools: ['search_tool', 'code_analysis', 'documentation'],
        restrictions: ['No destructive operations', 'Read-only file access']
    };
    const testContext = {
        availableTools: [],
        persona: testPersona
    };
    describe('build メソッド', () => {
        test('完全なペルソナ情報がある場合', () => {
            const builder = new PersonaBuilder();
            const result = builder.build(testContext);
            expect(result).toContain('## Persona Context');
            expect(result).toContain('**Expertise Areas**: AI/ML, Backend Development, System Architecture');
            expect(result).toContain('**Available Tools**: search_tool, code_analysis, documentation');
            expect(result).toContain('**Restrictions**: No destructive operations, Read-only file access');
            expect(result).toContain('Adapt your tool selection and reasoning');
        });
        test('一部の情報が欠けている場合', () => {
            const incompletePersona = {
                expertise: ['AI/ML'],
                // tools と restrictions が未定義
            };
            const context = {
                availableTools: [],
                persona: incompletePersona
            };
            const builder = new PersonaBuilder();
            const result = builder.build(context);
            expect(result).toContain('**Expertise Areas**: AI/ML');
            expect(result).toContain('**Available Tools**: All available'); // デフォルト値
            expect(result).toContain('**Restrictions**: None'); // デフォルト値
        });
        test('すべての情報が欠けている場合', () => {
            const emptyPersona = {};
            const context = {
                availableTools: [],
                persona: emptyPersona
            };
            const builder = new PersonaBuilder();
            const result = builder.build(context);
            expect(result).toContain('**Expertise Areas**: General'); // デフォルト値
            expect(result).toContain('**Available Tools**: All available'); // デフォルト値
            expect(result).toContain('**Restrictions**: None'); // デフォルト値
        });
        test('ペルソナがnullまたはundefinedの場合', () => {
            const contextWithoutPersona = {
                availableTools: []
                // persona: undefined
            };
            const builder = new PersonaBuilder();
            const result = builder.build(contextWithoutPersona);
            expect(result).toBe(''); // 空文字列を返す
        });
    });
    describe('配列処理のテスト', () => {
        test('空の配列が適切に処理される', () => {
            const personaWithEmptyArrays = {
                expertise: [],
                tools: [],
                restrictions: []
            };
            const context = {
                availableTools: [],
                persona: personaWithEmptyArrays
            };
            const builder = new PersonaBuilder();
            const result = builder.build(context);
            expect(result).toContain('**Expertise Areas**: General');
            expect(result).toContain('**Available Tools**: All available');
            expect(result).toContain('**Restrictions**: None');
        });
        test('単一要素の配列が適切に処理される', () => {
            const personaWithSingleItems = {
                expertise: ['Frontend Development'],
                tools: ['debug_tool'],
                restrictions: ['Development environment only']
            };
            const context = {
                availableTools: [],
                persona: personaWithSingleItems
            };
            const builder = new PersonaBuilder();
            const result = builder.build(context);
            expect(result).toContain('**Expertise Areas**: Frontend Development');
            expect(result).toContain('**Available Tools**: debug_tool');
            expect(result).toContain('**Restrictions**: Development environment only');
        });
    });
    describe('Builder設定のテスト', () => {
        test('isRequired()は常にfalseを返す', () => {
            const builder = new PersonaBuilder();
            expect(builder.isRequired()).toBe(false);
        });
        test('getSectionName()は正しい名前を返す', () => {
            const builder = new PersonaBuilder();
            expect(builder.getSectionName()).toBe('Persona Context');
        });
        test('カスタム設定が適用される', () => {
            const customConfig = {
                enabled: false,
                priority: 5,
                maxLength: 500
            };
            const builder = new PersonaBuilder(customConfig);
            // BasePromptSectionBuilderの設定が適用されることを確認
            // 具体的な検証は、Builderの設定アクセサが必要
        });
    });
    describe('既存ロジックとの互換性テスト', () => {
        test('既存generatePersonaSectionと同じ出力を生成することを検証', () => {
            // 既存ロジックをシミュレート
            const existingGeneratePersonaSection = (persona) => {
                return `## Persona Context

You are operating with the following capabilities and constraints:

**Expertise Areas**: ${persona.expertise?.join(', ') || 'General'}
**Available Tools**: ${persona.tools?.join(', ') || 'All available'}
**Restrictions**: ${persona.restrictions?.join(', ') || 'None'}

Adapt your tool selection and reasoning to align with these persona characteristics.`;
            };
            const builder = new PersonaBuilder();
            const newResult = builder.build(testContext);
            const existingResult = existingGeneratePersonaSection(testPersona);
            expect(newResult).toBe(existingResult);
        });
        test('複数の代表的なペルソナパターンでの互換性確認', () => {
            const testCases = [
                // 完全なペルソナ
                {
                    expertise: ['AI', 'ML', 'Data Science'],
                    tools: ['analyze', 'predict', 'visualize'],
                    restrictions: ['No data modification', 'Privacy compliant']
                },
                // 最小のペルソナ
                {
                    expertise: ['General']
                },
                // 空のペルソナ
                {}
            ];
            const existingGeneratePersonaSection = (persona) => {
                return `## Persona Context

You are operating with the following capabilities and constraints:

**Expertise Areas**: ${persona.expertise?.join(', ') || 'General'}
**Available Tools**: ${persona.tools?.join(', ') || 'All available'}
**Restrictions**: ${persona.restrictions?.join(', ') || 'None'}

Adapt your tool selection and reasoning to align with these persona characteristics.`;
            };
            testCases.forEach((persona, index) => {
                const context = {
                    availableTools: [],
                    persona
                };
                const builder = new PersonaBuilder();
                const newResult = builder.build(context);
                const existingResult = existingGeneratePersonaSection(persona);
                expect(newResult).toBe(existingResult);
            });
        });
    });
});
