/**
 * Parameter Formatter Utility
 * パラメータフォーマット処理のユーティリティ
 */
/**
 * パラメータフォーマッター - DRY原則に従って共通化
 */
export declare class ParameterFormatter {
    /**
     * ツールパラメータを文字列にフォーマット
     */
    static format(parameters: any, requiredParams: string[], optionalParams: string[]): string;
    /**
     * パラメータの分類
     */
    static classify(parameters: any): {
        required: string[];
        optional: string[];
    };
    /**
     * パラメータの検証
     */
    static validate(parameters: any): {
        isValid: boolean;
        errors: string[];
    };
}
