import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import chalk from 'chalk';
import { parseStdoutTrajectory } from './adapters';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { resolveApiKey } from './auth';

const execAsync = promisify(exec);

export async function synthesizeGauntlet(command: string, providerInfo: string = 'google:gemini-2.5-flash', outputPath: string = 'tardi.yaml') {
  console.log(chalk.cyan(`\nRunning agent 3 times to synthesize a robust gauntlet: ${command}`));
  
  const trajectories: string[][] = [];
  const schemas: any[] = [];
  
  for (let i = 1; i <= 3; i++) {
    console.log(chalk.dim(`\n--- Golden Run ${i}/3 ---`));
    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    
    try {
      const { stdout: out, stderr: err } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });
      stdout = out;
      stderr = err || '';
    } catch (e: any) {
      stdout = e.stdout || '';
      stderr = e.stderr || e.message;
      exitCode = e.code || 1;
    }
    
    if (exitCode !== 0) {
      console.log(chalk.red(`Agent crashed on run ${i} with exit code ${exitCode}. Cannot synthesize gauntlet from failing runs.`));
      console.log(chalk.dim(`Stderr: ${stderr}`));
      return;
    }
    
    // Extract Trajectory
    const actualSteps = parseStdoutTrajectory(stdout);
    trajectories.push(actualSteps.map(s => s.content));
    
    // Extract JSON schema
    const jsonMatch = stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]);
        schemas.push({
          type: Array.isArray(data) ? 'array' : 'object',
          properties: typeof data === 'object' && !Array.isArray(data) ? 
            Object.keys(data).reduce((acc: any, key) => { acc[key] = { type: typeof data[key] }; return acc; }, {}) 
            : undefined,
          required: typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : undefined
        });
      } catch(e) {}
    }
  }
  
  console.log(chalk.green('\nAll 3 runs successful. Analyzing variance...'));

  // Use the shortest trajectory to avoid over-constraining on a single verbose run
  const robustTrajectory = trajectories.length > 0 ? 
      trajectories.reduce((min, cur) => cur.length < min.length ? cur : min, trajectories[0]) : [];
      
  const jsonSchema = schemas.length > 0 ? schemas[0] : undefined;

  // 2. Eval Synthesizer: Generate the subjective rubric
  console.log(chalk.yellow('Synthesizing evaluation rubric using LLM...'));
  let rubric = 'Evaluate the overall quality of the output.';
  try {
    const [providerStr, modelStr] = providerInfo.split(':');
    let synthModel: any;
    if (providerStr === 'openai') synthModel = openai(modelStr);
    else if (providerStr === 'anthropic') synthModel = anthropic(modelStr);
    else synthModel = google(modelStr);

    // Make sure API key is loaded
    await resolveApiKey(providerStr);
    const { text } = await generateText({
      model: synthModel,
      prompt: `Analyze the following successful terminal outputs of an AI agent across 3 runs and generate a 1-2 sentence grading rubric that can be used by an LLM-as-a-judge to evaluate future runs of this agent. Focus on semantic intent rather than exact string matching.\n\nRun 1: ${trajectories[0]?.join('\\n')}\n\nRun 2: ${trajectories[1]?.join('\\n')}\n\nRun 3: ${trajectories[2]?.join('\\n')}`
    });
    rubric = text.trim();
  } catch (e: any) {
    console.log(chalk.yellow(`Failed to auto-generate rubric, using default. (${e.message})`));
  }
  
  const config = {
    name: 'Auto-Synthesized Agent Test',
    agentCommand: command,
    iterations: 5,
    concurrency: 2,
    timeoutMs: 30000,
    flakinessThreshold: 80,
    failFast: true,
    assertions: {
      ...(robustTrajectory.length > 0 && { trajectory: robustTrajectory }),
      ...(jsonSchema && { jsonSchema }),
      telemetry: {
         maxLatencyMs: 60000
      }
    },
    evaluator: {
      provider: providerInfo.split(':')[0],
      model: providerInfo.split(':')[1],
      rubric: rubric
    }
  };
  
  const yamlStr = yaml.stringify(config);
  fs.writeFileSync(outputPath, yamlStr, 'utf8');
  
  console.log(chalk.green(`\n✅ Synthesized Gauntlet saved to ${outputPath}`));
  console.log(chalk.cyan(`  - Extracted ${robustTrajectory.length} robust trajectory steps.`));
  console.log(chalk.cyan(`  - Synthesized Rubric: "${rubric}"`));
  if (jsonSchema) {
    console.log(chalk.cyan(`  - Extracted JSON schema.`));
  }
}
