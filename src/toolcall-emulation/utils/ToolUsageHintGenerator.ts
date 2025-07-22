// ツール使用ヒント生成ユーティリティ
// 作成日: 2025年7月22日
// 目的: SystemPromptGeneratorとToolDescriptionBuilderの重複排除

// 関数型定義
interface ToolFunction {
  name: string;
  [key: string]: unknown;
}

/**
 * ツール使用ヒント生成の共通ユーティリティ
 */
export class ToolUsageHintGenerator {
  /**
   * 関数名から使用ヒントを生成
   */
  static generateUsageHint(func: ToolFunction): string {
    const keywords = func.name.toLowerCase();
    
    if (keywords.includes('search')) return 'the user needs to find or search for information';
    if (keywords.includes('create')) return 'the user wants to create something new';
    if (keywords.includes('update')) return 'the user wants to modify existing data';
    if (keywords.includes('delete')) return 'the user wants to remove something';
    if (keywords.includes('get') || keywords.includes('fetch')) return 'the user needs to retrieve specific data';
    if (keywords.includes('send') || keywords.includes('notify')) return 'the user wants to communicate or send notifications';
    
    return 'the user\'s request matches this tool\'s functionality';
  }

  /**
   * 複数のキーワードパターンをチェック
   */
  static generateEnhancedUsageHint(func: ToolFunction): string {
    const name = func.name.toLowerCase();
    
    // より詳細なパターンマッチング
    const patterns = [
      { keywords: ['list', 'show', 'display'], hint: 'the user wants to view or list items' },
      { keywords: ['add', 'insert', 'new'], hint: 'the user wants to add new content' },
      { keywords: ['edit', 'modify', 'change'], hint: 'the user wants to modify existing content' },
      { keywords: ['remove', 'clear', 'clean'], hint: 'the user wants to remove or clear content' },
      { keywords: ['connect', 'join', 'link'], hint: 'the user wants to establish connections' },
      { keywords: ['analyze', 'check', 'validate'], hint: 'the user needs analysis or validation' }
    ];

    for (const pattern of patterns) {
      if (pattern.keywords.some(keyword => name.includes(keyword))) {
        return pattern.hint;
      }
    }

    // フォールバック: 基本的なヒント生成
    return this.generateUsageHint(func);
  }
}
