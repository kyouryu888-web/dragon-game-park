import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const contentFile = resolve(root, 'src/features/englishQuest/englishQuestContent.ts');
const targetDir = resolve(root, 'public/audio/englishQuest');
const tempSource = resolve(targetDir, '.audio-source.json');
const python = process.env.ENGLISH_QUEST_PYTHON || 'python';

const source = readFileSync(contentFile, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('exports', 'module', compiled)(module.exports, module);

const entries = module.exports.ENGLISH_QUEST_ITEMS.map((item) => ({
  itemId: item.id,
  transcript: item.audioText,
  asset: item.audioAsset,
}));

mkdirSync(dirname(tempSource), { recursive: true });
writeFileSync(tempSource, JSON.stringify(entries, null, 2), 'utf8');
const result = spawnSync(
  python,
  [resolve(root, 'scripts/generate_english_quest_audio.py'), '--source', tempSource, '--output', targetDir],
  { stdio: 'inherit' },
);
rmSync(tempSource, { force: true });
process.exit(result.status ?? 1);
