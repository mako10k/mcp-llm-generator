#!/usr/bin/env node
/**
 * MCP Sampler Server with Sample Tool
 * 
 * This server demonstrates:
 * - Basic MCP server setup using TypeScript SDK
 * - Implementation of a 'sample' tool that uses LLM sampling
 * - Resource// Template execution tool implementation
server.registerTool(
  "template-execute",
  {
    title: "Template Execution",
    description: "Execute a predefined template with parameter substitution via LLM text generation",
    inputSchema: {
      templateName: z.string().describe("Name of the template to execute"),
      args: z.record(z.string()).describe("Arguments for template parameter substitution"),
      maxTokens: z.number().optional().default(500).describe("Maximum tokens to generate"),
      temperature: z.number().optional().default(0.7).describe("Sampling temperature (0.0 to 1.0)"),
      includeContext: z.enum(["none", "thisServer", "allServers"]).optional().default("none").describe("Context inclusion level")
    }sample configurations
 * - Prompt templates for sample operations
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Template structure definition
type SampleTemplate = {
  name: string;
  systemPrompt: string;
  userMessage: string;
  parameters: Record<string, string>;
};

// Predefined templates
const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    name: "explain-topic",
    systemPrompt: "You are a knowledgeable assistant who explains complex topics clearly.",
    userMessage: "Explain {topic} in {style} style. Make it {length} and suitable for {audience}.",
    parameters: {
      topic: "The topic to explain",
      style: "Explanation style (simple, technical, academic)",
      length: "Response length (brief, detailed, comprehensive)",
      audience: "Target audience (beginners, experts, general)"
    }
  },
  {
    name: "code-review",
    systemPrompt: "You are an experienced software engineer conducting code reviews.",
    userMessage: "Review the following {language} code and provide feedback on {aspect}: {code}",
    parameters: {
      language: "Programming language",
      aspect: "Review aspect (performance, security, readability, best-practices)",
      code: "Code to review"
    }
  },
  {
    name: "translate-text",
    systemPrompt: "You are a professional translator with expertise in multiple languages.",
    userMessage: "Translate the following text from {source_lang} to {target_lang}: {text}",
    parameters: {
      source_lang: "Source language",
      target_lang: "Target language", 
      text: "Text to translate"
    }
  },
  {
    name: "summarize-content",
    systemPrompt: "You are an expert at creating concise, accurate summaries.",
    userMessage: "Summarize the following content in {format} format, focusing on {focus}: {content}",
    parameters: {
      format: "Summary format (bullet points, paragraph, executive summary)",
      focus: "What to focus on (key points, action items, conclusions)",
      content: "Content to summarize"
    }
  }
];

// Template expansion helper function
async function expandTemplate(templateName: string, args: Record<string, string>): Promise<{ systemPrompt: string; userMessage: string; template: SampleTemplate }> {
  const templates = await loadTemplatesFromFile();
  const template = templates.find(t => t.name === templateName);
  
  if (!template) {
    throw new Error(`Template '${templateName}' not found`);
  }

  // Check for missing required parameters
  const missingParams = Object.keys(template.parameters).filter(param => !(param in args));
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
  }

  // Expand template strings
  let expandedSystemPrompt = template.systemPrompt;
  let expandedUserMessage = template.userMessage;

  for (const [key, value] of Object.entries(args)) {
    const placeholder = `{${key}}`;
    expandedSystemPrompt = expandedSystemPrompt.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    expandedUserMessage = expandedUserMessage.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return {
    systemPrompt: expandedSystemPrompt,
    userMessage: expandedUserMessage,
    template
  };
}

// Initialize MCP Server
const server = new McpServer({
  name: "mcp-sampler",
  version: "1.0.0"
});

// Sample configurations resource
server.registerResource(
  "sample-config",
  "sample://config",
  {
    title: "Sample Configuration",
    description: "Configuration for sample tool",
    mimeType: "application/json"
  },
  async () => ({
    contents: [{
      uri: "sample://config",
      text: JSON.stringify({
        defaultMaxTokens: 500,
        defaultTemperature: 0.7,
        sampleTypes: ["text", "code", "analysis", "summary"]
      }, null, 2)
    }]
  })
);

// Templates resource
server.registerResource(
  "templates",
  "sample://templates",
  {
    title: "Sample Templates",
    description: "Available sample templates with parameters",
    mimeType: "application/json"
  },
  async () => {
    const templates = await loadTemplatesFromFile();
    return {
      contents: [{
        uri: "sample://templates",
        text: JSON.stringify({
          templates: templates.map(template => ({
            name: template.name,
            description: `Template: ${template.name}`,
            parameters: template.parameters,
            systemPrompt: template.systemPrompt,
            userMessage: template.userMessage
          })),
          totalCount: templates.length
        }, null, 2)
      }]
    };
  }
);

// Dynamic sample results resource template
server.registerResource(
  "sample-result",
  new ResourceTemplate("sample://results/{id}", { list: undefined }),
  {
    title: "Sample Result",
    description: "Result from a sample operation",
    mimeType: "text/plain"
  },
  async (uri, { id }) => ({
    contents: [{
      uri: uri.href,
      text: `Sample result for ID: ${id}\nThis is a placeholder result.`
    }]
  })
);

// Individual template resource template
server.registerResource(
  "template-detail",
  new ResourceTemplate("sample://templates/{name}", { list: undefined }),
  {
    title: "Template Detail",
    description: "Detailed information about a specific template",
    mimeType: "application/json"
  },
  async (uri, { name }) => {
    const templates = await loadTemplatesFromFile();
    const template = templates.find(t => t.name === name);
    if (!template) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            error: "Template not found",
            templateName: name,
            availableTemplates: templates.map(t => t.name)
          }, null, 2)
        }]
      };
    }

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify({
          template,
          usage: {
            toolName: "sample-template-exec",
            requiredArgs: Object.keys(template.parameters),
            exampleCall: {
              templateName: template.name,
              args: Object.keys(template.parameters).reduce((acc, key) => {
                acc[key] = `<${key}_value>`;
                return acc;
              }, {} as Record<string, string>)
            }
          }
        }, null, 2)
      }]
    };
  }
);

// Template execution tool
server.registerTool(
  "template-execute",
  {
    title: "Template Execution",
    description: "Execute predefined templates with parameter substitution via LLM text generation",
    inputSchema: {
      templateName: z.string().describe("Name of the template to execute"),
      args: z.record(z.string()).describe("Arguments for template parameter substitution"),
      maxTokens: z.number().optional().default(500).describe("Maximum tokens to generate"),
      temperature: z.number().optional().default(0.7).describe("Sampling temperature (0.0 to 1.0)"),
      includeContext: z.enum(["none", "thisServer", "allServers"]).optional().default("none").describe("Context inclusion level")
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false
    }
  },
  async ({ templateName, args, maxTokens, temperature, includeContext }, extra) => {
    try {
      // Expand the template
      const { systemPrompt, userMessage, template } = await expandTemplate(templateName, args);

      // Direct internal call to sampling functionality
      const response = await server.server.createMessage({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: userMessage
            }
          }
        ],
        maxTokens,
        temperature,
        systemPrompt,
        includeContext
      });

      const resultText = response.content.type === "text" ? response.content.text : "Unable to generate sample";

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              usedTemplate: templateName,
              expandedSystemPrompt: systemPrompt,
              expandedUserMessage: userMessage,
              result: resultText,
              metadata: {
                timestamp: new Date().toISOString(),
                temperature,
                maxTokens,
                includeContext,
                templateParameters: Object.keys(template.parameters),
                model: response.model,
                stopReason: response.stopReason,
                implementationNote: "Direct internal sampling call"
              }
            }, null, 2)
          }
        ],
        // Include structured content for better integration
        structuredContent: {
          usedTemplate: templateName,
          expandedSystemPrompt: systemPrompt,
          expandedUserMessage: userMessage,
          result: resultText,
          metadata: {
            timestamp: new Date().toISOString(),
            temperature,
            maxTokens,
            includeContext,
            templateParameters: Object.keys(template.parameters),
            model: response.model,
            stopReason: response.stopReason,
            implementationNote: "Direct internal sampling call"
          }
        }
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: true,
              message: error instanceof Error ? error.message : "Unknown error",
              templateName,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    }
  }
);

// LLM text generation tool
server.registerTool(
  "llm-generate",
  {
    title: "LLM Text Generation",
    description: "Generate text using LLM via MCP sampling protocol (server-to-client-to-LLM delegation)",
    inputSchema: {
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]).describe("Message role"),
        content: z.object({
          type: z.literal("text").describe("Content type"),
          text: z.string().describe("Message text content")
        }).describe("Message content")
      })).describe("Array of messages for the conversation"),
      systemPrompt: z.string().optional().describe("System prompt for the LLM"),
      maxTokens: z.number().optional().default(500).describe("Maximum tokens to generate"),
      temperature: z.number().optional().default(0.7).describe("Sampling temperature (0.0 to 1.0)"),
      includeContext: z.enum(["none", "thisServer", "allServers"]).optional().default("none").describe("Context inclusion level")
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: true
    }
  },
  async ({ messages, systemPrompt, maxTokens, temperature, includeContext }) => {
    try {
      // Use MCP sampling to call the LLM directly with provided parameters
      const response = await server.server.createMessage({
        messages,
        maxTokens,
        temperature,
        systemPrompt,
        includeContext
      });

      const resultText = response.content.type === "text" ? response.content.text : "Unable to generate sample";
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              model: response.model,
              result: resultText,
              stopReason: response.stopReason,
              metadata: {
                maxTokens,
                temperature,
                includeContext,
                systemPrompt: systemPrompt || null,
                messageCount: messages.length,
                timestamp: new Date().toISOString()
              }
            }, null, 2)
          }
        ],
        // Include structured content for better integration
        structuredContent: {
          model: response.model,
          result: resultText,
          stopReason: response.stopReason,
          metadata: {
            maxTokens,
            temperature,
            includeContext,
            systemPrompt: systemPrompt || null,
            messageCount: messages.length,
            timestamp: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: true,
              message: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    }
  }
);

// Sample template prompt
server.registerPrompt(
  "sample-template",
  {
    title: "Sample Template",
    description: "Template for creating sample requests",
    argsSchema: {
      topic: z.string().describe("Topic for the sample"),
      style: z.string().optional().describe("Style of the sample (formal, casual, technical)")
    }
  },
  async ({ topic, style = "formal" }) => ({
    description: `Sample template for ${topic}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please provide a ${style} sample about ${topic}. Make it informative and well-structured.`
        }
      }
    ]
  })
);

// Template file I/O functionality
import { promises as fs } from 'fs';
import { join } from 'path';

const TEMPLATES_DIR = './templates';
const TEMPLATES_FILE = join(TEMPLATES_DIR, 'templates.json');

// Template file initialization
async function initializeTemplatesFile() {
  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    
    // Create initial templates if file doesn't exist
    try {
      await fs.access(TEMPLATES_FILE);
    } catch {
      await fs.writeFile(TEMPLATES_FILE, JSON.stringify(SAMPLE_TEMPLATES, null, 2));
    }
  } catch (error) {
    console.error("Failed to initialize templates file:", error);
  }
}

// Load templates from file
async function loadTemplatesFromFile(): Promise<SampleTemplate[]> {
  try {
    const data = await fs.readFile(TEMPLATES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to load templates from file:", error);
    return SAMPLE_TEMPLATES; // Fallback to default templates
  }
}

// Save templates to file
async function saveTemplatesToFile(templates: SampleTemplate[]): Promise<void> {
  try {
    await fs.writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
  } catch (error) {
    console.error("Failed to save templates to file:", error);
    throw error;
  }
}

// Template management tool
server.registerTool(
  "template-manage",
  {
    title: "Template Management",
    description: "Add, update, delete, and list templates with file-based persistence",
    inputSchema: {
      action: z.enum(["add", "update", "delete", "list"]).describe("Action to perform"),
      name: z.string().optional().describe("Template name (required for add, update, delete)"),
      template: z.object({
        name: z.string(),
        systemPrompt: z.string(),
        userMessage: z.string(),
        parameters: z.record(z.string())
      }).optional().describe("Template data (required for add, update)")
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false
    }
  },
  async ({ action, name, template }) => {
    try {
      let templates = await loadTemplatesFromFile();

      switch (action) {
        case "list":
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                templates: templates.map(t => ({
                  name: t.name,
                  parameters: Object.keys(t.parameters)
                })),
                totalCount: templates.length
              }, null, 2)
            }]
          };

        case "add":
          if (!template) {
            throw new Error("Template data is required for add action");
          }
          
          // Check for duplicates
          if (templates.find(t => t.name === template.name)) {
            throw new Error(`Template '${template.name}' already exists`);
          }
          
          templates.push(template);
          await saveTemplatesToFile(templates);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Template '${template.name}' added successfully`,
                template
              }, null, 2)
            }]
          };

        case "update":
          if (!name || !template) {
            throw new Error("Template name and data are required for update action");
          }
          
          const updateIndex = templates.findIndex(t => t.name === name);
          if (updateIndex === -1) {
            throw new Error(`Template '${name}' not found`);
          }
          
          templates[updateIndex] = template;
          await saveTemplatesToFile(templates);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Template '${name}' updated successfully`,
                template
              }, null, 2)
            }]
          };

        case "delete":
          if (!name) {
            throw new Error("Template name is required for delete action");
          }
          
          const deleteIndex = templates.findIndex(t => t.name === name);
          if (deleteIndex === -1) {
            throw new Error(`Template '${name}' not found`);
          }
          
          const deletedTemplate = templates.splice(deleteIndex, 1)[0];
          await saveTemplatesToFile(templates);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Template '${deletedTemplate.name}' deleted successfully`,
                deletedTemplate
              }, null, 2)
            }]
          };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : "Unknown error",
            action,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  }
);

// Template parameter generation tool
server.registerTool(
  "template-to-params",
  {
    title: "Template to Parameters Conversion",
    description: "Convert templates into parameters suitable for LLM text generation",
    inputSchema: {
      templateName: z.string().describe("Name of the template to use"),
      args: z.record(z.string()).describe("Arguments for template parameter substitution"),
      maxTokens: z.number().optional().default(500).describe("Maximum tokens to generate"),
      temperature: z.number().optional().default(0.7).describe("Sampling temperature (0.0 to 1.0)"),
      includeContext: z.enum(["none", "thisServer", "allServers"]).optional().default("none").describe("Context inclusion level")
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false
    }
  },
  async ({ templateName, args, maxTokens, temperature, includeContext }) => {
    try {
      const templates = await loadTemplatesFromFile();
      const template = templates.find(t => t.name === templateName);
      
      if (!template) {
        throw new Error(`Template '${templateName}' not found`);
      }

      // Expand template parameters
      const { systemPrompt, userMessage } = await expandTemplate(templateName, args);

      // Generate parameters for llm-generate tool
      const sampleParams = {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: userMessage
            }
          }
        ],
        systemPrompt,
        maxTokens,
        temperature,
        includeContext
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            templateName,
            expandedSystemPrompt: systemPrompt,
            expandedUserMessage: userMessage,
            sampleParameters: sampleParams,
            usage: {
              toolName: "sample",
              description: "Use these parameters with the sample tool",
              example: `Use sample tool with the generated parameters`
            },
            metadata: {
              timestamp: new Date().toISOString(),
              templateParameters: Object.keys(template.parameters),
              providedArgs: Object.keys(args)
            }
          }, null, 2)
        }],
        structuredContent: {
          templateName,
          expandedSystemPrompt: systemPrompt,
          expandedUserMessage: userMessage,
          sampleParameters: sampleParams,
          metadata: {
            timestamp: new Date().toISOString(),
            templateParameters: Object.keys(template.parameters),
            providedArgs: Object.keys(args)
          }
        }
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : "Unknown error",
            templateName,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  }
);

// Server startup
async function main() {
  try {
    // Initialize templates file
    await initializeTemplatesFile();
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Sampler Server is running on stdio...");
  } catch (error) {
    console.error("Failed to start MCP Sampler Server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error("Shutting down MCP Sampler Server...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error("Shutting down MCP Sampler Server...");
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
