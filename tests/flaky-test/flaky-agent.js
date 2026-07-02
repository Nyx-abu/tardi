const r = Math.random();

if (r < 0.2) {
  // 20% chance to crash
  console.error("Fatal error: connection lost");
  process.exit(1);
} else if (r < 0.5) {
  // 30% chance to skip read_file
  console.log("thought: searching for file");
  console.log("call: search");
  console.log("thought: found it, let's just write to it");
  console.log("call: write_file");
  console.log('{"status": "success"}');
} else {
  // 50% chance to do it perfectly
  console.log("thought: searching for file");
  console.log("call: search");
  console.log("thought: reading file to get context");
  console.log("call: read_file");
  console.log("thought: making edits");
  console.log("call: write_file");
  console.log('{"status": "success"}');
}
