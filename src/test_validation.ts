import { validatePrediction, validateFullPrediction } from "./validate";

// 测试有效预测
const validPrediction = {
  emotion: "frustrated",
  energy: "low",
  need: "be_heard",
  adviceWanted: "no",
  engagement: "limited",
  riskLevel: "none",
  confidence: 0.9,
  evidence: ["先别给建议", "有点烦"],
  reason: "用户明确拒绝建议",
  shouldPersist: false,
};

console.log("=".repeat(50));
console.log("测试1: 有效预测");
console.log("=".repeat(50));
const result1 = validatePrediction(validPrediction);
console.log("valid:", result1.valid);
console.log("errors:", result1.errors);
console.log("prediction emotion:", result1.prediction?.emotion);
console.log("");

// 测试无效预测（缺少字段）
const invalidPrediction = {
  emotion: "frustrated",
  energy: "low",
  // 缺少 need, adviceWanted 等字段
};

console.log("=".repeat(50));
console.log("测试2: 无效预测（缺少字段）");
console.log("=".repeat(50));
const result2 = validatePrediction(invalidPrediction);
console.log("valid:", result2.valid);
console.log("errors:", result2.errors);
console.log("");

// 测试完整校验
const userMessages = ["先别给建议，我就是有点烦。"];
console.log("=".repeat(50));
console.log("测试3: 完整校验（含 Evidence）");
console.log("=".repeat(50));
const result3 = validateFullPrediction(validPrediction, userMessages);
console.log("schemaValid:", result3.schemaValid);
console.log("schemaErrors:", result3.schemaErrors);
console.log("evidenceGrounded:", result3.evidenceGrounded);
console.log("unmatchedEvidence:", result3.unmatchedEvidence);
console.log("");

// 测试 evidence 不匹配
const predictionWithBadEvidence = {
  ...validPrediction,
  evidence: ["这句话不存在"],
};
console.log("=".repeat(50));
console.log("测试4: Evidence 不匹配");
console.log("=".repeat(50));
const result4 = validateFullPrediction(predictionWithBadEvidence, userMessages);
console.log("schemaValid:", result4.schemaValid);
console.log("evidenceGrounded:", result4.evidenceGrounded);
console.log("unmatchedEvidence:", result4.unmatchedEvidence);