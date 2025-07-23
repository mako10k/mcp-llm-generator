/**
 * Parameter Formatter Utility
 * パラメータフォーマット処理のユーティリティ
 */

/**
 * パラメータフォーマッター - DRY原則に従って共通化
 */
export class ParameterFormatter {
  /**
   * ツールパラメータを文字列にフォーマット
   */
  static format(
    parameters: any,
    requiredParams: string[],
    optionalParams: string[]
  ): string {
    const allParams = { ...parameters.properties };
    const formatted: string[] = [];

    // 必須パラメータ
    if (requiredParams.length > 0) {
      formatted.push('**Required**:');
      requiredParams.forEach(param => {
        const paramDef = allParams[param];
        if (paramDef) {
          formatted.push(`- \`${param}\` (${paramDef.type}): ${paramDef.description}`);
        }
      });
    }

    // オプショナルパラメータ
    if (optionalParams.length > 0) {
      formatted.push('**Optional**:');
      optionalParams.forEach(param => {
        const paramDef = allParams[param];
        if (paramDef) {
          formatted.push(`- \`${param}\` (${paramDef.type}): ${paramDef.description}`);
        }
      });
    }

    return formatted.join('\n');
  }

  /**
   * パラメータの分類
   */
  static classify(parameters: any): {
    required: string[];
    optional: string[];
  } {
    const requiredParams = parameters.required || [];
    const allParams = Object.keys(parameters.properties || {});
    const optionalParams = allParams.filter(param => !requiredParams.includes(param));

    return {
      required: requiredParams,
      optional: optionalParams
    };
  }

  /**
   * パラメータの検証
   */
  static validate(parameters: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!parameters.properties) {
      errors.push('Missing properties object');
    }

    if (parameters.required && !Array.isArray(parameters.required)) {
      errors.push('Required field must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
