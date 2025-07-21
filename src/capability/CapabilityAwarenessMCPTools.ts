/**
 * Step3: Capability Awareness System MCP Tools Integration
 * 
 * Integrates CapabilityAwarenessService with MCP protocol,
 * enabling external systems to utilize capability awareness functions
 */

import { z } from 'zod';
import { CapabilityAwarenessService, SelfAwarenessInfo, OtherAwarenessInfo } from './CapabilityAwarenessService.js';

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

export class CapabilityAwarenessMCPTools {
  private service: CapabilityAwarenessService;

  constructor(dbPath: string) {
    this.service = new CapabilityAwarenessService(dbPath);
  }

  /**
   * MCP Tool: Self-awareness function
   * Get self-recognition information for specified persona
   */
  getToolDefinitions() {
    return {
      'capability-get-self-awareness': {
        description: 'Enable specified persona to recognize own capabilities, constraints, and responsibilities (self-awareness)',
        inputSchema: GetSelfAwarenessSchema
      },
      
      'capability-get-other-awareness': {
        description: 'Enable observer persona to observe and evaluate other personas capabilities (other-awareness)',
        inputSchema: GetOtherAwarenessSchema
      },
      
      'capability-process-inheritance': {
        description: 'Process capability inheritance from parent to child (inheritance function)',
        inputSchema: ProcessInheritanceSchema
      },
      
      'capability-get-matrix': {
        description: 'Display capability matrix and inheritance relationships for multiple personas',
        inputSchema: GetCapabilityMatrixSchema
      },
      
      'capability-analyze-hierarchy': {
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
  async handleToolCall(toolName: string, args: any): Promise<any> {
    try {
      switch (toolName) {
        case 'capability-get-self-awareness':
          return await this.handleGetSelfAwareness(args);
          
        case 'capability-get-other-awareness':
          return await this.handleGetOtherAwareness(args);
          
        case 'capability-process-inheritance':
          return await this.handleProcessInheritance(args);
          
        case 'capability-get-matrix':
          return await this.handleGetCapabilityMatrix(args);
          
        case 'capability-analyze-hierarchy':
          return await this.handleAnalyzeHierarchy(args);
          
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`Error in tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tool: toolName,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async handleGetSelfAwareness(args: any) {
    const { context_id } = GetSelfAwarenessSchema.parse(args);
    
    const selfAwareness = await this.service.getSelfAwareness(context_id);
    
    return {
      success: true,
      tool: 'capability-get-self-awareness',
      data: selfAwareness,
      summary: {
        context_id,
        hierarchy_depth: selfAwareness.position_in_hierarchy.depth,
        capabilities_count: {
          expertise: selfAwareness.own_capabilities.expertise.length,
          tools: selfAwareness.own_capabilities.tools.length,
          restrictions: selfAwareness.own_capabilities.restrictions.length
        },
        position: {
          is_root: selfAwareness.position_in_hierarchy.is_root,
          is_leaf: selfAwareness.position_in_hierarchy.is_leaf,
          ancestors_count: selfAwareness.position_in_hierarchy.ancestors.length,
          descendants_count: selfAwareness.position_in_hierarchy.descendants.length
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  private async handleGetOtherAwareness(args: any) {
    const { observer_context_id, target_context_id } = GetOtherAwarenessSchema.parse(args);
    
    const otherAwareness = await this.service.getOtherAwareness(observer_context_id, target_context_id);
    
    return {
      success: true,
      tool: 'capability-get-other-awareness',
      data: otherAwareness,
      summary: {
        observer: observer_context_id,
        target: target_context_id,
        relationship: otherAwareness.relationship,
        observable_capabilities: {
          expertise: otherAwareness.observable_capabilities.expertise.length,
          tools: otherAwareness.observable_capabilities.tools.length,
          restrictions: otherAwareness.observable_capabilities.restrictions.length
        },
        has_assessment: !!otherAwareness.assessment
      },
      timestamp: new Date().toISOString()
    };
  }

  private async handleProcessInheritance(args: any) {
    const { parent_context_id, child_context_id } = ProcessInheritanceSchema.parse(args);
    
    await this.service.processCapabilityInheritance(parent_context_id, child_context_id);
    
    // Get updated child capabilities after processing
    const updatedChildAwareness = await this.service.getSelfAwareness(child_context_id);
    
    return {
      success: true,
      tool: 'capability-process-inheritance',
      data: {
        parent_context_id,
        child_context_id,
        inheritance_completed: true,
        updated_child_capabilities: updatedChildAwareness.own_capabilities
      },
      summary: {
        inheritance_path: `${parent_context_id} → ${child_context_id}`,
        inherited_capabilities: {
          expertise: updatedChildAwareness.own_capabilities.expertise.length,
          tools: updatedChildAwareness.own_capabilities.tools.length,
          restrictions: updatedChildAwareness.own_capabilities.restrictions.length
        },
        inherited_from_count: updatedChildAwareness.own_capabilities.inherited_from.length
      },
      timestamp: new Date().toISOString()
    };
  }

  private async handleGetCapabilityMatrix(args: any) {
    const { context_ids, include_inheritance } = GetCapabilityMatrixSchema.parse(args);
    
    // TODO: Implement multiple persona capability matrix generation
    // Example: Organize all persona capabilities in tabular format
    
    const matrix = await this.generateCapabilityMatrix(context_ids, include_inheritance);
    
    return {
      success: true,
      tool: 'capability-get-matrix',
      data: matrix,
      summary: {
        total_personas: matrix.personas.length,
        unique_expertise: matrix.statistics.unique_expertise_count,
        unique_tools: matrix.statistics.unique_tools_count,
        hierarchy_levels: matrix.statistics.max_depth
      },
      timestamp: new Date().toISOString()
    };
  }

  private async handleAnalyzeHierarchy(args: any) {
    const { root_context_id } = args;
    
    // TODO: Hierarchy analysis and optimization suggestions
    const analysis = await this.analyzeHierarchyStructure(root_context_id);
    
    return {
      success: true,
      tool: 'capability-analyze-hierarchy',
      data: analysis,
      summary: {
        analyzed_personas: analysis.total_personas,
        optimization_suggestions: analysis.optimization_suggestions.length,
        potential_improvements: analysis.potential_improvements.length
      },
      timestamp: new Date().toISOString()
    };
  }

  private async generateCapabilityMatrix(contextIds?: string[], includeInheritance: boolean = true) {
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

  private async analyzeHierarchyStructure(rootContextId?: string) {
    // TODO: Implement hierarchy analysis
    return {
      total_personas: 0,
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
