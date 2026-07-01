// Agent 4: Slow agent — hangs for 8 seconds (should trigger timeout at 3s)
setTimeout(() => {
  console.log(JSON.stringify({ status: "success", result: "Finally done" }));
}, 8000);
