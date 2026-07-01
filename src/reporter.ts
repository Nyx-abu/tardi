import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';
import fs from 'fs';
import { EvaluationSummary, FailureType } from './evaluator';

export function generateReport(summary: EvaluationSummary, exportPath?: string) {
  
  if (exportPath) {
    fs.writeFileSync(exportPath, JSON.stringify(summary, null, 2), 'utf8');
  }

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
    ['Avg Latency', summary.avgLatencyMs > 5000 ? chalk.yellow(`${summary.avgLatencyMs.toFixed(2)} ms`) : `${summary.avgLatencyMs.toFixed(2)} ms`]
  );
  
  let failureOutput = '';
  if (summary.failedRuns > 0) {
    failureOutput += '\n\n' + chalk.bold.red('Failures:\n');
    summary.results.filter(r => !r.passed).forEach(r => {
      failureOutput += chalk.red(`- Iteration ${r.iteration} [${r.failureType || 'UNKNOWN'}]: `) + r.reason + '\n';
      
      if (r.failureType === FailureType.CRASH && r.stderr) {
        failureOutput += chalk.dim(`  Stderr: ${r.stderr.trim().substring(0, 300).replace(/\n/g, '\\n')}...`) + '\n';
      } else if (r.output) {
        failureOutput += chalk.dim(`  Output: ${r.output.trim().substring(0, 300).replace(/\n/g, '\\n')}...`) + '\n';
      }
    });
  }

  const resultStatus = summary.passRate < 100 
    ? chalk.yellow('⚠️ Some iterations failed due to non-deterministic outputs or crashes.')
    : chalk.green('✅ All iterations passed! Your agent is highly deterministic.');

  const finalOutput = table.toString() + failureOutput + '\n\n' + resultStatus;

  const finalBox = boxen(finalOutput, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: summary.failedRuns > 0 ? 'red' : 'green',
    title: chalk.bold(' Tardi Execution Summary '),
    titleAlignment: 'center'
  });

  console.log(finalBox);
}
