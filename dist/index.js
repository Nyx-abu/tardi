#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const runner_1 = require("./runner");
const figlet_1 = __importDefault(require("figlet"));
const gradient_string_1 = __importDefault(require("gradient-string"));
const prompts_1 = require("@clack/prompts");
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
program
    .name('tardi')
    .description('Testing framework for non-deterministic AI agents (Survive the extremes!)')
    .version('1.0.0');
program
    .command('run')
    .description('Run a suite of agent tests')
    .argument('<path>', 'Path to the test configuration file (YAML)')
    .option('-e, --export <path>', 'Export results to a JSON file')
    .action(async (path, options) => {
    try {
        console.clear();
        const logo = figlet_1.default.textSync('TARDI', { font: 'Slant' });
        console.log(gradient_string_1.default.pastel.multiline(logo));
        (0, prompts_1.intro)(chalk_1.default.bgCyan.black(' tardi-cli v1.0.0 '));
        await (0, runner_1.runTests)(path, options.export);
    }
    catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    }
});
program.parse();
