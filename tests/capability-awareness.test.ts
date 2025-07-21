/**
 * Step3: Capability Awareness System - Comprehensive Test Suite
 * 
 * Tests for CapabilityAwarenessService and CapabilityAwarenessMCPTools
 * Following QA Engineer approved Test Quality Guidelines
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CapabilityAwarenessService } from '../src/capability/CapabilityAwarenessService.js';
import { CapabilityAwarenessMCPTools } from '../src/capability/CapabilityAwarenessMCPTools.js';
import { MCPToolResponse } from '../src/types/mcp-responses.js';
import * as fs from 'fs';
import * as path from 'path';

// Type guard for text content
function isTextContent(content: any): content is { type: 'text'; text: string } {
  return content && content.type === 'text' && typeof content.text === 'string';
}

describe('Step3 Capability Awareness System', () => {
  const testDbPath = 'data/test-capability-awareness.db';
  let service: CapabilityAwarenessService;
  let mcpTools: CapabilityAwarenessMCPTools;

  beforeEach(async () => {
    // Clean up test database if exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    service = new CapabilityAwarenessService(testDbPath);
    mcpTools = new CapabilityAwarenessMCPTools(testDbPath);
  });

  afterEach(async () => {
    // Clean up resources
    service.close();
    mcpTools.close();
    
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('CapabilityAwarenessService', () => {
    describe('Database Initialization', () => {
      it('should create database schema successfully', () => {
        expect(fs.existsSync(testDbPath)).toBe(true);
        
        // Verify tables exist by attempting to query them
        expect(() => {
          service.getSelfAwareness('test-context');
        }).not.toThrow();
      });

      it('should handle database connection errors gracefully', () => {
        const invalidDbPath = '/invalid/path/db.sqlite';
        expect(() => {
          new CapabilityAwarenessService(invalidDbPath);
        }).toThrow();
      });
    });

    describe('Self-Awareness Function', () => {
      it('should return default self-awareness for new context', async () => {
        const contextId = 'test-context-001';
        const selfAwareness = await service.getSelfAwareness(contextId);

        expect(selfAwareness).toHaveProperty('context_id', contextId);
        expect(selfAwareness).toHaveProperty('own_capabilities');
        expect(selfAwareness).toHaveProperty('constraints');
        expect(selfAwareness).toHaveProperty('responsibilities');
        expect(selfAwareness).toHaveProperty('position_in_hierarchy');
        expect(selfAwareness.own_capabilities).toHaveProperty('expertise');
        expect(selfAwareness.own_capabilities).toHaveProperty('tools');
        expect(selfAwareness.own_capabilities).toHaveProperty('restrictions');
      });

      it('should handle non-existent context gracefully', async () => {
        const contextId = 'non-existent-context';
        const selfAwareness = await service.getSelfAwareness(contextId);

        expect(selfAwareness.context_id).toBe(contextId);
        expect(Array.isArray(selfAwareness.own_capabilities.expertise)).toBe(true);
        expect(Array.isArray(selfAwareness.own_capabilities.tools)).toBe(true);
        expect(Array.isArray(selfAwareness.own_capabilities.restrictions)).toBe(true);
      });

      it('should maintain context isolation', async () => {
        const context1 = 'test-context-001';
        const context2 = 'test-context-002';

        const awareness1 = await service.getSelfAwareness(context1);
        const awareness2 = await service.getSelfAwareness(context2);

        expect(awareness1.context_id).toBe(context1);
        expect(awareness2.context_id).toBe(context2);
        expect(awareness1.context_id).not.toBe(awareness2.context_id);
      });
    });

    describe('Other-Awareness Function', () => {
      it('should return other-awareness information', async () => {
        const observerId = 'observer-001';
        const targetId = 'target-001';

        const otherAwareness = await service.getOtherAwareness(observerId, targetId);

        expect(otherAwareness).toHaveProperty('observer_context_id', observerId);
        expect(otherAwareness).toHaveProperty('target_context_id', targetId);
        expect(otherAwareness).toHaveProperty('relationship');
        expect(otherAwareness).toHaveProperty('observable_capabilities');
        expect(otherAwareness).toHaveProperty('assessment');
      });

      it('should handle same observer and target', async () => {
        const contextId = 'same-context';

        const otherAwareness = await service.getOtherAwareness(contextId, contextId);

        expect(otherAwareness.observer_context_id).toBe(contextId);
        expect(otherAwareness.target_context_id).toBe(contextId);
        expect(otherAwareness.relationship).toBe('self');
      });

      it('should validate input parameters', async () => {
        await expect(async () => {
          await service.getOtherAwareness('', 'target');
        }).rejects.toThrow();

        await expect(async () => {
          await service.getOtherAwareness('observer', '');
        }).rejects.toThrow();
      });
    });

    describe('Capability Inheritance Function', () => {
      it('should process capability inheritance successfully', async () => {
        const parentId = 'parent-001';
        const childId = 'child-001';

        // Should not throw error
        await expect(
          service.processCapabilityInheritance(parentId, childId)
        ).resolves.not.toThrow();

        // Verify inheritance was processed
        const childAwareness = await service.getSelfAwareness(childId);
        expect(childAwareness.own_capabilities.inherited_from).toContain(parentId);
      });

      it('should handle circular inheritance prevention', async () => {
        const context1 = 'context-001';
        const context2 = 'context-002';

        // Create inheritance: context1 -> context2
        await service.processCapabilityInheritance(context1, context2);

        // Attempt circular inheritance: context2 -> context1
        await expect(
          service.processCapabilityInheritance(context2, context1)
        ).rejects.toThrow('Circular inheritance detected');
      });

      it('should validate inheritance parameters', async () => {
        await expect(async () => {
          await service.processCapabilityInheritance('', 'child');
        }).rejects.toThrow();

        await expect(async () => {
          await service.processCapabilityInheritance('parent', '');
        }).rejects.toThrow();

        await expect(async () => {
          await service.processCapabilityInheritance('same', 'same');
        }).rejects.toThrow('Self-inheritance not allowed');
      });
    });
  });

  describe('CapabilityAwarenessMCPTools', () => {
    describe('Tool Definition Registration', () => {
      it('should provide all required MCP tool definitions', () => {
        const toolDefs = mcpTools.getToolDefinitions();

        expect(toolDefs).toHaveProperty('capability-get-self-awareness');
        expect(toolDefs).toHaveProperty('capability-get-other-awareness');
        expect(toolDefs).toHaveProperty('capability-process-inheritance');
        expect(toolDefs).toHaveProperty('capability-get-matrix');
        expect(toolDefs).toHaveProperty('capability-analyze-hierarchy');

        // Verify each tool has required properties
        Object.values(toolDefs).forEach((toolDef: any) => {
          expect(toolDef).toHaveProperty('description');
          expect(toolDef).toHaveProperty('inputSchema');
        });
      });
    });

    describe('MCP Tool Call Handling', () => {
      it('should handle capability-get-self-awareness tool call', async () => {
        const args = { context_id: 'test-context-001' };
        const response = await mcpTools.handleToolCall('capability-get-self-awareness', args);

        expect(response).toHaveProperty('content');
        expect(Array.isArray(response.content)).toBe(true);
        expect(response.content.length).toBeGreaterThan(0);
        expect(response.content[0]).toHaveProperty('type', 'text');
        expect(response.content[0]).toHaveProperty('text');

        // Verify response is valid JSON
        const responseData = JSON.parse(response.content[0].text);
        expect(responseData).toHaveProperty('success', true);
        expect(responseData).toHaveProperty('tool', 'capability-get-self-awareness');
        expect(responseData).toHaveProperty('data');
      });

      it('should handle capability-get-other-awareness tool call', async () => {
        const args = {
          observer_context_id: 'observer-001',
          target_context_id: 'target-001'
        };
        const response = await mcpTools.handleToolCall('capability-get-other-awareness', args);

        expect(response).toHaveProperty('content');
        const responseData = JSON.parse(response.content[0].text);
        expect(responseData).toHaveProperty('success', true);
        expect(responseData).toHaveProperty('tool', 'capability-get-other-awareness');
      });

      it('should handle capability-process-inheritance tool call', async () => {
        const args = {
          parent_context_id: 'parent-001',
          child_context_id: 'child-001'
        };
        const response = await mcpTools.handleToolCall('capability-process-inheritance', args);

        expect(response).toHaveProperty('content');
        const responseData = JSON.parse(response.content[0].text);
        expect(responseData).toHaveProperty('success', true);
        expect(responseData).toHaveProperty('tool', 'capability-process-inheritance');
      });

      it('should handle unknown tool gracefully', async () => {
        const response = await mcpTools.handleToolCall('unknown-tool', {});

        expect(response).toHaveProperty('content');
        expect(response).toHaveProperty('isError', true);
        expect(response.content[0].text).toContain('Error:');
        expect(response.content[0].text).toContain('Unknown tool');
      });

      it('should handle invalid arguments gracefully', async () => {
        const response = await mcpTools.handleToolCall('capability-get-self-awareness', {});

        expect(response).toHaveProperty('content');
        expect(response).toHaveProperty('isError', true);
        expect(response.content[0].text).toContain('Error:');
      });
    });

    describe('Response Format Compliance', () => {
      it('should return MCP-compliant response format', async () => {
        const args = { context_id: 'test-context' };
        const response = await mcpTools.handleToolCall('capability-get-self-awareness', args);

        // Verify MCP response schema compliance
        expect(response).toHaveProperty('content');
        expect(Array.isArray(response.content)).toBe(true);
        expect(response.content[0]).toHaveProperty('type', 'text');
        expect(response.content[0]).toHaveProperty('text');
        expect(typeof response.content[0].text).toBe('string');

        // Verify no "o.content is not iterable" error format
        expect(response).not.toHaveProperty('success');
        expect(response).not.toHaveProperty('data');
        expect(response).not.toHaveProperty('tool');
      });

      it('should return error response in MCP format', async () => {
        const response = await mcpTools.handleToolCall('invalid-tool', {});

        expect(response).toHaveProperty('content');
        expect(response).toHaveProperty('isError', true);
        expect(Array.isArray(response.content)).toBe(true);
        expect(response.content[0]).toHaveProperty('type', 'text');
        expect(response.content[0].text).toContain('Error:');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should maintain data consistency between service and MCP tools', async () => {
      const contextId = 'integration-test-001';

      // Get self-awareness via service
      const serviceResult = await service.getSelfAwareness(contextId);

      // Get self-awareness via MCP tools
      const mcpResponse = await mcpTools.handleToolCall('capability-get-self-awareness', { context_id: contextId });
      const mcpData = JSON.parse(mcpResponse.content[0].text);

      // Verify data consistency
      expect(mcpData.data.context_id).toBe(serviceResult.context_id);
      expect(mcpData.data.own_capabilities.expertise).toEqual(serviceResult.own_capabilities.expertise);
      expect(mcpData.data.own_capabilities.tools).toEqual(serviceResult.own_capabilities.tools);
      expect(mcpData.data.own_capabilities.restrictions).toEqual(serviceResult.own_capabilities.restrictions);
    });

    it('should handle concurrent capability operations', async () => {
      const promises = [];

      // Create multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        promises.push(
          mcpTools.handleToolCall('capability-get-self-awareness', { context_id: `concurrent-${i}` })
        );
      }

      const results = await Promise.all(promises);

      // Verify all operations completed successfully
      results.forEach((result, index) => {
        expect(result).toHaveProperty('content');
        const data = JSON.parse(result.content[0].text);
        expect(data.success).toBe(true);
        expect(data.data.context_id).toBe(`concurrent-${index}`);
      });
    });
  });
});
