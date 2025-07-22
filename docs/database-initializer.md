# DatabaseInitializer 設計・利用ガイド

## 概要

DatabaseInitializerは、mcp-samplerプロジェクトにおけるデータベースの一元的な初期化・管理を担うクラスです。Step3能力自覚システム実装に伴い、DB初期化コードの重複排除と一貫性確保のために設計されました。

## 設計原則

### 1. 一元化管理
- 全テーブルのスキーマ定義を一箇所に集約
- 初期化処理の重複を排除
- 一貫したエラーハンドリング

### 2. タイプ安全性
```typescript
export type TableName = 
  | 'contexts' 
  | 'persona_capabilities' 
  | 'persona_hierarchy' 
  | 'persona_roles' 
  | 'task_delegations' 
  | 'persona_lineage' 
  | 'shared_memories';
```

### 3. パフォーマンス最適化
- インデックス管理の統一
- プリペアドステートメント対応

## アーキテクチャ

```
DatabaseInitializer
├── Schema Definitions (7テーブル)
├── Index Management
├── Initialization Methods
├── Validation Methods
└── Cleanup Methods
```

## 管理対象テーブル

### 1. contexts
人格コンテキストの基本情報
```sql
CREATE TABLE IF NOT EXISTS contexts (
  context_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)
```

### 2. persona_capabilities
人格の能力・制約・ツール情報
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

### 3. persona_hierarchy
人格階層構造（閉包テーブル）
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

### 4. persona_roles
人格の役割・責任定義
```sql
CREATE TABLE IF NOT EXISTS persona_roles (
  role_id TEXT PRIMARY KEY,
  context_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  permissions TEXT DEFAULT '[]',
  responsibilities TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (context_id) REFERENCES contexts(context_id)
)
```

### 5. task_delegations
タスク委譲履歴
```sql
CREATE TABLE IF NOT EXISTS task_delegations (
  delegation_id TEXT PRIMARY KEY,
  from_context_id TEXT NOT NULL,
  to_context_id TEXT NOT NULL,
  task_description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  result TEXT,
  FOREIGN KEY (from_context_id) REFERENCES contexts(context_id),
  FOREIGN KEY (to_context_id) REFERENCES contexts(context_id)
)
```

### 6. persona_lineage
人格の血統・継承関係
```sql
CREATE TABLE IF NOT EXISTS persona_lineage (
  lineage_id TEXT PRIMARY KEY,
  parent_context_id TEXT NOT NULL,
  child_context_id TEXT NOT NULL,
  inheritance_type TEXT DEFAULT 'capability',
  inheritance_strength REAL DEFAULT 1.0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent_context_id) REFERENCES contexts(context_id),
  FOREIGN KEY (child_context_id) REFERENCES contexts(context_id)
)
```

### 7. shared_memories
共有メモリシステム
```sql
CREATE TABLE IF NOT EXISTS shared_memories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  creator_persona_id TEXT NOT NULL,
  permission_level TEXT DEFAULT 'edit',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (creator_persona_id) REFERENCES contexts(context_id)
)
```

## API仕様

### 基本メソッド

#### initializeAll()
```typescript
initializeAll(): void
```
全テーブルを一括初期化。アプリケーション起動時に呼び出し。

#### initializeTable(tableName: TableName)
```typescript
initializeTable(tableName: TableName): void
```
指定テーブルのみ初期化。

#### validateSchema()
```typescript
validateSchema(): boolean
```
現在のDBスキーマが期待値と一致するかチェック。

### 開発・テスト用メソッド

#### clearAllData()
```typescript
clearAllData(): void
```
全テーブルのデータを削除（スキーマは保持）。

#### dropAllTables()
```typescript
dropAllTables(): void
```
全テーブルを削除（開発時のみ使用）。

#### recreateAllTables()
```typescript
recreateAllTables(): void
```
全テーブル削除→再作成。

## 使用方法

### 基本的な利用パターン

```typescript
import { DatabaseInitializer } from '../database/DatabaseInitializer';
import Database from 'better-sqlite3';

class SomeService {
  private db: Database.Database;
  private dbInitializer: DatabaseInitializer;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.dbInitializer = new DatabaseInitializer(this.db);
    
    // 全テーブル初期化
    this.dbInitializer.initializeAll();
  }
}
```

### テスト環境での利用

```typescript
describe('Service Tests', () => {
  let service: SomeService;
  let dbInitializer: DatabaseInitializer;

  beforeEach(() => {
    const db = new Database(':memory:');
    dbInitializer = new DatabaseInitializer(db);
    dbInitializer.initializeAll();
    service = new SomeService(':memory:');
  });

  afterEach(() => {
    // テストデータクリーンアップ
    dbInitializer.clearAllData();
  });
});
```

## 制約遵守事項

### Step3制約11項目対応

1. **開発プロセス制約**
   - ✅ 既存コード類似排除: DB初期化重複コード統一
   - ✅ コード品質: TypeScript型安全性確保
   - ✅ 新規問題回避: 段階的テスト実装

2. **実行制約**
   - ✅ サイレントフォールバック禁止: エラー時は明示的例外
   - ✅ ユーザー許可制: 破壊的操作前の確認必須

3. **問題解決制約**
   - ✅ 進捗管理連携: 実装進捗の定期報告
   - ✅ メモリ活用: 設計決定理由の記録
   - ✅ 専門家相談: System Architectとの設計レビュー

## 運用上の注意点

### ⚠️ 重要な制限事項

1. **初期化タイミング**
   - アプリケーション起動時またはサービス生成時のみ実行
   - リクエスト毎の初期化は禁止

2. **多重初期化防止**
   - `CREATE TABLE IF NOT EXISTS`で重複実行を防止
   - 状態管理による二重初期化検知

3. **外部キー制約**
   - テーブル作成順序の依存関係に注意
   - 削除時は逆順で実行

### 🔧 トラブルシューティング

#### スキーマ不整合エラー
```typescript
// 解決方法
dbInitializer.validateSchema(); // 現状確認
dbInitializer.recreateAllTables(); // 再構築（開発時のみ）
```

#### パフォーマンス問題
```typescript
// インデックス状況確認
dbInitializer.createIndexes(); // インデックス再作成
```

## 今後の拡張予定

### Step4対応
- マージ機能用テーブル追加
- システムプロンプト統合スキーマ

### パフォーマンス改善
- 動的インデックス管理
- クエリ最適化

## 関連ドキュメント

- [Step3実装仕様](./step3-implementation.md)
- [システムアーキテクチャ](./system-architecture.md)
- [テスト設計ガイドライン](./test-design-guidelines.md)

---
*最終更新: 2025-07-22*
*担当: GitHub Copilot (Step3実装チーム)*
