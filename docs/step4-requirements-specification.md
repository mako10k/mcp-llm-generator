# Step4マージ機能 - 要件仕様書

**作成日**: 2025年7月22日  
**ステータス**: スコープ修正完了・実装準備中  
**プロジェクトマネージャー承認**: ✅ 確認済み（スコープ縮小修正）

## 📋 要件定義概要

### プロジェクト目的
**システムプロンプト効率化・最適化機能**として、既存の自由入力システムプロンプト機能とStep3で実装した能力自覚機能をシームレスに統合し、システムプロンプト肥大化によるトークン数圧迫問題を解決する。AI要約技術とテンプレート化による動的生成を活用し、両機能を生かした効率的なプロンプト管理を実現する。

---

## 🎯 機能要件詳細

### 2.1. システムプロンプトマージ機能
- **統合対象**:
  - 自由入力システムプロンプト（既存機能）
  - 能力自覚情報（Step3実装済み）
  - タスクコンテキスト（現在のユーザー要求）

- **マージ処理**:
  - AI要約技術による能力情報の圧縮・要約
  - タスク内容に応じた必要能力のみ選択注入
  - テンプレート化・動的注入による効率化
  - tiktoken等でのトークン数制限管理

### 2.2. 言語非限定マージ仕様
- **言語融合**:
  - 任意の言語でのマージ処理（英語・日本語・他言語混在可）
  - 言語境界を超えた意味的統合
  - 自動言語検出と適切な処理

- **JSON整形**:
  - 自動生成部は構造化フォーマット
  - 一貫した出力スキーマ
  - 型安全性の保証

- **自動優先度解決**:
  - 曖昧性は自動ルールで解決
  - ユーザー入力 > 能力情報 > デフォルト設定
  - 明示的な優先順位適用

### 2.3. 圧縮ロジック
- **冗長性自動除去**:
  - 重複する能力説明の統合
  - 類似制約の集約
  - 不要な詳細情報の省略

- **優先度ベース圧縮**:
  - タスク関連性による重み付け
  - 安全性ルールの優先保持
  - 文脈に応じた動的調整
### 2.4. 矛盾検出とエラー生成
- **矛盾検出**:
  - 能力情報と自由入力プロンプトの競合
  - 制約ルール間の不整合
  - 言語混在による意味的矛盾

- **エラー生成**:
  - 明示的エラーメッセージ
  - 矛盾箇所の詳細報告
  - サイレントフォールバック禁止

### 2.5. エラー戦略・ロールバック要件
- **更新前検証**:
  - マージ処理実行前の事前検証
  - 既存データのバックアップ作成
  - 処理成功予測とリスクアセスメント

- **マージ失敗時のロールバック**:
  - 即座の前回有効状態への復帰
  - 部分適用の防止（All-or-Nothing原則）
  - エラー状態での中途半端な更新禁止

- **エラー通知戦略**:
  - 元MCPツール呼び出しへのエラー応答
  - 失敗原因の詳細説明（エラー応答内）
  - 修正方法の具体的提案（エラーメッセージ内）
  - 自動復旧の可否判定
  - 呼び出し元への適切なエラーコード返却

- **データ整合性保証**:
  - トランザクション制御による原子性確保
  - 整合性チェックの多層実装
  - 破損データの自動検出・修復

### 2.6. オリジナルデータ永続化要件
- **データベース保存**:
  - オリジナル自由入力システムプロンプトの完全保存
  - 能力情報の詳細版保持
  - タスクコンテキストの原文保存
  - マージ設定とパラメータ保存

- **履歴管理**:
  - バージョン番号による変更追跡
  - タイムスタンプ付き履歴記録
  - 圧縮設定の変更履歴
  - マージ結果との関連付け

- **復元・再生成機能**:
  - DB情報からの完全再マージ
  - 圧縮レベル変更による再生成
  - 任意バージョンへのロールバック
  - 設定変更時の自動再処理

### 2.6. Context管理との統合
- **既存システム活用**:
  - PersonalityPreset参照
  - Context-specific設定優先
  - 会話履歴からのタスク文脈推測

---

## 🏗️ 非機能要件

### 3.1. パフォーマンス要件
- **処理時間**: 外部API利用のため制限なし（概算応答時間は利用サービス依存）
- **メモリ使用量**: <10MB（マージ処理時）
- **トークン管理**: 過大な超過を防止（情報量維持を優先）

### 3.2. 品質要件
- **TDD実装**: テストファースト開発
- **テストカバレッジ**: 90%以上
- **エラー処理**: 明示的エラーメッセージ

### 3.3. トークン計算
- **既存実装活用**: `PromptTokenManager`クラス（src/utils/promptOptimization.ts）
- **計算方式**: tiktoken使用による概算値
- **対象モデル**: GPT-4, GPT-3.5-turbo, Claude系（近似値）

---

## 🎨 アウトプット仕様

### 4.1. LLM出力例（マージ処理結果）

**成功時の出力:**
```json
{
  "mergedSystemPrompt": "You are a programming assistant with code analysis and review capabilities. Your constraints include read-only file access and no personal data processing. Current task: Code review and optimization suggestions.",
  "tokenCount": 280,
  "originalTokenCount": 520,
  "tokenReduction": 240,
  "sources": {
    "userPrompt": "summarized",
    "capabilities": ["code-analysis", "file-operations", "review-feedback"],
    "taskContext": "Code review session"
  },
  "conflicts": [],
  "compressionDetails": {
    "compressionApplied": true,
    "removedRedundancy": ["duplicate capability descriptions", "verbose constraint explanations"],
    "preservedInformation": ["core capabilities", "safety constraints", "task-specific guidance"]
  }
}
```

**エラー時のMCPツール応答:**
```json
{
  "error": {
    "code": "MERGE_FAILED",
    "message": "System prompt merge failed due to capability conflicts",
    "details": {
      "conflictType": "constraint_contradiction",
      "conflictingItems": ["file-access permission", "security constraint"],
      "suggestedFix": "Review and resolve contradictory security constraints in user prompt",
      "rollbackPerformed": true,
      "previousState": "restored"
    }
  }
}
```

### 4.2. データベース保存仕様
```typescript
// ContextMemoryでの永続保存
interface PromptMergeHistory {
  id: string;
  contextId: string;
  timestamp: Date;
  originalUserPrompt: string;           // 完全なオリジナル
  originalCapabilities: CapabilityInfo[]; // 詳細能力情報
  originalTaskContext: string;         // 元タスクコンテキスト
  mergedResult: MergeResult;           // LLM出力結果
  compressionSettings: CompressionConfig;
  version: number;
  status: 'pending' | 'success' | 'failed' | 'rolled_back'; // 処理状態
  errorInfo?: ErrorDetails;            // エラー情報（失敗時）
  rollbackInfo?: RollbackDetails;      // ロールバック情報
}

// エラー管理
interface ErrorDetails {
  errorType: 'conflict' | 'compression_failed' | 'token_overflow' | 'validation_error';
  message: string;
  details: Record<string, any>;
  suggestedFix?: string;
  timestamp: Date;
}

// ロールバック管理
interface RollbackDetails {
  previousVersion: number;
  rollbackReason: string;
  rollbackTimestamp: Date;
  rollbackSuccess: boolean;
}
```

### 4.3. 実装方式
- **実装形式**: 既存人格管理機能の補助ロジック（新規MCPツールではない）
- **利用タイミング**:
  - 人格の生成・変更時（手動システムプロンプト変更）
  - 人格の能力生成・変更時
- **統合方法**: 既存のpersona管理ツール内での自動呼び出し
- **インターフェース**: 内部API関数として実装
- **戻り値**: 上記JSON構造（LLM利用用）
- **データ永続化**: ContextMemoryでの完全履歴保存
- **トークン計算**: 既存PromptTokenManagerクラス活用

### 4.4. データ分離設計
- **LLM出力**: 必要最小限の情報（mergedSystemPrompt + メタデータ）
- **DB保存**: 完全なオリジナルデータ + 変更履歴
- **復元時**: DB情報から再マージ処理実行
- **セキュリティ**: オリジナルプロンプトの出力制御

---

## 🚫 スコープ外項目

### 除外機能
1. **新規MCPツール作成**: 既存人格管理の補助ロジックとして実装
2. **複数人格同時統合**: 単一人格ベースの処理
3. **リアルタイム同期**: 静的マージ処理のみ
4. **GUI作成**: 既存人格管理UI内での統合
5. **自動翻訳**: 既存言語情報の活用のみ

---

## 📚 実装方針

### 既存システム活用
- **Step3能力自覚システム**: CapabilityAwarenessService
- **PersonalityPreset**: systemPrompt統合
- **ContextMemory**: タスク文脈推測
- **PromptTokenManager**: トークン計算・最適化（src/utils/promptOptimization.ts）

### 新規実装要素  
- **PersonaPromptMerger**: メイン統合クラス（内部API）
- **PromptCompressor**: 既存PromptTokenManager拡張
- **ConflictDetector**: 矛盾検出エンジン
- **TokenBalancer**: 情報量保持とトークン管理のバランス調整
- **OriginalDataManager**: オリジナルデータ保持・管理クラス
- **VersionTracker**: マージ履歴・バージョン管理
- **TransactionManager**: トランザクション制御・ロールバック管理
- **ErrorRecoveryService**: エラー検出・自動復旧サービス

### エラー処理・復旧方針
- **事前検証**: マージ実行前の妥当性チェック
- **トランザクション管理**: 原子性保証とロールバック機能
- **エラー分類**: 回復可能・不可能エラーの判定
- **自動復旧**: 可能な範囲での自動修復機能
- **MCPエラー応答**: 元ツール呼び出しへの構造化エラー返却
- **ログ記録**: 詳細なエラー情報の内部記録

### データ永続化方針
- **ContextMemory活用**: オリジナルデータの永続保存
- **履歴管理**: マージ結果とオリジナルの関連付け
- **復元機能**: 任意時点のデータ復元
- **差分管理**: 変更履歴の追跡とロールバック

### 統合ポイント
- **人格作成・更新**: Context作成・更新時の自動マージ処理
- **能力変更**: 能力自覚情報更新時の自動プロンプト統合
- **システムプロンプト変更**: ユーザー定義プロンプト変更時の能力情報統合

---

## ✅ 受入基準

### 機能受入基準
1. **マージ精度**: 矛盾検出100%、適切なエラー報告
2. **トークン管理**: 過大超過の防止（情報量維持優先）  
3. **言語対応**: 言語非限定の正確な融合処理
4. **データ保持**: オリジナル自由入力プロンプトの100%保持
5. **復元機能**: オリジナルデータからの完全再生成
6. **エラー処理**: マージ失敗時の即座ロールバック
7. **整合性保証**: 中途半端な更新状態の完全排除

### 品質受入基準
1. **テストカバレッジ**: 90%以上
2. **パフォーマンス**: 外部API依存のため時間制限なし
3. **エラー処理**: 明示的エラーメッセージ
4. **情報保持**: 圧縮よりも必要情報の完全性を優先
5. **データ整合性**: オリジナルとマージ結果の関連付け100%維持
6. **障害復旧**: エラー発生時の自動復旧率80%以上
7. **トランザクション**: All-or-Nothing原則の完全実装

---

## 📊 実装フェーズ

### Phase 1: 基本マージ機能
1. **内部API実装**: PersonaPromptMerger クラス作成
2. **基本統合機能**: システムプロンプト + 能力情報
3. **矛盾検出**: 基本的な競合検出とエラー生成
4. **エラー処理基盤**: TransactionManager・ErrorRecoveryService実装

### Phase 2: 既存システム統合
1. **人格管理統合**: Context作成・更新時の自動呼び出し
2. **能力管理統合**: 能力変更時の自動プロンプト更新
3. **圧縮ロジック**: 冗長性除去と最適化
4. **障害復旧機能**: 自動ロールバック・復旧機能の実装

### Phase 3: 信頼性強化（追加）
1. **エラー分類システム**: 回復可能・不可能エラーの自動判定
2. **予防的チェック**: 事前検証による失敗予測
3. **監視・ログ機能**: エラー傾向分析と予防策
4. **運用支援**: エラー状況の可視化とアラート

---

**Step4マージ機能の最終仕様です。既存人格管理システムの補助ロジックとして、システムプロンプトと能力自覚機能の統合を実装します。**
