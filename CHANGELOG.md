# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Phase 2: RBAC Integration System v1.2.0
- **PersonaManager RBAC Extension**: Hierarchical permission management with self-capability awareness
- **RBACEngine**: Permission inheritance calculation engine with cycle detection and optimization
- **RBACAPIService**: High-level API layer with validation and error handling
- **RBACMCPTools**: 6 specialized MCP tools for external RBAC access
- **PersonaRBACIntegration**: Non-destructive PersonaManager extension factory
- **PersonaRBACHelper**: Role-based permission templates and best practices
- **Self-Capability Awareness**: Personas can understand their permissions and limitations
- **Comprehensive Testing**: 130+ test cases covering integration, performance, and error handling

### Technical Implementation - Phase 2
- Closure Table pattern for unlimited hierarchy depth with O(log n) performance
- Permission inheritance caching for <5ms response times
- Type-safe implementation with TypeScript + Zod validation
- Memory-efficient design (<5MB for 10K contexts)
- Comprehensive audit logging and security measures
- Role-based permission templates (admin/specialist/assistant/observer/guest)
- Hierarchy pattern recommendations and validation utilities
- Non-breaking integration maintaining backward compatibility

### Database Extensions - Phase 1 (Completed)
- persona_hierarchy table with Closure Table architecture for unlimited hierarchy depth
- persona_permission_cache table for performance optimization
- inherited_permissions column in persona_roles table
- 6 optimized database indexes for hierarchy and permission queries
- Database migration system with integrity validation
- Foreign key constraints for data integrity
- Self-referential hierarchy records for existing personas
- Comprehensive migration validation with rollback support

## [1.1.0] - 2025-07-21

### Added
- **Security Enhancement**: persona_id validation for shared memory tools
- Mandatory persona_id parameter validation in shared-memory-create tool
- Enhanced error handling for empty or invalid persona_id values

### Fixed
- Prevented unauthorized shared memory operations without valid persona_id

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

[Unreleased]: https://github.com/mako10k/mcp-llm-generator/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/mako10k/mcp-llm-generator/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mako10k/mcp-llm-generator/releases/tag/v1.0.0
