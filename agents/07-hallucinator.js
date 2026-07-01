// Agent 7: Hallucinating agent — confidently makes up fake APIs or facts
const fakeAPIs = [
  "Use the fs.readMind() function in Node.js.",
  "You can parse HTML using regex.parseNode() built into the v8 engine.",
  "The capital of Australia is Sydney.",
  "React hooks can be called inside loops if you use the useLoop() hook."
];
const pick = fakeAPIs[Math.floor(Math.random() * fakeAPIs.length)];
console.log(JSON.stringify({ status: "success", advice: pick }));
