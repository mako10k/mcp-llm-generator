/**
 * Refactored System Prompt Generator
 * リファクタリング後のシステムプロンプト生成器
 * 責任分離：組み立て責任のみに集中、Strategy Pattern適用
 */

import { 
  PromptSectionBuilder,
  ToolDescriptionBuilder,
  OutputSchemaBuilder,
  ExampleBuilder,
  PersonaBuilder,
  ConstraintBuilder,
  ContextBuilder
} from './prompt-builders/index.js';

import { 
  PromptGeneratorConfig,
  GeneratedPrompt,
  PromptContext,
  PromptSection
} from '../types/prompt.js';

/**
 * メタデータ計算ユーティリティ（責任分離）
 */
class MetadataCalculator {
  static calculate(
    systemPrompt: string,
    userPrompt: string,
    context: PromptContext
  ): GeneratedPrompt['metadata'] {
    return {
      toolCount: context.availableTools.length,
      promptLength: systemPrompt.length,
      schemaComplexity: this.calculateSchemaComplexity(context),
      personaIncluded: !!context.persona,
      generatedAt: new Date()
    };
  }

  private static calculateSchemaComplexity(context: PromptContext): number {
    return context.availableTools.reduce((complexity, tool) => {
      const paramCount = Object.keys(tool.function.parameters.properties || {}).length;
      const requiredCount = tool.function.parameters.required?.length || 0;
      return complexity + paramCount + (requiredCount * 0.5);
    }, 0);
  }
}

/**
 * プロンプト組み立て責任に特化したSystemPromptGenerator
 */
export class SystemPromptGenerator {
  private config: PromptGeneratorConfig;
  private builders: PromptSectionBuilder[];

  constructor(
    config: PromptGeneratorConfig = {
      includeExamples: true,
      strictMode: true,
      personaAware: true,
      contextLengthLimit: 8000,
      includeToolValidation: true
    },
    customBuilders?: PromptSectionBuilder[]
  ) {
    this.config = config;
    this.builders = customBuilders || this.createDefaultBuilders();
  }

  /**
   * メインの組み立てメソッド（責任を組み立てのみに限定）
   */
  generateSystemPrompt(
    userMessage: string,
    context: PromptContext
  ): GeneratedPrompt {
    // アクティブなBuilderの選択（優先度順にソート）
    const activeBuilders = this.selectActiveBuilders(context);

    // 各セクションの生成
    const sections = this.generateSections(activeBuilders, context);

    // プロンプトの組み立て
    const systemPrompt = this.assemblePrompt(sections);
    const userPrompt = this.enhanceUserPrompt(userMessage, context);

    // メタデータ計算（分離された責任）
    const metadata = MetadataCalculator.calculate(systemPrompt, userPrompt, context);

    return {
      systemPrompt,
      userPrompt,
      metadata
    };
  }

  /**
   * アクティブなBuilderの選択（Strategy Pattern）
   */
  private selectActiveBuilders(context: PromptContext): PromptSectionBuilder[] {
    return this.builders
      .filter(builder => this.isBuilderApplicable(builder, context))
      .sort((a, b) => b.getPriority() - a.getPriority()); // 高優先度順
  }

  /**
   * Builderの適用条件判定
   */
  private isBuilderApplicable(builder: PromptSectionBuilder, context: PromptContext): boolean {
    // 基本的な適用条件
    if (!builder.isRequired()) {
      // PersonaBuilderの場合
      if (builder instanceof PersonaBuilder && !context.persona) {
        return false;
      }
      
      // ExampleBuilderの場合
      if (builder instanceof ExampleBuilder && !this.config.includeExamples) {
        return false;
      }
    }

    return true;
  }

  /**
   * セクション生成（各Builderに委譲）
   */
  private generateSections(
    builders: PromptSectionBuilder[],
    context: PromptContext
  ): PromptSection[] {
    const sections: PromptSection[] = [];

    for (const builder of builders) {
      try {
        const content = builder.build(context);
        if (content.trim().length > 0) {
          sections.push({
            name: builder.getSectionName(),
            content,
            priority: builder.getPriority(),
            required: builder.isRequired()
          });
        }
      } catch (error) {
        console.error(`Error building section ${builder.getSectionName()}:`, error);
        // 必須セクションでエラーが発生した場合は例外を投げる
        if (builder.isRequired()) {
          throw new Error(`Failed to build required section: ${builder.getSectionName()}`);
        }
      }
    }

    return sections;
  }

  /**
   * プロンプトの組み立て（組み立て責任のみ）
   */
  private assemblePrompt(sections: PromptSection[]): string {
    // ベースプロンプトを最初に追加
    const basePrompt = this.buildBasePrompt();
    const sectionContents = sections.map(section => section.content);
    
    let assembled = [basePrompt, ...sectionContents].join('\n\n');

    // 長さ制限の適用
    if (assembled.length > this.config.contextLengthLimit) {
      assembled = this.truncatePrompt(assembled);
    }

    return assembled;
  }

  /**
   * ベースプロンプト（固定セクション）
   */
  private buildBasePrompt(): string {
    return `You are a precision tool call analyzer designed to determine when and how to use available tools.

Your core responsibilities:
1. Analyze user requests to determine if tool usage is required
2. Select appropriate tools based on request context and available options
3. Generate properly formatted tool calls with accurate parameters
4. Provide clear reasoning for your decisions
5. Maintain high confidence scores for reliable tool usage

Key Principles:
- Only call tools when genuinely necessary for the user's request
- Ensure all required parameters are properly filled
- Provide confidence scores between 0.0 and 1.0
- Include clear reasoning for each decision
- Follow the exact output schema format`;
  }

  /**
   * ユーザープロンプトの拡張
   */
  private enhanceUserPrompt(userMessage: string, context: PromptContext): string {
    return `User Request: ${userMessage}

Please analyze this request and determine if any tools should be called. Respond with the exact JSON format specified.`;
  }

  /**
   * プロンプトの切り詰め
   */
  private truncatePrompt(prompt: string): string {
    const lines = prompt.split('\n');
    let truncated = '';
    
    for (const line of lines) {
      if (truncated.length + line.length + 1 <= this.config.contextLengthLimit) {
        truncated += line + '\n';
      } else {
        truncated += '\n... (truncated for length)';
        break;
      }
    }
    
    return truncated;
  }

  /**
   * デフォルトBuilderの作成（DIの柔軟性）
   */
  private createDefaultBuilders(): PromptSectionBuilder[] {
    return [
      new ToolDescriptionBuilder(),
      new OutputSchemaBuilder(),
      new ExampleBuilder({ enabled: this.config.includeExamples, priority: 6 }),
      new PersonaBuilder({ enabled: this.config.personaAware, priority: 7 }),
      new ConstraintBuilder(this.config.strictMode, this.config.includeToolValidation),
      new ContextBuilder()
    ];
  }

  /**
   * Builder管理メソッド（拡張性）
   */
  addBuilder(builder: PromptSectionBuilder): void {
    this.builders.push(builder);
  }

  removeBuilder(builderClass: any): void {
    this.builders = this.builders.filter(builder => !(builder instanceof builderClass));
  }

  replaceBuilder(builderClass: any, newBuilder: PromptSectionBuilder): void {
    const index = this.builders.findIndex(builder => builder instanceof builderClass);
    if (index !== -1) {
      this.builders[index] = newBuilder;
    }
  }

  /**
   * 統計情報の取得
   */
  getBuilderStatistics(): {
    totalBuilders: number;
    enabledBuilders: number;
    builderTypes: string[];
  } {
    return {
      totalBuilders: this.builders.length,
      enabledBuilders: this.builders.filter(b => b.isRequired()).length,
      builderTypes: this.builders.map(b => b.getSectionName())
    };
  }
}
