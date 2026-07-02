import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import pLimit from 'p-limit';
import { AgentTestSchema, AgentTestConfig } from './schema';
import { aggregateResults, evaluateIteration, TestResult } from './evaluator';
import { generateReport } from './reporter';
import { spinner } from '@clack/prompts';
import chalk from 'chalk';
import { fromZodError } from 'zod-validation-error';

const execAsync = promisify(exec);

/**
 * Run tests and return true if there were failures, false if all passed.
 * Does NOT call process.exit — the caller decides what to do.
 */
export async function runTests(configPath: string, exportPath?: string, evaluatorOverride?: string, jsonMode: boolean = false, reporterPath?: string): Promise<boolean> {
  const fileContent = fs.readFileSync(configPath, 'utf8');
  const parsed = yaml.parse(fileContent);
  const parseResult = AgentTestSchema.safeParse(parsed);
  
  if (!parseResult.success) {
    const err = fromZodError(parseResult.error);
    if (!jsonMode) console.error(chalk.red(`\n❌ Configuration Error in ${configPath}:\n  ${err.message}`));
    return true; // Treat as failure
  }
  
  const config = parseResult.data;

  if (evaluatorOverride) {
    const [overrideProvider, overrideModel] = evaluatorOverride.split(':');
    if (!config.evaluator) {
      config.evaluator = { provider: overrideProvider, model: overrideModel, rubric: 'Evaluate the quality and correctness of the output.' };
    } else {
      if (overrideProvider) config.evaluator.provider = overrideProvider;
      if (overrideModel) config.evaluator.model = overrideModel;
    }
  }

  const results: TestResult[] = [];
  const limit = pLimit(config.concurrency);
  
  let completed = 0;
  let hasFailedFast = false;
  
  const deadLetterDir = path.join(process.cwd(), '.tardi', 'dead-letter');
  if (!fs.existsSync(deadLetterDir)) {
    fs.mkdirSync(deadLetterDir, { recursive: true });
  }
  
  const s = spinner();
  if (!jsonMode) s.start(`Running ${config.iterations} iterations for: ${config.name}`);

  const tasks = Array.from({ length: config.iterations }).map((_, i) =>
    limit(async () => {
      if (hasFailedFast) return;
      
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
      } catch (e: any) {
        stdout = e.stdout || '';
        stderr = e.stderr || e.message || String(e);
        exitCode = e.code || 1;
        if (e.killed && e.signal === 'SIGTERM') {
          isTimeout = true;
        }
      }

      const latencyMs = Date.now() - startTime;
      
      const { passed, reason, failureType, judgeCacheHit, diff } = await evaluateIteration(stdout, stderr, exitCode, isTimeout, latencyMs, config);
      
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
        fs.writeFileSync(path.join(deadLetterDir, `run-${runId}.json`), JSON.stringify(crashState, null, 2), 'utf8');
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
      if (!jsonMode) s.message(`Running iterations… (${completed}/${config.iterations})`);
    })
  );

  await Promise.all(tasks);
  if (!jsonMode) s.stop(`Completed ${config.iterations} iterations for: ${config.name}`);

  const evaluation = aggregateResults(results);
  
  await generateReport(evaluation, exportPath, jsonMode, reporterPath);
  
  return evaluation.failedRuns > 0;
}
