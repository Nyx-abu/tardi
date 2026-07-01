// Agent 5: Markdown + JSON leaker — outputs JSON inside markdown blocks
console.log(`Here is the result of your query:

\`\`\`json
{
  "sql_query": "SELECT * FROM users WHERE active = true;",
  "explain": "Fetches all active users from the database."
}
\`\`\`

Hope this helps!`);
