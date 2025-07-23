# 共有メモリMCPツール詳細仕様書

**プロジェクト**: MCP LLM Generator  
**作成日**: 2025-07-19  
**対象スプリント**: Sprint4.5 (短期修正版)  

## 📋 概要

Sprint4で実装されたPersonaManagerクラスの機能を、MCPツールとして外部公開する仕様です。VS Codeや他のMCPクライアントから、ペルソナ間の能力共有、タスク委譲、協力システムが利用可能になります。

## 🎯 実装対象MCPツール

### 1. `queryPersonas` - ペルソナ能力検索

**機能**: 指定した能力を持つペルソナを検索し、適切な協力相手を見つける

**パラメータ**:
```typescript
{
  required_capabilities: string[],  // 必要な能力 (例: ["python", "database", "security"])
  exclude_context_ids?: string[],  // 除外するコンテキストID
  max_results?: number,            // 最大結果数 (デフォルト: 5)
  min_capability_match?: number,   // 最低能力一致率% (デフォルト: 30)
  exclude_busy?: boolean,          // 忙しいペルソナを除外 (デフォルト: false)
  include_load_info?: boolean      // 負荷情報を含める (デフォルト: true)
}
```

**レスポンス例**:
```typescript
{
  "success": true,
  "personas": [
    {
      "context_id": "context-abc123",
      "name": "Python Developer",
      "capability_score": 85,        // 能力一致率%
      "current_load": 2,             // 現在のタスク数
      "expertise": ["python", "fastapi", "database"],
      "tools": ["pytest", "black", "sqlalchemy"],
      "restrictions": ["no_production_deployment"],
      "availability": "available"    // available/busy/offline
    }
  ],
  "total_found": 3,
  "search_criteria": {
    "required_capabilities": ["python", "database"],
    "min_match_threshold": 30
  }
}
```

**実用例**:
```bash
# TypeScript開発者を探す
queryPersonas({"required_capabilities": ["typescript", "node.js"]})

# セキュリティ専門家を探す（忙しい人は除外）
queryPersonas({
  "required_capabilities": ["security", "audit"],
  "exclude_busy": true,
  "min_capability_match": 70
})
```

---

### 2. `getMyCapabilities` - 自己能力参照

**機能**: 現在のコンテキスト（自分）の能力情報を取得

**パラメータ**:
```typescript
{
  context_id?: string,           // 指定しない場合は現在のコンテキスト
  include_performance?: boolean, // パフォーマンス情報を含める
  include_lineage?: boolean      // 系譜情報を含める
}
```

**レスポンス例**:
```typescript
{
  "success": true,
  "context_id": "context-def456",
  "capabilities": {
    "expertise": ["react", "typescript", "ui_design"],
    "tools": ["figma", "storybook", "jest"],
    "restrictions": ["frontend_only", "no_backend_access"],
    "performance_metrics": {
      "tasks_completed": 15,
      "success_rate": 92.5,
      "avg_completion_time": "2.3 hours"
    },
    "learning_capabilities": {
      "adaptability_score": 78,
      "knowledge_retention": 85,
      "learning_speed": "fast"
    }
  },
  "role_info": {
    "role_type": "specialist",
    "permissions": ["read_code", "create_ui"],
    "is_admin": false
  },
  "lineage": {
    "ancestors": [
      {"context_id": "context-parent1", "relation": "mentor", "depth": 1}
    ],
    "descendants": [],
    "lineage_strength": 45
  }
}
```

**実用例**:
```bash
# 自分の能力確認
getMyCapabilities()

# 系譜情報も含めて確認
getMyCapabilities({"include_lineage": true})
```

---

### 3. `getOtherCapabilities` - 他者能力参照

**機能**: 指定したペルソナの能力情報を取得（権限に応じて表示内容調整）

**パラメータ**:
```typescript
{
  target_context_id: string,     // 対象のコンテキストID
  detail_level?: "basic" | "detailed" | "full", // 詳細レベル
  requester_context_id?: string  // 要求者ID（権限チェック用）
}
```

**レスポンス例**:
```typescript
{
  "success": true,
  "target_context_id": "context-xyz789",
  "detail_level": "detailed",
  "capabilities": {
    "public_expertise": ["database", "sql", "performance"],
    "public_tools": ["postgresql", "redis", "monitoring"],
    "collaboration_score": 88,     // 協力しやすさスコア
    "communication_style": "technical", 
    "availability_status": "available",
    "preferred_tasks": ["optimization", "troubleshooting"]
  },
  "restricted_info": {
    "access_level": "limited",     // 権限に応じて制限
    "hidden_capabilities": 3,      // 非表示の能力数
    "reason": "insufficient_permissions"
  }
}
```

---

### 4. `delegateTask` - タスク委譲

**機能**: 他のペルソナにタスクを委譲する

**パラメータ**:
```typescript
{
  task_description: string,        // タスクの説明
  required_capabilities: string[], // 必要な能力
  target_context_id?: string,      // 指定の委譲先（省略時は自動選択）
  priority?: "low" | "medium" | "high" | "urgent",
  deadline?: string,               // ISO形式の日時
  auto_select?: boolean,           // 自動選択を使用
  selection_criteria?: {           // 自動選択の条件
    min_capability_match: number,
    max_candidates: number,
    exclude_busy: boolean
  }
}
```

**レスポンス例**:
```typescript
{
  "success": true,
  "delegation_id": "task_1721393847_abc123",
  "selected_persona": {
    "context_id": "context-expert789",
    "name": "Database Expert",
    "capability_match": 92,
    "estimated_completion": "2-3 hours"
  },
  "task_info": {
    "description": "Optimize slow SQL queries in user dashboard",
    "priority": "high",
    "status": "pending",
    "required_capabilities": ["sql", "performance", "postgresql"]
  },
  "notification": "Task delegation created and notification sent to target persona"
}
```

**実用例**:
```bash
# 自動選択でタスク委譲
delegateTask({
  "task_description": "React コンポーネントのパフォーマンス最適化",
  "required_capabilities": ["react", "performance", "optimization"],
  "priority": "medium",
  "auto_select": true
})

# 指定の人にタスク委譲
delegateTask({
  "task_description": "セキュリティ監査レポート作成",
  "target_context_id": "context-security-expert",
  "priority": "urgent",
  "deadline": "2025-07-20T17:00:00Z"
})
```

---

### 5. `listAvailablePersonas` - 利用可能ペルソナ一覧

**機能**: 現在利用可能なペルソナの一覧と基本情報を取得

**パラメータ**:
```typescript
{
  filter_by_role?: string,        // ロールでフィルタ
  filter_by_status?: "available" | "busy" | "all",
  include_self?: boolean,         // 自分を含める
  sort_by?: "name" | "capability" | "availability" | "load"
}
```

**レスポンス例**:
```typescript
{
  "success": true,
  "personas": [
    {
      "context_id": "context-dev001",
      "name": "Backend Developer",
      "role_type": "specialist",
      "primary_expertise": ["node.js", "api", "database"],
      "availability": "available",
      "current_load": 1,
      "collaboration_rating": 4.2
    },
    {
      "context_id": "context-design001", 
      "name": "UI Designer",
      "role_type": "creative",
      "primary_expertise": ["ui", "figma", "prototyping"],
      "availability": "busy",
      "current_load": 3,
      "collaboration_rating": 4.8
    }
  ],
  "total_count": 12,
  "available_count": 8,
  "busy_count": 4
}
```

---

### 6. `acceptTask` - タスク受諾

**機能**: 委譲されたタスクを受諾・拒否・交渉する

**パラメータ**:
```typescript
{
  delegation_id: string,
  action: "accept" | "decline" | "negotiate",
  message?: string,               // 理由やコメント
  proposed_deadline?: string,     // 交渉時の提案期限
  resource_requirements?: string[] // 必要なリソース
}
```

**レスポンス例**:
```typescript
{
  "success": true,
  "delegation_id": "task_1721393847_abc123",
  "action": "accept",
  "new_status": "accepted",
  "estimated_start": "2025-07-19T14:00:00Z",
  "estimated_completion": "2025-07-19T17:00:00Z",
  "message": "Task accepted. Will start after current task completion.",
  "next_steps": [
    "Review task requirements in detail",
    "Set up development environment", 
    "Begin implementation"
  ]
}
```

---

### 7. `listMyTasks` - 自分のタスク一覧

**機能**: 委譲したタスク・受けたタスクの一覧と進捗を確認

**パラメータ**:
```typescript
{
  task_type?: "delegated" | "received" | "all",
  status_filter?: "pending" | "in_progress" | "completed" | "all",
  limit?: number,
  include_progress?: boolean
}
```

**レスポンス例**:
```typescript
{
  "success": true,
  "tasks": {
    "delegated_tasks": [
      {
        "delegation_id": "task_1721393847_abc123",
        "to_persona": "Database Expert",
        "description": "SQL optimization",
        "status": "in_progress",
        "progress": 65,
        "last_update": "2025-07-19T13:30:00Z"
      }
    ],
    "received_tasks": [
      {
        "delegation_id": "task_1721394000_def456", 
        "from_persona": "Project Manager",
        "description": "API documentation update",
        "status": "pending",
        "progress": 0,
        "deadline": "2025-07-20T18:00:00Z"
      }
    ]
  },
  "summary": {
    "total_active": 3,
    "pending_acceptance": 1,
    "in_progress": 2,
    "overdue": 0
  }
}
```

## 🔧 技術実装詳細

### MCPツール登録方法

```typescript
// src/index.ts に追加する実装例
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "queryPersonas",
      description: "Search for personas with specific capabilities",
      inputSchema: {
        type: "object",
        properties: {
          required_capabilities: {
            type: "array",
            items: { type: "string" },
            description: "Required capabilities to search for"
          },
          exclude_context_ids: {
            type: "array", 
            items: { type: "string" },
            description: "Context IDs to exclude from search"
          },
          max_results: {
            type: "number",
            default: 5,
            description: "Maximum number of results"
          }
        },
        required: ["required_capabilities"]
      }
    },
    // ... 他のツール定義
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case "queryPersonas":
      return handleQueryPersonas(args);
    case "getMyCapabilities":
      return handleGetMyCapabilities(args);
    // ... 他のハンドラー
  }
});
```

### エラーハンドリング戦略

```typescript
// 共通エラーレスポンス形式
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to view detailed capabilities",
    "details": {
      "required_permission": "admin",
      "current_permission": "user"
    }
  },
  "suggestions": [
    "Request admin permissions from system administrator",
    "Use basic capability query instead"
  ]
}
```

## 🧪 テスト計画

### 単体テスト
- 各MCPツールの正常系・異常系テスト
- パラメータバリデーション
- 権限チェック機能

### 統合テスト  
- VS Code MCP接続テスト
- 複数ペルソナ間の協調動作テスト
- 負荷テスト（複数タスク委譲）

### 実用テスト
- 実際の開発タスクでの委譲フロー
- ペルソナ検索精度の評価
- 系譜機能の動作確認

## 📈 期待される効果

1. **協調開発の効率化**: 適切な専門家への即座のタスク委譲
2. **知識共有の促進**: ペルソナ間の能力可視化
3. **作業負荷の最適化**: 自動的な負荷分散
4. **スキル発見**: 隠れた専門能力の発掘
5. **学習促進**: 系譜機能による知識継承

## ⚠️ 注意点とリスク

- **プライバシー**: 能力情報の公開レベル制御が重要
- **パフォーマンス**: 大量のペルソナでの検索効率
- **権限管理**: 適切な認可システムの実装
- **スパム防止**: タスク委譲の濫用防止機能

---

**この仕様書に基づいて実装すると、ペルソナ間の本格的な協調システムが完成します！** 😄

実装時に詳細で迷うところがあれば、いつでも相談してくださいね〜
