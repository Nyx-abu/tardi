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
    sandbox: zod_1.z.boolean().default(false),
    flakinessThreshold: zod_1.z.number().min(0).max(100).default(80),
    failFast: zod_1.z.boolean().default(false),
    assertions: zod_1.z.object({
        regex: zod_1.z.string().optional(),
        jsonSchema: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
        trajectory: zod_1.z.array(zod_1.z.string()).optional(),
        telemetry: zod_1.z.object({
            maxLatencyMs: zod_1.z.number().optional(),
            maxCost: zod_1.z.number().optional(),
            maxTokens: zod_1.z.number().optional()
        }).optional(),
    }).optional(),
    evaluator: zod_1.z.object({
        provider: zod_1.z.string(),
        model: zod_1.z.string(),
        rubric: zod_1.z.string(),
        baseUrl: zod_1.z.string().optional(),
    }).optional(),
});
