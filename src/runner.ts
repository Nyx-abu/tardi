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

export async function runTests(configPath: string, exportPath?: string) {
  const fileContent = fs.readFileSync(configPath, 'utf8');
  const parsed = yaml.parse(fileContent);
  const config = AgentTestSchema.parse(parsed);

  const results: TestResult[] = [];
  const limit = pLimit(config.concurrency);
  
  let completed = 0;
  
  const s = spinner();
  s.start(`Executing ${config.iterations} iterations for suite: ${config.name}`);

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
          maxBuffer: 1024 * 1024 * 10 // 10MB to avoid dangerous concurrency crashes
        });
        stdout = out;
        stderr = err || '';
      } catch (e: any) {
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
      s.message(`Executing ${config.iterations} iterations... (${completed}/${config.iterations})`);
    })
  );

  await Promise.all(tasks);
  s.stop(`Completed ${config.iterations} iterations for suite: ${config.name}`);

  const evaluation = aggregateResults(results);
  
  generateReport(evaluation, exportPath);
  
  if (evaluation.failedRuns > 0) {
    process.exit(1);
  }
}
