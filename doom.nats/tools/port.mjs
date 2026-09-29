// port.mjs — faithful 1.20.1 -> 1.21.6 port of suso.nats
//   original/suso.nats/  ->  ported/suso.nats/
// Fixes: directory singularisation, pack_format 80, minecraft:grass -> short_grass,
//        dangling basalt_deltas function reference, entity/item NBT rewrite.
import fs from 'node:fs';
import path from 'node:path';
import { parse, serialize, tokenize } from './lib/snbt.mjs';
import { rewriteEntityNbt } from './rules/nbt-1.21.mjs';
import { applyExternalTagFallback } from './lib/exttag.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'original', 'suso.nats');
const DST = path.join(ROOT, '..', 'ported', 'suso.nats');

const renameDir = (p) => p
  .replace(/(^|\/)functions(\/|$)/g, '$1function$2')
  .replace(/(^|\/)predicates(\/|$)/g, '$1predicate$2')
  .replace(/(^|\/)tags\/blocks(\/|$)/g, '$1tags/block$2')
  .replace(/(^|\/)tags\/functions(\/|$)/g, '$1tags/function$2');

const counters = { files: 0, lines: 0, summon: 0, items: 0, effects: 0, attrs: 0, equip: 0, dropc: 0, components: 0, fixes: [] };

const walkFiles = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walkFiles(p, out) : out.push(p); } return out; };

// ---- tag value fix ----
const BLOCK_RENAME = { 'minecraft:grass': 'minecraft:short_grass' };

// ---- function id fixes (dangling references in the upstream pack) ----
const FN_FIX = [
  ['suso.nats:spawn/ground/basalt_deltas', 'suso.nats:spawn/ground/dark_basalt_deltas'],
];

function rewriteLine(line) {
  if (!line.trim() || line.trimStart().startsWith('#')) return line;
  let out = line;
  for (const [from, to] of FN_FIX) {
    if (out.includes(from)) { out = out.split(from).join(to); counters.fixes.push(`fnref ${from} -> ${to}`); }
  }
  const tok = tokenize(out);
  const si = tok.indexOf('summon');
  if (si < 0) return out;
  const last = tok[tok.length - 1];
  if (!last || !last.startsWith('{')) return out;
  let nbt;
  try { nbt = parse(last); } catch (e) { counters.fixes.push(`NBT parse FAIL: ${e.message}`); return out; }
  const before = JSON.stringify(nbt);
  const rw = rewriteEntityNbt(nbt);
  const changed = JSON.stringify(rw) !== before;
  counters.summon++;
  if (changed) {
    if (rw.equipment) counters.equip++;
    if (rw.drop_chances) counters.dropc++;
    if (rw.active_effects) counters.effects++;
    if (rw.attributes) counters.attrs++;
    for (const s of Object.values(rw.equipment || {})) if (s.components) counters.components++;
    if (nbt.HandItems || nbt.ArmorItems) counters.items++;
  }
  const head = out.slice(0, out.length - last.length);
  return head + serialize(rw);
}

function walk(srcDir) {
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const sp = path.join(srcDir, e.name);
    if (e.isDirectory()) { walk(sp); continue; }
    const rel = path.relative(SRC, sp).split(path.sep).join('/');
    const dstRel = renameDir(rel);
    const dp = path.join(DST, dstRel);
    fs.mkdirSync(path.dirname(dp), { recursive: true });

    if (e.name.endsWith('.mcfunction')) {
      const src = fs.readFileSync(sp, 'utf8');
      const lines = src.split(/\r?\n/).map(rewriteLine);
      fs.writeFileSync(dp, lines.join('\n'));
      counters.lines += lines.length;
    } else if (e.name === 'pack.mcmeta') {
      const j = JSON.parse(fs.readFileSync(sp, 'utf8'));
      j.pack.pack_format = 80;
      j.pack.description = (j.pack.description || '') + ' §7[1.21.6 port]';
      fs.writeFileSync(dp, JSON.stringify(j, null, 4) + '\n');
    } else if (e.name.endsWith('.json')) {
      const raw = fs.readFileSync(sp, 'utf8');
      const j = JSON.parse(raw);
      if (Array.isArray(j.values)) {
        j.values = j.values.map((v) => BLOCK_RENAME[v] ?? v);
        if (j.values.some((v) => v === 'minecraft:short_grass')) counters.fixes.push('tag grass -> short_grass');
      }
      fs.writeFileSync(dp, JSON.stringify(j, null, 4) + '\n');
    } else {
      fs.copyFileSync(sp, dp);
    }
    counters.files++;
  }
}

fs.rmSync(DST, { recursive: true, force: true });
walk(SRC);

// ---- datapack-provided empty loot table (replaces DeathLootTable:"none") ----
const ltDir = path.join(DST, 'data', 'suso.nats', 'loot_table');
fs.mkdirSync(ltDir, { recursive: true });
fs.writeFileSync(path.join(ltDir, 'none.json'),
  JSON.stringify({ type: 'minecraft:generic', pools: [] }, null, 4) + '\n');

// ---- external tag fallback（规则见 lib/exttag.mjs）----
for (const x of applyExternalTagFallback(path.join(ROOT, '_work', 'ref'), DST)) counters.fixes.push(x);
console.log('=== port 完成 ===');
console.log('输出:', DST);
console.log('文件:', counters.files, '| 行:', counters.lines, '| summon:', counters.summon);
console.log('equipment:', counters.equip, '| drop_chances:', counters.dropc,
  '| active_effects:', counters.effects, '| attributes:', counters.attrs,
  '| 含组件的物品:', counters.components);
console.log('修正:', counters.fixes.length);
for (const f of [...new Set(counters.fixes)].slice(0, 10)) console.log('  -', f);
