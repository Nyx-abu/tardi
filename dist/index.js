#!/usr/bin/env node
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
const commander_1 = require("commander");
const runner_1 = require("./runner");
const logo_1 = require("./logo");
const prompts_1 = require("@clack/prompts");
const chalk_1 = __importDefault(require("chalk"));
const glob_1 = require("glob");
const fs_1 = __importDefault(require("fs"));
const yaml_1 = __importDefault(require("yaml"));
const ci_info_1 = require("ci-info");
const auth_1 = require("./auth");
// ─── Helpers ────────────────────────────────────────────────────────────────
const PROVIDERS = [
    { value: 'google', label: 'Google Gemini' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'local', label: 'Local (Ollama / LM Studio)' },
];
/**
 * Prompt the user for an API key, validate it by fetching models,
 * save it, and return the chosen model id.
 */
async function interactiveKeyAndModelFlow(provider) {
    // 1. Resolve or ask for key
    let apiKey = await (0, auth_1.resolveApiKey)(provider);
    if (!apiKey) {
        const inputKey = await (0, prompts_1.password)({
            message: `Enter your API key for ${provider}:`,
            validate: (v) => {
                if (!v || v.trim().length === 0)
                    return 'API key cannot be empty.';
                if (v.trim().length < 10)
                    return 'That looks too short to be a valid API key.';
            },
        });
        if ((0, prompts_1.isCancel)(inputKey)) {
            (0, prompts_1.cancel)('Cancelled.');
            process.exit(0);
        }
        apiKey = inputKey;
    }
    // 2. Validate key by fetching models
    const s = (0, prompts_1.spinner)();
    s.start(`Validating key & fetching available ${provider} models…`);
    let models;
    try {
        models = await (0, auth_1.fetchAvailableModels)(provider, apiKey);
    }
    catch (e) {
        s.stop(chalk_1.default.red('Key validation failed.'));
        console.error(chalk_1.default.red(`\n❌ ${e.message}`));
        console.error(chalk_1.default.yellow('Please double-check your API key and try again.'));
        process.exit(1);
    }
    s.stop(chalk_1.default.green(`Found ${models.length} available models.`));
    // Save the key only AFTER it's validated
    await (0, auth_1.setProviderKey)(provider, apiKey);
    if (models.length === 0) {
        console.error(chalk_1.default.red('❌ Your key is valid but no models supporting generateContent were found.'));
        process.exit(1);
    }
    // 3. Let user pick a model
    const selectedModel = await (0, prompts_1.select)({
        message: `Choose a model for ${provider}:`,
        options: models.slice(0, 30).map(m => ({
            value: m.id,
            label: `${m.displayName}`,
            hint: m.id,
        })),
    });
    if ((0, prompts_1.isCancel)(selectedModel)) {
        (0, prompts_1.cancel)('Cancelled.');
        process.exit(0);
    }
    return selectedModel;
}
// ─── CLI Setup ──────────────────────────────────────────────────────────────
const program = new commander_1.Command();
program
    .name('tardi')
    .description('Tardi — A deterministic testing framework for LLM agents and non-deterministic AI pipelines.')
    .version('1.0.0');
// ─── tardi init ─────────────────────────────────────────────────────────────
program
    .command('init')
    .description('Initialize a new tardi.yaml test suite interactively')
    .action(async () => {
    console.clear();
    (0, logo_1.printLogo)();
    (0, prompts_1.intro)(chalk_1.default.bgCyan.black(' Initialize Tardi Test Suite '));
    if (ci_info_1.isCI) {
        console.error(chalk_1.default.red('❌ Cannot run interactive init in CI. Use `tardi init --non-interactive` or write tardi.yaml manually.'));
        process.exit(1);
    }
    const name = await (0, prompts_1.text)({
        message: 'Test suite name?',
        defaultValue: 'My Tardi Test Suite',
        placeholder: 'My Tardi Test Suite',
    });
    if ((0, prompts_1.isCancel)(name)) {
        (0, prompts_1.cancel)('Cancelled.');
        process.exit(0);
    }
    const agentCommand = await (0, prompts_1.text)({
        message: 'Agent command to test?',
        placeholder: 'node my-agent.js --prompt "Hello"',
    });
    if ((0, prompts_1.isCancel)(agentCommand)) {
        (0, prompts_1.cancel)('Cancelled.');
        process.exit(0);
    }
    const iterations = await (0, prompts_1.text)({
        message: 'Number of iterations?',
        defaultValue: '5',
        placeholder: '5',
    });
    if ((0, prompts_1.isCancel)(iterations)) {
        (0, prompts_1.cancel)('Cancelled.');
        process.exit(0);
    }
    // Provider selection
    const provider = await (0, prompts_1.select)({
        message: 'Which LLM provider for evaluation?',
        options: PROVIDERS,
    });
    if ((0, prompts_1.isCancel)(provider)) {
        (0, prompts_1.cancel)('Cancelled.');
        process.exit(0);
    }
    let model;
    if (provider === 'local') {
        const localModel = await (0, prompts_1.text)({
            message: 'Local model name?',
            defaultValue: 'llama3',
            placeholder: 'llama3',
        });
        if ((0, prompts_1.isCancel)(localModel)) {
            (0, prompts_1.cancel)('Cancelled.');
            process.exit(0);
        }
        model = localModel;
    }
    else {
        model = await interactiveKeyAndModelFlow(provider);
    }
    const rubric = await (0, prompts_1.text)({
        message: 'Evaluation rubric (what makes a good output)?',
        defaultValue: 'Output must be relevant and well-formatted',
        placeholder: 'Output must be relevant and well-formatted',
    });
    if ((0, prompts_1.isCancel)(rubric)) {
        (0, prompts_1.cancel)('Cancelled.');
        process.exit(0);
    }
    const safeCommand = agentCommand.replace(/"/g, '\\"');
    const template = `# yaml-language-server: $schema=./tardi.schema.json
name: "${name}"
agentCommand: "${safeCommand}"
iterations: ${iterations}
concurrency: 2
timeoutMs: 30000
assertions:
  regex: "."
evaluator:
  provider: ${provider}
  model: ${model}
  rubric: "${rubric}"
`;
    fs_1.default.writeFileSync('tardi.yaml', template);
    (0, prompts_1.outro)(chalk_1.default.green('✅ Created tardi.yaml — run `tardi run` to start testing!'));
});
// ─── tardi auth ─────────────────────────────────────────────────────────────
const authCmd = program.command('auth').description('Manage API keys securely via OS Keychain');
authCmd
    .command('login <provider>')
    .description('Store an API key and verify it works')
    .action(async (provider) => {
    console.clear();
    (0, prompts_1.intro)(chalk_1.default.bgCyan.black(` Tardi Auth: ${provider} `));
    if (ci_info_1.isCI) {
        console.error(chalk_1.default.red('❌ Cannot run interactive login in CI. Set env vars instead.'));
        process.exit(1);
    }
    const inputKey = await (0, prompts_1.password)({
        message: `Enter your API key for ${provider}:`,
        validate: (v) => {
            if (!v || v.trim().length === 0)
                return 'API key cannot be empty.';
            if (v.trim().length < 10)
                return 'That looks too short to be a valid API key.';
        },
    });
    if ((0, prompts_1.isCancel)(inputKey)) {
        (0, prompts_1.cancel)('Cancelled.');
        process.exit(0);
    }
    const s = (0, prompts_1.spinner)();
    s.start('Validating key…');
    try {
        const models = await (0, auth_1.fetchAvailableModels)(provider, inputKey);
        s.stop(chalk_1.default.green(`✅ Key valid! ${models.length} models available.`));
        await (0, auth_1.setProviderKey)(provider, inputKey);
        if (models.length > 0) {
            (0, prompts_1.note)(models.slice(0, 10).map(m => `  ${chalk_1.default.cyan(m.id)} — ${m.displayName}`).join('\n'), 'Available models (top 10)');
        }
    }
    catch (e) {
        s.stop(chalk_1.default.red('Key validation failed.'));
        console.error(chalk_1.default.red(`\n❌ ${e.message}`));
        process.exit(1);
    }
    (0, prompts_1.outro)(chalk_1.default.green('✅ API Key saved securely to OS Keychain!'));
});
authCmd
    .command('logout <provider>')
    .description('Remove an API key from the OS Keychain')
    .action(async (provider) => {
    const deleted = await (0, auth_1.deleteProviderKey)(provider);
    if (deleted) {
        console.log(chalk_1.default.green(`✅ API Key for ${provider} removed.`));
    }
    else {
        console.log(chalk_1.default.yellow(`⚠️ No stored key found for ${provider}.`));
    }
});
authCmd
    .command('wipe')
    .description('Remove ALL stored API keys (fresh start)')
    .action(async () => {
    const count = await (0, auth_1.wipeAllKeys)();
    console.log(chalk_1.default.green(`✅ Wiped ${count} stored key(s) from OS Keychain.`));
});
authCmd
    .command('status')
    .description('Show which providers have stored keys')
    .action(async () => {
    const providers = await (0, auth_1.listStoredProviders)();
    if (providers.length === 0) {
        console.log(chalk_1.default.yellow('No API keys stored. Run `tardi auth login <provider>` to add one.'));
    }
    else {
        console.log(chalk_1.default.bold('Stored API keys:'));
        for (const p of providers) {
            console.log(chalk_1.default.green(`  ✓ ${p}`));
        }
    }
});
// ─── tardi run ──────────────────────────────────────────────────────────────
program
    .command('run')
    .description('Run a suite of agent tests')
    .argument('[path]', 'Path to test config (YAML) or directory. Defaults to auto-discovery.')
    .option('-e, --export <path>', 'Export results to a JSON file')
    .option('--json', 'Output results as JSON to stdout')
    .option('--reporter <path>', 'Use a custom JS reporter instead of the default CLI table')
    .option('--evaluator <provider:model>', 'Override the evaluator (e.g. google:gemini-2.0-flash)')
    .action(async (pathArg, options) => {
    try {
        if (!options.json) {
            console.clear();
            (0, logo_1.printLogo)();
            (0, prompts_1.intro)(chalk_1.default.bgCyan.black(' tardi-cli v1.0.0 '));
        }
        // ── Discover test files ──
        let testFiles = [];
        if (!pathArg) {
            testFiles = (0, glob_1.globSync)('**/*.{tardi.yaml,tardi.yml}', { ignore: 'node_modules/**' });
            // Also check for any yaml in tests/ dir
            testFiles.push(...(0, glob_1.globSync)('tests/**/*.{yaml,yml}', { ignore: 'node_modules/**' }));
            // Dedupe
            testFiles = [...new Set(testFiles)];
        }
        else {
            try {
                if (fs_1.default.statSync(pathArg).isDirectory()) {
                    testFiles = (0, glob_1.globSync)(`${pathArg}/**/*.{yaml,yml}`, { ignore: 'node_modules/**' });
                }
                else {
                    testFiles = [pathArg];
                }
            }
            catch {
                testFiles = [pathArg]; // Let it fail with a proper file-not-found later
            }
        }
        if (testFiles.length === 0) {
            if (!options.json)
                console.error(chalk_1.default.red('❌ No test files found. Run `tardi init` to create one.'));
            process.exit(1);
        }
        let hasFailures = false;
        for (const file of testFiles) {
            if (!options.json)
                console.log(chalk_1.default.bold(`\n📝 Suite: ${file}`));
            const content = fs_1.default.readFileSync(file, 'utf8');
            const parsed = yaml_1.default.parse(content);
            // ── Resolve provider + model ──
            let overrideProvider;
            let overrideModel;
            if (options.evaluator) {
                [overrideProvider, overrideModel] = options.evaluator.split(':');
            }
            let provider = overrideProvider || parsed?.evaluator?.provider;
            let model = overrideModel || parsed?.evaluator?.model;
            // If no provider at all, prompt interactively
            if (!provider && !ci_info_1.isCI && process.stdout.isTTY && !options.json) {
                console.log(chalk_1.default.yellow(`\n⚠️ No evaluator in ${file}. Let's pick one.`));
                const selectedProvider = await (0, prompts_1.select)({
                    message: 'Which LLM provider?',
                    options: PROVIDERS,
                });
                if ((0, prompts_1.isCancel)(selectedProvider)) {
                    (0, prompts_1.cancel)('Cancelled.');
                    process.exit(0);
                }
                provider = selectedProvider;
                if (provider === 'local') {
                    const localModel = await (0, prompts_1.text)({
                        message: 'Local model name?',
                        defaultValue: 'llama3',
                    });
                    if ((0, prompts_1.isCancel)(localModel)) {
                        (0, prompts_1.cancel)('Cancelled.');
                        process.exit(0);
                    }
                    model = localModel;
                }
                else {
                    const defaultModel = provider === 'google' ? 'gemini-2.5-flash'
                        : provider === 'openai' ? 'gpt-4o'
                            : provider === 'anthropic' ? 'claude-3-5-sonnet-20241022'
                                : 'llama3';
                    model = await interactiveKeyAndModelFlow(provider);
                }
                options.evaluator = `${provider}:${model}`;
            }
            // If we have a provider but no model, auto-fetch
            if (provider && provider !== 'local' && !model && !ci_info_1.isCI && process.stdout.isTTY && !options.json) {
                model = await interactiveKeyAndModelFlow(provider);
                options.evaluator = `${provider}:${model}`;
            }
            // Ensure we have a key for the provider
            if (provider && provider !== 'local') {
                const key = await (0, auth_1.resolveApiKey)(provider);
                if (!key) {
                    if (ci_info_1.isCI || !process.stdout.isTTY || options.json) {
                        if (!options.json) {
                            console.error(chalk_1.default.red(`\n❌ Missing API key for ${provider}.`));
                            console.error(chalk_1.default.yellow('In CI, set the env var (e.g. GOOGLE_GENERATIVE_AI_API_KEY).'));
                        }
                        process.exit(1);
                    }
                    else {
                        // Interactive: ask for key, validate, pick model
                        model = await interactiveKeyAndModelFlow(provider);
                        options.evaluator = `${provider}:${model}`;
                    }
                }
            }
            const failed = await (0, runner_1.runTests)(file, options.export, options.evaluator, !!options.json, options.reporter);
            if (failed)
                hasFailures = true;
        }
        if (hasFailures)
            process.exit(1);
    }
    catch (error) {
        console.error(chalk_1.default.red(`\n❌ Error: ${error.message}`));
        process.exit(1);
    }
});
// ─── tardi synthesize ───────────────────────────────────────────────────────
program
    .command('synthesize <command...>')
    .description('Run an agent command once and auto-synthesize a tardi.yaml gauntlet')
    .action(async (commandArgs) => {
    try {
        const { synthesizeGauntlet } = await Promise.resolve().then(() => __importStar(require('./synthesizer')));
        await synthesizeGauntlet(commandArgs.join(' '));
    }
    catch (error) {
        console.error(chalk_1.default.red(`\n❌ Error synthesizing gauntlet: ${error.message}`));
        process.exit(1);
    }
});
// ─── tardi repl ───────────────────────────────────────────────────────────────
program
    .command('repl')
    .description('Start the interactive Tardi REPL')
    .action(async () => {
    try {
        const { startRepl } = await Promise.resolve().then(() => __importStar(require('./repl')));
        await startRepl();
    }
    catch (error) {
        console.error(chalk_1.default.red(`\n❌ Failed to start REPL: ${error.message}`));
        process.exit(1);
    }
});
// ── Entry point logic ──
if (process.argv.length <= 2) {
    // Launch REPL if no arguments provided
    Promise.resolve().then(() => __importStar(require('./repl'))).then(({ startRepl }) => startRepl()).catch(e => {
        console.error(chalk_1.default.red(`Failed to start REPL: ${e.message}`));
        process.exit(1);
    });
}
else {
    program.parse(process.argv);
}
