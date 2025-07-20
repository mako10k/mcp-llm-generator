# データベース設計・依存関係ドキュメント

## 概要
Sprint4 Phase 1で実装したペルソナ管理統合システムのデータベース設計と依存関係を明文化しています。

## テーブル一覧と関係

### 主要テーブル

#### 1. contexts
- **目的**: 人格・コンテキストの基本情報
- **主キー**: context_id (TEXT)
- **カラム**: name, description, created_at, updated_at

#### 2. persona_capabilities
- **目的**: 人格の能力・専門分野・制約情報
- **主キー**: context_id (TEXT)
- **外部キー**: contexts.context_id を参照
- **重要**: createTaskDelegationでの事前チェック対象テーブル
- **カラム**: 
  - expertise (JSON): 専門分野配列
  - tools (JSON): 利用可能ツール配列
  - restrictions (JSON): 制約事項配列
  - learning_capabilities (JSON): 学習能力情報

#### 3. task_delegations
- **目的**: タスク委譲の履歴・状況管理
- **主キー**: delegation_id (TEXT)
- **外部キー**: 
  - from_context_id → persona_capabilities.context_id
  - to_context_id → persona_capabilities.context_id
- **カラム**: task_description, required_capabilities, priority_level, status, created_at, updated_at

#### 4. persona_roles
- **目的**: 権限・ロール管理
- **主キー**: context_id (TEXT)
- **外部キー**: persona_capabilities.context_id を参照

#### 5. persona_lineage
- **目的**: 人格系譜・継承関係
- **外部キー**: 
  - parent_context_id → persona_capabilities.context_id
  - child_context_id → persona_capabilities.context_id

## 重要な依存関係

### 外部キー制約のポイント

1. **persona_capabilities が中心**
   - 他のテーブルはpersona_capabilitiesのcontext_idを参照
   - contextsテーブルとpersona_capabilitiesは1:1関係
   - **重要**: PersonaManager.createTaskDelegationは persona_capabilities で存在チェック

2. **テスト時の注意点**
   - contextsテーブルにコンテキスト作成だけでは不十分
   - **必須**: persona_capabilitiesテーブルにも対応レコード作成
   - updatePersonaCapabilities()メソッドを使用して両テーブルを適切に設定

### データフロー

```
1. コンテキスト作成
   contexts INSERT → persona_capabilities INSERT (updatePersonaCapabilities)

2. タスク委譲作成
   persona_capabilities 存在チェック → task_delegations INSERT

3. 権限管理
   persona_capabilities → persona_roles 関連付け
```

## テスト設計ガイドライン

### 必須ルール

1. **一意ID使用**
   - 各テストで一意のcontext_idを使用
   - 例: 'smart_delegator', 'monitor_delegator', 'test_unique_001'

2. **完全セットアップ**
   - contextsテーブル + persona_capabilitiesテーブル両方設定
   - updatePersonaCapabilities()メソッド使用推奨

3. **依存関係確認**
   - 外部キー制約エラー時は参照先テーブルの存在確認
   - エラーメッセージ「from_exists: false」は persona_capabilities 未設定を示す

### テストパターン例

```typescript
// 良い例
test('タスク委譲テスト', () => {
  // 1. contextsテーブルに作成
  db.prepare('INSERT INTO contexts (context_id, name) VALUES (?, ?)').run('unique_delegator', 'Delegator');
  
  // 2. persona_capabilitiesテーブルにも設定（重要！）
  personaManager.updatePersonaCapabilities('unique_delegator', {
    expertise: ['management'],
    tools: ['delegation'],
    restrictions: []
  });
  
  // 3. タスク委譲実行
  const result = personaManager.createTaskDelegation({...});
});
```

## エラーパターンと対策

### よくあるエラー

1. **外部キー制約違反**
   - 原因: persona_capabilitiesテーブル未設定
   - 対策: updatePersonaCapabilities()で事前設定

2. **UNIQUE制約違反**
   - 原因: 同じcontext_idを複数テストで使用
   - 対策: テストごとに一意ID使用

3. **from_exists: false エラー**
   - 原因: createTaskDelegationの事前チェックでpersona_capabilities未発見
   - 対策: 委譲元・委譲先両方のpersona_capabilities設定確認

## Phase 2での拡張予定

- function_call_logs: FunctionCall実行履歴
- tool_usage_stats: ツール利用統計
- persona_function_permissions: 人格別Function権限管理

## 更新履歴

- 2025-07-20: 初版作成（Sprint4 Phase 1完了時点）
