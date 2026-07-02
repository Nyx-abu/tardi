import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';
import fs from 'fs';
import { EvaluationSummary, FailureType } from './evaluator';
import path from 'path';

export async function generateReport(summary: EvaluationSummary, exportPath?: string, jsonMode: boolean = false, reporterPath?: string) {
  
  if (reporterPath) {
    try {
      const fullPath = path.resolve(process.cwd(), reporterPath);
      const customReporter = await import(fullPath);
      if (typeof customReporter.default === 'function') {
        customReporter.default(summary);
      } else {
        console.error(chalk.red(`\n❌ Custom reporter at ${reporterPath} must export a default function.`));
      }
      return;
    } catch (e: any) {
      console.error(chalk.red(`\n❌ Failed to load custom reporter at ${reporterPath}: ${e.message}`));
      return;
    }
  }

  if (exportPath) {
    fs.writeFileSync(exportPath, JSON.stringify(summary, null, 2), 'utf8');
  }

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
    return;
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
    ['Avg Latency', summary.avgLatencyMs > 5000 ? chalk.yellow(`${summary.avgLatencyMs.toFixed(2)} ms`) : `${summary.avgLatencyMs.toFixed(2)} ms`],
    ['Cache Hits', summary.cacheHits > 0 ? chalk.green(summary.cacheHits.toString()) : summary.cacheHits.toString()],
    ['Flakiness', summary.isFlaky ? chalk.red('Flaky') : summary.passRate === 100 ? chalk.green('Deterministic') : chalk.red('Failing')]
  );
  
  let failureOutput = '';
  if (summary.failedRuns > 0) {
    failureOutput += '\n\n' + chalk.bold.red('Failures:\n');
    summary.results.filter(r => !r.passed).forEach(r => {
      failureOutput += chalk.red(`- Iteration ${r.iteration} [${r.failureType || 'UNKNOWN'}]: `) + r.reason + '\n';
      
      if (r.diff) {
        failureOutput += chalk.bold.cyan('  Trajectory Mismatch Diff:\n');
        r.diff.split('\n').forEach(line => {
          if (line.startsWith('+')) failureOutput += chalk.green(`  ${line}\n`);
          else if (line.startsWith('-')) failureOutput += chalk.red(`  ${line}\n`);
          else failureOutput += chalk.dim(`  ${line}\n`);
        });
      } else if (r.failureType === FailureType.CRASH && r.stderr) {
        failureOutput += chalk.dim(`  Stderr: ${r.stderr.trim().substring(0, 300).replace(/\n/g, '\\n')}...`) + '\n';
      } else if (r.output) {
        failureOutput += chalk.dim(`  Output: ${r.output.trim().substring(0, 300).replace(/\n/g, '\\n')}...`) + '\n';
      }
    });
  }

  let resultStatus = '';
  if (summary.isFlaky) {
    resultStatus = chalk.yellow(`⚠️ Flaky Agent Detected: Passed ${summary.passedRuns}/${summary.totalRuns} runs. Results are non-deterministic.`);
  } else if (summary.passRate === 100) {
    resultStatus = chalk.green('✅ All iterations passed! Your agent is highly deterministic.');
  } else {
    resultStatus = chalk.red(`❌ All iterations failed. Agent is deterministically broken.`);
  }

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
