import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import yaml from 'yaml';
import pLimit from 'p-limit';
import { AgentTestSchema, AgentTestConfig } from './schema';
import { aggregateResults, evaluateIteration, TestResult } from './evaluator';
import { generateReport } from './reporter';
import { spinner } from '@clack/prompts';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Run tests and return true if there were failures, false if all passed.
 * Does NOT call process.exit — the caller decides what to do.
 */
export async function runTests(configPath: string, exportPath?: string, evaluatorOverride?: string): Promise<boolean> {
  const fileContent = fs.readFileSync(configPath, 'utf8');
  const parsed = yaml.parse(fileContent);
  const config = AgentTestSchema.parse(parsed);

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
  
  const s = spinner();
  s.start(`Running ${config.iterations} iterations for: ${config.name}`);

  const tasks = Array.from({ length: config.iterations }).map((_, i) =>
    limit(async () => {
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
      } catch (e: any) {
        stdout = e.stdout || '';
        stderr = e.stderr || e.message || String(e);
        exitCode = e.code || 1;
        if (e.killed && e.signal === 'SIGTERM') {
          isTimeout = true;
        }
      }

      const latencyMs = Date.now() - startTime;
      
      const { passed, reason, failureType } = await evaluateIteration(stdout, stderr, exitCode, isTimeout, config);
      
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
    })
  );

  await Promise.all(tasks);
  s.stop(`Completed ${config.iterations} iterations for: ${config.name}`);

  const evaluation = aggregateResults(results);
  
  generateReport(evaluation, exportPath);
  
  return evaluation.failedRuns > 0;
}
