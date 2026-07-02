import readline from 'readline';
import chalk from 'chalk';
import { printLogo } from './logo';
import { intro, select, text, isCancel, cancel, note, password } from '@clack/prompts';
import { resolveApiKey, setProviderKey } from './auth';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const PROVIDERS = [
  { value: 'google', label: 'Google AI (Gemini)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'local', label: 'Local (Ollama)' }
];

export async function startRepl() {
  console.clear();
  printLogo();
  intro(chalk.bgCyan.black(' tardi-cli v1.0.0 '));
  console.log(chalk.cyan('Welcome to Tardi REPL! Type /help to see available commands.\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.magenta('tardi> ')
  });

  let currentProvider = 'google';
  let currentModel = 'gemini-2.5-flash';

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      switch (cmd) {
        case '/help':
          console.log('\nAvailable commands:');
          console.log(`  ${chalk.bold('/help')}                   Show this help message`);
          console.log(`  ${chalk.bold('/provider')}               Switch evaluator provider interactively`);
          console.log(`  ${chalk.bold('/model')}                  Switch evaluator model interactively`);
          console.log(`  ${chalk.bold('/auth <provider> <key>')}  Save an API key for a provider`);
          console.log(`  ${chalk.bold('/status')}                 Show current evaluator configuration`);
          console.log(`  ${chalk.bold('/run [path]')}             Run tardi suite in current repo or specified path`);
          console.log(`  ${chalk.bold('/github <url>')}           Clone a GitHub repo and run tardi suite`);
          console.log(`  ${chalk.bold('/synthesize <cmd>')}       Run command and auto-synthesize tardi.yaml`);
          console.log(`  ${chalk.bold('/deadletter [id]')}        View crashed agent states`);
          console.log(`  ${chalk.bold('/exit')}                   Exit REPL`);
          console.log();
          break;

        case '/provider':
          // Pause RL
          rl.pause();
          const selectedProvider = await select({
            message: 'Select the evaluator provider:',
            options: PROVIDERS
          });
          if (!isCancel(selectedProvider)) {
            currentProvider = selectedProvider as string;
            // auto-set default model based on provider
            currentModel = currentProvider === 'google' ? 'gemini-2.5-flash' 
                       : currentProvider === 'openai' ? 'gpt-4o' 
                       : currentProvider === 'anthropic' ? 'claude-3-5-sonnet-20241022'
                       : 'llama3';
            console.log(chalk.green(`Provider set to ${currentProvider}`));
            console.log(chalk.green(`Model auto-set to ${currentModel}`));
          }
          rl.resume();
          break;

        case '/model':
          rl.pause();
          const selectedModel = await text({
            message: 'Enter model name:',
            defaultValue: currentModel
          });
          if (!isCancel(selectedModel)) {
            currentModel = selectedModel as string;
            console.log(chalk.green(`Model set to ${currentModel}`));
          }
          rl.resume();
          break;

        case '/auth':
          rl.pause();
          const providerArg = args[0];
          const providerSelected = providerArg || await select({
            message: 'Select the provider for the API key:',
            options: [
              { value: 'google', label: 'Google AI (Gemini)' },
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Anthropic' }
            ]
          });
          if (isCancel(providerSelected)) {
            rl.resume();
            break;
          }
          const p = providerSelected.toString();
          
          let keyVal = args[1];
          if (!keyVal) {
            const keyPrompt = await password({
              message: `Enter API key for ${p}:`,
              mask: '*'
            });
            if (isCancel(keyPrompt)) {
              rl.resume();
              break;
            }
            keyVal = keyPrompt as string;
          }
          
          await setProviderKey(p, keyVal);
          console.log(chalk.green(`✅ API key saved for ${p}`));
          rl.resume();
          break;

        case '/status':
          console.log(chalk.cyan('\nCurrent Configuration:'));
          console.log(`  Provider: ${chalk.bold(currentProvider)}`);
          console.log(`  Model:    ${chalk.bold(currentModel)}\n`);
          break;

        case '/run':
          const path = args[0] || '.';
          console.log(chalk.yellow(`\nRunning suite at ${path}...`));
          console.log(chalk.dim(`(Invoking internal runner with ${currentProvider}:${currentModel})`));
          // Import runner and execute (dynamic import to avoid circular deps if any)
          const { runTests } = await import('./runner');
          const fs = await import('fs');
          const pathModule = await import('path');
          
          let testFile = path;
          try {
            if (fs.existsSync(path)) {
              if (fs.statSync(path).isDirectory()) {
                const possible = ['tardi.yaml', 'tardi.yml', 'tests/tardi.yaml'];
                for (const p of possible) {
                  if (fs.existsSync(pathModule.join(path, p))) {
                    testFile = pathModule.join(path, p);
                    break;
                  }
                }
              }
            } else {
              console.log(chalk.red(`❌ Path not found: ${path}`));
              console.log();
              break;
            }
            if (!fs.existsSync(testFile)) {
               console.log(chalk.red(`❌ No tardi.yaml found at ${path}`));
            } else {
               await runTests(testFile, undefined, `${currentProvider}:${currentModel}`);
            }
          } catch(e: any) {
            console.log(chalk.red(`Error running tests: ${e.message}`));
          }
          console.log();
          break;

        case '/github':
          if (args.length === 0) {
            console.log(chalk.red('Usage: /github <url>'));
          } else {
            const url = args[0];
            const { runGithubEval } = await import('./github');
            await runGithubEval(url, `${currentProvider}:${currentModel}`);
          }
          console.log();
          break;

        case '/synthesize':
          if (args.length === 0) {
            console.log(chalk.red('Usage: /synthesize <command>'));
            console.log(chalk.dim('Example: /synthesize node agent.js'));
          } else {
            const cmdToRun = args.join(' ');
            const { synthesizeGauntlet } = await import('./synthesizer');
            await synthesizeGauntlet(cmdToRun, `${currentProvider}:${currentModel}`);
          }
          break;

        case '/deadletter':
          try {
            const fs = await import('fs');
            const pathModule = await import('path');
            const deadLetterDir = pathModule.join(process.cwd(), '.tardi', 'dead-letter');
            
            if (!fs.existsSync(deadLetterDir)) {
              console.log(chalk.yellow('No dead-letter directory found.'));
            } else {
              const files = fs.readdirSync(deadLetterDir).filter(f => f.endsWith('.json'));
              if (files.length === 0) {
                console.log(chalk.green('No crashed runs in dead-letter queue!'));
              } else if (args.length === 0) {
                console.log(chalk.cyan(`Found ${files.length} crashed runs:`));
                files.forEach(f => console.log(`  ${f.replace('.json', '')}`));
                console.log(chalk.dim('\nUse /deadletter <id> to view details.'));
              } else {
                const id = args[0];
                const file = files.find(f => f.includes(id));
                if (file) {
                  const data = JSON.parse(fs.readFileSync(pathModule.join(deadLetterDir, file), 'utf8'));
                  console.log(chalk.bold.red(`\nCrash Report: ${file}`));
                  console.log(chalk.cyan('Agent:'), data.configName, chalk.cyan('Iteration:'), data.iteration);
                  console.log(chalk.cyan('Exit Code:'), data.exitCode);
                  console.log(chalk.cyan('Timestamp:'), data.timestamp);
                  console.log(chalk.bold.yellow('\n--- STDOUT ---'));
                  console.log(data.stdout || chalk.dim('(empty)'));
                  console.log(chalk.bold.red('\n--- STDERR ---'));
                  console.log(data.stderr || chalk.dim('(empty)'));
                  console.log();
                } else {
                  console.log(chalk.red(`No dead-letter found for id: ${id}`));
                }
              }
            }
          } catch (e: any) {
            console.log(chalk.red(`Error reading dead-letter: ${e.message}`));
          }
          break;

        case '/exit':
        case '/quit':
          console.log(chalk.green('Goodbye!'));
          process.exit(0);

        default:
          console.log(chalk.red(`Unknown command: ${cmd}. Type /help for a list of commands.`));
      }
    } else if (input === '/menu' || input === 'menu') {
      // Wizard Menu
      rl.pause();
      const action = await select({
        message: 'What would you like to do today?',
        options: [
          { value: 'synthesize', label: '🧪 Test a new AI Agent (Synthesize)', hint: 'Generates tardi.yaml from a run' },
          { value: 'run', label: '▶️  Run an existing test suite' },
          { value: 'auth', label: '🔑 Setup my API Keys' },
          { value: 'deadletter', label: '🗑️  View crashed agents (Dead-letter)' },
          { value: 'exit', label: '🚪 Exit' }
        ]
      });

      if (!isCancel(action)) {
        switch (action) {
          case 'synthesize':
            const cmdToRun = await text({ message: 'What is the command to run your agent? (e.g. node agent.js)' });
            if (!isCancel(cmdToRun) && cmdToRun.toString().trim()) {
              const { synthesizeGauntlet } = await import('./synthesizer');
              await synthesizeGauntlet(cmdToRun.toString().trim());
            }
            break;
          case 'run':
            const runPath = await text({ message: 'Path to run? (leave empty for current directory)' });
            if (!isCancel(runPath)) {
              rl.emit('line', `/run ${runPath.toString().trim()}`);
              return;
            }
            break;
          case 'auth':
            rl.emit('line', `/provider`);
            return;
          case 'deadletter':
            rl.emit('line', `/deadletter`);
            return;
          case 'exit':
            process.exit(0);
        }
      }
      rl.resume();
    } else {
      // Natural Language Intent Parsing
      if (!input) {
        rl.prompt();
        return;
      }
      
      rl.pause();
      console.log(chalk.dim(`🧠 Thinking about: "${input}"...`));
      try {
        const apiKey = await resolveApiKey(currentProvider);
        if (!apiKey) {
           console.log(chalk.yellow(`\n⚠️  To use natural language commands, please setup your ${currentProvider} API key using '/auth ${currentProvider}'.`));
        } else {
           let nlpModel: any;
           if (currentProvider === 'openai') nlpModel = openai(currentModel);
           else if (currentProvider === 'anthropic') nlpModel = anthropic(currentModel);
           else nlpModel = google(currentModel);

           const { object } = await generateObject({
             model: nlpModel,
             schema: z.object({
               intent: z.enum(['synthesize', 'run', 'auth', 'deadletter', 'github', 'unknown']),
               commandArgs: z.string().optional().describe('The arguments to pass to the underlying command, if any. e.g. "node agent.js" for synthesize, a path for run, or a URL for github.'),
               friendlyResponse: z.string().describe('A friendly, helpful response acknowledging their request.')
             }),
             prompt: `The user typed: "${input}". Classify their intent into one of the available commands: synthesize (test a new agent), run (run an existing suite), auth (setup keys), deadletter (view crashes), or github (clone and test a github repo URL). If you can't determine it, return unknown.`
           });

           console.log(chalk.cyan(`🤖 ${object.friendlyResponse}`));
           
           if (object.intent !== 'unknown') {
             const syntheticCmd = `/${object.intent} ${object.commandArgs || ''}`.trim();
             console.log(chalk.dim(`Executing: ${syntheticCmd}\n`));
             rl.resume();
             rl.emit('line', syntheticCmd);
             return;
           }
        }
      } catch (e: any) {
        console.log(chalk.red(`\n❌ Failed to understand: ${e.message}`));
      }
      rl.resume();
    }

    rl.prompt();
  }).on('close', () => {
    console.log(chalk.green('\nGoodbye!'));
    process.exit(0);
  });
}
