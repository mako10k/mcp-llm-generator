/**
 * SystemPromptGenerator Feature Flags Integration Test
 * 段階的統合のためのFeature Flag動作確認テスト
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SystemPromptGenerator } from '../src/toolcall-emulation/SystemPromptGenerator.js';
import { PromptContext } from '../src/types/prompt.js';
import { PersonaCapabilities } from '../src/types/persona.js';
import { Tool } from '../src/types/tool.js';

describe('SystemPromptGenerator Feature Flags Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeAll(() => {
    originalEnv = { ...process.env };
  });
  
  afterAll(() => {
    process.env = originalEnv;
  });

  const mockTool: Tool = {
    type: 'function',
    function: {
      name: 'test_tool',
      description: 'Test tool',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input value' }
        },
        required: ['input']
      }
    }
  };

  const mockPersona: PersonaCapabilities = {
    expertise: ['testing', 'development'],
    tools: ['test_tool'],
    restrictions: ['no dangerous operations']
  };

  const mockContext: PromptContext = {
    availableTools: [mockTool],
    persona: mockPersona
  };

  describe('PersonaBuilder Feature Flag', () => {
    it('should use legacy implementation when USE_PERSONA_BUILDER is false', () => {
      process.env.USE_PERSONA_BUILDER = 'false';
      
      const generator = new SystemPromptGenerator();
      const result = generator.generateSystemPrompt('test message', mockContext);
      
      // Legacy implementation should include "## Persona Context"
      expect(result.systemPrompt).toContain('## Persona Context');
      expect(result.systemPrompt).toContain('testing, development');
      expect(result.systemPrompt).toContain('test_tool');
      expect(result.systemPrompt).toContain('no dangerous operations');
    });

    it('should use PersonaBuilder when USE_PERSONA_BUILDER is true', () => {
      process.env.USE_PERSONA_BUILDER = 'true';
      
      const generator = new SystemPromptGenerator();
      const result = generator.generateSystemPrompt('test message', mockContext);
      
      // PersonaBuilder implementation should include persona info
      expect(result.systemPrompt).toBeTruthy();
      expect(result.systemPrompt.length).toBeGreaterThan(0);
      // PersonaBuilderの出力を確認
      const hasTestingOrDev = result.systemPrompt.includes('testing') || 
                              result.systemPrompt.includes('development');
      expect(hasTestingOrDev).toBe(true);
    });

    it('should default to legacy implementation when env var is not set', () => {
      delete process.env.USE_PERSONA_BUILDER;
      
      const generator = new SystemPromptGenerator();
      const result = generator.generateSystemPrompt('test message', mockContext);
      
      // Should use legacy implementation by default
      expect(result.systemPrompt).toContain('## Persona Context');
    });
  });

  describe('ParameterFormatter Feature Flag', () => {
    it('should respect USE_PARAMETER_FORMATTER flag', () => {
      process.env.USE_PARAMETER_FORMATTER = 'false';
      
      const generator = new SystemPromptGenerator();
      const result = generator.generateSystemPrompt('test message', mockContext);
      
      // Should generate valid prompt regardless of flag
      expect(result.systemPrompt).toContain('test_tool');
    });

    it('should use ParameterFormatter when enabled', () => {
      process.env.USE_PARAMETER_FORMATTER = 'true';
      
      const generator = new SystemPromptGenerator();
      const result = generator.generateSystemPrompt('test message', mockContext);
      
      // Should still work with ParameterFormatter
      expect(result.systemPrompt).toContain('test_tool');
    });
  });

  describe('Combined Feature Flags', () => {
    it('should work with both flags enabled', () => {
      process.env.USE_PARAMETER_FORMATTER = 'true';
      process.env.USE_PERSONA_BUILDER = 'true';
      
      const generator = new SystemPromptGenerator();
      const result = generator.generateSystemPrompt('test message', mockContext);
      
      expect(result.systemPrompt).toBeTruthy();
      expect(result.systemPrompt.length).toBeGreaterThan(0);
    });

    it('should work with both flags disabled', () => {
      process.env.USE_PARAMETER_FORMATTER = 'false';
      process.env.USE_PERSONA_BUILDER = 'false';
      
      const generator = new SystemPromptGenerator();
      const result = generator.generateSystemPrompt('test message', mockContext);
      
      expect(result.systemPrompt).toBeTruthy();
      expect(result.systemPrompt).toContain('## Persona Context');
    });
  });

  describe('Combined Feature Flags', () => {
    it('should work with both flags enabled', () => {
      process.env.USE_PARAMETER_FORMATTER = 'true';
      process.env.USE_PERSONA_BUILDER = 'true';
      
      const generator = new SystemPromptGenerator();
      const result = generator.generateSystemPrompt('test message', mockContext);
      
      expect(result.systemPrompt).toBeTruthy();
      expect(result.systemPrompt.length).toBeGreaterThan(0);
    });

    it('should work with both flags disabled', () => {
      process.env.USE_PARAMETER_FORMATTER = 'false';
      process.env.USE_PERSONA_BUILDER = 'false';
      
      const generator = new SystemPromptGenerator();
      const result = generator.generateSystemPrompt('test message', mockContext);
      
      expect(result.systemPrompt).toBeTruthy();
      expect(result.systemPrompt).toContain('## Persona Context');
    });
  });
});
