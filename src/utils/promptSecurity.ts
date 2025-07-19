// Sprint4 Phase 1: セキュリティフレームワーク - プロンプトインジェクション検出・サニタイゼーション
import { PromptInjectionAttempt, SecurityValidationResult, PromptSecurityLevel } from '../types/persona.js';

export class PromptSecurityManager {
  private readonly INJECTION_PATTERNS = [
    // 直接的な指示変更パターン
    /(?:ignore|forget|disregard)\s+(?:previous|all|the)\s+(?:instructions?|prompts?|rules?)/i,
    /(?:new|override|replace)\s+(?:instructions?|prompts?|system\s*prompts?)/i,
    /(?:you\s+are\s+now|from\s+now\s+on|instead\s+you\s+should)/i,
    
    // ロールプレイ・人格変更パターン
    /(?:pretend|act\s+like|roleplay|role-play)\s+(?:you\s+are|as|to\s+be)/i,
    /(?:simulate|emulate|behave\s+like)\s+(?:a|an|the)/i,
    /(?:your\s+new\s+name\s+is|call\s+yourself|identify\s+as)/i,
    
    // システム権限昇格パターン
    /(?:sudo|admin|administrator|root)\s+(?:mode|access|privileges?)/i,
    /(?:developer|debug|test)\s+(?:mode|access|override)/i,
    /(?:unrestricted|unlimited|full)\s+(?:access|permissions?|capabilities?)/i,
    
    // エスケープ・ブレイクアウトパターン
    /(?:break\s+out|escape)\s+(?:from|of)\s+(?:character|role|constraints?)/i,
    /(?:stop\s+being|cease\s+to\s+be)\s+(?:an?\s+)?(?:ai|assistant|chatbot)/i,
    /(?:reveal|show|tell\s+me)\s+(?:your|the)\s+(?:prompt|instructions?|rules?)/i,
    
    // 日本語パターン
    /(?:無視|忘れ|破棄)(?:して|しろ).{0,10}(?:指示|命令|ルール|制限)/,
    /(?:新しい|別の).{0,10}(?:指示|命令|プロンプト|ルール)/,
    /(?:今から|これから).{0,10}(?:君は|あなたは).{0,20}(?:として|になって)/,
    /(?:開発者|管理者|デバッグ).{0,10}(?:モード|権限|アクセス)/
  ];

  private readonly SUSPICIOUS_KEYWORDS = [
    // 英語キーワード
    'jailbreak', 'bypass', 'override', 'hack', 'exploit', 'vulnerability',
    'system prompt', 'base instructions', 'core directives', 'fundamental rules',
    'character breaking', 'role confusion', 'prompt injection', 'adversarial',
    'social engineering', 'manipulation', 'deception', 'trick',
    
    // 日本語キーワード
    'ジェイルブレイク', 'バイパス', 'オーバーライド', 'ハック', '脆弱性',
    'システムプロンプト', '基本指示', 'コア命令', '基本ルール',
    'キャラクター破綻', 'ロール混乱', 'プロンプトインジェクション',
    'ソーシャルエンジニアリング', '操作', '欺瞞', 'トリック'
  ];

  private readonly ENCODING_PATTERNS = [
    // Base64
    /[A-Za-z0-9+\/]{20,}={0,2}/,
    
    // URL encoding
    /%[0-9A-Fa-f]{2}/,
    
    // Unicode encoding
    /\\u[0-9A-Fa-f]{4}/,
    
    // HTML entities
    /&[a-zA-Z][a-zA-Z0-9]*;/,
    
    // 特殊文字による偽装
    /[^\x00-\x7F]{3,}/
  ];

  /**
   * プロンプトのセキュリティ検証
   */
  validatePrompt(
    prompt: string, 
    securityLevel: PromptSecurityLevel = 'medium'
  ): SecurityValidationResult {
    const attempts: PromptInjectionAttempt[] = [];
    let riskScore = 0;
    
    // 1. 直接的なインジェクションパターン検出
    for (const pattern of this.INJECTION_PATTERNS) {
      const matches = prompt.match(pattern);
      if (matches) {
        const attempt: PromptInjectionAttempt = {
          type: 'direct_injection',
          pattern: pattern.source,
          matched_text: matches[0],
          confidence: 0.8,
          position: prompt.indexOf(matches[0])
        };
        attempts.push(attempt);
        riskScore += 25;
      }
    }

    // 2. 疑わしいキーワード検出
    const suspiciousMatches = this.SUSPICIOUS_KEYWORDS.filter(keyword =>
      prompt.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (suspiciousMatches.length > 0) {
      const attempt: PromptInjectionAttempt = {
        type: 'suspicious_keywords',
        pattern: 'keyword_detection',
        matched_text: suspiciousMatches.join(', '),
        confidence: Math.min(0.7, suspiciousMatches.length * 0.2),
        position: -1
      };
      attempts.push(attempt);
      riskScore += suspiciousMatches.length * 10;
    }

    // 3. エンコーディング検出
    for (const pattern of this.ENCODING_PATTERNS) {
      const matches = prompt.match(pattern);
      if (matches) {
        const attempt: PromptInjectionAttempt = {
          type: 'encoded_content',
          pattern: pattern.source,
          matched_text: matches[0],
          confidence: 0.6,
          position: prompt.indexOf(matches[0])
        };
        attempts.push(attempt);
        riskScore += 15;
      }
    }

    // 4. 構造分析
    const structuralRisk = this.analyzeStructuralRisk(prompt);
    riskScore += structuralRisk;

    // 5. セキュリティレベルに基づく判定
    const threshold = this.getSecurityThreshold(securityLevel);
    const isSafe = riskScore < threshold;

    return {
      is_safe: isSafe,
      risk_score: Math.min(100, riskScore),
      security_level: securityLevel,
      detected_attempts: attempts,
      recommendations: this.generateRecommendations(attempts, riskScore)
    };
  }

  /**
   * プロンプトのサニタイゼーション
   */
  sanitizePrompt(
    prompt: string, 
    securityLevel: PromptSecurityLevel = 'medium'
  ): {
    sanitized_prompt: string;
    removed_content: string[];
    applied_filters: string[];
  } {
    let sanitized = prompt;
    const removedContent: string[] = [];
    const appliedFilters: string[] = [];

    // 1. 直接的なインジェクションパターンの除去
    for (const pattern of this.INJECTION_PATTERNS) {
      const matches = sanitized.match(pattern);
      if (matches) {
        matches.forEach(match => {
          removedContent.push(match);
          sanitized = sanitized.replace(match, '[セキュリティ上の理由により削除]');
        });
        appliedFilters.push('injection_pattern_removal');
      }
    }

    // 2. エンコードされたコンテンツの処理
    if (securityLevel === 'strict') {
      for (const pattern of this.ENCODING_PATTERNS) {
        const matches = sanitized.match(pattern);
        if (matches) {
          matches.forEach(match => {
            removedContent.push(match);
            sanitized = sanitized.replace(match, '[エンコードされたコンテンツを削除]');
          });
          appliedFilters.push('encoded_content_removal');
        }
      }
    }

    // 3. 長すぎる行の分割（構造的攻撃対策）
    if (sanitized.includes('\n')) {
      const lines = sanitized.split('\n');
      const maxLineLength = securityLevel === 'strict' ? 200 : 500;
      
      const processedLines = lines.map(line => {
        if (line.length > maxLineLength) {
          removedContent.push(`Long line (${line.length} chars): ${line.substring(0, 50)}...`);
          appliedFilters.push('long_line_truncation');
          return line.substring(0, maxLineLength) + '[...切り詰め]';
        }
        return line;
      });
      
      sanitized = processedLines.join('\n');
    }

    // 4. 疑わしいキーワードの置換（strictモードのみ）
    if (securityLevel === 'strict') {
      this.SUSPICIOUS_KEYWORDS.forEach(keyword => {
        const regex = new RegExp(keyword, 'gi');
        if (sanitized.match(regex)) {
          removedContent.push(keyword);
          sanitized = sanitized.replace(regex, '[***]');
          appliedFilters.push('suspicious_keyword_replacement');
        }
      });
    }

    return {
      sanitized_prompt: sanitized.trim(),
      removed_content: removedContent,
      applied_filters: [...new Set(appliedFilters)]
    };
  }

  /**
   * 構造的リスク分析
   */
  private analyzeStructuralRisk(prompt: string): number {
    let risk = 0;

    // 異常に長いプロンプト
    if (prompt.length > 5000) {
      risk += 20;
    }

    // 同じ文字の大量繰り返し
    const repetitionPattern = /(.)\1{20,}/;
    if (repetitionPattern.test(prompt)) {
      risk += 15;
    }

    // 異常に多い改行
    const lineCount = prompt.split('\n').length;
    if (lineCount > 50) {
      risk += 10;
    }

    // 特殊文字の異常な集中
    const specialCharRatio = (prompt.match(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length / prompt.length;
    if (specialCharRatio > 0.3) {
      risk += 15;
    }

    return risk;
  }

  /**
   * セキュリティレベル別の閾値取得
   */
  private getSecurityThreshold(level: PromptSecurityLevel): number {
    switch (level) {
      case 'low': return 60;
      case 'medium': return 40;
      case 'strict': return 20;
      default: return 40;
    }
  }

  /**
   * 推奨事項の生成
   */
  private generateRecommendations(
    attempts: PromptInjectionAttempt[], 
    riskScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (attempts.some(a => a.type === 'direct_injection')) {
      recommendations.push('直接的なプロンプトインジェクションパターンが検出されました。プロンプトの見直しをお勧めします。');
    }

    if (attempts.some(a => a.type === 'suspicious_keywords')) {
      recommendations.push('疑わしいキーワードが含まれています。意図が明確でない場合は修正してください。');
    }

    if (attempts.some(a => a.type === 'encoded_content')) {
      recommendations.push('エンコードされたコンテンツが検出されました。透明性を保つため平文での記述をお勧めします。');
    }

    if (riskScore > 70) {
      recommendations.push('高リスクと判定されました。セキュリティレベルを上げるか、プロンプトの大幅な修正を検討してください。');
    } else if (riskScore > 40) {
      recommendations.push('中程度のリスクが検出されました。部分的な修正をお勧めします。');
    }

    if (recommendations.length === 0) {
      recommendations.push('このプロンプトは安全と判定されました。');
    }

    return recommendations;
  }

  /**
   * セキュリティ設定の動的調整
   */
  adjustSecurityLevel(
    currentLevel: PromptSecurityLevel,
    recentAttempts: PromptInjectionAttempt[]
  ): PromptSecurityLevel {
    // 最近のアクティビティに基づいてセキュリティレベルを動的調整
    const highRiskAttempts = recentAttempts.filter(a => a.confidence > 0.7).length;
    
    if (highRiskAttempts > 5) {
      return 'strict';
    } else if (highRiskAttempts > 2 && currentLevel === 'low') {
      return 'medium';
    } else if (highRiskAttempts === 0 && currentLevel === 'strict') {
      return 'medium';
    }
    
    return currentLevel;
  }
}

// シングルトンインスタンス
export const promptSecurityManager = new PromptSecurityManager();
