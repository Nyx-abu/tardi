// Agent 2: Non-deterministic text — simulates LLM randomness
const answers = [
  "The mitochondria is the powerhouse of the cell.",
  "Mitochondria are organelles that generate energy (ATP) for cells.",
  "The mitochondrion serves as the cell's energy factory, producing ATP through oxidative phosphorylation.",
  "In biology, mitochondria produce ATP — the cell's energy currency.",
  "Mitochondria: the powerhouse organelle responsible for cellular respiration and ATP synthesis."
];
const pick = answers[Math.floor(Math.random() * answers.length)];
console.log(JSON.stringify({ answer: pick, model: "sim-gpt-4" }));
