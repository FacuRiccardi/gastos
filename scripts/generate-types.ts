import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';
import { writeFileSync } from 'node:fs';
import { buildApp } from '../src/http/app.js';
import type { Repositories } from '../src/http/types.js';

const app = buildApp({} as unknown as Repositories);
await app.ready();

const spec = app.swagger();
const ast = await openapiTS(spec as Parameters<typeof openapiTS>[0]);
const output = astToString(ast);

const outPath = new URL('../src/http/api-types.ts', import.meta.url);
writeFileSync(outPath, `${COMMENT_HEADER}${output}`);

await app.close();
console.log('Generated src/http/api-types.ts');
