/**
 * Sprint4 Phase 2: 人格間FunctionCall機能
 * FunctionCall Dispatcher Core - 人格間のFunction実行を統括する中央システム
 */

import { PersonaManager } from './personaManager.js';
import { PersonaLogger } from './personaLogger.js';
import { FunctionExecutionEngine, type FunctionExecutionParams } from './functionExecutionEngine.js';

// =============================================================================
// Type Definitions
// =============================================================================

export interface FunctionCallRequest {
  fromPersonaId: string;
  toPersonaId: string;
  functionName: string;
  parameters: Record<string, any>;
  contextId?: string;
  priority?: 'low' | 'medium' | 'high';
  retryConfig?: {
    maxRetries: number;
    retryDelayMs: number;
  };
}

export interface FunctionCallResponse {
  success: boolean;
  result?: any;
  data?: any;
  error?: string;
  logId: string;
  executionTimeMs: number;
  retryCount?: number;
  metadata?: {
    fromPersonaId: string;
    toPersonaId: string;
    functionName: string;
    timestamp: string;
  };
}

export interface FunctionCallCapability {
  functionName: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
  }>;
  security_level: 'public' | 'protected' | 'private';
  execution_timeout_ms: number;
}

export interface PersonaFunctionRegistry {
  personaId: string;
  availableFunctions: FunctionCallCapability[];
  lastUpdated: Date;
}

// =============================================================================
// Function Call Dispatcher Core
// =============================================================================

export class FunctionCallDispatcher {
  private personaManager: PersonaManager;
  private logger: PersonaLogger;
  private functionRegistry: Map<string, PersonaFunctionRegistry> = new Map();
  private executionEngine: FunctionExecutionEngine;
  
  constructor(personaManager: PersonaManager) {
    this.personaManager = personaManager;
    this.logger = PersonaLogger.getInstance();
    this.executionEngine = new FunctionExecutionEngine(personaManager['db']);
    
    this.logger.info('FunctionCall Dispatcher initialized', {
      method: 'constructor',
      contextId: 'function-call-dispatcher',
      operation: 'dispatcher_initialization'
    });
  }

  /**
   * 人格間Function実行のメインエントリーポイント
   */
  async dispatchFunctionCall(request: FunctionCallRequest): Promise<FunctionCallResponse> {
    const methodName = 'dispatchFunctionCall';
    const startTime = Date.now();
    const requestId = `fc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.debug('Function call dispatch started', {
      method: methodName,
      contextId: requestId,
      operation: 'dispatch_start',
      metadata: {
        from_persona_id: request.fromPersonaId,
        to_persona_id: request.toPersonaId,
        function_name: request.functionName,
        priority: request.priority || 'medium'
      }
    });

    try {
      // Step 1: 権限・能力の事前検証
      const validationResult = await this.validateFunctionCall(request);
      if (!validationResult.valid) {
        return this.createErrorResponse(
          request,
          requestId,
          `Validation failed: ${validationResult.reason}`,
          startTime
        );
      }

      // Step 2: PersonaManagerを通じたタスク委譲実行
      const delegationResult = await this.executeDelegatedFunction(request, requestId);
      
      if (!delegationResult.success) {
        return this.createErrorResponse(
          request,
          requestId,
          delegationResult.error || 'Function execution failed',
          startTime
        );
      }

      // Step 3: 成功レスポンスの構築
      const response: FunctionCallResponse = {
        success: true,
        data: delegationResult.data,
        logId: requestId,
        executionTimeMs: delegationResult.executionTimeMs || (Date.now() - startTime),
        metadata: {
          fromPersonaId: request.fromPersonaId,
          toPersonaId: request.toPersonaId,
          functionName: request.functionName,
          timestamp: new Date().toISOString()
        }
      };

      this.logger.logDatabaseOperation(
        methodName,
        'function_call_success',
        true,
        requestId,
        {
          execution_time_ms: response.executionTimeMs,
          from_persona_id: request.fromPersonaId,
          to_persona_id: request.toPersonaId,
          function_name: request.functionName
        }
      );

      this.logger.info('Function call completed successfully', {
        method: methodName,
        contextId: requestId,
        operation: 'dispatch_success'
      });

      return response;

    } catch (error) {
      this.logger.error(
        'Function call dispatch failed',
        {
          method: methodName,
          contextId: requestId,
          operation: 'dispatch_error',
          metadata: {
            from_persona_id: request.fromPersonaId,
            to_persona_id: request.toPersonaId,
            function_name: request.functionName
          }
        },
        error as Error
      );

      return this.createErrorResponse(
        request,
        requestId,
        `Dispatch error: ${(error as Error).message}`,
        startTime
      );
    }
  }

  /**
   * Function実行権限・能力の検証
   */
  private async validateFunctionCall(request: FunctionCallRequest): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const methodName = 'validateFunctionCall';
    
    // fromPersonaの存在確認
    const fromPersonaCapabilities = this.personaManager.getPersonaCapabilities(request.fromPersonaId);
    if (!fromPersonaCapabilities) {
      this.logger.warn('Source persona not found', {
        method: methodName,
        contextId: request.fromPersonaId,
        operation: 'validation_failed'
      });
      return { valid: false, reason: 'Source persona not found' };
    }

    // toPersonaの存在確認
    const toPersonaCapabilities = this.personaManager.getPersonaCapabilities(request.toPersonaId);
    if (!toPersonaCapabilities) {
      this.logger.warn('Target persona not found', {
        method: methodName,
        contextId: request.toPersonaId,
        operation: 'validation_failed'
      });
      return { valid: false, reason: 'Target persona not found' };
    }

    // Function実行能力の確認
    const hasFunction = toPersonaCapabilities.tools?.includes(request.functionName) ?? false;
    if (!hasFunction) {
      this.logger.warn('Function not available in target persona', {
        method: methodName,
        contextId: request.toPersonaId,
        operation: 'validation_failed',
        metadata: {
          function_name: request.functionName,
          available_tools: toPersonaCapabilities.tools || []
        }
      });
      return { valid: false, reason: `Function '${request.functionName}' not available` };
    }

    // 権限チェック
    const hasPermission = this.personaManager.checkRolePermissions(
      request.fromPersonaId, 
      'function_call'
    );
    if (!hasPermission) {
      this.logger.warn('Permission denied for function call', {
        method: methodName,
        contextId: request.fromPersonaId,
        operation: 'permission_denied'
      });
      return { valid: false, reason: 'Permission denied' };
    }

    // Functionレベルの権限チェック
    const targetPersonaCapabilities = this.personaManager.getPersonaCapabilities(request.toPersonaId);
    if (targetPersonaCapabilities) {
      // 現在は基本的な権限チェックのみ実装
      // TODO: より詳細な権限チェックは次の改善で実装
    }

    this.logger.debug('Function call validation passed', {
      method: methodName,
      operation: 'validation_success',
      metadata: {
        from_persona_id: request.fromPersonaId,
        to_persona_id: request.toPersonaId,
        function_name: request.functionName
      }
    });

    return { valid: true };
  }

  /**
   * PersonaManagerを通じたFunction実行
   */
  private async executeDelegatedFunction(
    request: FunctionCallRequest, 
    requestId: string
  ): Promise<{ success: boolean; result?: any; error?: string; data?: any; executionTimeMs?: number }> {
    const methodName = 'executeDelegatedFunction';
    
    try {
      // PersonaManagerのタスク委譲システムを活用
      const delegationId = this.personaManager.createTaskDelegation({
        from_context_id: request.fromPersonaId,
        to_context_id: request.toPersonaId,
        task_description: `Function call: ${request.functionName}`,
        required_capabilities: [request.functionName],
        priority_level: request.priority || 'medium',
        status: 'pending'
      });

      if (!delegationId) {
        return {
          success: false,
          error: 'Failed to create task delegation'
        };
      }

      // 実際のFunction実行
      const executionParams: FunctionExecutionParams = {
        functionId: `func_${request.functionName}`,
        functionName: request.functionName,
        parameters: request.parameters,
        fromPersonaId: request.fromPersonaId,
        toPersonaId: request.toPersonaId,
        requestId,
        timeout: 30000 // デフォルト30秒
      };

      const executionResult = await this.executionEngine.executeFunction(executionParams);

      if (!executionResult.success) {
        this.logger.error('Function execution failed', {
          method: methodName,
          contextId: requestId,
          operation: 'execution_failed',
          metadata: {
            function_name: request.functionName,
            error: executionResult.error
          }
        });

        return {
          success: false,
          error: executionResult.error || 'Function execution failed',
          executionTimeMs: executionResult.executionTimeMs
        };
      }

      this.logger.debug('Function execution delegated successfully', {
        method: methodName,
        contextId: requestId,
        operation: 'delegation_success',
        metadata: {
          delegation_id: delegationId,
          function_name: request.functionName,
          execution_time_ms: executionResult.executionTimeMs
        }
      });

      return {
        success: true,
        data: executionResult.data,
        executionTimeMs: executionResult.executionTimeMs
      };

    } catch (error) {
      this.logger.error(
        'Function delegation failed',
        {
          method: methodName,
          contextId: requestId,
          operation: 'delegation_error'
        },
        error as Error
      );

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * エラーレスポンスの構築
   */
  private createErrorResponse(
    request: FunctionCallRequest,
    requestId: string,
    errorMessage: string,
    startTime: number
  ): FunctionCallResponse {
    return {
      success: false,
      error: errorMessage,
      logId: requestId,
      executionTimeMs: Date.now() - startTime,
      metadata: {
        fromPersonaId: request.fromPersonaId,
        toPersonaId: request.toPersonaId,
        functionName: request.functionName,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Function Registry管理
   */
  registerPersonaFunctions(registry: PersonaFunctionRegistry): void {
    this.functionRegistry.set(registry.personaId, registry);
    
    this.logger.info('Persona function registry updated', {
      method: 'registerPersonaFunctions',
      contextId: registry.personaId,
      operation: 'registry_update',
      metadata: {
        function_count: registry.availableFunctions.length
      }
    });
  }

  /**
   * 利用可能Function一覧の取得
   */
  getAvailableFunctions(personaId: string): FunctionCallCapability[] {
    const registry = this.functionRegistry.get(personaId);
    return registry ? registry.availableFunctions : [];
  }
}
