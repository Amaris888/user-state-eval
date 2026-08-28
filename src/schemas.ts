import { z } from "zod";

export const CaseSchema = z.object({
  id: z.string(),
  version: z.string().optional(),
  scenario: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tags: z.array(z.string()).optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ).min(1),
  gold: z.object({
    emotion: z.enum([
      "positive", "calm", "sad", "anxious", "angry", 
      "frustrated", "mixed", "unclear"
    ]),
    energy: z.enum(["low", "normal", "high", "unclear"]),
    need: z.enum([
      "be_heard", "advice", "information", "celebration", 
      "reassurance", "companionship", "space", "action", "unclear"
    ]),
    adviceWanted: z.enum(["yes", "no", "unknown"]),
    engagement: z.enum(["open", "limited", "withdrawn", "unclear"]),
    riskLevel: z.enum(["none", "watch", "urgent", "unclear"]),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()).max(5),
    reason: z.string().max(120),
    shouldPersist: z.boolean(),
  }),
});

export interface Case {
  id: string;
  version?: string;
  scenario?: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
  messages: { role: "user" | "assistant"; content: string }[];
  gold: {
    emotion: "positive" | "calm" | "sad" | "anxious" | "angry" | "frustrated" | "mixed" | "unclear";
    energy: "low" | "normal" | "high" | "unclear";
    need: "be_heard" | "advice" | "information" | "celebration" | "reassurance" | "companionship" | "space" | "action" | "unclear";
    adviceWanted: "yes" | "no" | "unknown";
    engagement: "open" | "limited" | "withdrawn" | "unclear";
    riskLevel: "none" | "watch" | "urgent" | "unclear";
    confidence: number;
    evidence: string[];
    reason: string;
    shouldPersist: boolean;
  };
}

export type CaseType = Case;


// ========== 模型预测校验 Schema（独立于 Gold） ==========
export const PredictionSchema = z.object({
  emotion: z.enum([
    "positive", "calm", "sad", "anxious", "angry", 
    "frustrated", "mixed", "unclear"
  ]),
  energy: z.enum(["low", "normal", "high", "unclear"]),
  need: z.enum([
    "be_heard", "advice", "information", "celebration", 
    "reassurance", "companionship", "space", "action", "unclear"
  ]),
  adviceWanted: z.enum(["yes", "no", "unknown"]),
  engagement: z.enum(["open", "limited", "withdrawn", "unclear"]),
  riskLevel: z.enum(["none", "watch", "urgent", "unclear"]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).max(5),
  reason: z.string().max(120),
  shouldPersist: z.boolean(),
});

export type Prediction = z.infer<typeof PredictionSchema>;