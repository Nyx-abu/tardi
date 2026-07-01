// Agent 9: Conversational chat agent — outputs freeform text with varied greetings
const greetings = ["Hi there!", "Hello!", "Greetings human.", "Hey!"];
const val = greetings[Math.floor(Math.random() * greetings.length)];
console.log(`${val} I can help you with that. The answer is 42. Let me know if you need anything else.`);
