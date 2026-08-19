import { z } from "zod";

export const UserStatePredictionSchema = z.object({
  emotion: z.enum([
    "positive",
    "calm",
    "sad",
    "anxious",
    "angry",
    "frustrated",
    "mixed",
    "unclear",
  ]),
  energy: z.enum(["low", "normal", "high", "unclear"]),
  need: z.enum([
    "be_heard",
    "advice",
    "information",
    "celebration",
    "reassurance",
    "companionship",
    "space",
    "action",
    "unclear",
  ]),
  adviceWanted: z.enum(["yes", "no", "unknown"]),
  engagement: z.enum(["open", "limited", "withdrawn", "unclear"]),
  riskLevel: z.enum(["none", "watch", "urgent", "unclear"]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).max(5),
  reason: z.string().max(120),
  shouldPersist: z.boolean(),
});