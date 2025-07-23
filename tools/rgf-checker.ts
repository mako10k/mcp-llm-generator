import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';

// Type definitions based on the rules schema
const RuleSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  confidence: z.enum(['high', 'medium', 'low']),
  pattern: z.string(),
  anti_pattern: z.string().optional(),
  validation_rule: z.string(),
  fix_suggestion: z.string(),
  examples: z.object({
    violation: z.string().optional(),
    correct: z.string().optional(),
  }).optional(),
  documentation: z.string().optional(),
});

const RuleViolation = z.object({
  rule: RuleSchema,
  matches: z.array(z.string()),
  line_numbers: z.array(z.number()).optional(),
  file_path: z.string(),
  confidence_level: z.enum(['high', 'medium', 'low']),
});

const RulesConfigSchema = z.object({
  version: z.string(),
  metadata: z.object({
    description: z.string(),
    created: z.string(),
    updated: z.string(),
    confidence_framework: z.string(),
  }),
  categories: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  })),
  rules: z.array(RuleSchema),
  confidence_escalation: z.array(z.object({
    from: z.string(),
    to: z.string(),
    condition: z.string(),
    action: z.string(),
  })),
  feedback_loop: z.object({
    detection_phase: z.array(z.string()),
    notification_phase: z.array(z.string()),
    correction_phase: z.array(z.string()),
    learning_phase: z.array(z.string()),
  }),
  integration: z.object({
    mcp_memory: z.object({
      scope: z.string(),
      auto_store: z.boolean(),
      retention_policy: z.string(),
    }),
    ci_cd: z.object({
      pipeline: z.string(),
      fail_on: z.array(z.string()),
      warn_on: z.array(z.string()),
    }),
    documentation: z.object({
      source: z.string(),
      auto_update: z.boolean(),
      review_required: z.boolean(),
    }),
  }),
  metrics: z.record(z.object({
    target: z.string(),
    measurement: z.string(),
    reporting: z.string().optional(),
    tracking: z.string().optional(),
    alerting: z.string().optional(),
  })),
});

type Rule = z.infer<typeof RuleSchema>;
type RuleViolation = z.infer<typeof RuleViolation>;
type RulesConfig = z.infer<typeof RulesConfigSchema>;

/**
 * Rule-Guided Feedback (RGF) Checker
 * Implements automated rule violation detection for GitHub Copilot instructions
 */
export class RGFChecker {
  private config!: RulesConfig;
  private rules!: Rule[];

  constructor(configPath: string = './copilot-instructions.rules.yaml') {
    this.loadConfig(configPath);
  }

  /**
   * Load and validate rules configuration
   */
  private loadConfig(configPath: string): void {
    try {
      const configFile = fs.readFileSync(configPath, 'utf8');
      const rawConfig = yaml.load(configFile);
      this.config = RulesConfigSchema.parse(rawConfig);
      this.rules = this.config.rules;
      console.log(`✅ Loaded ${this.rules.length} rules from ${configPath}`);
    } catch (error: any) {
      throw new Error(`Failed to load rules configuration: ${error.message}`);
    }
  }

  /**
   * Check code against all rules
   */
  checkCode(code: string, filePath: string = 'unknown'): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const rule of this.rules) {
      const ruleViolations = this.checkRule(code, rule, filePath);
      violations.push(...ruleViolations);
    }

    return violations;
  }

  /**
   * Check code against a specific rule
   */
  private checkRule(code: string, rule: Rule, filePath: string): RuleViolation[] {
    const violations: RuleViolation[] = [];
    
    try {
      // Check for violation pattern
      const violationRegex = new RegExp(rule.pattern, 'gi');
      const matches = [...code.matchAll(violationRegex)];

      if (matches.length > 0) {
        // Check if anti-pattern (correct usage) is present
        if (rule.anti_pattern) {
          const antiRegex = new RegExp(rule.anti_pattern, 'gi');
          const antiMatches = code.match(antiRegex);
          
          // If anti-pattern is found, it might be correctly implemented
          if (antiMatches && antiMatches.length >= matches.length) {
            return violations; // No violation if correct usage is present
          }
        }

        // Calculate line numbers for violations
        const lines = code.split('\n');
        const lineNumbers: number[] = [];
        
        matches.forEach(match => {
          const beforeMatch = code.substring(0, match.index || 0);
          const lineNumber = beforeMatch.split('\n').length;
          lineNumbers.push(lineNumber);
        });

        violations.push({
          rule,
          matches: matches.map(m => m[0]),
          line_numbers: lineNumbers,
          file_path: filePath,
          confidence_level: rule.confidence,
        });
      }
    } catch (error: any) {
      console.error(`Error checking rule ${rule.id}:`, error.message);
    }

    return violations;
  }

  /**
   * Check files in a directory
   */
  async checkDirectory(dirPath: string, extensions: string[] = ['.ts', '.js', '.md']): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];
    
    const checkFile = (filePath: string) => {
      const ext = path.extname(filePath);
      if (!extensions.includes(ext)) return;

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileViolations = this.checkCode(content, filePath);
        violations.push(...fileViolations);
      } catch (error: any) {
        console.error(`Error reading file ${filePath}:`, error.message);
      }
    };

    const scanDirectory = (dir: string) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and build directories
          if (!['node_modules', 'build', 'dist', '.git'].includes(item)) {
            scanDirectory(fullPath);
          }
        } else {
          checkFile(fullPath);
        }
      }
    };

    scanDirectory(dirPath);
    return violations;
  }

  /**
   * Generate report from violations
   */
  generateReport(violations: RuleViolation[]): string {
    if (violations.length === 0) {
      return '✅ No rule violations found!';
    }

    let report = `🚨 Found ${violations.length} rule violations:\n\n`;

    // Group by severity
    const groupedBySeverity = violations.reduce((acc, violation) => {
      const severity = violation.rule.severity;
      if (!acc[severity]) acc[severity] = [];
      acc[severity].push(violation);
      return acc;
    }, {} as Record<string, RuleViolation[]>);

    // Report by severity
    for (const [severity, severityViolations] of Object.entries(groupedBySeverity)) {
      report += `## ${severity.toUpperCase()} (${severityViolations.length})\n\n`;
      
      for (const violation of severityViolations) {
        report += `### ${violation.rule.title}\n`;
        report += `**File:** ${violation.file_path}\n`;
        if (violation.line_numbers && violation.line_numbers.length > 0) {
          report += `**Lines:** ${violation.line_numbers.join(', ')}\n`;
        }
        report += `**Rule:** ${violation.rule.id}\n`;
        report += `**Confidence:** ${violation.confidence_level}\n`;
        report += `**Description:** ${violation.rule.description}\n`;
        report += `**Fix:** ${violation.rule.fix_suggestion}\n`;
        
        if (violation.rule.examples) {
          if (violation.rule.examples.violation) {
            report += `**Violation example:** \`${violation.rule.examples.violation}\`\n`;
          }
          if (violation.rule.examples.correct) {
            report += `**Correct example:** \`${violation.rule.examples.correct}\`\n`;
          }
        }
        
        if (violation.rule.documentation) {
          report += `**Documentation:** ${violation.rule.documentation}\n`;
        }
        
        report += '\n';
      }
    }

    // Summary statistics
    report += '\n## Summary\n';
    report += `- Total violations: ${violations.length}\n`;
    report += `- Errors: ${groupedBySeverity.error?.length || 0}\n`;
    report += `- Warnings: ${groupedBySeverity.warning?.length || 0}\n`;
    report += `- Info: ${groupedBySeverity.info?.length || 0}\n`;

    return report;
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category: string): Rule[] {
    return this.rules.filter(rule => rule.category === category);
  }

  /**
   * Get rules by severity
   */
  getRulesBySeverity(severity: 'error' | 'warning' | 'info'): Rule[] {
    return this.rules.filter(rule => rule.severity === severity);
  }

  /**
   * Get configuration
   */
  getConfig(): RulesConfig {
    return this.config;
  }

  /**
   * Store violation in MCP memory (if configured)
   */
  async storeViolationInMemory(violation: RuleViolation): Promise<void> {
    // This would integrate with MCP memory tools
    // Implementation depends on available MCP memory tools
    const memoryContent = {
      type: 'rule_violation',
      rule_id: violation.rule.id,
      file_path: violation.file_path,
      severity: violation.rule.severity,
      confidence: violation.confidence_level,
      timestamp: new Date().toISOString(),
      fix_suggestion: violation.rule.fix_suggestion,
    };

    console.log('📝 Would store in MCP memory:', memoryContent);
    // TODO: Implement actual MCP memory storage
  }
}

/**
 * CLI interface for RGF Checker
 */
export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('Usage: rgf-checker <command> [options]');
    console.log('Commands:');
    console.log('  check <file|directory>  - Check file or directory for violations');
    console.log('  rules                   - List all rules');
    console.log('  config                  - Show configuration');
    return;
  }

  const checker = new RGFChecker();

  switch (command) {
    case 'check':
      const target = args[1] || '.';
      const stat = fs.statSync(target);
      
      let violations: RuleViolation[];
      if (stat.isDirectory()) {
        violations = await checker.checkDirectory(target);
      } else {
        const content = fs.readFileSync(target, 'utf8');
        violations = checker.checkCode(content, target);
      }
      
      const report = checker.generateReport(violations);
      console.log(report);
      
      // Exit with error if there are error-level violations
      const errorViolations = violations.filter(v => v.rule.severity === 'error');
      if (errorViolations.length > 0) {
        process.exit(1);
      }
      break;

    case 'rules':
      const rules = checker.getRulesBySeverity('error');
      console.log(`📋 Rules (${rules.length} total):`);
      rules.forEach(rule => {
        console.log(`- ${rule.id}: ${rule.title} (${rule.severity})`);
      });
      break;

    case 'config':
      const config = checker.getConfig();
      console.log('⚙️ Configuration:');
      console.log(`Version: ${config.version}`);
      console.log(`Rules: ${config.rules.length}`);
      console.log(`Categories: ${config.categories.length}`);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

// Export for use as module
export { RuleViolation };

// Run as CLI if called directly
if (require.main === module) {
  main().catch(console.error);
}
