import { loadDataset } from "./dataset";
import { callModel, saveLog } from "./providers";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Case } from "./schemas";

// ========== 配置 ==========
const DATASET_PATH = "./datasets/dev.jsonl";
const MODEL_ID = "qwen-turbo"; // 可换成 qwen-turbo 或 doubao-pro

// ========== 批量评测 ==========
async function batchEvaluate(
  datasetPath: string,
  modelId: string
): Promise<void> {
  console.log(`🚀 开始批量评测`);
  console.log(`📂 数据集: ${datasetPath}`);
  console.log(`🤖 模型: ${modelId}`);
  console.log("");

  // 1. 加载数据
  const cases = loadDataset(datasetPath);
  const total = cases.length;
  console.log(`✅ 加载了 ${total} 条案例\n`);

  // 2. 创建输出目录
  const outputDir = join(process.cwd(), "outputs", modelId);
  mkdirSync(outputDir, { recursive: true });

  // 3. 存储所有结果
  const results: any[] = [];
  let successCount = 0;
  let failCount = 0;

  // 4. 逐条处理
  for (let i = 0; i < cases.length; i++) {
    const caseItem = cases[i];
    if (!caseItem) {
      console.log(`[${i + 1}/${total}] ⚠️ 案例为空，跳过`);
      continue;
    }

    const num = i + 1;
    console.log(`[${num}/${total}] 处理: ${caseItem.id}`);

    try {
      // 提取对话消息 - 使用类型断言确保安全
      const messages = caseItem.messages.map((m: { role: "user" | "assistant"; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // 调用模型（记录延迟）
      const startTime = Date.now();
      const response = await callModel(messages, modelId);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // 解析响应
      const prediction = JSON.parse(response);

      // 保存结果
      const result = {
        caseId: caseItem.id,
        gold: caseItem.gold,
        prediction: prediction,
        latency: latency,
        success: true,
      };

      results.push(result);
      successCount++;

      console.log(`   ✅ 成功 (${latency}ms)`);
      console.log(`      预测情绪: ${prediction.emotion || "未知"} | 黄金标签: ${caseItem.gold.emotion || "未知"}`);

      // 保存单条日志
      saveLog(
        modelId,
        messages,
        response,
        latency,
        new Date().toISOString()
      );

    } catch (error) {
      console.log(`   ❌ 失败: ${error}`);
      results.push({
        caseId: caseItem.id,
        gold: caseItem.gold,
        prediction: null,
        success: false,
        error: String(error),
      });
      failCount++;
    }

    // 每处理5条，保存一次进度（防止中断丢失数据）
    if ((i + 1) % 5 === 0) {
      const checkpointPath = join(outputDir, `checkpoint_${i + 1}.json`);
      writeFileSync(checkpointPath, JSON.stringify(results, null, 2));
      console.log(`   💾 检查点已保存 (${i + 1}/${total})`);
    }

    console.log("");
  }

  // 5. 保存完整结果
  const summaryPath = join(outputDir, `batch_results_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const report = {
    timestamp: new Date().toISOString(),
    model: modelId,
    dataset: datasetPath,
    total: total,
    success: successCount,
    fail: failCount,
    results: results,
  };

  writeFileSync(summaryPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 完整报告已保存: ${summaryPath}`);

  // 6. 输出统计
  console.log("\n📊 批量评测完成!");
  console.log(`   ✅ 成功: ${successCount}/${total}`);
  console.log(`   ❌ 失败: ${failCount}/${total}`);
  console.log(`   📁 结果目录: ${outputDir}`);
}

// ========== 主函数 ==========
if (import.meta.main) {
  const datasetPath = process.argv[2] || DATASET_PATH;
  const modelId = process.argv[3] || MODEL_ID;

  console.log("📋 批量评测配置:");
  console.log(`   数据集: ${datasetPath}`);
  console.log(`   模型: ${modelId}`);
  console.log("");

  batchEvaluate(datasetPath, modelId).catch(error => {
    console.error("❌ 批量评测失败:", error);
    process.exit(1);
  });
}