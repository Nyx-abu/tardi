import chalk from 'chalk';
import Table from 'cli-table3';
import { EvaluationSummary } from './evaluator';

export function generateReport(summary: EvaluationSummary) {
  console.log('\n' + chalk.bold.blue('=== Agent-Harness Test Report ===') + '\n');
  
  const table = new Table({
    head: [
      chalk.cyan('Metric'),
      chalk.cyan('Value')
    ]
  });

  table.push(
    ['Total Runs', summary.totalRuns.toString()],
    ['Passed', chalk.green(summary.passedRuns.toString())],
    ['Failed', chalk.red(summary.failedRuns.toString())],
    ['Pass Rate', summary.passRate >= 80 ? chalk.green(`${summary.passRate.toFixed(2)}%`) : chalk.red(`${summary.passRate.toFixed(2)}%`)],
    ['Avg Latency', `${summary.avgLatencyMs.toFixed(2)} ms`]
  );

  console.log(table.toString());
  
  if (summary.passRate < 100) {
    console.log('\n' + chalk.yellow('⚠️ Some iterations failed due to non-deterministic outputs.'));
  } else {
    console.log('\n' + chalk.green('✅ All iterations passed! Your agent is highly deterministic.'));
  }
}
