# 共有メモリMCPツール設計 - 修正版

**作成日**: 2025-07-19  
**修正理由**: 動作主体とツール定義の混同を修正

## 🎯 正しい設計思想

### MCPツールの呼び出し主体
1. **主体LLM** (GitHub Copilot, Claude等) - MCPクライアント経由
2. **人格LLM** (各コンテキスト内AI) - サンプリング機能経由

### 共有メモリの目的
- 主体LLMが「適切な人格を選択」するための情報提供
- 人格LLMが「自分の能力範囲」「協力可能な相手」を認識

---

## 📋 修正されたMCPツール仕様

### 1. `queryPersonaCapabilities` 
**呼び出し主体**: 主体LLM  
**目的**: タスクに適した人格を見つける

```typescript
// 主体LLMがこう使う：
queryPersonaCapabilities({
  "task_description": "React コンポーネントの最適化",
  "required_skills": ["react", "performance"],
  "return_top_n": 3
})

// レスポンス：
{
  "suitable_personas": [
    {
      "context_id": "context-react-expert",
      "name": "React専門家", 
      "match_score": 95,
      "expertise": ["react", "performance", "typescript"],
      "current_availability": "available"
    }
  ],
  "recommendation": "React専門家が最も適しています。現在利用可能です。"
}
```

### 2. `getPersonaProfile`
**呼び出し主体**: 主体LLM、人格LLM  
**目的**: 特定人格の詳細能力確認

```typescript
// 人格LLMが自分を確認：
getPersonaProfile({"context_id": "self"})

// 人格LLMが他者を確認：  
getPersonaProfile({"context_id": "context-database-expert"})

// レスポンス：
{
  "context_id": "context-database-expert",
  "public_capabilities": {
    "expertise": ["postgresql", "optimization", "troubleshooting"],
    "interaction_style": "technical_detailed",
    "collaboration_preference": "async_tasks"
  },
  "availability": {
    "status": "available",
    "estimated_response_time": "< 1 hour"
  }
}
```

### 3. `requestCollaboration`
**呼び出し主体**: 人格LLM  
**目的**: 他の人格に協力を要請

```typescript
// 人格LLMが他の人格に協力要請：
requestCollaboration({
  "target_context_id": "context-security-expert",
  "request_type": "consultation", 
  "task_description": "このAPIエンドポイントのセキュリティレビュー",
  "urgency": "medium",
  "expected_effort": "30分程度の確認"
})
```

### 4. `getAllPersonasSummary`
**呼び出し主体**: 主体LLM  
**目的**: 利用可能な人格の概要把握

```typescript
// 主体LLMがシステム全体を把握：
getAllPersonasSummary({
  "include_availability": true,
  "group_by": "expertise_area"
})

// レスポンス：
{
  "persona_groups": {
    "development": [
      {"name": "React専門家", "status": "available"},
      {"name": "Backend開発者", "status": "busy"}
    ],
    "analysis": [
      {"name": "データ分析者", "status": "available"}
    ]
  },
  "total_available": 8,
  "recommended_workflow": "開発系タスクはReact専門家へ、分析はデータ分析者へ"
}
```

---

## 🔍 使用シナリオ例

### シナリオ1: 主体LLMがタスク分散
```
ユーザー: "ECサイトの注文処理API作って"

主体LLM: 
1. queryPersonaCapabilities("API開発", ["backend", "database"])
2. → "Backend開発者"が最適と判断
3. Backend開発者コンテキストでタスク実行
```

### シナリオ2: 人格LLMが専門外で協力要請
```
Backend開発者LLM:
"APIは作成しましたが、フロントエンドの実装方法がわかりません"

1. getPersonaProfile("self") → 自分はbackend専門と確認
2. queryPersonaCapabilities("フロントエンド", ["react", "api連携"])
3. → React専門家を発見
4. requestCollaboration(React専門家, "API連携方法の相談")
```

### シナリオ3: 人格LLMが能力範囲を自覚
```
React専門家LLM:
"データベース設計について聞かれましたが..."

1. getPersonaProfile("self") → 自分はフロントエンド専門
2. "申し訳ありませんが、私はフロントエンド専門です"
3. queryPersonaCapabilities("データベース", ["design", "modeling"])
4. → "データベース専門家をお勧めします"
```

---

## 🏗️ 実装アーキテクチャ

### PersonaManager (既存) 
```typescript
// 既存機能をMCPツール用に適応
class PersonaManager {
  // MCPツール用メソッド
  findSuitablePersonas(task: string, skills: string[])
  getPersonaPublicProfile(contextId: string)
  createCollaborationRequest(from: string, to: string, task: string)
  getSystemPersonasSummary()
}
```

### MCPツール登録 (src/index.ts)
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "queryPersonaCapabilities",
      description: "Find suitable personas for a specific task or skill requirement",
      // 主体LLMが人格選択に使用
    },
    {
      name: "getPersonaProfile", 
      description: "Get detailed information about a specific persona",
      // 人格LLMが自己認識・他者認識に使用
    },
    {
      name: "requestCollaboration",
      description: "Request collaboration from another persona",
      // 人格LLMが協力要請に使用
    }
  ]
}));
```

---

## 🎭 人格LLMでの使用例

人格LLMのシステムプロンプトに追加：

```
あなたは[専門分野]の専門家です。

自分の能力を確認したい場合：
getPersonaProfile({"context_id": "self"})

他の専門家の能力を知りたい場合：
getPersonaProfile({"context_id": "対象のID"})

専門外のタスクで協力が必要な場合：
1. queryPersonaCapabilities("タスク内容", ["必要スキル"])で適切な専門家を探す
2. requestCollaboration()で協力を要請

常に自分の専門範囲を意識し、専門外の場合は適切な専門家を紹介してください。
```

---

これで、**主体LLMは人格選択**、**人格LLMは自己認識と協力**という、正しい役割分担になりました！

各ツールの目的も明確になり、実装もシンプルになりそうです 😊
