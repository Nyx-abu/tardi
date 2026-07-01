// Simulates a real-world agent that calls an API and returns structured JSON.
// Failure modes:
//   - Sometimes returns valid JSON
//   - Sometimes returns JSON with missing fields
//   - Sometimes returns raw text instead of JSON
//   - Sometimes returns partial/truncated JSON (stream cut off)
//   - Sometimes takes too long (timeout simulation)

const roll = Math.random();
const prompt = process.argv[2] || "What is the capital of France?";

function respond() {
  if (roll < 0.35) {
    // GOOD: Well-formed structured output
    console.log(JSON.stringify({
      answer: "The capital of France is Paris.",
      confidence: 0.97,
      sources: ["wikipedia.org/wiki/Paris"],
      metadata: { model: "gpt-4", tokens_used: 42 }
    }));
  } else if (roll < 0.50) {
    // BAD: Missing required fields (schema drift)
    console.log(JSON.stringify({
      answer: "Paris is the capital.",
      // missing: confidence, sources, metadata
    }));
  } else if (roll < 0.65) {
    // BAD: Returns markdown instead of JSON (format hallucination)
    console.log(`## Answer\n\nThe capital of France is **Paris**.\n\n### Sources\n- Wikipedia`);
  } else if (roll < 0.75) {
    // BAD: Truncated JSON (simulates stream cut-off)
    console.log(`{"answer": "The capital of France is Paris.", "confidence": 0.`);
  } else if (roll < 0.85) {
    // BAD: Writes to stderr (agent internal error leak)
    console.error("[WARN] Rate limit approaching, retrying in 2s...");
    console.log(JSON.stringify({ answer: "Paris", confidence: 0.85, sources: [], metadata: {} }));
  } else if (roll < 0.92) {
    // BAD: Returns nothing (empty stdout)
    // agent silently fails
  } else {
    // BAD: Crashes with a non-zero exit code
    console.error("FATAL: OpenAI API key not found. Set OPENAI_API_KEY.");
    process.exit(1);
  }
}

// Simulate real latency (50ms to 3s)
const latency = Math.floor(Math.random() * 2950) + 50;
setTimeout(respond, latency);
