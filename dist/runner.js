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
async function runTests(configPath, exportPath) {
    const fileContent = fs_1.default.readFileSync(configPath, 'utf8');
    const parsed = yaml_1.default.parse(fileContent);
    const config = schema_1.AgentTestSchema.parse(parsed);
    const results = [];
    const limit = (0, p_limit_1.default)(config.concurrency);
    let completed = 0;
    const s = (0, prompts_1.spinner)();
    s.start(`Executing ${config.iterations} iterations for suite: ${config.name}`);
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
                maxBuffer: 1024 * 1024 * 10 // 10MB to avoid dangerous concurrency crashes
            });
            stdout = out;
            stderr = err || '';
        }
        catch (e) {
            // exec throws if non-zero exit or timeout
            stdout = e.stdout || '';
            stderr = e.stderr || e.message || String(e);
            exitCode = e.code || 1;
            if (e.killed && e.signal === 'SIGTERM') {
                isTimeout = true;
            }
        }
        const latencyMs = Date.now() - startTime;
        // Evaluate
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
        s.message(`Executing ${config.iterations} iterations... (${completed}/${config.iterations})`);
    }));
    await Promise.all(tasks);
    s.stop(`Completed ${config.iterations} iterations for suite: ${config.name}`);
    const evaluation = (0, evaluator_1.aggregateResults)(results);
    (0, reporter_1.generateReport)(evaluation, exportPath);
    if (evaluation.failedRuns > 0) {
        process.exit(1);
    }
}
