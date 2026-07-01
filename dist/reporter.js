"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReport = generateReport;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
function generateReport(summary) {
    console.log('\n' + chalk_1.default.bold.blue('=== Agent-Harness Test Report ===') + '\n');
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.cyan('Metric'),
            chalk_1.default.cyan('Value')
        ]
    });
    table.push(['Total Runs', summary.totalRuns.toString()], ['Passed', chalk_1.default.green(summary.passedRuns.toString())], ['Failed', chalk_1.default.red(summary.failedRuns.toString())], ['Pass Rate', summary.passRate >= 80 ? chalk_1.default.green(`${summary.passRate.toFixed(2)}%`) : chalk_1.default.red(`${summary.passRate.toFixed(2)}%`)], ['Avg Latency', `${summary.avgLatencyMs.toFixed(2)} ms`]);
    console.log(table.toString());
    if (summary.passRate < 100) {
        console.log('\n' + chalk_1.default.yellow('⚠️ Some iterations failed due to non-deterministic outputs.'));
    }
    else {
        console.log('\n' + chalk_1.default.green('✅ All iterations passed! Your agent is highly deterministic.'));
    }
}
