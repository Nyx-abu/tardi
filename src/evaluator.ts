import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { AgentTestConfig } from './schema';
import Ajv from 'ajv';

export enum FailureType {
  CRASH = 'CRASH',
  TIMEOUT = 'TIMEOUT',
  EMPTY_OUTPUT = 'EMPTY_OUTPUT',
  FORMAT_DRIFT = 'FORMAT_DRIFT',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  ASSERTION_FAILED = 'ASSERTION_FAILED',
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
}

export interface EvaluationSummary {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  passRate: number;
  avgLatencyMs: number;
  results: TestResult[];
}

export async function evaluateIteration(
  stdout: string,
  stderr: string,
  exitCode: number,
  isTimeout: boolean,
  config: AgentTestConfig
): Promise<{ passed: boolean; reason: string; failureType?: FailureType }> {
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

  // Stage 2: LLM as a judge (if configured)
  if (config.evaluator) {
    let model;
    if (config.evaluator.provider === 'google') {
      model = google(config.evaluator.model);
    } else if (config.evaluator.provider === 'openai') {
      model = openai(config.evaluator.model);
    } else {
      throw new Error(`Unsupported provider: ${config.evaluator.provider}`);
    }

    try {
      const { object } = await generateObject({
        model,
        schema: z.object({
          passed: z.boolean(),
          reason: z.string(),
        }),
        prompt: `Evaluate the following output based on the rubric.\n\nRubric: ${config.evaluator.rubric}\n\nOutput: ${stdout}`
      });
      if (!object.passed) {
        return { passed: false, reason: object.reason, failureType: FailureType.LLM_JUDGE_FAIL };
      }
      return object;
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

  return {
    totalRuns,
    passedRuns,
    failedRuns,
    passRate,
    avgLatencyMs,
    results
  };
}
