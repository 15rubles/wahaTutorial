// Checks that every ruleRefs id used by the engine and the lessons exists in a rules.json.
// Usage: npm run rules:check            (your local cache, data-cache/normalized)
//        npm run rules:check -- --fixture (the invented fixture rules; only reports, never fails)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { engineRuleRefs } from '../packages/engine/src/index.js';
import { LESSONS, demoLesson } from '../packages/tutorial/src/index.js';

const fixture = process.argv.includes('--fixture');
const file = resolve(
  import.meta.dirname,
  '..',
  fixture ? 'fixtures/normalized/rules.json' : 'data-cache/normalized/rules.json',
);
interface Node {
  id: string;
  children: Node[];
}
let roots: Node[];
try {
  roots = JSON.parse(readFileSync(file, 'utf8')) as Node[];
} catch {
  console.error(`Cannot read ${file}. Run npm run data:sync and npm run data:build first.`);
  process.exit(2);
}
const ids = new Set<string>();
const walk = (n: Node) => {
  ids.add(n.id);
  n.children.forEach(walk);
};
roots.forEach(walk);

const refs: [string, string][] = [
  ...Object.entries(engineRuleRefs).flatMap(([where, list]) =>
    list.map((r) => [`engine/${where}`, r] as [string, string]),
  ),
  ...[...LESSONS, demoLesson].flatMap((l) =>
    l.steps.flatMap((s) =>
      s.ruleRefs.map((r) => [`lesson/${l.id}/${s.id}`, r] as [string, string]),
    ),
  ),
];
const missing = refs.filter(([, r]) => !ids.has(r));
console.log(
  `${refs.length} rule references checked against ${ids.size} sections in ${fixture ? 'fixture' : 'local cache'}.`,
);
for (const [where, r] of missing) console.log(`  missing: ${r} (${where})`);
if (missing.length === 0) console.log('All references resolve.');
process.exit(missing.length > 0 && !fixture ? 1 : 0);
