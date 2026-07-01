"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const yaml_1 = __importDefault(require("yaml"));
const p_limit_1 = __importDefault(require("p-limit"));
const schema_1 = require("./schema");
const evaluator_1 = require("./evaluator");
const reporter_1 = require("./reporter");
const prompts_1 = require("@clack/prompts");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Run tests and return true if there were failures, false if all passed.
 * Does NOT call process.exit — the caller decides what to do.
 */
async function runTests(configPath, exportPath, evaluatorOverride) {
    const fileContent = fs_1.default.readFileSync(configPath, 'utf8');
    const parsed = yaml_1.default.parse(fileContent);
    const config = schema_1.AgentTestSchema.parse(parsed);
    if (evaluatorOverride) {
        const [overrideProvider, overrideModel] = evaluatorOverride.split(':');
        if (!config.evaluator) {
            config.evaluator = { provider: overrideProvider, model: overrideModel, rubric: 'Evaluate the quality and correctness of the output.' };
        }
        else {
            if (overrideProvider)
                config.evaluator.provider = overrideProvider;
            if (overrideModel)
                config.evaluator.model = overrideModel;
        }
    }
    const results = [];
    const limit = (0, p_limit_1.default)(config.concurrency);
    let completed = 0;
    const s = (0, prompts_1.spinner)();
    s.start(`Running ${config.iterations} iterations for: ${config.name}`);
    const tasks = Array.from({ length: config.iterations }).map((_, i) => limit(async () => {
        const iteration = i + 1;
        const startTime = Date.now();
        let stdout = '';
        let stderr = '';
        let exitCode = 0;
        let isTimeout = false;
        try {
            const { stdout: out, stderr: err } = await execAsync(config.agentCommand, {
                timeout: config.timeoutMs,
                maxBuffer: 1024 * 1024 * 10 // 10MB
            });
            stdout = out;
            stderr = err || '';
        }
        catch (e) {
            stdout = e.stdout || '';
            stderr = e.stderr || e.message || String(e);
            exitCode = e.code || 1;
            if (e.killed && e.signal === 'SIGTERM') {
                isTimeout = true;
            }
        }
        const latencyMs = Date.now() - startTime;
        const { passed, reason, failureType } = await (0, evaluator_1.evaluateIteration)(stdout, stderr, exitCode, isTimeout, config);
        results.push({
            iteration,
            passed,
            latencyMs,
            output: stdout,
            stderr,
            exitCode,
            reason,
            failureType
        });
        completed++;
        s.message(`Running iterations… (${completed}/${config.iterations})`);
    }));
    await Promise.all(tasks);
    s.stop(`Completed ${config.iterations} iterations for: ${config.name}`);
    const evaluation = (0, evaluator_1.aggregateResults)(results);
    (0, reporter_1.generateReport)(evaluation, exportPath);
    return evaluation.failedRuns > 0;
}
