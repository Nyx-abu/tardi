import { z } from 'zod';

export const AgentTestSchema = z.object({
  name: z.string(),
  agentCommand: z.string(),
  iterations: z.number().int().positive().default(10),
  concurrency: z.number().int().positive().default(5),
  timeoutMs: z.number().int().positive().default(30000),
  assertions: z.object({
    regex: z.string().optional(),
    jsonSchema: z.record(z.string(), z.any()).optional(),
  }).optional(),
  evaluator: z.object({
    provider: z.string(),
    model: z.string(),
    rubric: z.string(),
    baseUrl: z.string().optional(),
  }).optional(),
});

export type AgentTestConfig = z.infer<typeof AgentTestSchema>;
