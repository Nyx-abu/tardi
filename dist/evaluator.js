"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FailureType = void 0;
exports.evaluateIteration = evaluateIteration;
exports.aggregateResults = aggregateResults;
const ai_1 = require("ai");
const google_1 = require("@ai-sdk/google");
const openai_1 = require("@ai-sdk/openai");
const anthropic_1 = require("@ai-sdk/anthropic");
const zod_1 = require("zod");
const ajv_1 = __importDefault(require("ajv"));
const crypto_1 = __importDefault(require("crypto"));
const diff_1 = require("diff");
const adapters_1 = require("./adapters");
var FailureType;
(function (FailureType) {
    FailureType["CRASH"] = "CRASH";
    FailureType["TIMEOUT"] = "TIMEOUT";
    FailureType["EMPTY_OUTPUT"] = "EMPTY_OUTPUT";
    FailureType["FORMAT_DRIFT"] = "FORMAT_DRIFT";
    FailureType["SCHEMA_MISMATCH"] = "SCHEMA_MISMATCH";
    FailureType["ASSERTION_FAILED"] = "ASSERTION_FAILED";
    FailureType["TRAJECTORY_MISMATCH"] = "TRAJECTORY_MISMATCH";
    FailureType["TELEMETRY_FAILED"] = "TELEMETRY_FAILED";
    FailureType["LLM_JUDGE_FAIL"] = "LLM_JUDGE_FAIL";
})(FailureType || (exports.FailureType = FailureType = {}));
const judgeCache = new Map();
async function evaluateIteration(stdout, stderr, exitCode, isTimeout, latencyMs, config) {
    // Stage 0: Process Checks
    if (isTimeout) {
        return { passed: false, reason: 'Process exceeded timeout limit', failureType: FailureType.TIMEOUT };
    }
    if (exitCode !== 0) {
        return { passed: false, reason: `Process exited with code ${exitCode}`, failureType: FailureType.CRASH };
    }
    if (!stdout.trim()) {
        return { passed: false, reason: 'Process output was empty', failureType: FailureType.EMPTY_OUTPUT };
    }
    // Stage 0.5: Hard Telemetry
    if (config.assertions?.telemetry?.maxLatencyMs) {
        if (latencyMs > config.assertions.telemetry.maxLatencyMs) {
            return {
                passed: false,
                reason: `Process took ${latencyMs}ms, which exceeds maxLatencyMs of ${config.assertions.telemetry.maxLatencyMs}ms`,
                failureType: FailureType.TELEMETRY_FAILED
            };
        }
    }
    // Stage 1: Deterministic Gates
    if (config.assertions?.regex) {
        const regex = new RegExp(config.assertions.regex);
        if (!regex.test(stdout)) {
            return { passed: false, reason: `Failed deterministic regex match: ${config.assertions.regex}`, failureType: FailureType.FORMAT_DRIFT };
        }
    }
    if (config.assertions?.jsonSchema) {
        try {
            // Basic extraction if output has extra text, but let's try direct parse first
            // Assuming agent returns strict JSON, or we extract the json block
            const jsonMatch = stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (!jsonMatch) {
                return { passed: false, reason: 'No JSON object found in output', failureType: FailureType.SCHEMA_MISMATCH };
            }
            const data = JSON.parse(jsonMatch[0]);
            const ajv = new ajv_1.default();
            const validate = ajv.compile(config.assertions.jsonSchema);
            const valid = validate(data);
            if (!valid) {
                return {
                    passed: false,
                    reason: `JSON Schema validation failed: ${ajv.errorsText(validate.errors)}`,
                    failureType: FailureType.SCHEMA_MISMATCH
                };
            }
        }
        catch (e) {
            return { passed: false, reason: `Failed to parse JSON: ${e.message}`, failureType: FailureType.SCHEMA_MISMATCH };
        }
    }
    // Stage 1.5: Trajectory Assertions
    if (config.assertions?.trajectory && config.assertions.trajectory.length > 0) {
        const actualSteps = (0, adapters_1.parseStdoutTrajectory)(stdout).map(s => s.content);
        let currentIndex = -1;
        for (const expectedStep of config.assertions.trajectory) {
            const foundIndex = actualSteps.findIndex((step, idx) => idx > currentIndex && step.includes(expectedStep));
            if (foundIndex === -1) {
                const expectedTrajectory = config.assertions.trajectory.join('\n');
                const actualTrajectory = actualSteps.join('\n');
                const diffResult = (0, diff_1.diffLines)(expectedTrajectory, actualTrajectory);
                const diffStr = diffResult.map(part => {
                    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
                    return part.value.split('\n').filter(l => l).map(l => `${prefix} ${l}`).join('\n');
                }).join('\n');
                return {
                    passed: false,
                    reason: `Trajectory mismatch: Expected step containing "${expectedStep}" not found in sequence.`,
                    failureType: FailureType.TRAJECTORY_MISMATCH,
                    diff: diffStr
                };
            }
            currentIndex = foundIndex;
        }
    }
    // Stage 2: LLM as a judge (if configured)
    if (config.evaluator) {
        let model;
        // Core providers
        if (config.evaluator.provider === 'google') {
            model = (0, google_1.google)(config.evaluator.model);
        }
        else if (config.evaluator.provider === 'openai') {
            model = (0, openai_1.openai)(config.evaluator.model);
        }
        else if (config.evaluator.provider === 'anthropic') {
            model = (0, anthropic_1.anthropic)(config.evaluator.model);
        }
        else if (config.evaluator.provider === 'local') {
            const customOpenAI = (0, openai_1.createOpenAI)({
                baseURL: config.evaluator.baseUrl || 'http://localhost:11434/v1',
                apiKey: 'dummy'
            });
            model = customOpenAI(config.evaluator.model);
        }
        else {
            // Dynamic Plugin Support
            try {
                const plugin = await Promise.resolve(`${config.evaluator.provider}`).then(s => __importStar(require(s)));
                model = plugin.default(config.evaluator.model);
            }
            catch (e) {
                throw new Error(`Unsupported provider or missing plugin: ${config.evaluator.provider}`);
            }
        }
        const hash = crypto_1.default.createHash('sha256').update(stdout + config.evaluator.rubric).digest('hex');
        if (judgeCache.has(hash)) {
            const cached = judgeCache.get(hash);
            if (!cached.passed) {
                return { passed: false, reason: cached.reason, failureType: FailureType.LLM_JUDGE_FAIL, judgeCacheHit: true };
            }
            return { ...cached, judgeCacheHit: true };
        }
        try {
            let object;
            if (config.evaluator.provider === 'local' && config.evaluator.model === 'dummy') {
                object = { passed: true, reason: 'Looks good' };
            }
            else {
                const result = await (0, ai_1.generateObject)({
                    model,
                    schema: zod_1.z.object({
                        passed: zod_1.z.boolean(),
                        reason: zod_1.z.string(),
                    }),
                    prompt: `Evaluate the following output based on the rubric.\n\nRubric: ${config.evaluator.rubric}\n\nOutput: ${stdout}`
                });
                object = result.object;
            }
            judgeCache.set(hash, object);
            if (!object.passed) {
                return { passed: false, reason: object.reason, failureType: FailureType.LLM_JUDGE_FAIL, judgeCacheHit: false };
            }
            return { ...object, judgeCacheHit: false };
        }
        catch (e) {
            return { passed: false, reason: `LLM evaluation failed: ${e.message}`, failureType: FailureType.LLM_JUDGE_FAIL };
        }
    }
    return { passed: true, reason: 'Passed deterministic checks (no LLM evaluator configured).' };
}
function aggregateResults(results) {
    const totalRuns = results.length;
    const passedRuns = results.filter(r => r.passed).length;
    const failedRuns = totalRuns - passedRuns;
    const passRate = totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0;
    const totalLatency = results.reduce((acc, curr) => acc + curr.latencyMs, 0);
    const avgLatencyMs = totalRuns > 0 ? totalLatency / totalRuns : 0;
    const cacheHits = results.filter(r => r.judgeCacheHit).length;
    // It is flaky if it's not 100% passes and not 100% failures
    const isFlaky = passRate > 0 && passRate < 100;
    return {
        totalRuns,
        passedRuns,
        failedRuns,
        passRate,
        avgLatencyMs,
        cacheHits,
        isFlaky,
        results
    };
}
