import { PredictionSchema, type Prediction } from "./schemas";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  prediction: Prediction | null;
}

export function validatePrediction(raw: unknown): ValidationResult {
  const result = PredictionSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, errors: [], prediction: result.data };
  }
  
  // 使用更宽松的类型处理
  const errors: string[] = result.error.issues.map((issue) => {
    const path = issue.path.map((p) => String(p)).join(".");
    return `${path}: ${issue.message}`;
  });
  
  return {
    valid: false,
    errors,
    prediction: null,
  };
}

// ========== Evidence 原文匹配校验 ==========
export function validateEvidence(
  evidence: string[],
  userMessages: string[]
): { grounded: boolean; unmatched: string[] } {
  if (!evidence || evidence.length === 0) {
    return { grounded: false, unmatched: [] };
  }

  const unmatched = evidence.filter((ev: string) => 
    !userMessages.some((msg: string) => msg.includes(ev))
  );
  return {
    grounded: unmatched.length === 0,
    unmatched,
  };
}

// ========== 完整的预测结果校验（含 evidence） ==========
export interface FullValidationResult {
  schemaValid: boolean;
  schemaErrors: string[];
  evidenceGrounded: boolean;
  unmatchedEvidence: string[];
  prediction: Prediction | null;
}

export function validateFullPrediction(
  raw: unknown,
  userMessages: string[]
): FullValidationResult {
  // 1. Schema 校验
  const schemaResult = validatePrediction(raw);
  
  // 2. Evidence 校验（仅当 Schema 校验通过时）
  let evidenceGrounded = true;
  let unmatchedEvidence: string[] = [];
  
  if (schemaResult.valid && schemaResult.prediction) {
    const evidenceResult = validateEvidence(
      schemaResult.prediction.evidence || [],
      userMessages
    );
    evidenceGrounded = evidenceResult.grounded;
    unmatchedEvidence = evidenceResult.unmatched;
  }

  return {
    schemaValid: schemaResult.valid,
    schemaErrors: schemaResult.errors,
    evidenceGrounded,
    unmatchedEvidence,
    prediction: schemaResult.prediction,
  };
}