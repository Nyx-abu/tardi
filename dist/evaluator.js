"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateResults = evaluateResults;
function evaluateResults(results) {
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
