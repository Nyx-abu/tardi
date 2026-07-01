<p align="center">
<pre>
                                                            
                                                            
                                                            
                                                            
                                                            
                                                            
                                                            
                                                            
                                                            
                                                            
                                                            
                                                            
                                                            
                                47-                         
                     =*********1  :***                      
                   @*2     *9       ***0b$***               
                  *;      *       **         *:             
               1**       *       *            **            
             **=*       W-                     *5   ?!      
            *   *       *       ***@            *b***       
          :*   *       *        =******5       ******       
          *    *       *         8*********:****#***        
         *    8        W          ****$*********#**         
        *     *       *            **@#********$***         
        *     *       *       *     ***********#***         
       *      *       *       *      *******0****#b         
       *      *       *       *       **    *8 ** _b        
       *      8       *       *            a** *  0         
      ::      8       *        *         @  *# *  *         
      *       *       *        *         6**W**   *         
      *       *       *         *            *   *          
      *       *       *         c*          a   b*          
      *                                        **           
      !,                             -       6**            
       *                              ******* 25            
       *       *        *                     *             
       2!  *   *        *                    *W-            
        *   *   *        **                 *  #            
        *   84  *         *       =        *   *            
        *    #* *         *       *      **    #            
        *      **      *  *       *   ***     2             
        @      **      *  *0      ***4* *     *             
         *    *  *     *?W**      *   *  *    *             
         :*  **  *    W* **@1    @* =**  ** !**             
           ****   *= **#*** *1   *7****   *****             
           * :     ****      7****_a       c*               
                   , *        ***                           
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
