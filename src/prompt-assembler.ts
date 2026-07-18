import * as fs from 'fs';
import * as path from 'path';

export interface PromptComponents {
  context?: string;
  constraints?: string;
  task: string;
  examples?: string;
  user_input: string;
}

export class PromptAssembler {
  private basePromptTemplate: string;
  private readonly maxTokens: number;

  constructor(maxTokens: number = 8000, templateName: string = 'base_prompt.md') {
    this.maxTokens = maxTokens;
    const templatePath = path.join(__dirname, '..', 'prompts', templateName);
    this.basePromptTemplate = fs.readFileSync(templatePath, 'utf8');
  }

  /**
   * Sanitizes user input to prevent prompt injection.
   * Basic injection defense layer (Task 10).
   */
  private sanitizeInput(input: string): string {
    // Strip XML tags that might try to close the <user_input> or inject new sections
    return input.replace(/<(\/?)([a-zA-Z0-9_]+)(?:\s+[^>]+)?>/g, (match, slash, tag) => {
      // Allow benign elements if needed, but for strict defense, strip all XML-like tags
      return `&lt;${slash}${tag}&gt;`;
    });
  }

  public assemble(components: PromptComponents): string {
    let assembled = this.basePromptTemplate;
    
    assembled = assembled.replace('{{context}}', components.context || 'No specific context provided.');
    assembled = assembled.replace('{{constraints}}', components.constraints || 'No constraints.');
    assembled = assembled.replace('{{task}}', components.task);
    assembled = assembled.replace('{{examples}}', components.examples || 'No examples provided.');
    
    const sanitizedInput = this.sanitizeInput(components.user_input);
    assembled = assembled.replace('{{user_input}}', sanitizedInput);

    // Simple rough token check (Task 8: Token budget management)
    // 1 token ~= 4 chars roughly
    const estimatedTokens = assembled.length / 4;
    if (estimatedTokens > this.maxTokens) {
      throw new Error(`Assembled prompt exceeds token budget: ${estimatedTokens} > ${this.maxTokens}`);
    }

    return assembled;
  }
}
