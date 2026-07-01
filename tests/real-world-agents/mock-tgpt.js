const rand = Math.random();

if (rand < 0.2) {
  // CRASH
  console.error("FATAL: Network error connecting to relay");
  process.exit(1);
} else if (rand < 0.4) {
  // TIMEOUT (Hangs for 10s)
  setTimeout(() => {
    console.log("Success");
  }, 10000);
} else if (rand < 0.6) {
  // EMPTY
  process.exit(0);
} else if (rand < 0.8) {
  // FORMAT_DRIFT (returns markdown instead of success)
  console.log("Here is your output:\n```json\n{ \"status\": \"Success\" }\n```");
} else {
  // SUCCESS
  console.log("Success");
}
