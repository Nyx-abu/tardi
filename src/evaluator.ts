export interface TestResult {
  iteration: number;
  passed: boolean;
  latencyMs: number;
  output: string;
}

export interface EvaluationSummary {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  passRate: number;
  avgLatencyMs: number;
  results: TestResult[];
}

export function evaluateResults(results: TestResult[]): EvaluationSummary {
  const totalRuns = results.length;
  const passedRuns = results.filter(r => r.passed).length;
  const failedRuns = totalRuns - passedRuns;
  const passRate = (passedRuns / totalRuns) * 100;
  
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
