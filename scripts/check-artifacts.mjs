// Gate de artefatos: confere PRD, estado e pastas das features contra as regras do processo.
import { readFileSync, existsSync } from 'node:fs';

const errors = [];
const read = (p) => readFileSync(p, 'utf8');

const prd = read('docs/PRD.md');
for (let i = 1; i <= 13; i++) {
  const rule = `R${String(i).padStart(2, '0')}`;
  if (!prd.includes(rule)) errors.push(`PRD não cita ${rule}`);
}
for (const section of ['## 7. Fora de escopo', '## 8. Grafo de dependências', '## 9. Critérios de aceite', 'Cross-Feature Integration']) {
  if (!prd.includes(section)) errors.push(`PRD sem seção "${section}"`);
}

const state = JSON.parse(read('docs/state.json'));
const ids = Object.keys(state.features);
if (ids.length < 5) errors.push(`PRD/estado com ${ids.length} features (mínimo 5)`);

for (const id of ids) {
  const f = state.features[id];
  if (f.status === 'pending') continue;
  for (const doc of ['spec.md', 'plan.md', 'contract.md']) {
    if (!existsSync(`${f.folder}/${doc}`)) errors.push(`${id}: falta ${f.folder}/${doc}`);
  }
  if (f.report_path && !existsSync(f.report_path)) errors.push(`${id}: report_path inexistente ${f.report_path}`);
  if (f.status === 'done' && !f.report_path) errors.push(`${id}: done sem report_path`);
  const contractPath = `${f.folder}/contract.md`;
  if (existsSync(contractPath)) {
    const contract = read(contractPath);
    const owned = [...prd.matchAll(new RegExp(String.raw`\*\*(AC-${id}-\d+)\*\*`, 'g'))].map((m) => m[1]);
    const crossOwned = [...prd.matchAll(new RegExp(String.raw`\*\*(X\d+) \([^)]*\)\*\*[^\n]*\[contrato ${id}\]`, 'g'))].map((m) => m[1]);
    for (const ac of [...owned, ...crossOwned]) {
      if (!contract.includes(ac)) errors.push(`${id}: contrato não mapeia ${ac}`);
    }
  }
}

if (errors.length) {
  console.error('check-artifacts: FALHOU');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log(`check-artifacts: OK (${ids.length} features, R01–R13 citadas no PRD)`);
