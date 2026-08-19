import { readFileSync } from "fs";
import { CaseSchema, type Case } from "./schemas";

export function loadDataset(path: string): Case[] {
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n").filter(line => line.trim());
  
  return lines.map((line, index) => {
    const parsed = JSON.parse(line);
    const result = CaseSchema.safeParse(parsed);
    if (!result.success) {
      console.error(`❌ Line ${index + 1} validation failed:`, result.error);
      throw new Error(`Invalid case at line ${index + 1}`);
    }
    return result.data;
  });
}

// 直接运行测试：bun run src/dataset.ts
if (import.meta.main) {
  try {
    const cases = loadDataset("./datasets/dev.jsonl");
    console.log(`✅ 成功加载 ${cases.length} 条对话案例\n`);
    
    // 按情绪分组
    const emotionCount: Record<string, number> = {};
    cases.forEach(c => {
      const emo = c.gold.emotion;
      emotionCount[emo] = (emotionCount[emo] || 0) + 1;
    });
    
    console.log("📊 情绪分布:");
    Object.entries(emotionCount).forEach(([emotion, count]) => {
      console.log(`   ${emotion}: ${count} 条`);
    });
    
  } catch (error) {
    console.error("❌ 加载失败:", error);
  }
}