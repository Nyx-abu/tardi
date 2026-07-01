"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReport = generateReport;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const boxen_1 = __importDefault(require("boxen"));
const fs_1 = __importDefault(require("fs"));
const evaluator_1 = require("./evaluator");
function generateReport(summary, exportPath) {
    if (exportPath) {
        fs_1.default.writeFileSync(exportPath, JSON.stringify(summary, null, 2), 'utf8');
    }
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.cyan('Metric'),
            chalk_1.default.cyan('Value')
        ]
    });
    table.push(['Total Runs', summary.totalRuns.toString()], ['Passed', chalk_1.default.green(summary.passedRuns.toString())], ['Failed', chalk_1.default.red(summary.failedRuns.toString())], ['Pass Rate', summary.passRate >= 80 ? chalk_1.default.green(`${summary.passRate.toFixed(2)}%`) : chalk_1.default.red(`${summary.passRate.toFixed(2)}%`)], ['Avg Latency', summary.avgLatencyMs > 5000 ? chalk_1.default.yellow(`${summary.avgLatencyMs.toFixed(2)} ms`) : `${summary.avgLatencyMs.toFixed(2)} ms`]);
    let failureOutput = '';
    if (summary.failedRuns > 0) {
        failureOutput += '\n\n' + chalk_1.default.bold.red('Failures:\n');
        summary.results.filter(r => !r.passed).forEach(r => {
            failureOutput += chalk_1.default.red(`- Iteration ${r.iteration} [${r.failureType || 'UNKNOWN'}]: `) + r.reason + '\n';
            if (r.failureType === evaluator_1.FailureType.CRASH && r.stderr) {
                failureOutput += chalk_1.default.dim(`  Stderr: ${r.stderr.trim().substring(0, 300).replace(/\n/g, '\\n')}...`) + '\n';
            }
            else if (r.output) {
                failureOutput += chalk_1.default.dim(`  Output: ${r.output.trim().substring(0, 300).replace(/\n/g, '\\n')}...`) + '\n';
            }
        });
    }
    const resultStatus = summary.passRate < 100
        ? chalk_1.default.yellow('⚠️ Some iterations failed due to non-deterministic outputs or crashes.')
        : chalk_1.default.green('✅ All iterations passed! Your agent is highly deterministic.');
    const finalOutput = table.toString() + failureOutput + '\n\n' + resultStatus;
    const finalBox = (0, boxen_1.default)(finalOutput, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: summary.failedRuns > 0 ? 'red' : 'green',
        title: chalk_1.default.bold(' Tardi Execution Summary '),
        titleAlignment: 'center'
    });
    console.log(finalBox);
}
