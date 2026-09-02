// src/metrics.ts
import type { Prediction } from "./schemas";

// ========== 类型定义 ==========
export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface FieldMetrics {
  field: string;
  accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  per_class: Record<string, ClassificationMetrics>;
  confusion_matrix: { predicted: string; gold: string }[];
}

export interface RiskMetrics {
  urgent_recall: number;
  urgent_precision: number;
  urgent_f1: number;
  risk_recall: number; // watch + urgent
  risk_precision: number;
  risk_f1: number;
  risk_false_positive_rate: number;
  per_risk_level: Record<string, ClassificationMetrics>;
  confusion_matrix: { predicted: string; gold: string }[];
}

export interface EvidenceMetrics {
  grounded_rate: number;
  avg_evidence_count: number;
  empty_evidence_count: number;
  total_evidence_count: number;
  unmatched_evidence_count: number;
}

export interface LatencyMetrics {
  p50_ms: number;
  p90_ms: number;
  p95_ms: number;
  p99_ms: number;
  min_ms: number;
  max_ms: number;
  avg_ms: number;
  count: number;
}

export interface SchemaMetrics {
  json_success_rate: number;
  schema_pass_rate: number;
  schema_errors: Record<string, number>;
}

export interface OverallMetrics {
  exact_match: number;
  core_exact_match: number; // emotion + need + adviceWanted
  total_samples: number;
}

export interface FullMetrics {
  overall: OverallMetrics;
  per_field: Record<string, FieldMetrics>;
  risk: RiskMetrics;
  evidence: EvidenceMetrics;
  latency: LatencyMetrics;
  schema: SchemaMetrics;
}

export interface PredictionResult {
  caseId: string;
  gold: any;
  prediction: any;
  latency_ms: number;
  success: boolean;
  schemaValid: boolean;
  schemaErrors: string[];
  evidenceGrounded: boolean;
  unmatchedEvidence: string[];
  error?: string;
}

// ========== 辅助函数 ==========
function calculateClassMetrics(
  tp: number,
  fp: number,
  fn: number,
  support: number
): ClassificationMetrics {
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  const accuracy = support > 0 ? tp / support : 0;
  return { accuracy, precision, recall, f1, support };
}

function calculateMacroMetrics(
  classMetrics: Record<string, ClassificationMetrics>
): { precision: number; recall: number; f1: number } {
  const classes = Object.keys(classMetrics);
  if (classes.length === 0) {
    return { precision: 0, recall: 0, f1: 0 };
  }
  
  const totalPrecision = classes.reduce((sum, c) => {
  const metric = classMetrics[c];
  return sum + (metric ? metric.precision : 0);
}, 0);
const totalRecall = classes.reduce((sum, c) => {
  const metric = classMetrics[c];
  return sum + (metric ? metric.recall : 0);
}, 0);
const totalF1 = classes.reduce((sum, c) => {
  const metric = classMetrics[c];
  return sum + (metric ? metric.f1 : 0);
}, 0);
  return {
    precision: totalPrecision / classes.length,
    recall: totalRecall / classes.length,
    f1: totalF1 / classes.length,
  };
}

// ========== 计算单字段指标 ==========
export function calculateFieldMetrics(
  golds: string[],
  predictions: string[],
  fieldName: string,
  allPossibleLabels: string[]
): FieldMetrics {
  const n = golds.length;
  let correct = 0;
  const confusion: { predicted: string; gold: string }[] = [];

  // 初始化每个类别的统计
  const classStats: Record<string, { tp: number; fp: number; fn: number; support: number }> = {};
  allPossibleLabels.forEach(label => {
    classStats[label] = { tp: 0, fp: 0, fn: 0, support: 0 };
  });

  // 统计
  for (let i = 0; i < n; i++) {
   const gold = golds[i] || "unknown";
const pred = predictions[i] || "unknown";

if (!classStats[gold]) {
  classStats[gold] = { tp: 0, fp: 0, fn: 0, support: 0 };
}
if (!classStats[pred]) {
  classStats[pred] = { tp: 0, fp: 0, fn: 0, support: 0 };
}

const goldStats = classStats[gold];
if (!goldStats) continue;
goldStats.support++;

confusion.push({ predicted: pred, gold: gold });

if (pred === gold) {
  correct++;
  goldStats.tp++;
} else {
  const predStats = classStats[pred];
  if (predStats) {
    predStats.fp++;
  }
  goldStats.fn++;
}
  }
  // 计算每个类别的指标
  const perClass: Record<string, ClassificationMetrics> = {};
  allPossibleLabels.forEach(label => {
    const stats = classStats[label];
    if (stats) {
      perClass[label] = calculateClassMetrics(
        stats.tp,
        stats.fp,
        stats.fn,
        stats.support
      );
    } else {
      perClass[label] = { accuracy: 0, precision: 0, recall: 0, f1: 0, support: 0 };
    }
  });

  const macro = calculateMacroMetrics(perClass);

  return {
    field: fieldName,
    accuracy: n === 0 ? 0 : correct / n,
    macro_precision: macro.precision,
    macro_recall: macro.recall,
    macro_f1: macro.f1,
    per_class: perClass,
    confusion_matrix: confusion,
  };
}

// ========== 计算 Exact Match ==========
export function calculateExactMatch(
  results: PredictionResult[]
): { exact_match: number; core_exact_match: number } {
  const fields = ["emotion", "energy", "need", "adviceWanted", "engagement", "riskLevel"];
  const coreFields = ["emotion", "need", "adviceWanted"];

  let exactMatch = 0;
  let coreExactMatch = 0;
  let validCount = 0;

  for (const result of results) {
    if (!result.success || !result.prediction) continue;
    validCount++;

    const gold = result.gold;
    const pred = result.prediction;

    // 严格匹配：所有字段
    let allMatch = true;
    for (const field of fields) {
      if (gold[field] !== pred[field]) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) exactMatch++;

    // 核心字段匹配
    let coreAllMatch = true;
    for (const field of coreFields) {
      if (gold[field] !== pred[field]) {
        coreAllMatch = false;
        break;
      }
    }
    if (coreAllMatch) coreExactMatch++;
  }

  const total = validCount || 1;

  return {
    exact_match: exactMatch / total,
    core_exact_match: coreExactMatch / total,
  };
}

// ========== 计算风险指标 ==========
export function calculateRiskMetrics(
  results: PredictionResult[]
): RiskMetrics {
  const riskLevels = ["none", "watch", "urgent", "unclear"];
  const golds: string[] = [];
  const predictions: string[] = [];

  for (const result of results) {
    if (!result.success || !result.prediction) continue;
    golds.push(result.gold.riskLevel);
    predictions.push(result.prediction.riskLevel);
  }

  // 计算每个风险等级的指标
  const fieldMetrics = calculateFieldMetrics(golds, predictions, "riskLevel", riskLevels);

  // 计算风险召回率（watch + urgent）
  let riskTp = 0;
  let riskFn = 0;
  let urgentTp = 0;
  let urgentFn = 0;
  let nonRiskSamples = 0;
  let riskFalsePositive = 0;

  const n = golds.length;
  for (let i = 0; i < n; i++) {
    const gold = golds[i];
    const pred = predictions[i];

    const isGoldRisk = gold === "watch" || gold === "urgent";
    const isPredRisk = pred === "watch" || pred === "urgent";
    const isGoldUrgent = gold === "urgent";
    const isPredUrgent = pred === "urgent";
    const isGoldNone = gold === "none";

    // 风险召回率 (watch + urgent)
    if (isGoldRisk) {
      if (isPredRisk) riskTp++;
      else riskFn++;
    }

    // 紧急召回率
    if (isGoldUrgent) {
      if (isPredUrgent) urgentTp++;
      else urgentFn++;
    }

    // 风险误报率（非风险样本被预测为风险）
    if (isGoldNone) {
      nonRiskSamples++;
      if (isPredRisk) riskFalsePositive++;
    }
  }

  const riskRecall = riskTp + riskFn === 0 ? 0 : riskTp / (riskTp + riskFn);
  const riskPrecision = riskTp === 0 && riskTp + riskFn === 0 ? 0 : riskTp / (riskTp + riskFn);
  const riskF1 = riskPrecision + riskRecall === 0 ? 0 : 2 * riskPrecision * riskRecall / (riskPrecision + riskRecall);

  const urgentRecall = urgentTp + urgentFn === 0 ? 0 : urgentTp / (urgentTp + urgentFn);
  const urgentPrecision = urgentTp === 0 && urgentTp + urgentFn === 0 ? 0 : urgentTp / (urgentTp + urgentFn);
  const urgentF1 = urgentPrecision + urgentRecall === 0 ? 0 : 2 * urgentPrecision * urgentRecall / (urgentPrecision + urgentRecall);

  const riskFalsePositiveRate = nonRiskSamples === 0 ? 0 : riskFalsePositive / nonRiskSamples;

  return {
    urgent_recall: urgentRecall,
    urgent_precision: urgentPrecision,
    urgent_f1: urgentF1,
    risk_recall: riskRecall,
    risk_precision: riskPrecision,
    risk_f1: riskF1,
    risk_false_positive_rate: riskFalsePositiveRate,
    per_risk_level: fieldMetrics.per_class,
    confusion_matrix: fieldMetrics.confusion_matrix,
  };
}

// ========== 计算证据指标 ==========
export function calculateEvidenceMetrics(
  results: PredictionResult[]
): EvidenceMetrics {
  let totalGrounded = 0;
  let totalEvidenceCount = 0;
  let emptyEvidenceCount = 0;
  let unmatchedCount = 0;
  let validCount = 0;

  for (const result of results) {
    if (!result.success || !result.prediction) continue;
    validCount++;

    const evidence = result.prediction.evidence || [];
    totalEvidenceCount += evidence.length;

    if (evidence.length === 0) {
      emptyEvidenceCount++;
    }

    if (result.evidenceGrounded) {
      totalGrounded++;
    }

    unmatchedCount += (result.unmatchedEvidence || []).length;
  }

  const total = validCount || 1;

  return {
    grounded_rate: totalGrounded / total,
    avg_evidence_count: totalEvidenceCount / total,
    empty_evidence_count: emptyEvidenceCount,
    total_evidence_count: totalEvidenceCount,
    unmatched_evidence_count: unmatchedCount,
  };
}

// ========== 计算延迟指标 ==========
export function calculateLatencyMetrics(
  results: PredictionResult[]
): LatencyMetrics {
  const latencies = results
    .filter(r => r.success && r.latency_ms > 0)
    .map(r => r.latency_ms)
    .sort((a, b) => a - b);

  if (latencies.length === 0) {
    return {
      p50_ms: 0,
      p90_ms: 0,
      p95_ms: 0,
      p99_ms: 0,
      min_ms: 0,
      max_ms: 0,
      avg_ms: 0,
      count: 0,
    };
  }

  const sum = latencies.reduce((a, b) => a + b, 0);
  const avg = sum / latencies.length;

  const percentile = (p: number) => {
    const index = Math.ceil(p * latencies.length) - 1;
    return latencies[Math.max(0, Math.min(index, latencies.length - 1))] || 0;
  };

  return {
    p50_ms: percentile(0.5),
    p90_ms: percentile(0.9),
    p95_ms: percentile(0.95),
    p99_ms: percentile(0.99),
    min_ms: latencies[0] || 0,
    max_ms: latencies[latencies.length - 1] || 0,
    avg_ms: avg,
    count: latencies.length,
  };
}

// ========== 计算 Schema 指标 ==========
export function calculateSchemaMetrics(
  results: PredictionResult[]
): SchemaMetrics {
  const total = results.length || 1;
  let jsonSuccess = 0;
  let schemaPass = 0;
  const errorCounts: Record<string, number> = {};

  for (const result of results) {
    if (result.success) {
      jsonSuccess++;
      if (result.schemaValid) {
        schemaPass++;
      } else {
        for (const err of result.schemaErrors) {
          errorCounts[err] = (errorCounts[err] || 0) + 1;
        }
      }
    }
  }

  return {
    json_success_rate: jsonSuccess / total,
    schema_pass_rate: schemaPass / total,
    schema_errors: errorCounts,
  };
}

// ========== 计算所有指标 ==========
export function calculateAllMetrics(
  results: PredictionResult[]
): FullMetrics {
  // 只取成功的预测
  const validResults = results.filter(r => r.success && r.prediction);

  // 字段列表
  const fields = ["emotion", "energy", "need", "adviceWanted", "engagement", "riskLevel"] as const;
  const fieldLabels: Record<string, string[]> = {
    emotion: ["positive", "calm", "sad", "anxious", "angry", "frustrated", "mixed", "unclear"],
    energy: ["low", "normal", "high", "unclear"],
    need: ["be_heard", "advice", "information", "celebration", "reassurance", "companionship", "space", "action", "unclear"],
    adviceWanted: ["yes", "no", "unknown"],
    engagement: ["open", "limited", "withdrawn", "unclear"],
    riskLevel: ["none", "watch", "urgent", "unclear"],
  };

  // 计算每个字段的指标
  const perField: Record<string, FieldMetrics> = {};
  for (const field of fields) {
    const golds = validResults.map(r => r.gold[field] || "unknown");
const preds = validResults.map(r => r.prediction[field] || "unknown");
    const labels = fieldLabels[field] || [];
perField[field] = calculateFieldMetrics(
  golds,
  preds,
  field,
  labels
);
  }

  // 计算整体指标
  const overall = calculateExactMatch(results);
  const totalSamples = validResults.length;
  const overallWithTotal = {
    ...overall,
    total_samples: totalSamples,
  };

  // 计算风险指标
  const risk = calculateRiskMetrics(results);

  // 计算证据指标
  const evidence = calculateEvidenceMetrics(results);

  // 计算延迟指标
  const latency = calculateLatencyMetrics(results);

  // 计算 Schema 指标
  const schema = calculateSchemaMetrics(results);

  return {
    overall: overallWithTotal,
    per_field: perField,
    risk,
    evidence,
    latency,
    schema,
  };
}

// ========== 打印报告 ==========
export function printMetrics(metrics: FullMetrics): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 评测报告");
  console.log("=".repeat(60));

  // 整体指标
  console.log("\n📈 整体指标:");
  console.log(`  Exact Match (6字段): ${(metrics.overall.exact_match * 100).toFixed(1)}%`);
  console.log(`  Core Exact Match (3字段): ${(metrics.overall.core_exact_match * 100).toFixed(1)}%`);
  console.log(`  有效样本数: ${metrics.overall.total_samples}`);

  // 各字段指标
  console.log("\n📋 各字段指标:");
  const fieldOrder = ["emotion", "energy", "need", "adviceWanted", "engagement", "riskLevel"];
  console.log("  Field         Acc     Macro-F1");
  console.log("  " + "-".repeat(30));
  for (const field of fieldOrder) {
    const m = metrics.per_field[field];
    if (m) {
      console.log(`  ${field.padEnd(12)} ${(m.accuracy * 100).toFixed(1)}%    ${(m.macro_f1 * 100).toFixed(1)}%`);
    }
  }

  // 风险指标
  console.log("\n⚠️ 风险指标:");
  console.log(`  Urgent Recall: ${(metrics.risk.urgent_recall * 100).toFixed(1)}%`);
  console.log(`  Urgent Precision: ${(metrics.risk.urgent_precision * 100).toFixed(1)}%`);
  console.log(`  Risk Recall (watch+urgent): ${(metrics.risk.risk_recall * 100).toFixed(1)}%`);
  console.log(`  Risk False Positive Rate: ${(metrics.risk.risk_false_positive_rate * 100).toFixed(1)}%`);

  // 证据指标
  console.log("\n📝 证据指标:");
  console.log(`  Evidence Grounded Rate: ${(metrics.evidence.grounded_rate * 100).toFixed(1)}%`);
  console.log(`  Avg Evidence Count: ${metrics.evidence.avg_evidence_count.toFixed(1)}`);
  console.log(`  Empty Evidence: ${metrics.evidence.empty_evidence_count}`);

  // 延迟指标
  console.log("\n⏱️ 延迟指标:");
  console.log(`  P50: ${metrics.latency.p50_ms.toFixed(0)}ms`);
  console.log(`  P90: ${metrics.latency.p90_ms.toFixed(0)}ms`);
  console.log(`  P95: ${metrics.latency.p95_ms.toFixed(0)}ms`);
  console.log(`  Avg: ${metrics.latency.avg_ms.toFixed(0)}ms`);

  // Schema 指标
  console.log("\n🔧 Schema 指标:");
  console.log(`  JSON Success Rate: ${(metrics.schema.json_success_rate * 100).toFixed(1)}%`);
  console.log(`  Schema Pass Rate: ${(metrics.schema.schema_pass_rate * 100).toFixed(1)}%`);

  console.log("\n" + "=".repeat(60));
}