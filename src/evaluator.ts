import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { AgentTestConfig } from './schema';
import Ajv from 'ajv';
import crypto from 'crypto';
import { diffLines } from 'diff';
import { parseStdoutTrajectory } from './adapters';

export enum FailureType {
  CRASH = 'CRASH',
  TIMEOUT = 'TIMEOUT',
  EMPTY_OUTPUT = 'EMPTY_OUTPUT',
  FORMAT_DRIFT = 'FORMAT_DRIFT',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  ASSERTION_FAILED = 'ASSERTION_FAILED',
  TRAJECTORY_MISMATCH = 'TRAJECTORY_MISMATCH',
  TELEMETRY_FAILED = 'TELEMETRY_FAILED',
  LLM_JUDGE_FAIL = 'LLM_JUDGE_FAIL'
}

export interface TestResult {
  iteration: number;
  passed: boolean;
  latencyMs: number;
  output: string;
  stderr: string;
  exitCode: number;
  reason?: string;
  failureType?: FailureType;
  judgeCacheHit?: boolean;
  diff?: string;
}

export interface EvaluationSummary {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  passRate: number;
  avgLatencyMs: number;
  cacheHits: number;
  isFlaky: boolean;
  results: TestResult[];
}

const judgeCache = new Map<string, { passed: boolean, reason: string }>();

export async function evaluateIteration(
  stdout: string,
  stderr: string,
  exitCode: number,
  isTimeout: boolean,
  latencyMs: number,
  config: AgentTestConfig
): Promise<{ passed: boolean; reason: string; failureType?: FailureType; judgeCacheHit?: boolean; diff?: string }> {
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
      const ajv = new Ajv();
      const validate = ajv.compile(config.assertions.jsonSchema);
      const valid = validate(data);
      if (!valid) {
        return { 
          passed: false, 
          reason: `JSON Schema validation failed: ${ajv.errorsText(validate.errors)}`, 
          failureType: FailureType.SCHEMA_MISMATCH 
        };
      }
    } catch (e: any) {
      return { passed: false, reason: `Failed to parse JSON: ${e.message}`, failureType: FailureType.SCHEMA_MISMATCH };
    }
  }

  // Stage 1.5: Trajectory Assertions
  if (config.assertions?.trajectory && config.assertions.trajectory.length > 0) {
    const actualSteps = parseStdoutTrajectory(stdout).map(s => s.content);
    let currentIndex = -1;
    
    for (const expectedStep of config.assertions.trajectory) {
      const foundIndex = actualSteps.findIndex((step, idx) => idx > currentIndex && step.includes(expectedStep));
      if (foundIndex === -1) {
        const expectedTrajectory = config.assertions.trajectory.join('\n');
        const actualTrajectory = actualSteps.join('\n');
        
        const diffResult = diffLines(expectedTrajectory, actualTrajectory);
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
      model = google(config.evaluator.model);
    } else if (config.evaluator.provider === 'openai') {
      model = openai(config.evaluator.model);
    } else if (config.evaluator.provider === 'anthropic') {
      model = anthropic(config.evaluator.model);
    } else if (config.evaluator.provider === 'local') {
      const customOpenAI = createOpenAI({
         baseURL: config.evaluator.baseUrl || 'http://localhost:11434/v1',
         apiKey: 'dummy'
      });
      model = customOpenAI(config.evaluator.model);
    } else {
      // Dynamic Plugin Support
      try {
        const plugin = await import(config.evaluator.provider);
        model = plugin.default(config.evaluator.model);
      } catch (e) {
        throw new Error(`Unsupported provider or missing plugin: ${config.evaluator.provider}`);
      }
    }

    const hash = crypto.createHash('sha256').update(stdout + config.evaluator.rubric).digest('hex');
    if (judgeCache.has(hash)) {
      const cached = judgeCache.get(hash)!;
      if (!cached.passed) {
        return { passed: false, reason: cached.reason, failureType: FailureType.LLM_JUDGE_FAIL, judgeCacheHit: true };
      }
      return { ...cached, judgeCacheHit: true };
    }

    try {
      let object;
      if (config.evaluator.provider === 'local' && config.evaluator.model === 'dummy') {
        object = { passed: true, reason: 'Looks good' };
      } else {
        const result = await generateObject({
          model,
          schema: z.object({
            passed: z.boolean(),
            reason: z.string(),
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
    } catch (e: any) {
      return { passed: false, reason: `LLM evaluation failed: ${e.message}`, failureType: FailureType.LLM_JUDGE_FAIL };
    }
  }

  return { passed: true, reason: 'Passed deterministic checks (no LLM evaluator configured).' };
}

export function aggregateResults(results: TestResult[]): EvaluationSummary {
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
