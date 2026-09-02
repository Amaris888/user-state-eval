// src/cli.ts
import { loadDataset } from "./dataset";
import { callModel } from "./providers";
import { calculateAllMetrics, printMetrics, type PredictionResult } from "./metrics";
import { validateFullPrediction } from "./validate";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface CliOptions {
  dataset: string;
  model: string;
  output?: string;
  limit?: number;
}

async function runEvaluation(options: CliOptions): Promise<void> {
  console.log("🚀 开始评测");
  console.log(`📂 数据集: ${options.dataset}`);
  console.log(`🤖 模型: ${options.model}`);
  console.log("");

  // 1. 加载数据
  const cases = loadDataset(options.dataset);
  const total = options.limit ? Math.min(options.limit, cases.length) : cases.length;
  console.log(`✅ 加载了 ${total} 条案例\n`);

  // 2. 创建输出目录
  const outputDir = options.output || join(process.cwd(), "outputs", options.model);
  mkdirSync(outputDir, { recursive: true });

  // 3. 运行预测
  const results: PredictionResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < total; i++) {
    const caseItem = cases[i];
    if (!caseItem) {
      console.log(`[${i + 1}/${total}] ⚠️ 案例为空，跳过`);
      continue;
    }

    const num = i + 1;
    console.log(`[${num}/${total}] 处理: ${caseItem.id}`);

    const messages = caseItem.messages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    try {
      const startTime = Date.now();
      const response = await callModel(messages, options.model);
      const endTime = Date.now();
      const latency = endTime - startTime;

      const rawPrediction = JSON.parse(response);

      // 校验
      const userMessages = caseItem.messages
        .filter((m: any) => m.role === "user")
        .map((m: any) => m.content);

      const validation = validateFullPrediction(rawPrediction, userMessages);

      const result: PredictionResult = {
        caseId: caseItem.id,
        gold: caseItem.gold,
        prediction: validation.prediction || rawPrediction,
        latency_ms: latency,
        success: true,
        schemaValid: validation.schemaValid,
        schemaErrors: validation.schemaErrors,
        evidenceGrounded: validation.evidenceGrounded,
        unmatchedEvidence: validation.unmatchedEvidence,
      };

      results.push(result);
      successCount++;

      console.log(`   ✅ 成功 (${latency}ms)`);
      console.log(`      预测: ${rawPrediction.emotion || "未知"} | 黄金: ${caseItem.gold.emotion}`);

    } catch (error) {
      console.log(`   ❌ 失败: ${error}`);
      results.push({
        caseId: caseItem.id,
        gold: caseItem.gold,
        prediction: null,
        latency_ms: 0,
        success: false,
        schemaValid: false,
        schemaErrors: ["模型调用失败"],
        evidenceGrounded: false,
        unmatchedEvidence: [],
        error: String(error),
      });
      failCount++;
    }

    console.log("");
  }

  // 4. 计算指标
  console.log("📊 计算评测指标...");
  const metrics = calculateAllMetrics(results);
  printMetrics(metrics);

  // 5. 保存结果
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const predictionsPath = join(outputDir, `predictions_${timestamp}.jsonl`);
  const metricsPath = join(outputDir, `metrics_${timestamp}.json`);

  // 保存 predictions.jsonl
  let predictionsContent = "";
  for (const result of results) {
    predictionsContent += JSON.stringify(result) + "\n";
  }
  writeFileSync(predictionsPath, predictionsContent);
  console.log(`\n📁 预测结果已保存: ${predictionsPath}`);

  // 保存 metrics.json
  writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  console.log(`📁 指标已保存: ${metricsPath}`);

  // 6. 输出摘要
  console.log("\n📊 评测完成!");
  console.log(`   ✅ 成功: ${successCount}/${total}`);
  console.log(`   ❌ 失败: ${failCount}/${total}`);
  console.log(`   📁 输出目录: ${outputDir}`);
}

// ========== CLI 入口 ==========
if (import.meta.main) {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    dataset: "./datasets/dev.jsonl",
    model: "doubao-pro",
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dataset":
      case "-d":
        options.dataset = args[++i] || options.dataset;
        break;
      case "--model":
      case "-m":
        options.model = args[++i] || options.model;
        break;
      case "--output":
      case "-o":
        options.output = args[++i] || options.output;
        break;
      case "--limit":
      case "-l":
        options.dataset = args[++i] ?? options.dataset;
        break;
      case "--help":
      case "-h":
        console.log(`
用法: bun run src/cli.ts [选项]

选项:
  --dataset, -d  数据集路径 (默认: ./datasets/dev.jsonl)
  --model, -m    模型名称 (默认: qwen-plus)
  --output, -o   输出目录
  --limit, -l    限制处理数量
  --help, -h     显示帮助
        `);
        process.exit(0);
        break;
    }
  }

  runEvaluation(options).catch(error => {
    console.error("❌ 评测失败:", error);
    process.exit(1);
  });
}