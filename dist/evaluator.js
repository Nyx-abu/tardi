"use strict";
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
const zod_1 = require("zod");
const ajv_1 = __importDefault(require("ajv"));
var FailureType;
(function (FailureType) {
    FailureType["CRASH"] = "CRASH";
    FailureType["TIMEOUT"] = "TIMEOUT";
    FailureType["EMPTY_OUTPUT"] = "EMPTY_OUTPUT";
    FailureType["FORMAT_DRIFT"] = "FORMAT_DRIFT";
    FailureType["SCHEMA_MISMATCH"] = "SCHEMA_MISMATCH";
    FailureType["ASSERTION_FAILED"] = "ASSERTION_FAILED";
    FailureType["LLM_JUDGE_FAIL"] = "LLM_JUDGE_FAIL";
})(FailureType || (exports.FailureType = FailureType = {}));
async function evaluateIteration(stdout, stderr, exitCode, isTimeout, config) {
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
    // Stage 2: LLM as a judge (if configured)
    if (config.evaluator) {
        let model;
        if (config.evaluator.provider === 'google') {
            model = (0, google_1.google)(config.evaluator.model);
        }
        else if (config.evaluator.provider === 'openai') {
            model = (0, openai_1.openai)(config.evaluator.model);
        }
        else {
            throw new Error(`Unsupported provider: ${config.evaluator.provider}`);
        }
        try {
            const { object } = await (0, ai_1.generateObject)({
                model,
                schema: zod_1.z.object({
                    passed: zod_1.z.boolean(),
                    reason: zod_1.z.string(),
                }),
                prompt: `Evaluate the following output based on the rubric.\n\nRubric: ${config.evaluator.rubric}\n\nOutput: ${stdout}`
            });
            if (!object.passed) {
                return { passed: false, reason: object.reason, failureType: FailureType.LLM_JUDGE_FAIL };
            }
            return object;
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
    return {
        totalRuns,
        passedRuns,
        failedRuns,
        passRate,
        avgLatencyMs,
        results
    };
}
