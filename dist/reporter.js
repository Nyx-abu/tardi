"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const path_1 = __importDefault(require("path"));
async function generateReport(summary, exportPath, jsonMode = false, reporterPath) {
    if (reporterPath) {
        try {
            const fullPath = path_1.default.resolve(process.cwd(), reporterPath);
            const customReporter = await Promise.resolve(`${fullPath}`).then(s => __importStar(require(s)));
            if (typeof customReporter.default === 'function') {
                customReporter.default(summary);
            }
            else {
                console.error(chalk_1.default.red(`\n❌ Custom reporter at ${reporterPath} must export a default function.`));
            }
            return;
        }
        catch (e) {
            console.error(chalk_1.default.red(`\n❌ Failed to load custom reporter at ${reporterPath}: ${e.message}`));
            return;
        }
    }
    if (exportPath) {
        fs_1.default.writeFileSync(exportPath, JSON.stringify(summary, null, 2), 'utf8');
    }
    if (jsonMode) {
        console.log(JSON.stringify(summary, null, 2));
        return;
    }
    const table = new cli_table3_1.default({
        head: [
            chalk_1.default.cyan('Metric'),
            chalk_1.default.cyan('Value')
        ]
    });
    table.push(['Total Runs', summary.totalRuns.toString()], ['Passed', chalk_1.default.green(summary.passedRuns.toString())], ['Failed', chalk_1.default.red(summary.failedRuns.toString())], ['Pass Rate', summary.passRate >= 80 ? chalk_1.default.green(`${summary.passRate.toFixed(2)}%`) : chalk_1.default.red(`${summary.passRate.toFixed(2)}%`)], ['Avg Latency', summary.avgLatencyMs > 5000 ? chalk_1.default.yellow(`${summary.avgLatencyMs.toFixed(2)} ms`) : `${summary.avgLatencyMs.toFixed(2)} ms`], ['Cache Hits', summary.cacheHits > 0 ? chalk_1.default.green(summary.cacheHits.toString()) : summary.cacheHits.toString()], ['Flakiness', summary.isFlaky ? chalk_1.default.red('Flaky') : summary.passRate === 100 ? chalk_1.default.green('Deterministic') : chalk_1.default.red('Failing')]);
    let failureOutput = '';
    if (summary.failedRuns > 0) {
        failureOutput += '\n\n' + chalk_1.default.bold.red('Failures:\n');
        summary.results.filter(r => !r.passed).forEach(r => {
            failureOutput += chalk_1.default.red(`- Iteration ${r.iteration} [${r.failureType || 'UNKNOWN'}]: `) + r.reason + '\n';
            if (r.diff) {
                failureOutput += chalk_1.default.bold.cyan('  Trajectory Mismatch Diff:\n');
                r.diff.split('\n').forEach(line => {
                    if (line.startsWith('+'))
                        failureOutput += chalk_1.default.green(`  ${line}\n`);
                    else if (line.startsWith('-'))
                        failureOutput += chalk_1.default.red(`  ${line}\n`);
                    else
                        failureOutput += chalk_1.default.dim(`  ${line}\n`);
                });
            }
            else if (r.failureType === evaluator_1.FailureType.CRASH && r.stderr) {
                failureOutput += chalk_1.default.dim(`  Stderr: ${r.stderr.trim().substring(0, 300).replace(/\n/g, '\\n')}...`) + '\n';
            }
            else if (r.output) {
                failureOutput += chalk_1.default.dim(`  Output: ${r.output.trim().substring(0, 300).replace(/\n/g, '\\n')}...`) + '\n';
            }
        });
    }
    let resultStatus = '';
    if (summary.isFlaky) {
        resultStatus = chalk_1.default.yellow(`⚠️ Flaky Agent Detected: Passed ${summary.passedRuns}/${summary.totalRuns} runs. Results are non-deterministic.`);
    }
    else if (summary.passRate === 100) {
        resultStatus = chalk_1.default.green('✅ All iterations passed! Your agent is highly deterministic.');
    }
    else {
        resultStatus = chalk_1.default.red(`❌ All iterations failed. Agent is deterministically broken.`);
    }
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
