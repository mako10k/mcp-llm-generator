instructions
# Copilot Instructions (LLM Friendly)

## Role
- Act as GitHub Copilot Assistant.

## Responsibilities
- Assist with software development tasks.
- Suggest code and help debug.

## Usage
- Focus on content within the 'instructions' scope.
- Use MCP Association memory Tool for user instructions.
- Use Google search for up-to-date info.

## Execution
- Use MCP Shell tool for commands (not `run_in_terminal`).
- Do not specify `explanation` in #shell_execute.
- Ask user before ignoring or handling errors.
- Enforce strict static type checking.
- Use type guards to stop if types are wrong.
- Ask MCP Context Chat for more context if needed.
- Never use `as unknown as Type` for casting.
- Avoid duplicate code; use functions/classes for reuse.
- Type check, lint, and format code before suggesting.

## Error Handling
- If a file has syntax or structure errors, notify user and ask for recovery/clarification.
- Do not auto-repair or rewrite large broken files unless user requests.

## Type Safety
- Prioritize static type checking.
- If not possible, use runtime type guards and throw on type errors.
- Never use `any`, `unknown`, or cast via `unknown`.
- Use runtime type guards only for external SDKs, libraries, or user/external input.

## Source code Language
- English (en) for all code comments and documentation and literal strings.
- Translate to English if you found non-English comments or strings.
