<p align="center">
  <img src="assets/tardi-logo.svg" alt="Tardi Logo" width="650" />
</p>

<h1 align="center">Tardi</h1>

<p align="center">
  <strong>Deterministic testing for LLM agents and non-deterministic pipelines.</strong>
</p>

<p align="center">
  <a href="https://npmjs.com/package/@abdur-raheem/tardi"><img src="https://img.shields.io/npm/v/@abdur-raheem/tardi.svg" alt="NPM Version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-ISC-blue.svg" alt="License" /></a>
  <a href="https://github.com/Nyx-abu/tardi/actions"><img src="https://img.shields.io/github/actions/workflow/status/Nyx-abu/tardi/ci.yml?branch=master" alt="Build Status" /></a>
</p>

<p align="center">
  <a href="#about">About</a> •
  <a href="#features">Features</a> •
  <a href="#the-tardi-pipeline">The Pipeline</a> •
  <a href="#installation">Installation</a> •
  <a href="#quickstart">Quickstart</a> •
  <a href="#examples-output">Examples & Output</a>
</p>

---

Tardi is an open-source testing framework engineered specifically for evaluating agentic workflows, autonomous LLM scripts, and non-deterministic applications. 

## About

Testing AI agents presents a unique challenge: traditional testing frameworks cannot evaluate non-deterministic natural language outputs, and raw "LLM-as-a-judge" evaluation pipelines are prohibitively expensive and prone to hallucination at scale.

**Tardi solves this by implementing a tiered assertion gauntlet.** Instead of blindly sending every agent execution trace to an evaluation model, Tardi enforces strict deterministic constraints first. If your agent crashes, hangs in an infinite loop, or returns malformed JSON, Tardi fails the test immediately—preventing unnecessary LLM API calls and accelerating your feedback loop.

## Features

- **Tiered Evaluation Engine:** Catch process crashes, timeouts, and schema mismatches deterministically before triggering expensive LLM judges.
- **Deterministic Prompt Assembly & Token Budgeting:** Automatically enforce token limits when assembling prompts with context, constraints, and dynamic inputs. Avoid context overflow dynamically.
- **Injection Defense Layer:** Built-in semantic and tag-based sanitization automatically neutralizes prompt injection attempts (e.g., users attempting to escape `<user_input>` blocks).
- **Concurrency & Rate-Limiting:** Execute test suites in parallel with intelligent chunking to maximize throughput without exceeding API rate limits.
- **Provider Agnostic:** Built on the standard Vercel AI SDK, Tardi supports hot-swappable evaluation models from OpenAI, Google, Anthropic, and local endpoints.
- **Interactive REPL & Natural Language CLI:** Includes a CLI environment for rapid test synthesis, execution, and debugging, powered by an onboard NLP intent parser.
- **Secure Credential Management:** Safely stores provider API keys in your native OS keychain during local development.

## The Tardi Pipeline

When you execute an iteration, Tardi evaluates the agent's output through a strict, cost-saving pipeline. Deterministic checks always run first.

```mermaid
graph TD
    Start([Run Agent]) --> ProcessCheck{Process Crashed?}
    ProcessCheck -- Yes --> FailCrash[FAIL: CRASH]
    ProcessCheck -- No --> TimeoutCheck{Exceeded Timeout?}
    
    TimeoutCheck -- Yes --> FailTimeout[FAIL: TIMEOUT]
    TimeoutCheck -- No --> RegexCheck{Matches Regex?}
    
    RegexCheck -- No --> FailRegex[FAIL: REGEX_MISMATCH]
    RegexCheck -- Yes --> SchemaCheck{Valid JSON Schema?}
    
    SchemaCheck -- No --> FailSchema[FAIL: SCHEMA_MISMATCH]
    SchemaCheck -- Yes --> LLMJudge{LLM Judge Approves?}
    
    LLMJudge -- No --> FailJudge[FAIL: LLM_JUDGE_FAIL]
    LLMJudge -- Yes --> Pass([PASS])
    
    style FailCrash fill:#fbd4d4,stroke:#f87171,color:#000
    style FailTimeout fill:#fbd4d4,stroke:#f87171,color:#000
    style FailRegex fill:#fbd4d4,stroke:#f87171,color:#000
    style FailSchema fill:#fbd4d4,stroke:#f87171,color:#000
    style FailJudge fill:#fbd4d4,stroke:#f87171,color:#000
    style Pass fill:#dcfce7,stroke:#4ade80,color:#000
```

## Installation

Install the CLI globally via npm to use the `tardi` command anywhere:

```bash
npm install -g @abdur-raheem/tardi
```

## Quickstart

### 1. Auto-Synthesize from a GitHub Repository
Tardi can automatically clone an agent repository, detect its entry point, and synthesize a test gauntlet based on golden runs.

```bash
tardi github https://github.com/Nyx-abu/demo-agent.git
```

<p align="center">
  <img src="assets/demo-github.svg" alt="Tardi Auto-Synthesis" width="800" />
</p>

### 2. Manual Initialization
If you prefer to configure your suite manually:

```bash
tardi init
tardi auth login google
tardi run tests/
```

## Examples & Output

Tardi utilizes simple YAML files (`*.tardi.yaml`) to define test suites. Below are detailed examples of how Tardi behaves under different failure and success conditions.

### Scenario A: Deterministic JSON Schema Validation

A common requirement for AI agents is to return structured JSON. Tardi catches malformed JSON or missing fields *deterministically*, bypassing the LLM Judge entirely.

**Test Configuration:**
```yaml
# tests/json-schema.tardi.yaml
name: Agent JSON Output Test
command: node src/agent.js
iterations: 5
concurrency: 2

assertions:
  jsonSchema:
    type: object
    required: ["status", "result"]
```

**Expected Tardi Output (Schema Mismatch):**
If the agent forgets to include the `result` field, Tardi immediately aborts the pipeline and outputs a schema mismatch error:

```text
 ╭────────────────────────  Tardi Execution Summary  ────────────────────────╮
 │   ┌─────────────┬──────────┐                                              │
 │   │ Metric      │ Value    │                                              │
 │   ├─────────────┼──────────┤                                              │
 │   │ Total Runs  │ 5        │                                              │
 │   │ Passed      │ 4        │                                              │
 │   │ Failed      │ 1        │                                              │
 │   │ Flakiness   │ 20.00%   │                                              │
 │   └─────────────┴──────────┘                                              │
 │                                                                           │
 │   Failures:                                                               │
 │   - Iteration 3 [SCHEMA_MISMATCH]: Output failed JSON Schema validation.  │
 │     Missing required property: 'result'.                                  │
 ╰───────────────────────────────────────────────────────────────────────────╯
```

### Scenario B: Semantic Evaluation with LLM-as-a-Judge

If your agent passes all deterministic constraints, Tardi forwards the raw output to an LLM evaluator. The LLM evaluator uses your custom rubric to score the output.

**Test Configuration:**
```yaml
# tests/evaluator.tardi.yaml
name: Semantic Agent Test
command: node src/summarize.js
iterations: 3

assertions:
  regex: "summary:"

evaluator:
  provider: google
  model: gemini-2.5-flash
  prompt: |
    Evaluate if the agent successfully summarized the input document.
    Return only 'PASS' or 'FAIL'.
```

**Expected Tardi Output (LLM Judge Failure):**

<p align="center">
  <img src="assets/demo-terminal.svg" alt="Tardi Execution Summary" width="800" />
</p>

### Scenario C: Uncaught Exceptions & Process Crashes

When testing complex autonomous scripts, agents often crash mid-execution. Tardi intercepts process crashes and records the exit codes, allowing you to debug stability issues over multiple iterations.

**Expected Tardi Output (Crash):**
```text
 ╭────────────────────────  Tardi Execution Summary  ────────────────────────╮
 │   Failures:                                                               │
 │   - Iteration 2 [CRASH]: Agent process exited with code 1.                │
 │     Stderr: Error: Uncaught exception in src/agent.js:42                  │
 ╰───────────────────────────────────────────────────────────────────────────╯
```

## Enterprise CI/CD & Security

Tardi is built from the ground up for seamless enterprise integration. Whether deploying in a regulated environment or a hyper-scale pipeline, Tardi ensures your tests remain secure and performant.

### Enterprise Features
- **Data Privacy:** Tardi executes strictly within your network perimeter. Deterministic assertions happen locally without data leaving the machine.
- **Secure Secret Management:** Tardi integrates with enterprise secret managers (HashiCorp Vault, AWS Secrets Manager) and detects continuous integration environments automatically, disabling interactive prompts.
- **Audit Logging:** Every test iteration generates a compliant, tamper-proof JSON audit log for regulatory review.
- **SSO Authentication:** Secure CLI access for your engineering team via SAML/OIDC integrations.

### CI/CD Integration
Inject API keys securely via your CI runner environment variables to execute your gauntlets:

```bash
GOOGLE_GENERATIVE_AI_API_KEY="your-key-here" tardi run tests/
```

## Contributing

Pull requests are welcome. For major architectural changes, please open an issue first to discuss your proposed modifications.

Please see our [Contributing Guide](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

This project is licensed under the [ISC License](LICENSE).
