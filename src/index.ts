#!/usr/bin/env node
import { Command } from 'commander';
import { runTests } from './runner';
import { printLogo } from './logo';
import { intro, password, outro, text, select, isCancel, cancel, spinner, note } from '@clack/prompts';
import chalk from 'chalk';
import { globSync } from 'glob';
import fs from 'fs';
import yaml from 'yaml';
import { isCI } from 'ci-info';
import {
  setProviderKey, deleteProviderKey, resolveApiKey,
  wipeAllKeys, listStoredProviders, fetchAvailableModels
} from './auth';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: 'google',    label: 'Google Gemini' },
  { value: 'openai',    label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'local',     label: 'Local (Ollama / LM Studio)' },
];

/**
 * Prompt the user for an API key, validate it by fetching models,
 * save it, and return the chosen model id.
 */
async function interactiveKeyAndModelFlow(provider: string): Promise<string> {
  // 1. Resolve or ask for key
  let apiKey = await resolveApiKey(provider);
  if (!apiKey) {
    const inputKey = await password({
      message: `Enter your API key for ${provider}:`,
      validate: (v) => {
        if (!v || v.trim().length === 0) return 'API key cannot be empty.';
        if (v.trim().length < 10) return 'That looks too short to be a valid API key.';
      },
    });
    if (isCancel(inputKey)) { cancel('Cancelled.'); process.exit(0); }
    apiKey = inputKey as string;
  }

  // 2. Validate key by fetching models
  const s = spinner();
  s.start(`Validating key & fetching available ${provider} models…`);
  let models;
  try {
    models = await fetchAvailableModels(provider, apiKey);
  } catch (e: any) {
    s.stop(chalk.red('Key validation failed.'));
    console.error(chalk.red(`\n❌ ${e.message}`));
    console.error(chalk.yellow('Please double-check your API key and try again.'));
    process.exit(1);
  }
  s.stop(chalk.green(`Found ${models.length} available models.`));

  // Save the key only AFTER it's validated
  await setProviderKey(provider, apiKey);

  if (models.length === 0) {
    console.error(chalk.red('❌ Your key is valid but no models supporting generateContent were found.'));
    process.exit(1);
  }

  // 3. Let user pick a model
  const selectedModel = await select({
    message: `Choose a model for ${provider}:`,
    options: models.slice(0, 30).map(m => ({
      value: m.id,
      label: `${m.displayName}`,
      hint: m.id,
    })),
  });
  if (isCancel(selectedModel)) { cancel('Cancelled.'); process.exit(0); }

  return selectedModel as string;
}

// ─── CLI Setup ──────────────────────────────────────────────────────────────

const program = new Command();

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
    printLogo();
    intro(chalk.bgCyan.black(' Initialize Tardi Test Suite '));

    if (isCI) {
      console.error(chalk.red('❌ Cannot run interactive init in CI. Use `tardi init --non-interactive` or write tardi.yaml manually.'));
      process.exit(1);
    }

    const name = await text({
      message: 'Test suite name?',
      defaultValue: 'My Tardi Test Suite',
      placeholder: 'My Tardi Test Suite',
    });
    if (isCancel(name)) { cancel('Cancelled.'); process.exit(0); }

    const agentCommand = await text({
      message: 'Agent command to test?',
      placeholder: 'node my-agent.js --prompt "Hello"',
    });
    if (isCancel(agentCommand)) { cancel('Cancelled.'); process.exit(0); }

    const iterations = await text({
      message: 'Number of iterations?',
      defaultValue: '5',
      placeholder: '5',
    });
    if (isCancel(iterations)) { cancel('Cancelled.'); process.exit(0); }

    // Provider selection
    const provider = await select({
      message: 'Which LLM provider for evaluation?',
      options: PROVIDERS,
    });
    if (isCancel(provider)) { cancel('Cancelled.'); process.exit(0); }

    let model: string;
    if (provider === 'local') {
      const localModel = await text({
        message: 'Local model name?',
        defaultValue: 'llama3',
        placeholder: 'llama3',
      });
      if (isCancel(localModel)) { cancel('Cancelled.'); process.exit(0); }
      model = localModel as string;
    } else {
      model = await interactiveKeyAndModelFlow(provider as string);
    }

    const rubric = await text({
      message: 'Evaluation rubric (what makes a good output)?',
      defaultValue: 'Output must be relevant and well-formatted',
      placeholder: 'Output must be relevant and well-formatted',
    });
    if (isCancel(rubric)) { cancel('Cancelled.'); process.exit(0); }

    const safeCommand = (agentCommand as string).replace(/"/g, '\\"');
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
    fs.writeFileSync('tardi.yaml', template);
    outro(chalk.green('✅ Created tardi.yaml — run `tardi run` to start testing!'));
  });

// ─── tardi auth ─────────────────────────────────────────────────────────────

const authCmd = program.command('auth').description('Manage API keys securely via OS Keychain');

authCmd
  .command('login <provider>')
  .description('Store an API key and verify it works')
  .action(async (provider) => {
    console.clear();
    intro(chalk.bgCyan.black(` Tardi Auth: ${provider} `));
    if (isCI) {
      console.error(chalk.red('❌ Cannot run interactive login in CI. Set env vars instead.'));
      process.exit(1);
    }
    const inputKey = await password({
      message: `Enter your API key for ${provider}:`,
      validate: (v) => {
        if (!v || v.trim().length === 0) return 'API key cannot be empty.';
        if (v.trim().length < 10) return 'That looks too short to be a valid API key.';
      },
    });
    if (isCancel(inputKey)) { cancel('Cancelled.'); process.exit(0); }

    const s = spinner();
    s.start('Validating key…');
    try {
      const models = await fetchAvailableModels(provider, inputKey as string);
      s.stop(chalk.green(`✅ Key valid! ${models.length} models available.`));
      await setProviderKey(provider, inputKey as string);

      if (models.length > 0) {
        note(
          models.slice(0, 10).map(m => `  ${chalk.cyan(m.id)} — ${m.displayName}`).join('\n'),
          'Available models (top 10)'
        );
      }
    } catch (e: any) {
      s.stop(chalk.red('Key validation failed.'));
      console.error(chalk.red(`\n❌ ${e.message}`));
      process.exit(1);
    }

    outro(chalk.green('✅ API Key saved securely to OS Keychain!'));
  });

authCmd
  .command('logout <provider>')
  .description('Remove an API key from the OS Keychain')
  .action(async (provider) => {
    const deleted = await deleteProviderKey(provider);
    if (deleted) {
      console.log(chalk.green(`✅ API Key for ${provider} removed.`));
    } else {
      console.log(chalk.yellow(`⚠️ No stored key found for ${provider}.`));
    }
  });

authCmd
  .command('wipe')
  .description('Remove ALL stored API keys (fresh start)')
  .action(async () => {
    const count = await wipeAllKeys();
    console.log(chalk.green(`✅ Wiped ${count} stored key(s) from OS Keychain.`));
  });

authCmd
  .command('status')
  .description('Show which providers have stored keys')
  .action(async () => {
    const providers = await listStoredProviders();
    if (providers.length === 0) {
      console.log(chalk.yellow('No API keys stored. Run `tardi auth login <provider>` to add one.'));
    } else {
      console.log(chalk.bold('Stored API keys:'));
      for (const p of providers) {
        console.log(chalk.green(`  ✓ ${p}`));
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
        printLogo();
        intro(chalk.bgCyan.black(' tardi-cli v1.0.0 '));
      }

      // ── Discover test files ──
      let testFiles: string[] = [];
      if (!pathArg) {
        testFiles = globSync('**/*.{tardi.yaml,tardi.yml}', { ignore: 'node_modules/**' });
        // Also check for any yaml in tests/ dir
        testFiles.push(...globSync('tests/**/*.{yaml,yml}', { ignore: 'node_modules/**' }));
        // Dedupe
        testFiles = [...new Set(testFiles)];
      } else {
        try {
          if (fs.statSync(pathArg).isDirectory()) {
            testFiles = globSync(`${pathArg}/**/*.{yaml,yml}`, { ignore: 'node_modules/**' });
          } else {
            testFiles = [pathArg];
          }
        } catch {
          testFiles = [pathArg]; // Let it fail with a proper file-not-found later
        }
      }

      if (testFiles.length === 0) {
        if (!options.json) console.error(chalk.red('❌ No test files found. Run `tardi init` to create one.'));
        process.exit(1);
      }

      let hasFailures = false;

      for (const file of testFiles) {
        if (!options.json) console.log(chalk.bold(`\n📝 Suite: ${file}`));

        const content = fs.readFileSync(file, 'utf8');
        const parsed = yaml.parse(content);

        // ── Resolve provider + model ──
        let overrideProvider: string | undefined;
        let overrideModel: string | undefined;
        if (options.evaluator) {
          [overrideProvider, overrideModel] = options.evaluator.split(':');
        }

        let provider = overrideProvider || parsed?.evaluator?.provider;
        let model = overrideModel || parsed?.evaluator?.model;

        // If no provider at all, prompt interactively
        if (!provider && !isCI && process.stdout.isTTY && !options.json) {
          console.log(chalk.yellow(`\n⚠️ No evaluator in ${file}. Let's pick one.`));
          const selectedProvider = await select({
            message: 'Which LLM provider?',
            options: PROVIDERS,
          });
          if (isCancel(selectedProvider)) { cancel('Cancelled.'); process.exit(0); }
          provider = selectedProvider as string;

          if (provider === 'local') {
            const localModel = await text({
              message: 'Local model name?',
              defaultValue: 'llama3',
            });
            if (isCancel(localModel)) { cancel('Cancelled.'); process.exit(0); }
            model = localModel as string;
          } else {
            const defaultModel = provider === 'google' ? 'gemini-2.5-flash' 
                       : provider === 'openai' ? 'gpt-4o' 
                       : provider === 'anthropic' ? 'claude-3-5-sonnet-20241022'
                       : 'llama3';
            model = await interactiveKeyAndModelFlow(provider);
          }
          options.evaluator = `${provider}:${model}`;
        }

        // If we have a provider but no model, auto-fetch
        if (provider && provider !== 'local' && !model && !isCI && process.stdout.isTTY && !options.json) {
          model = await interactiveKeyAndModelFlow(provider);
          options.evaluator = `${provider}:${model}`;
        }

        // Ensure we have a key for the provider
        if (provider && provider !== 'local') {
          const key = await resolveApiKey(provider);
          if (!key) {
            if (isCI || !process.stdout.isTTY || options.json) {
              if (!options.json) {
                console.error(chalk.red(`\n❌ Missing API key for ${provider}.`));
                console.error(chalk.yellow('In CI, set the env var (e.g. GOOGLE_GENERATIVE_AI_API_KEY).'));
              }
              process.exit(1);
            } else {
              // Interactive: ask for key, validate, pick model
              model = await interactiveKeyAndModelFlow(provider);
              options.evaluator = `${provider}:${model}`;
            }
          }
        }

        const failed = await runTests(file, options.export, options.evaluator, !!options.json, options.reporter);
        if (failed) hasFailures = true;
      }

      if (hasFailures) process.exit(1);

    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// ─── tardi synthesize ───────────────────────────────────────────────────────

program
  .command('synthesize <command...>')
  .description('Run an agent command once and auto-synthesize a tardi.yaml gauntlet')
  .action(async (commandArgs) => {
    try {
      const { synthesizeGauntlet } = await import('./synthesizer');
      await synthesizeGauntlet(commandArgs.join(' '));
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error synthesizing gauntlet: ${error.message}`));
      process.exit(1);
    }
  });

// ─── tardi repl ───────────────────────────────────────────────────────────────

program
  .command('repl')
  .description('Start the interactive Tardi REPL')
  .action(async () => {
    try {
      const { startRepl } = await import('./repl');
      await startRepl();
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Failed to start REPL: ${error.message}`));
      process.exit(1);
    }
  });

// ── Entry point logic ──
if (process.argv.length <= 2) {
  // Launch REPL if no arguments provided
  import('./repl').then(({ startRepl }) => startRepl()).catch(e => {
    console.error(chalk.red(`Failed to start REPL: ${e.message}`));
    process.exit(1);
  });
} else {
  program.parse(process.argv);
}
