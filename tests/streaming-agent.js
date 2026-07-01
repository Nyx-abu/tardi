// Simulates a multi-turn conversational agent that streams output line-by-line.
// This tests whether agent-harness can handle:
//   - Multi-line stdout (not just single-line JSON)
//   - Streaming/chunked output
//   - Thinking tokens mixed with final answer
//   - Tool-call traces in the output

const roll = Math.random();

async function stream(text, delayMs = 50) {
  const lines = text.split('\n');
  for (const line of lines) {
    process.stdout.write(line + '\n');
    await new Promise(r => setTimeout(r, delayMs));
  }
}

async function run() {
  if (roll < 0.4) {
    // GOOD: Clean agent with thinking trace + final answer
    await stream(`[thinking] Let me look up the weather API...
[tool_call] get_weather(location="London")
[tool_result] {"temp": 15, "condition": "cloudy"}
[final_answer] The weather in London is 15°C and cloudy.`);
  } else if (roll < 0.6) {
    // BAD: Agent gets stuck in a tool-call loop
    await stream(`[thinking] I need to check the database...
[tool_call] query_db(sql="SELECT * FROM users")
[tool_result] timeout after 30s
[thinking] Let me try again...
[tool_call] query_db(sql="SELECT * FROM users")
[tool_result] timeout after 30s
[thinking] One more time...
[tool_call] query_db(sql="SELECT * FROM users")
[tool_result] timeout after 30s
[error] Max retries exceeded. No final answer produced.`);
  } else if (roll < 0.8) {
    // BAD: Agent produces thinking tokens but no final answer
    await stream(`[thinking] The user wants me to summarize the document...
[thinking] I should first identify the key themes...
[thinking] The main theme appears to be about climate change...
[thinking] Let me structure my response...`);
    // No [final_answer] ever emitted
  } else {
    // BAD: Agent outputs an interleaved mess (stderr + stdout race)
    process.stderr.write("[debug] Loading model weights...\n");
    await stream(`[thinking] Processing request...`);
    process.stderr.write("[debug] GPU memory: 4.2GB / 8GB\n");
    await stream(`[final_answer] Here is your summary of the document.`);
  }
}

run();
