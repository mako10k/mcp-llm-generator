# MCP LLM Generator v2 🤖

[![npm version](https://badge.fury.io/js/%40mako10k%2Fmcp-llm-generator.svg)](https://badge.fury.io/js/%40mako10k%2Fmcp-llm-generator)
[![Node.js CI](https://github.com/mako10k/mcp-sampler/actions/workflows/ci.yml/badge.svg)](https://github.com/mako10k/mcp-sampler/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

🚀 **Production-ready Model Context Protocol (MCP) server** with advanced LLM text generation, context memory management, and intelligent template systems.

> **New in v2**: 67% token reduction optimization, context memory tools, personality-driven consultants, and associative memory for enhanced AI workflows.

## ✨ Key Features

### 🔧 Core Tools
- **`llm-generate`** - Direct LLM text generation via MCP sampling protocol
- **`template-execute`** - Execute sophisticated templates with smart parameter substitution
- **`template-manage`** - Full CRUD operations for reusable prompt templates
- **`context-chat`** - Personality-driven conversations with persistent memory
- **`context-manage`** - Create, update, and manage AI consultant contexts
- **`memory-store`** - Store and organize knowledge with associative linking

### 📚 Smart Resources
- **`template-list`** - Dynamic discovery of available templates
- **`template-detail`** - Comprehensive template information with validation
- **`context-history`** - Access conversation histories and consultant insights

### 🎯 Advanced Prompts
- **`explain-template`** - Multi-style explanations (beginner, technical, expert)
- **`review-template`** - Intelligent code review and analysis
- **`consultant-prompt`** - Access to 12+ specialized AI consultants

## 🚀 Quick Start

### Global Installation (Recommended)
```bash
# Install globally for easy access
npm install -g @mako10k/mcp-llm-generator

# Verify installation
mcp-llm-generator --version
```

### Local Development Setup
```bash
# Clone the repository
git clone https://github.com/mako10k/mcp-sampler.git
cd mcp-sampler

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the server
npm start
```

### 🔌 MCP Client Integration

Add to your MCP client configuration (e.g., `~/.claude/mcp.json`):

```json
{
  "servers": {
    "mcp-llm-generator": {
      "command": "mcp-llm-generator",
      "type": "stdio"
    }
  }
}
```

For local development:
```json
{
  "servers": {
    "mcp-llm-generator": {
      "command": "node",
      "args": ["/path/to/mcp-sampler/build/index.js"],
      "type": "stdio"
    }
  }
}
}
```

## 📖 Usage Examples

### 🤖 Basic LLM Text Generation
```typescript
// Generate text with custom parameters
await client.callTool("llm-generate", {
  messages: [
    { 
      role: "user", 
      content: { 
        type: "text", 
        text: "Explain quantum computing in simple terms" 
      } 
    }
  ],
  maxTokens: 500,
  temperature: 0.7
});
```

### 📝 Template System
```typescript
// Execute predefined templates
await client.callTool("template-execute", {
  templateName: "explain-template",
  args: { 
    topic: "machine learning", 
    style: "beginner",
    audience: "developers"
  }
});

// Manage templates
await client.callTool("template-manage", {
  action: "add",
  template: {
    name: "code-review",
    systemPrompt: "You are an expert code reviewer...",
    userMessage: "Review this code: {code}",
    parameters: { code: "Code to review" }
  }
});
```

### 🧠 Context Memory & Consultants
```typescript
// Create a specialized consultant
await client.callTool("context-manage", {
  action: "create",
  name: "Security Expert",
  personality: "Expert cybersecurity consultant with 15+ years experience",
  maxTokens: 1000,
  temperature: 0.3
});

// Chat with consultant
await client.callTool("context-chat", {
  contextId: "security-expert-id",
  message: "Review this authentication system for vulnerabilities",
  maintainPersonality: true
});

// Store important insights
await client.callTool("memory-store", {
  content: "JWT tokens should expire within 15 minutes for high-security applications",
  scope: "security/authentication",
  tags: ["jwt", "security", "best-practices"]
});
```

### 📚 Resource Discovery
```typescript
// List available templates
const templates = await client.readResource({ 
  uri: "mcp-llm-generator://template-list" 
});

// Get detailed template information
const template = await client.readResource({ 
  uri: "mcp-llm-generator://template-detail/explain-template" 
});

// Access consultant history
const history = await client.readResource({ 
  uri: "mcp-llm-generator://context-history/security-expert-id" 
});
```

## 🛡️ Security & Safety

### 🔒 Database File Protection

This project uses SQLite databases containing sensitive data including consultant personalities, conversation histories, and associative memory networks. **These files must never be committed to version control.**

#### Multi-Layer Protection System
- **`.gitignore`** - Prevents database files from being tracked
- **Pre-commit hooks** - Automatically blocks commits containing sensitive files
- **Clear error handling** - Provides immediate feedback on security violations

#### ⚠️ Critical Security Notes
- **Never commit**: `context-memory.db`, `*.db`, `*.db-wal`, `*.db-shm` files
- **Contains**: 12+ consultant personalities, conversation data, memory associations
- **Risk**: Loss of these files means losing valuable AI consultant expertise

#### 🔧 Secure Development Setup
```bash
# Install with automatic security hooks
npm install

# If you encounter database commit errors:
git reset HEAD context-memory.db
git reset HEAD *.db *.db-wal *.db-shm

# Verify protection is active
npm run lint
```

### 🔐 Production Security Best Practices
- Regular security audits with `npm audit`
- Dependency vulnerability scanning via GitHub Dependabot
- MIT license ensures open-source transparency
- No network access required for core functionality
- Input validation using Zod schemas throughout

## 🏗️ Architecture & Design

### Core Components
- **LLM Integration** - Direct text generation using MCP sampling protocol
- **Template Engine** - Reusable prompt templates with intelligent parameter substitution
- **Context Memory** - Persistent conversation and consultant management
- **Associative Memory** - Smart knowledge linking and discovery
- **Resource Management** - Dynamic access to templates, contexts, and metadata
- **Type Safety** - Full TypeScript implementation with comprehensive Zod validation

### 📊 Performance Optimizations (v2)
- **67% Token Reduction** - Optimized prompt engineering and response formatting
- **Smart Caching** - Template and context caching for improved response times
- **Memory Efficiency** - Associative linking reduces redundant data storage
- **Lazy Loading** - Dynamic resource loading for faster startup times

## 📚 API Reference

### Core Tools

#### `llm-generate`
Generate text using LLM via MCP sampling protocol.

**Parameters:**
- `messages` (required) - Array of conversation messages
- `maxTokens` (optional, default: 500) - Maximum tokens to generate
- `temperature` (optional, default: 0.7) - Sampling temperature (0.0-1.0)
- `systemPrompt` (optional) - Custom system prompt

#### `template-execute`
Execute predefined templates with parameter substitution.

**Parameters:**
- `templateName` (required) - Name of template to execute
- `args` (required) - Object with template parameter values
- `maxTokens` (optional, default: 500) - Token limit
- `temperature` (optional, default: 0.7) - Sampling temperature

#### `context-chat`
Chat with personality-driven consultants with persistent memory.

**Parameters:**
- `contextId` (required) - Unique consultant context identifier
- `message` (required) - User message to send
- `maintainPersonality` (optional, default: true) - Keep consultant personality

#### `memory-store`
Store knowledge with automatic associative linking.

**Parameters:**
- `content` (required) - Content to store
- `scope` (optional, default: "user/default") - Hierarchical organization scope
- `tags` (optional) - Array of descriptive tags
- `category` (optional) - Content category

### Resources

#### `template-list`
**URI**: `mcp-llm-generator://template-list`
Returns dynamic list of all available templates with metadata.

#### `template-detail/{name}`
**URI**: `mcp-llm-generator://template-detail/{templateName}`
Returns comprehensive template information including parameters and validation rules.

#### `context-history/{id}`
**URI**: `mcp-llm-generator://context-history/{contextId}`
Returns conversation history and consultant insights.

## 🔧 Troubleshooting

### Common Issues

#### ❌ "Command not found: mcp-llm-generator"
**Solution:**
```bash
# Reinstall globally
npm install -g @mako10k/mcp-llm-generator

# Or check npm global bin path
npm config get prefix
```

#### ❌ "Cannot connect to MCP server"
**Solutions:**
1. Verify MCP client configuration:
   ```json
   {
     "command": "mcp-llm-generator",
     "type": "stdio"
   }
   ```

2. Test server directly:
   ```bash
   mcp-llm-generator
   # Should output: Context Memory System initialized successfully
   ```

3. Check Node.js compatibility:
   ```bash
   node --version  # Should be ≥18.0.0
   ```

#### ❌ "Template not found" errors
**Solutions:**
1. List available templates:
   ```typescript
   await client.readResource({ uri: "mcp-llm-generator://template-list" })
   ```

2. Add missing template:
   ```typescript
   await client.callTool("template-manage", {
     action: "add",
     template: { /* template definition */ }
   })
   ```

#### ❌ "Database file locked" errors
**Solutions:**
1. Ensure no other MCP server instances are running
2. Check file permissions:
   ```bash
   ls -la context-memory.db*
   chmod 644 context-memory.db
   ```

#### ❌ "Memory allocation errors"
**Solutions:**
1. Reduce `maxTokens` parameter
2. Clear old conversation history:
   ```typescript
   await client.callTool("conversation-manage", {
     action: "clear",
     contextId: "your-context-id"
   })
   ```

### 🐛 Debug Mode
Enable detailed logging:
```bash
DEBUG=mcp-llm-generator:* mcp-llm-generator
```

### 📞 Support
- **Issues**: [GitHub Issues](https://github.com/mako10k/mcp-sampler/issues)
- **Security**: See [SECURITY.md](SECURITY.md)
- **Discussions**: [GitHub Discussions](https://github.com/mako10k/mcp-sampler/discussions)

## 🚀 Migration from v1

### Breaking Changes in v2
- **Scoped package name**: `mcp-llm-generator` → `@mako10k/mcp-llm-generator`
- **New tools**: `context-chat`, `context-manage`, `memory-store` require client updates
- **Enhanced templates**: Additional optional parameters for better control

### Migration Steps
1. **Update global installation**:
   ```bash
   npm uninstall -g mcp-llm-generator
   npm install -g @mako10k/mcp-llm-generator
   ```

2. **Update MCP client configuration**:
   ```json
   {
     "command": "mcp-llm-generator"  // Updated command
   }
   ```

3. **Template compatibility**: Existing templates continue to work with new optional parameters

## 🤝 Contributing

We welcome contributions! Please see our contribution guidelines:

### Development Setup
```bash
git clone https://github.com/mako10k/mcp-sampler.git
cd mcp-sampler
npm install
npm run build
npm test
```

### Code Standards
- **TypeScript**: Full type safety with strict mode
- **ESLint**: Code quality and consistency
- **Prettier**: Automated code formatting
- **Husky**: Pre-commit hooks for quality gates
- **Conventional Commits**: Semantic commit messages

### Testing
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Coverage report
```

### Release Process
1. Update version in `package.json`
2. Update `CHANGELOG.md` with new features
3. Create GitHub release with semantic versioning
4. Automated npm publish via GitHub Actions

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and breaking changes.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Model Context Protocol** - Built on the innovative MCP framework
- **TypeScript Community** - For excellent tooling and type safety
- **Open Source Contributors** - For making this project possible

---

**Made with ❤️ for the AI development community**

> **Star this repo** if you find it useful! Your support helps us continue improving MCP LLM Generator.
