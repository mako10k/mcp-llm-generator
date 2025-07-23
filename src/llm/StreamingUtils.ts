// LLMプロバイダー共通ユーティリティ
// 作成日: 2025年7月22日
// 目的: ClaudeProviderとOpenAIProviderの重複コードを排除

// エラーレスポンス型定義
interface ErrorResponse {
  error?: {
    message?: string;
  };
}

// JSON解析結果型定義
interface StreamData {
  [key: string]: unknown;
}

/**
 * ストリーミングレスポンスの共通処理
 */
export class StreamingUtils {
  /**
   * ストリーミングレスポンスのバッファ処理
   */
  static async* processStreamBuffer(
    responseBody: AsyncIterable<Uint8Array>,
    lineProcessor: (line: string) => { content?: string; done?: boolean } | null
  ): AsyncGenerator<string, void, unknown> {
    let buffer = '';
    const decoder = new TextDecoder();

    for await (const chunk of responseBody) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }

          const result = lineProcessor(data);
          if (result?.done) {
            return;
          }
          if (result?.content) {
            yield result.content;
          }
        }
      }
    }
  }

  /**
   * エラーレスポンスの共通処理
   */
  static handleErrorResponse(response: Response, data: ErrorResponse): void {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error?.message || 'Unknown error'}`);
    }
  }

  /**
   * JSON解析の共通処理
   */
  static parseStreamLine(data: string): StreamData | null {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
