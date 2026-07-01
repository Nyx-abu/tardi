#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const runner_1 = require("./runner");
const program = new commander_1.Command();
program
    .name('agent-harness')
    .description('Testing framework for non-deterministic AI agents')
    .version('1.0.0');
program
    .command('run')
    .description('Run a suite of agent tests')
    .argument('<path>', 'Path to the test configuration file')
    .option('-i, --iterations <number>', 'Number of times to run each test', '10')
    .action(async (path, options) => {
    console.log(`Starting agent-harness...`);
    console.log(`Target: ${path}`);
    console.log(`Iterations: ${options.iterations}`);
    await (0, runner_1.runTests)(path, parseInt(options.iterations, 10));
});
program.parse();
