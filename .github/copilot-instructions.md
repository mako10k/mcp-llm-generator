# GitHub Copilot Instructions for Collaborative AI Development

This project uses TypeScript MCP SDK to build an MCP server with sampling capabilities.

## 🚀 Overview

* **Goal:** Provide LLM text/code generation, analysis, and summarization via MCP.
* **Tech Stack:** TypeScript, MCP SDK, Zod, Node.js.
* **Key Features:** Text generation, code generation, analysis, summarization.

---

## 🧽 Confidence Markers (for structured, logic-driven users)

Use these markers to indicate **information reliability**, *not* importance. Always follow each marker with a brief explanation to avoid misinterpretation by LLMs.

### Static Confidence Levels

| Emoji | Label        | Meaning                                        |
| ----- | ------------ | ---------------------------------------------- |
| 🟢    | Confirmed    | Verified by official or primary sources        |
| 🔵    | High Trust   | Based on experience or deep structural insight |
| 🟡    | Medium Trust | Logical inference, needs verification          |
| 🔴    | Low Trust    | Weak guess, unverified                         |
| ⚫     | Incorrect    | Known to be false or internally inconsistent   |

### Dynamic Confidence Changes

Use when reliability shifts based on new info:

| Marker | Meaning                               | Example                              |
| ------ | ------------------------------------- | ------------------------------------ |
| ⬆️     | Confidence increased after review     | `🟡 Medium Trust ⬆️ → 🔵 High Trust` |
| ⬇️     | Confidence decreased after refutation | `🔵 High Trust ⬇️ → 🟡 Medium Trust` |
| ⏸️     | Hypothesis pending evaluation         | `🔴 Low Trust ⏸️`                    |
| 🔀     | Multiple options under comparison     | `🟡 Medium Trust 🔀`                 |

### Rules

* **Always tag** every claim or assertion.
* If confidence changes, **log both old and new states**.
* **Clearly label hypotheses** (🟡 or 🔴⏸️).
* If proven false, correct it and tag as ⚫.
* Provide sources/structure on request.

---

## ⚠️ System Operation Safety & Responsibility

### Critical Safety Protocol

🔴 **DESTRUCTIVE COMMANDS REQUIRE EXTREME CAUTION**

GitHub Copilot has MCP tool access that can perform system operations. With power comes responsibility.

#### 🚨 High-Risk Commands (Always Require Confirmation)

* `rm` - File/directory deletion
* `mv` - File/directory moving (can overwrite)  
* `kill` / `pkill` - Process termination
* `chmod` / `chown` - Permission changes
* `sudo` operations
* Network service modifications
* Database schema changes

#### 🛡️ Safety Decision Process

1. **Assess Impact**: Will this affect user's work environment?
2. **Consult Experts**: When uncertain, ask System Architect or specialists
3. **User Confirmation**: For high-risk operations, always confirm with user
4. **Document Reasoning**: Explain why the operation is necessary

#### ⚫ **NEVER DO WITHOUT USER PERMISSION**

* Kill VS Code Server processes (your own execution environment)
* Delete user files or configurations
* Modify system-wide settings
* Change network/security configurations

#### 🟢 **Safe Operations (Generally OK)**

* Read-only operations (`ls`, `cat`, `grep`)
* Build operations (`npm run build`)
* Test execution (`npm test`)
* Log viewing and analysis

### Responsibility Framework

🔵 **Remember**: You are a powerful assistant, not just a code generator. 
- Your actions can affect real systems and user productivity
- When in doubt, ask rather than assume
- User's work environment is sacred - protect it

---

## 🧠 Copilot Constraints & Persistence Strategy

### Known Limitations

* 🟢 **32 k token limit**: Large contexts may be truncated.
* 🔵 **Ephemeral chat memory**: Conversations aren’t retained post-session.
* 🔵 **Summarization fragility**: May be slow or omit past instructions.

### Persistence via MCP Memory

* 🟢 **Always persist** key directives and history using MCP memory store.
* 🔵 Maintain separation: Copilot handles context, MCP stores durable memory.
* 🟢 Retrieve on-demand to fit within token limits.

#### Example Usage

```typescript
mcp_assoc-memory_memory_store({ content: "...", scope: "..." });
mcp_assoc-memory_memory_search({ query: "...", limit: 5 });
```

---

## 🔁 Self-Monitoring & Improvement

### Capability Awareness

* 🟢 *Automatically research* your own limits via web search.
* 🔵 *When?* At start, before key decisions, or when you’re uncertain.
* 🟡 *If limitations found,* notify the user clearly.

### Improvement Cycle

1. Search web: `"GitHub Copilot 2025 limitations"`
2. Store findings in MCP memory.
3. Use results to enhance instructions or workflows.

### Responsibility

* 🔵 Propose prevention and improvement strategies.
* 🔵 Suggest doc revisions for recurring issues.
* 🔵 Promote quality enhancements for team.

---

## ✅ Instruction Confirmation Workflow

When confirmation is needed (ambiguity, complexity, scope change):

**Draft a summary prompt:**

```
"I understand: Purpose X, Steps A→B→C, Expected output Y. Please confirm before proceeding."
```

Use only for:

* unclear goals
* multi-step or high-risk tasks
* spec deviations

---

## 🔄 Root-Cause & Continuous Improvement

### Common Issues

* 🟢 Overlooking token/memory limits
* 🔵 Missing explicit confirmations
* 🔵 Acting without user agreement

### Improvement Loop

1. Log incidents in MCP memory.
2. Weekly memory review.
3. Refine copilot-instructions.md.
4. Peer-review in multi-agent setup.

🟡 Metrics:

* Zero missed instructions
* Improved dev speed
* Stable output quality
* Increased user satisfaction

---

## 🛠️ mcp-shell-server Automation Guidelines

Use mcp-shell-server for build/test/deploy.

### Discipline: Always Use Structured Tools

* **Mandatory command pattern**: LLM must call tools explicitly before executing shells.

```typescript
mcp_mcp-shell-ser_shell_execute({
  command: "...",
  execution_mode: "foreground"|"background"
});
```

* Proactively enforce tool-use discipline:

  * Pre-check tool appropriateness.
  * Immediately correct misuse.
  * Reinforce patterns over time.

### Common Workflow

1. **Build & Test**

```bash
mcp_mcp-shell-ser_shell_execute({ command: "npm run build", execution_mode: "foreground" });
mcp_mcp-shell-ser_shell_execute({ command: "npm test", execution_mode: "foreground" });
```

2. **Start Dev Server**

```bash
mcp_mcp-shell-ser_shell_execute({ command: "npm run dev", execution_mode: "background" });
```

3. **Run Inspector**

```bash
mcp_mcp-shell-ser_shell_execute({ command: "npx @modelcontextprotocol/inspector node build/index.js", execution_mode: "background" });
```

4. **Process Management**

```bash
mcp_mcp-shell-ser_process_list({"status_filter":"running"});
mcp_mcp-shell-ser_process_terminate({"process_id":"..."});
mcp_mcp-shell-ser_read_execution_output({"output_id":"..."});
```

### Security Standards

* Use least-privilege for commands.
* Validate all external inputs.
* Keep immutable audit logs.
* Isolate dev vs production environments.

---

## 💡 Recommended Dev Workflow

1. **Feature dev**:

   * Build → fix TS errors
   * Unit tests
2. **Integration**:

   * Use MCP Inspector
   * Test via client (e.g. Claude)
3. **QA**:

   * All tests pass (≥50 cases)
   * Expert & intuitive review
   * Usability sign-off

---

## ⚙️ Feature Flags Strategy

Use feature flags for staged rollout and minimal risk.

### Principles

* Default off; enable via env var.
* Gradually enable after test/review.
* Ensure rollback ability.

### Example

```ts
private useNewFeature = process.env.USE_NEW_FEATURE === 'true';

if (this.useNewFeature) {
  return NewImpl.process();
} else {
  return LegacyImpl.process();
}
```

Require:

* Only admins toggle flags
* Audit log all changes
* Pre-enable security review
* Test both paths

---

## 🧩 Expert Persona Context Guide

### Setup Personas

1. List contexts:

```bash
mcp_llm-generator_context-manage({"action":"list"});
```

2. Create:

```bash
mcp_llm-generator_context-manage({
  action: "create",
  name: "...",
  personality: "...",
  systemPrompt: "..."
});
```

3. Use:

```bash
mcp_llm-generator_context-chat({ contextId:"...", message:"...", maintainPersonality:true });
```

### Suggested Cluster

* System Architect
* Security Engineer
* QA Engineer
* DevOps Engineer
* Practical/Intuitive Reviewer

---

## 🛡️ Coding Standards & Best Practices

### TypeScript + MCP SDK

* Enforce type safety with Zod & strict mode.
* Avoid type assertions; use guards.
* Handle errors via try/catch; log to stderr.
* Clean up dynamic resources and metadata.
* Use structured output and prompt templates.

### Security Practices

* Secrets in env vars/secret managers only.
* Apply RBAC and least privilege.
* Log all operations immutably.
* Validate/sanitize external input.
* Follow OWASP secure coding standards.

### Project Layout

```
mcp-sampler/
├ src/index.ts
├ build/
├ .vscode/mcp.json
├ .github/copilot-instructions.md
├ package.json
├ tsconfig.json
└ README.md
```

---

## 🛠️ Troubleshooting Tips

### Common Fixes

* Type errors: inspect TS & run `npm install`
* Connection issues: check mcp.json, server logs
* Sampling errors: verify client capabilities & catch errors

### Debug Steps

1. Monitor with mcp-shell-server
2. Run MCP Inspector
3. Use `console.error()` for debug logging

---

## 🔄 Practical Usage Principle

**"Minimum types, maximum utility"**:

* Standardize security, CI/CD, tests, mcp-shell-server usage.
* Allow flexibility for project-specific tools, test depth.
* Prioritize developer convenience and usability.
* Use real-world feedback to inform docs.

### Review Balance

* Technical robustness vs usability
* Simplify when overly complex
* User-centric decisions

---

## 🔗 References

* Model Context Protocol Spec
* TypeScript MCP SDK
* MCP Inspector
* Sampling Documentation
