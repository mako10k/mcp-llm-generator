/**
 * Google検索Function実装
 * mcp-google MCPツール統合による検索機能
 */
export interface GoogleSearchParams {
    query: string;
    numResults?: number;
    language?: string;
    region?: string;
    imageSearch?: boolean;
}
export interface GoogleSearchResult {
    success: boolean;
    results?: Array<{
        title: string;
        url: string;
        snippet: string;
        displayUrl: string;
    }>;
    totalResults?: number;
    searchTime?: number;
    error?: string;
}
/**
 * Google検索Function実装クラス
 * FunctionExecutionEngineから呼び出される実際の検索処理
 */
export declare class GoogleSearchFunction {
    private logger;
    constructor();
    /**
     * Google検索の実行
     * mcp-google MCPツールを活用した検索機能
     */
    executeSearch(params: GoogleSearchParams): Promise<GoogleSearchResult>;
    /**
     * 検索結果の要約生成
     * 大量の検索結果を要約して重要な情報を抽出
     */
    summarizeSearchResults(results: GoogleSearchResult, summaryLength?: 'brief' | 'detailed'): Promise<{
        summary: string;
        keyPoints: string[];
    }>;
    /**
     * 関連検索クエリの生成
     * 現在の検索結果に基づいて関連する検索クエリを提案
     */
    generateRelatedQueries(originalQuery: string, results: GoogleSearchResult): string[];
    /**
     * モック検索結果の生成（開発・テスト用）
     * 実際のmcp-google統合時に削除予定
     */
    private generateMockSearchResults;
    private generateBriefSummary;
    private generateDetailedSummary;
    private extractKeyPoints;
    private extractKeywords;
}
