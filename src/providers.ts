import OpenAI from "openai";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Case } from "./schemas";

// ========== 配置 ==========
const ALIBABA_API_KEY = process.env.ALIBABA_API_KEY || "";
const ALIBABA_BASE_URL = process.env.ALIBABA_BASE_URL || "";
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || "";
const DOUBAO_BASE_URL = process.env.DOUBAO_BASE_URL || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "";


// ========== 模型配置 ==========
interface ModelConfig {
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
}

export const models: Record<string, ModelConfig> = {
  "qwen-plus": {
    name: "qwen-plus",
    apiKey: ALIBABA_API_KEY,
    baseURL: ALIBABA_BASE_URL,
    model: "qwen-plus",
  },
  "qwen-turbo": {
    name: "qwen-turbo",
    apiKey: ALIBABA_API_KEY,
    baseURL: ALIBABA_BASE_URL,
    model: "qwen-turbo",
  },
  "doubao-pro": {
    name: "doubao-pro",
    apiKey: DOUBAO_API_KEY,
    baseURL: DOUBAO_BASE_URL,
    model: "apikey-20260819114353-rdqsv",
  },
  "deepseek-v4-pro": {
    name: "deepseek-v4-pro",
    apiKey: DEEPSEEK_API_KEY,
    baseURL: DEEPSEEK_BASE_URL,
    model: "ep-20260825102240-q8rw6",
  },
};

// ========== 调用模型 ==========
export async function callModel(
  messages: { role: "user" | "assistant"; content: string }[],
  modelId: string = "deepseek-v4-pro"
): Promise<string> {
  const config = models[modelId];
  if (!config) {
    throw new Error(`未知模型: ${modelId}`);
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const systemPrompt = `你是一个用户状态理解专家。请根据对话内容，判断用户当前的状态。

你需要输出以下字段（JSON格式）：
- emotion: 情绪状态 (positive/calm/sad/anxious/angry/frustrated/mixed/unclear)
- energy: 精力状态 (low/normal/high/unclear)
- need: 当前需求 (be_heard/advice/information/celebration/reassurance/companionship/space/action/unclear)
- adviceWanted: 是否想要建议 (yes/no/unknown)
- engagement: 互动倾向 (open/limited/withdrawn/unclear)
- riskLevel: 风险等级 (none/watch/urgent/unclear)
- confidence: 置信度 (0-1)
- evidence: 关键证据 (字符串数组，最多5条)
- reason: 判断理由 (最多120字)
- shouldPersist: 是否适合长期记忆 (boolean)

只输出JSON，不要其他内容。证据必须来自对话原文。`;

  const startTime = Date.now();

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const endTime = Date.now();
  const latency = endTime - startTime;

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("模型返回为空");
  }

  // 返回结果 + 元数据
  return content;
}

// ========== 保存日志 ==========
export function saveLog(
  modelId: string,
  messages: { role: "user" | "assistant"; content: string }[],
  response: string,
  latency: number,
  timestamp: string = new Date().toISOString()
): string {
  const logDir = join(process.cwd(), "outputs");
  mkdirSync(logDir, { recursive: true });

  const logEntry = {
    timestamp,
    model: modelId,
    input: messages,
    output: JSON.parse(response),
    latency_ms: latency,
  };

  const logFileName = `run_${timestamp.replace(/[:.]/g, "-")}.jsonl`;
  const logPath = join(logDir, logFileName);

  writeFileSync(logPath, JSON.stringify(logEntry) + "\n");

  console.log(`📁 日志已保存: ${logPath}`);
  return logPath;
}

// ========== 批量运行（测试用） ==========
if (import.meta.main) {
  const testMessages = [
    { role: "user" as const, content: "我最近投了好多简历，一个回复都没有。" },
    { role: "assistant" as const, content: "一直等回复确实挺磨人的。" },
    { role: "user" as const, content: "先别给建议，我就是有点烦。" },
  ];

  console.log("🧪 测试模型调用...");
  console.log("📝 输入:", testMessages.map(m => m.content).join(" "));
  console.log("");

  try {
    const startTime = Date.now();
    const result = await callModel(testMessages, "deepseek-v4-pro");
    const endTime = Date.now();
    const latency = endTime - startTime;

    console.log("✅ 模型返回:");
    const parsed = JSON.parse(result);
    console.log(JSON.stringify(parsed, null, 2));
    console.log(`\n⏱️ 延迟: ${latency}ms`);

    // 保存日志
    const logPath = saveLog("deepseek-v4-pro", testMessages, result, latency);
    console.log(`✅ 日志已保存到: ${logPath}`);

    // 同时保存到汇总文件
    const summaryPath = join(process.cwd(), "outputs", "all_runs.jsonl");
    const summaryEntry = {
      timestamp: new Date().toISOString(),
      model: "deepseek-v4-pro",
      input: testMessages,
      output: parsed,
      latency_ms: latency,
    };
    writeFileSync(summaryPath, JSON.stringify(summaryEntry) + "\n", { flag: "a" });
    console.log(`✅ 已追加到汇总: ${summaryPath}`);

  } catch (error) {
    console.error("❌ 调用失败:", error);
  }
}