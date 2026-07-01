// A dummy agent that simulates non-deterministic behavior.
// Sometimes it outputs a valid JSON greeting, sometimes it hallucinates.

const isSuccess = Math.random() > 0.3; // 70% success rate

setTimeout(() => {
  if (isSuccess) {
    console.log(JSON.stringify({ greeting: "Hello world!", status: "success" }));
  } else {
    console.log("I am an AI and I decided to write a poem instead of JSON. The sky is blue.");
  }
}, Math.random() * 500);
