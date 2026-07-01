// Agent 3: Flaky agent — 40% chance of crashing
if (Math.random() < 0.4) {
  console.error("FATAL: Connection to inference server timed out");
  process.exit(1);
}
console.log(JSON.stringify({ status: "success", result: "Task completed", latency_ms: Math.floor(Math.random() * 500) }));
