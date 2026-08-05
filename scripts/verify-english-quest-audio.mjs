import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const contentFile = resolve(root, 'src/features/englishQuest/englishQuestContent.ts');
const audioDir = resolve(root, 'public/audio/englishQuest');
const manifestFile = resolve(audioDir, 'manifest.json');
const source = readFileSync(contentFile, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('exports', 'module', compiled)(module.exports, module);

const items = module.exports.ENGLISH_QUEST_ITEMS;
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
const errors = [];

if (!Array.isArray(manifest)) errors.push('manifest.json must contain an array');
const entries = Array.isArray(manifest) ? manifest : [];
if (entries.length !== items.length) errors.push(`manifest count ${entries.length} does not match ${items.length} learning items`);

const itemById = new Map(items.map((item) => [item.id, item]));
const seen = new Set();
for (const entry of entries) {
  const item = itemById.get(entry.itemId);
  if (!item) {
    errors.push(`unknown itemId: ${entry.itemId}`);
    continue;
  }
  if (seen.has(entry.itemId)) errors.push(`duplicate itemId: ${entry.itemId}`);
  seen.add(entry.itemId);
  if (entry.transcript !== item.audioText) errors.push(`${entry.itemId}: transcript mismatch`);
  if (entry.asset !== item.audioAsset) errors.push(`${entry.itemId}: asset mismatch`);
  if (entry.voice !== 'af_heart') errors.push(`${entry.itemId}: unexpected voice`);
  if (entry.model !== 'hexgrad/Kokoro-82M' || entry.generatorVersion !== '0.9.4') errors.push(`${entry.itemId}: generator metadata mismatch`);
  if (entry.sampleRate !== 24000 || entry.bitrateKbps !== 64) errors.push(`${entry.itemId}: encoding metadata mismatch`);
  if (!(entry.durationSeconds > 0 && entry.durationSeconds < 30)) errors.push(`${entry.itemId}: invalid duration`);
  if (!(entry.rmsDbfs <= -18 && entry.rmsDbfs >= -26)) errors.push(`${entry.itemId}: RMS outside safe range`);
  if (!(entry.peakDbfs <= -0.9 && entry.peakDbfs >= -12)) errors.push(`${entry.itemId}: peak outside safe range`);
  if (!/^[a-f0-9]{64}$/.test(entry.sha256)) errors.push(`${entry.itemId}: invalid SHA-256`);

  const file = resolve(audioDir, `${entry.itemId}.mp3`);
  if (!existsSync(file)) {
    errors.push(`${entry.itemId}: MP3 is missing`);
    continue;
  }
  if (statSync(file).size < 1000) errors.push(`${entry.itemId}: MP3 is unexpectedly small`);
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (hash !== entry.sha256) errors.push(`${entry.itemId}: hash mismatch`);
}

for (const item of items) {
  if (!seen.has(item.id)) errors.push(`${item.id}: manifest entry is missing`);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`Verified ${entries.length} Kokoro audio files and hashes.`);
