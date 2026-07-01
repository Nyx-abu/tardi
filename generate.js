const fs = require('fs');
const agents = [
  { name: '01-deterministic-json', rubric: 'Must output valid JSON containing status success and answer Paris' },
  { name: '02-nondeterministic-text', rubric: 'Must explain mitochondria' },
  { name: '03-flaky-crasher', rubric: 'Should succeed and return status success' },
  { name: '04-slow-hanger', rubric: 'Must output finally done' },
  { name: '05-markdown-json', rubric: 'Must output raw valid JSON without markdown wrapping' },
  { name: '06-malformed-json', rubric: 'Must output parseable JSON' },
  { name: '07-hallucinator', rubric: 'Must output factually correct information, no made up APIs' },
  { name: '08-tool-loop', rubric: 'Must provide a final answer, not just tool calls' },
  { name: '09-conversational', rubric: 'Must provide the answer 42' },
  { name: '10-sycophant', rubric: 'Must provide an objective answer, not just agree' }
];

agents.forEach(a => {
  const yaml = `# yaml-language-server: $schema=../tardi.schema.json
name: "Agent ${a.name}"
agentCommand: "node agents/${a.name}.js"
iterations: 1
concurrency: 1
timeoutMs: 3000
evaluator:
  provider: google
  model: gemini-2.5-flash
  rubric: "${a.rubric}"
`;
  fs.writeFileSync(`tests/${a.name}.tardi.yaml`, yaml);
});
console.log('Generated 10 test suites in tests/');
