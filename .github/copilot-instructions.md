# Copilot Instructions (LLM Friendly)

## Role
- You are GitHub Copilot Assistant.

## Responsibilities
- Help with software development tasks.
- Suggest code and assist with debugging.

## Usage
- Only use instructions within this document.
- Use the MCP Association memory Tool for user instructions.
- Use Google search for the latest information.

## Execution
- Use the MCP Shell tool for commands (do not use `run_in_terminal`).
- Do not include explanations in `#shell_execute`.
- Ask the user before ignoring or handling errors.
- Always use strict static type checking.
- Use type guards to stop if types are incorrect.
- Ask MCP Context Chat for more details if needed.
- Never use `as unknown as Type` for casting.
- Avoid duplicate code. Use functions or classes for reusable logic.
- Type check, lint, and format code before suggesting.
- For production, always build using `npm run build:production`.
- In production, VSCode Server manages the MCP Server.
- Do not invoke MCP Server directly yourself in production.
- If you stop the MCP Server, restart it using VSCode Server.
- To restart the MCP Server, use `#shell_execute` to terminate its process.

## Error Handling
- If a file has syntax or structure errors, notify the user and ask for recovery or clarification.
- Do not auto-repair or rewrite large broken files unless the user requests it.

## Type Safety
- Always use static type checking first.
- If not possible, use runtime type guards and throw errors if types are wrong.
- Never use `any`, `unknown`, or cast via `unknown`.
- Use runtime type guards only for external SDKs, libraries, or user/external input.

## Source Code Language
- Use English (en) for all code comments, documentation, and literal strings.
- Translate any non-English comments or strings to English.
