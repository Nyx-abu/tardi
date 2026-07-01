import { zodToJsonSchema } from 'zod-to-json-schema';
import { AgentTestSchema } from './schema';
import * as fs from 'fs';
import * as path from 'path';

const schema = zodToJsonSchema(AgentTestSchema as any, 'TardiTestSuite');
const outputPath = path.resolve(__dirname, '../tardi.schema.json');

fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2));
console.log(`Generated JSON Schema at ${outputPath}`);
