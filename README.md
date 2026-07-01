<p align="center">
<pre>
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;ii11ttttfffftt;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;iittffffLLLLffLLfftttttt;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;iittLLLLCCCCCCffGGff11tttt;;iiii;;;;;;;;;;;;;;;;;;
;;;;;;;;iiiittLLffffLLffttttttfftt11iittfffffftt11;;;;;;;;;;
;;;;;;;;ii;;iittffffttttttffffttfftttttt1111111111;;;;;;;;;;
;;;;;;;;iittttfftttttttttt1111111111tttttttttttttt11;;;;;;;;
;;;;;;;;ii11tttt111111iiiiii11tt1111tt11tt1111tttt11;;;;;;;;
;;;;;;;;111111ii11iiiiiiiiii11111111ttfftttttt11tt11ii;;;;;;
;;;;;;;;ii1111ii111111iiiiii11111111ttffffttff11tt11iiii;;;;
;;;;;;;;111111ii1111iiii;;tt111111tt1111tttttt11tt11;;ii;;;;
;;;;;;;;111111iiiiiiiiiiii11LLCCfffftttttt1111tttt11;;ii;;;;
;;;;;;iiii1111ii11ii1111iittLLLLLLffttttffttfftttt11;;ii;;;;
;;;;;;11ii1111ii11iiii111111tt1111ttLLLLtttttttttt11iiii;;;;
;;;;iiii;;111111tttttt1111LLttffffffffCCLLii111111iiiiii;;;;
;;;;iiii;;ii1111ii111111ttffffffffffLLLLCCttttfftt11iiii;;;;
;;;;;;11ii11ttttttttttttffffLLffffLLffffCCffttff1111ii;;;;;;
;;;;;;1111tttt11tttttt1111ttffffLLffttffffLLttttii11ii;;;;;;
;;;;;;;;1111iitttttttttttttt11ffttffffffffLL11111111ii;;;;;;
;;;;;;;;iiiiii11ttffffffffttffttttffttffffff;;111111ii;;;;;;
;;;;;;;;ii11iiiiiiiittffffffttfffffftttttttt;;111111ii;;;;;;
;;;;;;;;iifftt11ii11iiii11ttfffftt1111fftt11ii111111ii;;;;;;
;;;;;;;;ii111111ii11111111iiii11iiiittttttttii111111ii;;;;;;
;;;;;;iiii111111ii1111ii11111111iiiiii1111;;iiiiiiiiii;;;;;;
;;;;;;iiii11iiiiii1111111111ii1111iiii11iiiiiiii11ii;;;;;;;;
;;;;;;;;;;;;11111111iiiiii11111111iiii11ii;;;;ii;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;ii1111ii;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
</pre>
</p>

<h1 align="center">Tardi 🦠</h1>

<p align="center">
  <strong>The Enterprise-Grade CLI Testing Framework for Non-Deterministic AI Agents</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quickstart">Quickstart</a> •
  <a href="#writing-tests">Writing Tests</a> •
  <a href="#evaluation-pipeline">Evaluation</a>
</p>

---

Tardi is a robust, concurrent, and highly deterministic testing framework designed specifically to test the un-testable: non-deterministic AI agents and scripts. 

Instead of relying *only* on expensive, hallucination-prone LLM judges to evaluate your agents, Tardi employs a **multi-tiered evaluation pipeline**. It handles process crashes, timeouts, rigid regex/JSON structural assertions, and uses Vercel AI SDK to gracefully fall back to an LLM-as-a-judge as a last resort.

## ✨ Features

- **Multi-Tiered Evaluation:** Validate outputs via deterministic regex, strict JSON schema validation, and finally an LLM judge. Don't waste API quota on agents that return malformed JSON.
- **Resilience & Process Isolation:** Automatically catches process crashes (`[CRASH]`), infinite loops, and hangs (`[TIMEOUT]`).
- **Concurrent & Rate-Limit Aware:** Test agents in parallel across iterations with intelligent chunking (`p-limit`) to prevent catastrophic API rate limits.
- **Secure Keychain Storage:** Store LLM provider API keys securely in the OS keychain via `keytar`. No more committing plaintext keys!
- **Zero-Friction DevX:** Beautiful, interactive CLI prompts using `@clack/prompts` that safely downgrade in CI/CD environments.
- **Provider Agnostic:** Uses the standard Vercel AI SDK to support hot-swappable providers (Google Gemini, OpenAI, Anthropic) for the judge LLM.

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

## 📝 Writing Tests

Tardi uses simple YAML files (`*.tardi.yaml`) to define test suites. You can specify concurrency, iterations, process timeouts, and a multi-layered assertion stack.

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

## 🧠 The Evaluation Pipeline

When you run an iteration, Tardi evaluates the agent's stdout/stderr in this strict order:

1. **Process Level:** Did the agent crash (exit code != 0)? `-> FAIL [CRASH]`
2. **Timeout Level:** Did the agent exceed `timeoutMs`? `-> FAIL [TIMEOUT]`
3. **Regex Assertions:** Does the output match the expected regex? `-> FAIL [REGEX_MISMATCH]`
4. **JSON Schema:** Is the output valid JSON matching the schema? `-> FAIL [SCHEMA_MISMATCH]`
5. **LLM Judge:** Only if all above pass, query the judge model. `-> PASS or FAIL [LLM_JUDGE_FAIL]`

## 🔒 CI/CD Usage

Tardi detects CI environments automatically and disables interactive prompts. Instead of keychain storage, you can directly inject API keys via environment variables for your pipeline:

```bash
GOOGLE_GENERATIVE_AI_API_KEY="your-key-here" tardi run tests/
```

## 🛠 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

1. Clone the repository
2. Run `npm install`
3. Run `npm run build`
4. Test locally using `node dist/index.js run tests/`

---
*Built with ❤️ for AI Engineers.*
