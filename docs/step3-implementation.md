# Step3 能力自覚・他覚システム 実装仕様書

## 概要

Step3は、既存のpersona_hierarchyテーブルと統合して、各人格が自己能力を認識し、他人格を観察・評価し、親から子への能力継承を管理するシステムです。

## 実装対象

### ✅ 完了済み機能

1. **ツール名変更（汎用的表現への変更）**
   - `capability-get-self-awareness` → `persona-inspect-capabilities`
   - `capability-get-other-awareness` → `persona-evaluate-interaction`
   - `capability-process-inheritance` → `persona-transfer-knowledge`
   - `capability-get-matrix` → `group-get-capability-overview`
   - `capability-analyze-hierarchy` → `network-analyze-structure`

2. **人格システムプロンプトへのマージによる能力自覚機能追加**

## システム構成

### 1. 自覚機能（getSelfAwareness）

指定された人格が自身の能力・制約・責務を理解する機能。

#### 入力
```typescript
contextId: string
```

#### 出力
```typescript
interface SelfAwarenessInfo {
  context_id: string;
  own_capabilities: CapabilityInfo;
  position_in_hierarchy: HierarchyPosition;
  responsibilities: string[];
  constraints: string[];
  available_actions: string[];
}
```

#### 処理フロー
1. 自身の能力情報を取得
2. 階層位置情報を取得
3. 責務・制約・利用可能アクションを計算
4. 自覚情報を構築・検証

### 2. 他覚機能（getOtherAwareness）

指定された観察者人格が他の人格の能力を観察・評価する機能。

#### 入力
```typescript
observerContextId: string
targetContextId: string
```

#### 出力
```typescript
interface OtherAwarenessInfo {
  target_context_id: string;
  observer_context_id: string;
  observable_capabilities: CapabilityInfo;
  relationship: RelationshipType;
  interaction_history: any[];
  assessment?: Assessment;
}
```

#### 関係性判定
- `parent` / `child`: 直接の親子関係
- `sibling`: 兄弟関係
- `ancestor` / `descendant`: 祖先・子孫関係
- `unrelated`: 無関係
- `self`: 同一人格

#### 観察権限
- **無関係**: 公開情報のみ
- **関係あり**: 詳細情報提供

### 3. 継承機能（processCapabilityInheritance）

親人格から子人格への能力継承を処理する機能。

#### 入力
```typescript
parentContextId: string
childContextId: string
```

#### 継承ルール
1. **専門知識**: 50%継承
2. **ツール**: 親のサブセットのみ継承可能
3. **制約**: 完全継承（子はより制約される）

#### 安全機能
- 循環継承検出
- 自己継承禁止
- 入力値検証

## データスキーマ

### CapabilityInfo
```typescript
interface CapabilityInfo {
  expertise: string[];           // 専門知識
  tools: string[];              // 利用可能ツール
  restrictions: string[];        // 制約事項
  performance_metrics?: string;  // 性能指標
  learning_capabilities?: string; // 学習能力
  hierarchy_level: number;       // 階層レベル
  inherited_from: string[];      // 継承元人格ID
}
```

### HierarchyPosition
```typescript
interface HierarchyPosition {
  ancestors: string[];    // 祖先人格ID
  descendants: string[];  // 子孫人格ID
  depth: number;         // 階層深度
  is_root: boolean;      // ルート人格か
  is_leaf: boolean;      // 葉人格か
}
```

## データベース設計

### 主要テーブル

#### persona_capabilities
```sql
CREATE TABLE IF NOT EXISTS persona_capabilities (
  context_id TEXT PRIMARY KEY,
  expertise TEXT DEFAULT '[]',
  tools TEXT DEFAULT '[]',
  restrictions TEXT DEFAULT '[]',
  performance_metrics TEXT,
  learning_capabilities TEXT,
  is_public INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (context_id) REFERENCES contexts(context_id)
)
```

#### persona_hierarchy（閉包テーブル）
```sql
CREATE TABLE IF NOT EXISTS persona_hierarchy (
  ancestor_id TEXT NOT NULL,
  descendant_id TEXT NOT NULL,
  depth INTEGER NOT NULL,
  is_direct INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (ancestor_id, descendant_id),
  FOREIGN KEY (ancestor_id) REFERENCES contexts(context_id),
  FOREIGN KEY (descendant_id) REFERENCES contexts(context_id)
)
```

## パフォーマンス最適化

### プリコンパイルクエリ
```typescript
this.queries = {
  getPersonaCapabilities: this.db.prepare(`
    SELECT * FROM persona_capabilities WHERE context_id = ?
  `),
  getAncestors: this.db.prepare(`
    SELECT ancestor_id, depth 
    FROM persona_hierarchy 
    WHERE descendant_id = ? AND depth > 0
    ORDER BY depth ASC
  `),
  // ... 他のクエリ
};
```

### インデックス戦略
- `persona_capabilities.context_id` (PRIMARY KEY)
- `persona_hierarchy.ancestor_id`
- `persona_hierarchy.descendant_id`
- `persona_hierarchy.depth`

## エラーハンドリング

### 入力検証
```typescript
if (!observerContextId || !targetContextId) {
  throw new Error('Observer context ID and target context ID are required');
}
```

### 循環継承検出
```typescript
const wouldCreateCircle = parentAncestors.some(
  (ancestor: any) => ancestor.ancestor_id === childContextId
);
if (wouldCreateCircle) {
  throw new Error('Circular inheritance detected');
}
```

### デフォルト値生成
```typescript
if (!capabilities) {
  await this.createDefaultCapabilities(contextId);
  capabilities = this.queries.getPersonaCapabilities.get(contextId);
}
```

## テスト戦略

### テストカバレッジ：21/21成功

#### 1. 自覚機能テスト（7テスト）
- 基本的な自覚情報取得
- 新規コンテキストの自動作成
- 階層位置の正確な計算
- 責務・制約・アクションの計算
- Zodスキーマ検証
- エラーハンドリング
- データベース整合性

#### 2. 他覚機能テスト（7テスト）
- 基本的な他覚情報取得
- 関係性判定ロジック
- 観察権限の制御
- 入力値検証
- 無関係人格の制限
- 階層関係の検出
- 相互作用履歴

#### 3. 継承機能テスト（7テスト）
- 基本的な能力継承
- 継承ルールの適用
- 循環継承検出
- 自己継承禁止
- 親子関係の自動作成
- エラー条件の処理
- データ整合性確保

## 制約遵守状況

### Step3制約11項目

#### 開発プロセス制約
- ✅ **制約1**: 開発用ブランチ`feature/persona-naming-and-merge`で実装
- ✅ **制約2**: 類似コード排除（DatabaseInitializer統一）
- ✅ **制約3**: Lint・CCN解析実施（TypeScriptビルド成功）
- ✅ **制約4**: 新規問題なし（21/21テスト成功）

#### 実行制約
- ✅ **制約5**: `mcp_mcp-shell-ser_shell_execute`使用
- ✅ **制約6**: サイレントフォールバックなし
- ✅ **制約7**: フォールバックはユーザー許可制

#### 問題解決制約
- ✅ **制約8**: 専門家人格相談（System Architect連携）
- ✅ **制約9**: 進捗管理人格連携（定期報告）
- ✅ **制約10**: 進捗表共有メモリ管理
- ✅ **制約11**: 連想メモリ活用（設計記録・参照）

## マージ機能仕様

### 言語非限定の融合
- 自動生成部：JSON等整形フォーマット
- 曖昧性解決：自動入力優先
- 冗長記述：自由入力側圧縮
- 矛盾検出：LLMでエラー生成・拒否理由説明

## 運用ガイドライン

### 推奨使用パターン
1. アプリケーション起動時のサービス初期化
2. 人格作成時のデフォルト能力設定
3. 階層変更時の継承処理実行
4. 能力評価時の他覚機能利用

### 注意事項
- **多重初期化防止**: DatabaseInitializerで一元管理
- **循環参照防止**: 継承処理での自動検出
- **権限制御**: 観察者の関係性による情報制限
- **データ整合性**: 外部キー制約とトランザクション管理

### パフォーマンス考慮事項
- クエリプリコンパイル活用
- インデックス効率的利用
- JSON配列の適切なパース
- メモリ使用量の監視

## 今後の拡張予定

### Step4対応
- システムプロンプト自動生成機能
- 人格間コミュニケーション機能
- 動的能力学習機能

### 運用改善
- 能力評価の自動化
- 継承ルールのカスタマイズ
- パフォーマンス監視ダッシュボード

## 関連ドキュメント

- [DatabaseInitializer設計ガイド](./database-initializer.md)
- [システムアーキテクチャ](./system-architecture.md)
- [テスト設計ガイドライン](./test-design-guidelines.md)

---
*最終更新: 2025-07-22*
*担当: GitHub Copilot (Step3実装チーム)*
*テスト結果: 21/21成功*
