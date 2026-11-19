import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
import { parse } from 'yaml';

const source = new URL('../../../Rhythm_Biome_Codex_Planning_Pack_v0.4/18_OPENAPI.yaml', import.meta.url);
const spec = parse(await readFile(source, 'utf8'));
const implementedPaths = [
  '/v1/me', '/v1/me/bootstrap', '/v1/me/consents', '/v1/me/logs/{local_date}', '/v1/me/progress',
  '/v1/catalog/tests', '/v1/catalog/tests/{id}', '/v1/catalog/products', '/v1/catalog/products/{slug}',
];
const schemas = {};

function collect(node) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.$ref === 'string') {
    const name = node.$ref.match(/^#\/components\/schemas\/([^/]+)$/)?.[1];
    if (!name || !spec.components.schemas[name]) throw new Error(`Unresolved contract reference: ${node.$ref}`);
    if (name in schemas) return;
    schemas[name] = spec.components.schemas[name];
    collect(schemas[name]);
    return;
  }
  for (const child of Object.values(node)) collect(child);
}

const paths = Object.fromEntries(implementedPaths.map(path => {
  if (!spec.paths[path]) throw new Error(`Missing path: ${path}`);
  return [path, spec.paths[path]];
}));
collect(paths);
const output = new URL('../src/schema.ts', import.meta.url);
const result = '// Generated from the OpenAPI contract. Run npm run contract:generate -w @rb/api-client.\n' +
  astToString(await openapiTS({ openapi: spec.openapi, info: spec.info, paths, components: { schemas } }));
if (process.argv.includes('--check')) {
  if (result !== await readFile(output, 'utf8')) throw new Error('Generated client types are stale.');
} else {
  await writeFile(output, result);
}
