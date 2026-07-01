"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const evaluator_1 = require("./evaluator");
const reporter_1 = require("./reporter");
async function runTests(configPath, iterations) {
    // Mock logic for executing the test
    console.log(`Running tests from ${configPath} for ${iterations} iterations...\n`);
    const results = [];
    // Simulate running non-deterministic tests
    for (let i = 0; i < iterations; i++) {
        // Fake latency
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
        // Simulate non-deterministic output
        const isSuccess = Math.random() > 0.2; // 80% pass rate
        results.push({
            iteration: i + 1,
            passed: isSuccess,
            latencyMs: Math.floor(Math.random() * 1000) + 200,
            output: isSuccess ? "Valid JSON response" : "Hallucinated text block"
        });
    }
    const evaluation = (0, evaluator_1.evaluateResults)(results);
    (0, reporter_1.generateReport)(evaluation);
}
