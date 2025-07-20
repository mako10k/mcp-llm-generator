/**
 * 簡易共有メモリMCPツール実装
 * SharedMemoryCoreを使用したMCPプロトコル対応層
 */

import { z } from 'zod';
import Database from 'better-sqlite3';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { 
  SharedMemoryCore,
  CreateMemoryRequestSchema,
  UpdateMemoryRequestSchema,
  SearchMemoryRequestSchema 
} from '../core/shared-memory-core.js';

/**
 * 共有メモリMCPツール群の定義
 * SharedMemoryCoreを使用したMCPインターフェース層
 */
export class SharedMemoryMCPTools {
  private memoryCore: SharedMemoryCore;

  constructor(database: Database.Database) {
    this.memoryCore = new SharedMemoryCore(database);
  }

  /**
   * MCP Toolsリストの取得
   */
  getTools(): Tool[] {
    return [
      {
        name: 'shared-memory-create',
        description: 'Create a new shared memory item for team collaboration.',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Title of the memory item',
              minLength: 1,
              maxLength: 200
            },
            content: {
              type: 'string',
              description: 'Content of the memory item',
              maxLength: 10000
            },
            permission_level: {
              type: 'string',
              enum: ['public', 'edit'],
              default: 'edit',
              description: 'Access permission: public=read-only, edit=editable by anyone'
            },
            creator_persona_id: {
              type: 'string',
              description: 'ID of the creating persona'
            }
          },
          required: ['title', 'content', 'creator_persona_id'],
          additionalProperties: false
        }
      },
      {
        name: 'shared-memory-search',
        description: 'Search shared memory items by title or content.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search keyword to find in title or content'
            },
            limit: {
              type: 'number',
              default: 10,
              minimum: 1,
              maximum: 50,
              description: 'Maximum number of results to return'
            },
            offset: {
              type: 'number',
              default: 0,
              minimum: 0,
              description: 'Number of results to skip for pagination'
            },
            requester_persona_id: {
              type: 'string',
              description: 'ID of the requesting persona'
            }
          },
          required: ['requester_persona_id'],
          additionalProperties: false
        }
      },
      {
        name: 'shared-memory-get',
        description: 'Get detailed information of a specific shared memory item.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the memory item to retrieve'
            },
            requester_persona_id: {
              type: 'string',
              description: 'ID of the requesting persona'
            }
          },
          required: ['id', 'requester_persona_id'],
          additionalProperties: false
        }
      },
      {
        name: 'shared-memory-update',
        description: 'Update a shared memory item. Only editable items or owned items can be updated.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the memory item to update'
            },
            title: {
              type: 'string',
              description: 'New title (optional)',
              minLength: 1,
              maxLength: 200
            },
            content: {
              type: 'string',
              description: 'New content (optional)',
              maxLength: 10000
            },
            permission_level: {
              type: 'string',
              enum: ['public', 'edit'],
              description: 'New access permission (optional)'
            },
            updater_persona_id: {
              type: 'string',
              description: 'ID of the updating persona'
            }
          },
          required: ['id', 'updater_persona_id'],
          additionalProperties: false
        }
      },
      {
        name: 'shared-memory-delete',
        description: 'Delete a shared memory item. Only the owner can delete the item.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the memory item to delete'
            },
            deleter_persona_id: {
              type: 'string',
              description: 'ID of the deleting persona'
            }
          },
          required: ['id', 'deleter_persona_id'],
          additionalProperties: false
        }
      },
      {
        name: 'shared-memory-notifications',
        description: 'Get recent change notifications for shared memory items.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              default: 10,
              minimum: 1,
              maximum: 50,
              description: 'Maximum number of notifications to return'
            },
            persona_id: {
              type: 'string',
              description: 'ID of the persona requesting notifications'
            }
          },
          required: ['persona_id'],
          additionalProperties: false
        }
      }
    ];
  }

  /**
   * MCP Tool実行ハンドラー
   */
  async handleToolCall(name: string, args: any): Promise<any> {
    try {
      // System Architect指導: リクエストペイロードをログ出力
      console.log(`[MCP DEBUG] Tool: ${name}`);
      console.log(`[MCP DEBUG] Received payload:`, JSON.stringify(args, null, 2));
      
      switch (name) {
        case 'shared-memory-create':
          return await this.handleCreate(args);
        
        case 'shared-memory-search':
          return await this.handleSearch(args);
        
        case 'shared-memory-get':
          return await this.handleGet(args);
        
        case 'shared-memory-update':
          return await this.handleUpdate(args);
        
        case 'shared-memory-delete':
          return await this.handleDelete(args);
        
        case 'shared-memory-notifications':
          return await this.handleNotifications(args);
        
        default:
          return {
            isError: true,
            content: [{ 
              type: 'text', 
              text: `Unknown shared memory tool: ${name}` 
            }]
          };
      }
    } catch (error) {
      console.error(`Shared memory tool error (${name}):`, error);
      return {
        isError: true,
        content: [{ 
          type: 'text', 
          text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }]
      };
    }
  }

  private async handleCreate(args: any) {
    try {
      // Zodスキーマで入力検証
      const validatedData = CreateMemoryRequestSchema.parse({
        title: args.title,
        content: args.content,
        permission_level: args.permission_level || 'edit',
        creator_persona_id: args.creator_persona_id
      });

      const result = this.memoryCore.createMemory(validatedData);

      if (result.success) {
        return {
          content: [{
            type: 'text',
            text: `✅ 共有メモ「${validatedData.title}」を作成しました。\nID: ${result.data?.id}\n権限: ${validatedData.permission_level}`
          }]
        };
      } else {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `❌ メモ作成に失敗しました: ${result.error}`
          }]
        };
      }
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `❌ 入力データの検証に失敗しました: ${error instanceof z.ZodError ? error.message : String(error)}`
        }]
      };
    }
  }

  private async handleSearch(args: any) {
    try {
      // Zodスキーマで入力検証
      const validatedData = SearchMemoryRequestSchema.parse({
        query: args.query,
        limit: args.limit || 10,
        offset: args.offset || 0
      });

      const result = this.memoryCore.searchMemories(
        validatedData,
        args.requester_persona_id
      );

      if (result.success && result.data?.memories) {
        const memoriesText = result.data.memories.map((memory: any) => 
          `📝 **${memory.title}**\n` +
          `   ID: ${memory.id}\n` +
          `   作成者: ${memory.owner_persona_id}\n` +
          `   権限: ${memory.permission_level}\n` +
          `   更新: ${memory.updated_at}\n` +
          `   内容: ${memory.content.slice(0, 100)}${memory.content.length > 100 ? '...' : ''}\n`
        ).join('\n');

        return {
          content: [{
            type: 'text',
            text: result.data.memories.length > 0 
              ? `🔍 検索結果 (${result.data.memories.length}/${result.data.total}件)\n\n${memoriesText}`
              : `🔍 検索結果: 該当するメモが見つかりませんでした。`
          }]
        };
      } else {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `❌ 検索に失敗しました: ${result.error}`
          }]
        };
      }
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `❌ 入力データの検証に失敗しました: ${error instanceof z.ZodError ? error.message : String(error)}`
        }]
      };
    }
  }

  private async handleGet(args: any) {
    const result = this.memoryCore.getMemory(args.id, args.requester_persona_id);

    if (result.success && result.data) {
      const memory = result.data;
      return {
        content: [{
          type: 'text',
          text: `📝 **${memory.title}**\n\n` +
                `**内容:**\n${memory.content}\n\n` +
                `**詳細情報:**\n` +
                `- ID: ${memory.id}\n` +
                `- 作成者: ${memory.owner_persona_id}\n` +
                `- 権限: ${memory.permission_level}\n` +
                `- 作成日: ${memory.created_at}\n` +
                `- 更新日: ${memory.updated_at}\n` +
                `- 最終更新者: ${memory.last_updated_by}`
        }]
      };
    } else {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `❌ メモ取得に失敗しました: ${result.error}`
        }]
      };
    }
  }

  private async handleUpdate(args: any) {
    const result = this.memoryCore.updateMemory(
      {
        id: args.id,
        title: args.title,
        content: args.content,
        permission_level: args.permission_level
      },
      args.updater_persona_id
    );

    if (result.success) {
      return {
        content: [{
          type: 'text',
          text: `✅ メモを更新しました。\nID: ${args.id}`
        }]
      };
    } else {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `❌ メモ更新に失敗しました: ${result.error}`
        }]
      };
    }
  }

  private async handleDelete(args: any) {
    const result = this.memoryCore.deleteMemory(args.id, args.deleter_persona_id);

    if (result.success) {
      return {
        content: [{
          type: 'text',
          text: `✅ メモを削除しました。\nID: ${args.id}`
        }]
      };
    } else {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `❌ メモ削除に失敗しました: ${result.error}`
        }]
      };
    }
  }

  private async handleNotifications(args: any) {
    const result = this.memoryCore.getRecentNotifications(
      args.persona_id,
      args.limit || 10
    );

    if (result.success && result.data) {
      const notificationsText = result.data.map((notif: any) => 
        `🔔 ${notif.message}\n` +
        `   種別: ${notif.type} | 更新者: ${notif.updated_by}\n` +
        `   メモ: ${notif.memory_title} (ID: ${notif.memory_id})\n` +
        `   日時: ${notif.timestamp}\n`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: result.data.length > 0
            ? `🔔 最近の通知 (${result.data.length}件)\n\n${notificationsText}`
            : `🔔 最近の通知はありません。`
        }]
      };
    } else {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `❌ 通知取得に失敗しました: ${result.error}`
        }]
      };
    }
  }
}
