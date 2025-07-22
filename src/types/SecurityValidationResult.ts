export type PromptSecurityLevel = 'low' | 'medium' | 'high';

export interface SecurityValidationResult {
  isValid: boolean;
  issues: string[];
  is_safe: boolean;
  risk_score: number;
  security_level: PromptSecurityLevel;
  detected_attempts: number;
  recommendations: string[];
}
