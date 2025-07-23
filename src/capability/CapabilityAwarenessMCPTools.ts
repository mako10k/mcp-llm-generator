/**
 * Step3: Capability Awareness System MCP Tools Integration
 * 
 * Integrates CapabilityAwarenessService with MCP protocol,
 * enabling external systems to utilize capability awareness functions
 */

import { z } from 'zod';
import { CapabilityAwarenessService } from './CapabilityAwarenessService.js';
import { 
  MCPToolResponse,
  createMCPTextResponse,
  createMCPErrorResponse
} from '../types/mcp-responses.js';
import { 
  MCPToolDefinitions,
  MCPToolRegistry 
} from '../types/mcp-tool-definitions.js';

// MCP tool schema definitions
const GetSelfAwarenessSchema = z.object({
  context_id: z.string().describe('Context ID of the persona to get self-awareness information')
});

const GetOtherAwarenessSchema = z.object({
  observer_context_id: z.string().describe('Observer persona context ID'),
  target_context_id: z.string().describe('Target persona context ID to observe')
});

const ProcessInheritanceSchema = z.object({
  parent_context_id: z.string().describe('Parent persona context ID'),
  child_context_id: z.string().describe('Child persona context ID')
});

const GetCapabilityMatrixSchema = z.object({
  context_ids: z.array(z.string()).optional().describe('List of target personas (all personas if omitted)'),
  include_inheritance: z.boolean().default(true).describe('Whether to include inheritance relationship information')
});

export class CapabilityAwarenessMCPTools implements MCPToolRegistry {
  private service: CapabilityAwarenessService;

  constructor(dbPath: string) {
    this.service = new CapabilityAwarenessService(dbPath);
  }

  /**
   * MCP Tool: Self-awareness function
   * Get self-recognition information for specified persona
   */
  getToolDefinitions(): MCPToolDefinitions {
    return {
      'persona-inspect-capabilities': {
        description: 'Enable specified persona to recognize own capabilities, constraints, and responsibilities (self-awareness)',
        inputSchema: GetSelfAwarenessSchema
      },
      
      'persona-evaluate-interaction': {
        description: 'Enable observer persona to observe and evaluate other personas capabilities (other-awareness)',
        inputSchema: GetOtherAwarenessSchema
      },
      
      'persona-transfer-knowledge': {
        description: 'Process capability inheritance from parent to child (inheritance function)',
        inputSchema: ProcessInheritanceSchema
      },
      
      'group-get-capability-overview': {
        description: 'Display capability matrix and inheritance relationships for multiple personas',
        inputSchema: GetCapabilityMatrixSchema
      },
      
      'network-analyze-structure': {
        description: 'Analyze capability distribution and optimization suggestions for entire persona hierarchy',
        inputSchema: z.object({
          root_context_id: z.string().optional().describe('Root persona ID to start analysis (all hierarchy if omitted)')
        })
      }
    };
  }

  /**
   * MCP tool execution handler
   */
  async handleToolCall(toolName: string, args: unknown): Promise<MCPToolResponse> {
    try {
      switch (toolName) {
        case 'persona-inspect-capabilities':
          return await this.handleGetSelfAwareness(args);
          
        case 'persona-evaluate-interaction':
          return await this.handleGetOtherAwareness(args);
          
        case 'persona-transfer-knowledge':
          return await this.handleProcessInheritance(args);
          
        case 'group-get-capability-overview':
          return await this.handleGetCapabilityMatrix(args);
          
        case 'network-analyze-structure':
          return await this.handleAnalyzeHierarchy(args);
          
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`Error in tool ${toolName}:`, error);
      return createMCPErrorResponse(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private async handleGetSelfAwareness(args: unknown): Promise<MCPToolResponse> {
    const { context_id } = GetSelfAwarenessSchema.parse(args);
    
    const selfAwareness = await this.service.getSelfAwareness(context_id);
    
    // MCP仕様: text値はJSONパース可能文字列である必要
    const responseData = {
      success: true,
      tool: 'persona-inspect-capabilities',
      context_id,
      data: selfAwareness,
      capabilities_summary: {
        expertise_count: selfAwareness.own_capabilities.expertise.length,
        tools_count: selfAwareness.own_capabilities.tools.length,
        restrictions_count: selfAwareness.own_capabilities.restrictions.length
      },
      hierarchy_position: {
        depth: selfAwareness.position_in_hierarchy.depth,
        is_root: selfAwareness.position_in_hierarchy.is_root,
        is_leaf: selfAwareness.position_in_hierarchy.is_leaf
      },
      key_expertise: selfAwareness.own_capabilities.expertise.slice(0, 3)
    };
    
    return createMCPTextResponse(JSON.stringify(responseData));
  }

  private async handleGetOtherAwareness(args: unknown): Promise<MCPToolResponse> {
    const { observer_context_id, target_context_id } = GetOtherAwarenessSchema.parse(args);
    
    const otherAwareness = await this.service.getOtherAwareness(observer_context_id, target_context_id);
    
    // MCP仕様: text値はJSONパース可能文字列である必要
    const responseData = {
      success: true,
      tool: 'persona-evaluate-interaction',
      observer_context_id,
      target_context_id,
      data: otherAwareness,
      relationship: otherAwareness.relationship,
      observable_capabilities_count: otherAwareness.observable_capabilities?.expertise?.length || 0
    };
    
    return createMCPTextResponse(JSON.stringify(responseData));
  }

  private async handleProcessInheritance(args: unknown): Promise<MCPToolResponse> {
    const { parent_context_id, child_context_id } = ProcessInheritanceSchema.parse(args);
    
    await this.service.processCapabilityInheritance(parent_context_id, child_context_id);
    
    // Get updated child capabilities after processing
    const updatedChildAwareness = await this.service.getSelfAwareness(child_context_id);
    
    // MCP仕様: text値はJSONパース可能文字列である必要
    const responseData = {
      success: true,
      tool: 'persona-transfer-knowledge',
      parent_context_id,
      child_context_id,
      data: updatedChildAwareness,
      inheritance_completed: true,
      inherited_capabilities_count: {
        expertise: updatedChildAwareness.own_capabilities.expertise.length,
        tools: updatedChildAwareness.own_capabilities.tools.length,
        restrictions: updatedChildAwareness.own_capabilities.restrictions.length
      },
      inherited_from_count: updatedChildAwareness.own_capabilities.inherited_from.length,
      timestamp: new Date().toISOString()
    };
    
    return createMCPTextResponse(JSON.stringify(responseData));
  }

  private async handleGetCapabilityMatrix(args: unknown): Promise<MCPToolResponse> {
    const { context_ids, include_inheritance } = GetCapabilityMatrixSchema.parse(args);
    
    // TODO: Implement multiple persona capability matrix generation
    // Example: Organize all persona capabilities in tabular format
    
    const matrix = await this.generateCapabilityMatrix(context_ids, include_inheritance);
    
    // MCP仕様: text値はJSONパース可能文字列である必要
    const responseData = {
      success: true,
      tool: 'group-get-capability-overview',
      data: matrix,
      total_personas: matrix.personas.length,
      unique_expertise: matrix.statistics.unique_expertise_count,
      unique_tools: matrix.statistics.unique_tools_count,
      hierarchy_levels: matrix.statistics.max_depth,
      timestamp: new Date().toISOString()
    };
    
    return createMCPTextResponse(JSON.stringify(responseData));
  }

  private async handleAnalyzeHierarchy(args: unknown): Promise<MCPToolResponse> {
    // Validate input schema (root_context_id will be used in future implementation)
    z.object({
      root_context_id: z.string().optional().describe('Root persona ID for analysis start (all hierarchies if omitted)')
    }).parse(args);
    
    // TODO: Hierarchy analysis and optimization suggestions
    const analysis = await this.analyzeHierarchyStructure();
    
    // MCP仕様: text値はJSONパース可能文字列である必要
    const responseData = {
      success: true,
      tool: 'network-analyze-structure',
      data: analysis,
      analyzed_personas: analysis.total_personas,
      optimization_suggestions_count: analysis.optimization_suggestions.length,
      potential_improvements_count: analysis.potential_improvements.length,
      timestamp: new Date().toISOString()
    };
    
    return createMCPTextResponse(JSON.stringify(responseData));
  }

  private async generateCapabilityMatrix(contextIds?: string[], includeInheritance: boolean = true): Promise<{
    personas: unknown[];
    statistics: {
      unique_expertise_count: number;
      unique_tools_count: number;
      max_depth: number;
    };
    inheritance_map: Record<string, unknown> | null;
  }> {
    // TODO: Implement capability matrix generation
    return {
      personas: [],
      statistics: {
        unique_expertise_count: 0,
        unique_tools_count: 0,
        max_depth: 0
      },
      inheritance_map: includeInheritance ? {} : null
    };
  }

  private async analyzeHierarchyStructure(): Promise<{
    total_personas: number;
    hierarchical_levels: number;
    optimization_suggestions: string[];
    potential_improvements: string[];
  }> {
    // TODO: Implement hierarchy analysis
    return {
      total_personas: 0,
      hierarchical_levels: 0,
      optimization_suggestions: [],
      potential_improvements: []
    };
  }

  // Helper method: Generate detailed persona description
  async generatePersonaDescription(contextId: string): Promise<string> {
    try {
      const selfAwareness = await this.service.getSelfAwareness(contextId);
      
      const description = [
        `Persona ID: ${contextId}`,
        `Hierarchy Level: ${selfAwareness.position_in_hierarchy.depth}`,
        `Expertise: ${selfAwareness.own_capabilities.expertise.join(', ') || 'None'}`,
        `Available Tools: ${selfAwareness.own_capabilities.tools.join(', ') || 'None'}`,
        `Restrictions: ${selfAwareness.own_capabilities.restrictions.join(', ') || 'None'}`,
        `Responsibilities: ${selfAwareness.responsibilities.join(', ') || 'None'}`,
        `Position: ${selfAwareness.position_in_hierarchy.is_root ? 'Root' : ''}${selfAwareness.position_in_hierarchy.is_leaf ? 'Leaf' : ''}`,
        `Children Count: ${selfAwareness.position_in_hierarchy.descendants.length}`,
        `Parent Count: ${selfAwareness.position_in_hierarchy.ancestors.length}`
      ].join('\n');
      
      return description;
    } catch (error) {
      return `Failed to get detailed information for persona ${contextId}: ${error}`;
    }
  }

  // Resource cleanup
  close(): void {
    this.service.close();
  }
}

// Export utility functions
export async function createCapabilityAwarenessTools(dbPath: string): Promise<CapabilityAwarenessMCPTools> {
  return new CapabilityAwarenessMCPTools(dbPath);
}

export { GetSelfAwarenessSchema, GetOtherAwarenessSchema, ProcessInheritanceSchema, GetCapabilityMatrixSchema };
