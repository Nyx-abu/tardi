// Agent 1: Deterministic JSON — always returns the same structured JSON
console.log(JSON.stringify({
  status: "success",
  answer: "The capital of France is Paris.",
  confidence: 0.98,
  sources: ["wikipedia.org"]
}));
