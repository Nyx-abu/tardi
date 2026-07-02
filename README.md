<p align="center">
  <img src="assets/tardi-logo.svg" alt="Tardi Logo" width="650" />
</p>

<h1 align="center">Tardi 🦠</h1>

<p align="center">
  <strong>Bulletproof testing for AI agents.</strong>
</p>

<p align="center">
  <a href="https://npmjs.com/package/tardi-cli"><img src="https://img.shields.io/npm/v/tardi-cli.svg" alt="NPM Version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-ISC-blue.svg" alt="License" /></a>
  <a href="https://github.com/Nyx-abu/tardi/actions"><img src="https://img.shields.io/github/actions/workflow/status/Nyx-abu/tardi/ci.yml?branch=master" alt="Build Status" /></a>
  <a href="#community"><img src="https://img.shields.io/badge/Discord-Join_Community-7289da.svg?logo=discord" alt="Discord Community" /></a>
</p>

<p align="center">
  <a href="#why-tardi">Why Tardi?</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quickstart">Quickstart</a> •
  <a href="#writing-tests">Writing Tests</a> •
  <a href="#evaluation-pipeline">Evaluation</a>
</p>

---

Tardi is a robust, concurrent, and highly deterministic testing framework designed specifically to test the un-testable: non-deterministic AI agents and scripts. 

## ❓ Why Tardi?

When testing AI agents, traditional testing frameworks fall short, and raw LLM-as-a-judge approaches are dangerously expensive. 

**Tardi is designed to save your API quota and catch complete meltdowns.** Instead of blindly sending every agent output to a hallucination-prone LLM judge, Tardi enforces a strict gauntlet. If your agent crashes, gets stuck in an infinite loop, or returns malformed JSON, Tardi fails the test *immediately* without burning a single token on your evaluation model.

## ✨ Features

- 💸 **Save API Costs:** Catch crashes, timeouts, and malformed JSON *before* triggering expensive LLM judges.
- ⚡️ **Concurrency & Rate-Limit Aware:** Test agents in parallel with intelligent chunking (`p-limit`) to prevent catastrophic API rate limits.
- 🛡️ **Bulletproof Resilience:** Built-in process isolation automatically handles infinite loops, hangs (`[TIMEOUT]`), and crashes (`[CRASH]`).
- 🔒 **Secure Keychain Storage:** Store LLM provider API keys securely in the OS keychain via `keytar`. No more committing plaintext keys!
- 🎨 **Zero-Friction DevX:** Beautiful, interactive CLI prompts using `@clack/prompts` that safely downgrade in CI/CD environments.
- 🔌 **Provider Agnostic:** Uses the standard Vercel AI SDK to support hot-swappable providers (Google Gemini, OpenAI, Anthropic) for the judge LLM.

## 📦 Installation

```bash
npm install -g tardi-cli
```

## 🚀 Quickstart

1. **Initialize Tardi in your repository:**
   ```bash
   tardi init
   ```
   This will create a `tardi.yaml` configuration file and prompt you to set up your preferred evaluation provider.

2. **Authenticate with a provider (e.g., Google or OpenAI):**
   ```bash
   tardi auth login google
   ```
   Tardi securely stores your API key using your native OS keychain.

3. **Run your agent test suites:**
   ```bash
   tardi run tests/
   ```

### Beautiful CLI Output
Tardi leverages `@clack/prompts` and `cli-table3` to give you gorgeous, easy-to-read reports right in your terminal:
```text
📝 Suite: tests\10-sycophant.tardi.yaml
✓ Passed: 4 | ✗ Failed: 1
```

## 📝 Writing Tests

Tardi uses simple YAML files (`*.tardi.yaml`) to define test suites. You can specify concurrency, iterations, process timeouts, and a multi-layered assertion stack.

<details>
<summary><strong>Click to view an example configuration</strong></summary>

```yaml
# tests/example.tardi.yaml
name: Agent JSON Output Test
command: node path/to/your/agent.js
iterations: 5
concurrency: 2
timeoutMs: 3000

# 1. Deterministic assertions run first
assertions:
  jsonSchema:
    type: object
    required: ["status", "result"]
  regex: "\"status\":\\s*\"(success|failure)\""

# 2. LLM Judge runs last (only if deterministic tests pass)
evaluator:
  provider: google
  model: gemini-2.5-flash
  prompt: |
    Evaluate if the agent successfully summarized the input document.
    Return only 'PASS' or 'FAIL'.
```
</details>

## 🧠 The Evaluation Pipeline

When you run an iteration, Tardi evaluates the agent's stdout/stderr in a strict, cost-saving order:

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

## 🔒 CI/CD Usage

Tardi detects CI environments automatically and disables interactive prompts. Instead of keychain storage, you can directly inject API keys via environment variables for your pipeline:

```bash
GOOGLE_GENERATIVE_AI_API_KEY="your-key-here" tardi run tests/
```

## 🛠 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change. 

Please see our [Contributing Guide](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## 💬 Community

Have questions or need help setting up Tardi? 
- Join our community on [Discord](#)
- Open a [Discussion](https://github.com/Nyx-abu/tardi/discussions) on GitHub

## 📄 License

This project is licensed under the [ISC License](LICENSE).

---
*Survives anything. Just like a Tardigrade.*
