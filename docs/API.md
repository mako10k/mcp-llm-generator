# MCP LLM Generator v2 API Reference

## Overview

MCP LLM Generator v2 provides a comprehensive set of tools, resources, and prompts for advanced AI workflows. All tools support full TypeScript type safety with Zod validation.

## Tools API

### Core Generation Tools

#### `llm-generate`
Direct LLM text generation using MCP sampling protocol.

**Request Schema:**
```typescript
{
  messages: Array<{
    role: "user" | "assistant",
    content: {
      type: "text",
      text: string
    }
  }>,
  maxTokens?: number,        // Default: 500, Range: 1-4000
  temperature?: number,      // Default: 0.7, Range: 0.0-1.0
  systemPrompt?: string,     // Optional system context
  includeContext?: "none" | "thisServer" | "allServers"
}
```

**Response:**
```typescript
{
  content: Array<{
    type: "text",
    text: string
  }>
}
```

#### `template-execute`
Execute predefined templates with intelligent parameter substitution.

**Request Schema:**
```typescript
{
  templateName: string,      // Must exist in template registry
  args: Record<string, string>, // Template parameter values
  maxTokens?: number,        // Default: 500
  temperature?: number,      // Default: 0.7
  includeContext?: "none" | "thisServer" | "allServers"
}
```

**Response:**
```typescript
{
  content: Array<{
    type: "text", 
    text: string
  }>
}
```

### Template Management Tools

#### `template-manage`
CRUD operations for template management.

**Request Schema:**
```typescript
{
  action: "add" | "update" | "delete" | "list",
  name?: string,             // Required for add, update, delete
  template?: {
    name: string,
    systemPrompt: string,
    userMessage: string,
    parameters: Record<string, string>
  }
}
```

**Response:**
```typescript
{
  content: Array<{
    type: "text",
    text: string              // Success message or template list
  }>
}
```

#### `template-to-params`
Convert templates into LLM generation parameters.

**Request Schema:**
```typescript
{
  templateName: string,
  args: Record<string, string>,
  maxTokens?: number,
  temperature?: number,
  includeContext?: "none" | "thisServer" | "allServers"
}
```

**Response:**
```typescript
{
  systemPrompt: string,
  messages: Array<Message>,
  maxTokens: number,
  temperature: number
}
```

### Context Memory Tools

#### `context-manage`
Manage AI consultant contexts with persistent memory.

**Request Schema:**
```typescript
{
  action: "create" | "list" | "get" | "update" | "delete",
  contextId?: string,        // Required for get, update, delete
  name?: string,             // Required for create
  personality?: string,      // Consultant personality description
  systemPrompt?: string,     // Custom system prompt
  maxTokens?: number,        // Default: 1000
  maxHistoryTokens?: number, // Default: 4000
  temperature?: number,      // Default: 0.7
  expiryDays?: number,       // Default: 30
  page?: number,             // For list pagination
  pageSize?: number          // For list pagination
}
```

#### `context-chat`
Chat with personality-driven consultants.

**Request Schema:**
```typescript
{
  contextId: string,         // Must exist
  message: string,           // User message
  maintainPersonality?: boolean // Default: true
}
```

**Response:**
```typescript
{
  content: Array<{
    type: "text",
    text: string              // Consultant response
  }>,
  conversationId: string,     // For tracking
  tokenUsage: {
    prompt: number,
    completion: number,
    total: number
  }
}
```

#### `conversation-manage`
Manage conversations within contexts.

**Request Schema:**
```typescript
{
  action: "list" | "delete" | "clear",
  contextId: string,
  conversationIds?: string[], // For delete action
  olderThan?: string,        // ISO timestamp for delete
  page?: number,             // For list pagination
  pageSize?: number,         // For list pagination
  reverse?: boolean          // Chronological order
}
```

### Memory Tools

#### `memory-store`
Store knowledge with automatic associative linking.

**Request Schema:**
```typescript
{
  content: string,           // Content to store
  scope?: string,            // Default: "user/default"
  category?: string,         // Content category
  tags?: string[],           // Descriptive tags
  metadata?: Record<string, any>, // Additional metadata
  duplicate_threshold?: number,   // Similarity threshold (0-1)
  allow_duplicates?: boolean,     // Force storage
  auto_associate?: boolean        // Default: true
}
```

**Response:**
```typescript
{
  content: Array<{
    type: "text",
    text: string              // Storage confirmation
  }>,
  memory_id: string,          // Unique identifier
  associations: Array<{       // Related memories found
    memory_id: string,
    similarity: number,
    content_preview: string
  }>
}
```

#### `memory-search`
Search stored memories with semantic matching.

**Request Schema:**
```typescript
{
  query: string,             // Search query
  scope?: string,            // Limit to specific scope
  limit?: number,            // Default: 10, Max: 100
  similarity_threshold?: number, // Default: 0.1
  include_associations?: boolean, // Default: true
  include_child_scopes?: boolean  // Default: false
}
```

### Personality Preset Tools

#### `personality-preset-manage`
Manage reusable consultant personality presets.

**Request Schema:**
```typescript
{
  action: "create" | "list" | "get" | "update" | "delete",
  presetId?: string,         // Required for get, update, delete
  name?: string,             // Required for create
  description?: string,      // Preset description
  systemPrompt?: string,     // Core personality prompt
  defaultPersonality?: string, // Default personality text
  defaultSettings?: Record<string, any>, // Default parameters
  metadata?: Record<string, any> // Additional metadata
}
```

## Resources API

### Template Resources

#### `template-list`
**URI:** `mcp-llm-generator://template-list`

Dynamic list of all available templates.

**Response:**
```typescript
{
  contents: Array<{
    uri: string,              // Resource URI
    mimeType: "application/json",
    name: string,             // Template name
    description?: string,     // Template description
    parameters: Record<string, string> // Parameter definitions
  }>
}
```

#### `template-detail/{name}`
**URI:** `mcp-llm-generator://template-detail/{templateName}`

Comprehensive template information.

**Response:**
```typescript
{
  contents: Array<{
    uri: string,
    mimeType: "application/json",
    template: {
      name: string,
      systemPrompt: string,
      userMessage: string,
      parameters: Record<string, string>,
      metadata?: Record<string, any>
    }
  }>
}
```

### Context Resources

#### `context-history/{id}`
**URI:** `mcp-llm-generator://context-history/{contextId}`

Access conversation history and consultant insights.

**Response:**
```typescript
{
  contents: Array<{
    uri: string,
    mimeType: "application/json",
    context: {
      id: string,
      name: string,
      personality: string,
      conversations: Array<{
        id: string,
        timestamp: string,
        messages: Array<{
          role: "user" | "assistant",
          content: string,
          timestamp: string
        }>
      }>
    }
  }>
}
```

## Prompts API

### Core Prompts

#### `explain-template`
Multi-style explanation prompt with adaptive formatting.

**Arguments:**
- `topic` (required) - Subject to explain
- `style` (optional) - "beginner" | "technical" | "expert" | "creative"
- `audience` (optional) - Target audience description
- `length` (optional) - "brief" | "detailed" | "comprehensive"

#### `review-template`
Intelligent code review and analysis prompt.

**Arguments:**
- `code` (required) - Code to review
- `language` (optional) - Programming language
- `focus` (optional) - "security" | "performance" | "style" | "all"
- `level` (optional) - "junior" | "senior" | "expert"

#### `consultant-prompt`
Access specialized AI consultants.

**Arguments:**
- `expertise` (required) - Consultant specialization
- `query` (required) - Question or task
- `context` (optional) - Additional context
- `priority` (optional) - "low" | "medium" | "high" | "urgent"

## Error Handling

All tools return structured error responses for better debugging:

```typescript
{
  error: {
    code: string,             // Error code
    message: string,          // Human-readable message
    details?: any,            // Additional error details
    suggestions?: string[]    // Potential solutions
  }
}
```

### Common Error Codes

- `TEMPLATE_NOT_FOUND` - Template doesn't exist
- `CONTEXT_NOT_FOUND` - Context ID not found
- `VALIDATION_ERROR` - Invalid parameters
- `MEMORY_ERROR` - Database operation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INSUFFICIENT_CONTEXT` - Missing required context

## Best Practices

### Performance Optimization
1. **Reuse contexts** - Don't create new contexts for similar tasks
2. **Batch operations** - Use template-execute for repeated patterns
3. **Memory scoping** - Use hierarchical scopes for organization
4. **Token management** - Set appropriate maxTokens limits

### Security Guidelines
1. **Validate inputs** - All parameters are Zod-validated
2. **Scope isolation** - Use different scopes for different projects
3. **Regular cleanup** - Clear old conversations periodically
4. **Access control** - Keep database files secure

### Development Workflow
1. **Template-driven** - Create reusable templates for common tasks
2. **Memory-first** - Store important insights for future reference
3. **Context consistency** - Maintain consultant personalities
4. **Associative linking** - Let the system build knowledge connections

## Version Compatibility

- **MCP Protocol**: Compatible with MCP v1.0+
- **Node.js**: Requires v18.0.0 or higher
- **TypeScript**: Built with v5.0+ (optional for usage)
- **Database**: SQLite 3.40+ for context memory

## Rate Limits

Current implementation has the following limits:
- **Concurrent requests**: 10 per context
- **Memory storage**: 10MB per scope
- **Context history**: 1000 conversations per context
- **Template parameters**: 50 parameters per template

These limits can be configured via environment variables in production deployments.
