# MCP LLM Generator

A Model Context Protocol (MCP) server with LLM text generation capabilities using the latest TypeScript MCP SDK.

## Features

### Tools
- **llm-generate**: Generate text using LLM via MCP sampling protocol (server-to-client-to-LLM delegation)
- **template-execute**: Execute predefined templates with parameter substitution via LLM text generation
- **template-manage**: Add, update, delete, and list templates with file-based persistence
- **template-to-params**: Convert templates into parameters suitable for LLM text generation

### Resources
- **template-list**: Dynamic list of available templates
- **template-detail**: Detailed template information with parameters

### Prompts
- **explain-template**: Template for explaining topics in various styles
- **review-template**: Template for code review and analysis

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build TypeScript:
```bash
npm run build
```

3. Run the server:
```bash
npm start
```

## Configuration

Add the following to your MCP client configuration (e.g., `~/.claude/mcp.json`):

```json
{
  "servers": {
    "mcp-sampler": {
      "command": "node",
      "args": ["/path/to/mcp-sampler/build/index.js"],
      "type": "stdio"
    }
  }
}
```

## Usage

### Using Tools

```typescript
// Generate text using LLM
await client.callTool("llm-generate", {
  messages: [
    { role: "user", content: { type: "text", text: "Explain TypeScript generics" } }
  ],
  maxTokens: 500
});

// Execute a template
await client.callTool("template-execute", {
  templateName: "explain-template",
  args: { topic: "machine learning", style: "beginner" }
});
```

### Reading Resources

```typescript
// List available templates
const templates = await client.readResource({ uri: "mcp-llm-generator://template-list" });

// Get template details
const template = await client.readResource({ uri: "mcp-llm-generator://template-detail/explain-template" });
```

### Using Prompts

```typescript
// Get prompt template
const prompt = await client.getPrompt("explain-template", {
  topic: "machine learning",
  style: "technical"
});
```

## Security & Safety

### Database File Protection

This project includes SQLite database files (like `context-memory.db`) that contain sensitive data including consultant personalities and conversation history. These files are protected by multiple layers of security:

#### 🛡️ Multi-Layer Protection
- **`.gitignore`**: Prevents new database files from being tracked
- **Pre-commit hooks**: Automatically blocks commits containing database files
- **Clear error messages**: Provides instructions when database files are detected

#### ⚠️ Important Notes
- **Never commit** `context-memory.db` or any `*.db`, `*.db-wal`, `*.db-shm` files
- These files contain 12+ consultant personalities and sensitive conversation data
- Loss of these files means losing valuable consultant expertise

#### 🔧 Development Setup
After cloning, run:
```bash
npm install  # Automatically installs husky pre-commit hooks
```

If you encounter database file commit errors:
```bash
git reset HEAD context-memory.db
git reset HEAD *.db *.db-wal *.db-shm
```

## Architecture

This MCP server provides:

- **LLM text generation**: Direct text generation using MCP sampling protocol
- **Template system**: Reusable prompt templates with parameter substitution
- **Resource management**: Dynamic access to templates and metadata
- **Type safety**: Full TypeScript implementation with Zod validation

## License

MIT License
