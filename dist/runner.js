"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const yaml_1 = __importDefault(require("yaml"));
const p_limit_1 = __importDefault(require("p-limit"));
const schema_1 = require("./schema");
const evaluator_1 = require("./evaluator");
const reporter_1 = require("./reporter");
const prompts_1 = require("@clack/prompts");
const chalk_1 = __importDefault(require("chalk"));
const zod_validation_error_1 = require("zod-validation-error");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Run tests and return true if there were failures, false if all passed.
 * Does NOT call process.exit — the caller decides what to do.
 */
async function runTests(configPath, exportPath, evaluatorOverride, jsonMode = false, reporterPath) {
    const fileContent = fs_1.default.readFileSync(configPath, 'utf8');
    const parsed = yaml_1.default.parse(fileContent);
    const parseResult = schema_1.AgentTestSchema.safeParse(parsed);
    if (!parseResult.success) {
        const err = (0, zod_validation_error_1.fromZodError)(parseResult.error);
        if (!jsonMode)
            console.error(chalk_1.default.red(`\n❌ Configuration Error in ${configPath}:\n  ${err.message}`));
        return true; // Treat as failure
    }
    const config = parseResult.data;
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
    let hasFailedFast = false;
    const deadLetterDir = path_1.default.join(process.cwd(), '.tardi', 'dead-letter');
    if (!fs_1.default.existsSync(deadLetterDir)) {
        fs_1.default.mkdirSync(deadLetterDir, { recursive: true });
    }
    const s = (0, prompts_1.spinner)();
    if (!jsonMode)
        s.start(`Running ${config.iterations} iterations for: ${config.name}`);
    const tasks = Array.from({ length: config.iterations }).map((_, i) => limit(async () => {
        if (hasFailedFast)
            return;
        const iteration = i + 1;
        const startTime = Date.now();
        let stdout = '';
        let stderr = '';
        let exitCode = 0;
        let isTimeout = false;
        try {
            let cmd = config.agentCommand;
            if (config.sandbox) {
                // Mount the current working directory as /app in an alpine container, then execute the command
                cmd = `docker run --rm -v "${process.cwd()}:/app" -w /app node:18-alpine sh -c "${cmd.replace(/"/g, '\\"')}"`;
            }
            const { stdout: out, stderr: err } = await execAsync(cmd, {
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
        const { passed, reason, failureType, judgeCacheHit, diff } = await (0, evaluator_1.evaluateIteration)(stdout, stderr, exitCode, isTimeout, latencyMs, config);
        if (!passed && exitCode !== 0) {
            // Dead-Letter save
            const crashState = {
                iteration,
                configName: config.name,
                exitCode,
                stdout,
                stderr,
                timestamp: new Date().toISOString()
            };
            const runId = Date.now() + '-' + iteration;
            fs_1.default.writeFileSync(path_1.default.join(deadLetterDir, `run-${runId}.json`), JSON.stringify(crashState, null, 2), 'utf8');
        }
        if (config.failFast && !passed) {
            hasFailedFast = true;
        }
        results.push({
            iteration,
            passed,
            latencyMs,
            output: stdout,
            stderr,
            exitCode,
            reason,
            failureType,
            judgeCacheHit,
            diff
        });
        completed++;
        if (!jsonMode)
            s.message(`Running iterations… (${completed}/${config.iterations})`);
    }));
    await Promise.all(tasks);
    if (!jsonMode)
        s.stop(`Completed ${config.iterations} iterations for: ${config.name}`);
    const evaluation = (0, evaluator_1.aggregateResults)(results);
    await (0, reporter_1.generateReport)(evaluation, exportPath, jsonMode, reporterPath);
    return evaluation.failedRuns > 0;
}
