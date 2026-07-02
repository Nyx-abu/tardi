import { describe, it, expect } from 'vitest';
import { AgentTestSchema } from './schema';

describe('AgentTestSchema', () => {
  it('should validate a correct configuration', () => {
    const validConfig = {
      name: 'Test Agent',
      agentCommand: 'node agent.js',
      iterations: 5,
      concurrency: 2,
      timeoutMs: 10000,
      assertions: {
        regex: 'success',
      },
      evaluator: {
        provider: 'google',
        model: 'gemini-2.5-flash',
        rubric: 'Must be correct.',
      },
    };

    const parsed = AgentTestSchema.safeParse(validConfig);
    expect(parsed.success).toBe(true);
  });

  it('should fill in defaults for missing optional fields', () => {
    const minimalConfig = {
      name: 'Minimal',
      agentCommand: 'node min.js',
    };

    const parsed = AgentTestSchema.safeParse(minimalConfig);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.iterations).toBe(10);
      expect(parsed.data.concurrency).toBe(5);
      expect(parsed.data.timeoutMs).toBe(30000);
    }
  });

  it('should reject invalid iterations', () => {
    const invalidConfig = {
      name: 'Test',
      agentCommand: 'node test.js',
      iterations: -1, // invalid
    };

    const parsed = AgentTestSchema.safeParse(invalidConfig);
    expect(parsed.success).toBe(false);
  });
});
