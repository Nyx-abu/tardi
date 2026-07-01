"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTestSchema = void 0;
const zod_1 = require("zod");
exports.AgentTestSchema = zod_1.z.object({
    name: zod_1.z.string(),
    agentCommand: zod_1.z.string(),
    iterations: zod_1.z.number().int().positive().default(10),
    concurrency: zod_1.z.number().int().positive().default(5),
    timeoutMs: zod_1.z.number().int().positive().default(30000),
    assertions: zod_1.z.object({
        regex: zod_1.z.string().optional(),
        jsonSchema: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    }).optional(),
    evaluator: zod_1.z.object({
        provider: zod_1.z.enum(['google', 'openai', 'groq']).default('google'),
        model: zod_1.z.string().default('gemini-1.5-flash'),
        rubric: zod_1.z.string(),
    }).optional(),
});
