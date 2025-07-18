# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-07-18

### Added
- Initial public release of MCP LLM Generator
- Context Memory Tools with 67% token reduction optimization
- Four main tool categories:
  - `llm-generate`: LLM text generation with template support
  - `template-manage`: Template creation, update, and management
  - `context-manage`: Conversation context management with memory
  - `conversation-manage`: Conversation history and threading
- Global CLI installation support: `npm install -g @mako10k/mcp-llm-generator`
- Node.js 18/20/22 compatibility
- TypeScript support with complete type definitions
- ES Module architecture
- MCP Protocol compliance (SDK v1.2.0)
- Comprehensive documentation and examples
- MIT License for maximum compatibility
- Automated security auditing and dependency management

### Technical Details
- 14 optimized Context Memory Tools methods
- Token usage reduced by 67% compared to standard responses
- Better SQLite3 for efficient context storage
- Zod schema validation for type safety
- Husky pre-commit hooks for code quality

### Compatibility
- Model Context Protocol (MCP) SDK v1.2.0+
- Node.js v18.0.0+
- TypeScript 5.x
- Works with VS Code MCP extension and Claude Desktop

[Unreleased]: https://github.com/mako10k/mcp-llm-generator/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mako10k/mcp-llm-generator/releases/tag/v1.0.0
