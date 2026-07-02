import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { runTests } from './runner';

export async function runGithubEval(repoUrl: string, providerAndModel: string) {
  let tmpDir = '';
  try {
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `tardi-${repoName}-`));
    
    console.log(chalk.cyan(`\n📦 Cloning ${repoUrl} into temporary directory...`));
    execSync(`git clone --depth 1 ${repoUrl} ${tmpDir}`, { stdio: 'pipe' });

    // Install dependencies if needed
    if (fs.existsSync(path.join(tmpDir, 'package.json'))) {
      console.log(chalk.cyan('📦 package.json found. Installing dependencies (npm install)...'));
      execSync('npm install', { cwd: tmpDir, stdio: 'pipe' });
    } else if (fs.existsSync(path.join(tmpDir, 'requirements.txt'))) {
      console.log(chalk.cyan('📦 requirements.txt found. Installing dependencies (pip install -r requirements.txt)...'));
      execSync('pip install -r requirements.txt', { cwd: tmpDir, stdio: 'pipe' });
    }
    // Prompt for .env
    const { confirm, text, isCancel, cancel } = await import('@clack/prompts');
    const wantsEnv = await confirm({
      message: 'Does this agent require environment variables (e.g. API keys)?',
    });
    if (wantsEnv && !isCancel(wantsEnv)) {
      let addingEnv = true;
      let envContent = '';
      while (addingEnv) {
        const pair = await text({
          message: 'Enter env var (KEY=VALUE) or leave empty to finish:',
        });
        if (isCancel(pair) || !pair || (pair as string).trim() === '') {
          addingEnv = false;
        } else {
          envContent += `${(pair as string).trim()}\n`;
        }
      }
      if (envContent) {
        fs.writeFileSync(path.join(tmpDir, '.env'), envContent);
        console.log(chalk.green('✅ Saved .env to the repository root.'));
      }
    }

    // Auto-detect tardi.yaml
    const possibleFiles = [
      'tardi.yaml',
      'tardi.yml',
      'tests/tardi.yaml',
      'tests/tardi.yml',
      '.tardi.yaml',
    ];

    let testFile = '';
    for (const p of possibleFiles) {
      if (fs.existsSync(path.join(tmpDir, p))) {
        testFile = path.join(tmpDir, p);
        break;
      }
    }

    if (!testFile) {
      console.log(chalk.yellow(`\n⚠️ No tardi.yaml found in ${repoUrl}.`));
      const { confirm, text, isCancel, cancel } = await import('@clack/prompts');
      
      const shouldSynthesize = await confirm({
        message: 'Would you like to auto-synthesize a gauntlet by running the agent once?',
      });
      if (isCancel(shouldSynthesize) || !shouldSynthesize) {
        console.log(chalk.yellow(`Expected one of: ${possibleFiles.join(', ')}`));
        return;
      }
      
      let defaultCommand = '';
      if (fs.existsSync(path.join(tmpDir, 'package.json'))) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
          if (pkg.scripts && pkg.scripts.start) {
            defaultCommand = 'npm start';
          } else if (pkg.main) {
            defaultCommand = `node ${pkg.main}`;
          } else {
            defaultCommand = 'node index.js';
          }
        } catch {}
      } else if (fs.existsSync(path.join(tmpDir, 'main.py'))) {
        defaultCommand = 'python main.py';
      }

      const agentCommand = await text({
        message: 'Enter the command to run the agent (e.g. `npm start -- --prompt "hello"`):',
        placeholder: 'npm start',
        initialValue: defaultCommand,
        validate: (value) => {
          if (!value || value.trim().length === 0) return 'Please enter a command to run.';
        }
      });
      if (isCancel(agentCommand)) { cancel('Cancelled.'); return; }

      const originalCwd = process.cwd();
      process.chdir(tmpDir);

      const { synthesizeGauntlet } = await import('./synthesizer');
      await synthesizeGauntlet(agentCommand as string, 'tardi.yaml');
      testFile = path.join(tmpDir, 'tardi.yaml');

      if (!fs.existsSync(testFile)) {
        process.chdir(originalCwd);
        console.log(chalk.red('\n❌ Failed to synthesize tardi.yaml. Did the agent crash?'));
        return;
      }
      process.chdir(originalCwd);
    }

    console.log(chalk.green(`\n✅ Found/Created Tardi config at: ${path.relative(tmpDir, testFile)}`));
    
    // Remember original cwd and change to the repo directory before running
    const originalCwd = process.cwd();
    process.chdir(tmpDir);

    console.log(chalk.yellow(`\n🚀 Starting evaluation...`));
    await runTests(testFile, undefined, providerAndModel);

    process.chdir(originalCwd);

  } catch (e: any) {
    console.error(chalk.red(`\n❌ Failed to run GitHub eval: ${e.message}`));
  } finally {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log(chalk.dim(`\n🧹 Cleaned up temporary directory: ${tmpDir}`));
      } catch (cleanupErr) {
        // ignore
      }
    }
  }
}
