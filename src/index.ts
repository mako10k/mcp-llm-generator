#!/usr/bin/env node
/**
 * MCP Sampler Server with Sample Tool
 * 
 * This server demonstrates:
 * - Basic MCP server setup using TypeScript SDK
 * - Implementation of a 'sample' tool that uses LLM sampling
 * - Resource exposure for sample configurations
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
function expandTemplate(templateName: string, args: Record<string, string>): { systemPrompt: string; userMessage: string; template: SampleTemplate } {
  const template = SAMPLE_TEMPLATES.find(t => t.name === templateName);
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
  async () => ({
    contents: [{
      uri: "sample://templates",
      text: JSON.stringify({
        templates: SAMPLE_TEMPLATES.map(template => ({
          name: template.name,
          description: `Template: ${template.name}`,
          parameters: template.parameters,
          systemPrompt: template.systemPrompt,
          userMessage: template.userMessage
        })),
        totalCount: SAMPLE_TEMPLATES.length
      }, null, 2)
    }]
  })
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
    const template = SAMPLE_TEMPLATES.find(t => t.name === name);
    if (!template) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            error: "Template not found",
            templateName: name,
            availableTemplates: SAMPLE_TEMPLATES.map(t => t.name)
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
  "sample-template-exec",
  {
    title: "Execute Sample Template",
    description: "Execute a predefined sample template with parameter substitution using direct internal sampling",
    inputSchema: {
      templateName: z.string().describe("Name of the template to execute"),
      args: z.record(z.string()).describe("Arguments for template parameter substitution"),
      maxTokens: z.number().optional().default(500).describe("Maximum tokens to generate"),
      temperature: z.number().optional().default(0.7).describe("Sampling temperature (0.0 to 1.0)"),
      includeContext: z.enum(["none", "thisServer", "allServers"]).optional().default("none").describe("Context inclusion level")
    }
  },
  async ({ templateName, args, maxTokens, temperature, includeContext }, extra) => {
    try {
      // Expand the template
      const { systemPrompt, userMessage, template } = expandTemplate(templateName, args);

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

// Sample tool implementation
server.registerTool(
  "sample",
  {
    title: "Sample Tool",
    description: "Execute a sample operation using LLM sampling capabilities with direct createMessage parameters",
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

// Health check tool
server.registerTool(
  "health",
  {
    title: "Health Check",
    description: "Check the health status of the sampler server",
    inputSchema: {}
  },
  async () => ({
    content: [
      {
        type: "text",
        text: `MCP Sampler Server Status: ✓ Healthy\nVersion: 1.0.0\nTimestamp: ${new Date().toISOString()}\nSampling Capability: Available`
      }
    ]
  })
);

// Server startup
async function main() {
  try {
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
