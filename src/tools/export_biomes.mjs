// export_biomes.mjs — 从 vanilla 1.21.6 jar 导出全部生物群系的刷怪表与 spawn costs。
//
// 用途：自定义地图要复刻原版自然生成，群系刷怪表必须与官方数据**同源**，而不是手抄。
//   node tools/export_biomes.mjs
//
// 产物：
//   _work/generated/biomes.json       完整数据（spawners 按类别保序 + spawn_costs + creature_spawn_probability）
//   _work/generated/biome-index.json  精简索引（每群系每类别的权重和与条目数，供生成刷怪表用）
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
// Q7：转换逻辑与 tools/apply_worldgen.mjs（地图覆盖）共用同一份，避免字段名漂移（见 lib/biome-json.mjs 顶部）
import { entryFromWorldgen } from './lib/biome-json.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const JAR = 'C:/minecraft/Release 2.8.3.zip/.minecraft/versions/1.21.6-Fabric 0.16.14/1.21.6-Fabric 0.16.14.jar';
const OUT = path.join(ROOT, '_work', 'generated');
const LF = String.fromCharCode(10);

// ---- 极简 zip 读取（本机没有 unzip）----
const b = fs.readFileSync(JAR);
let q = b.length - 22;
while (q > 0 && b.readUInt32LE(q) !== 0x06054b50) q--;
const n = b.readUInt16LE(q + 10);
let r = b.readUInt32LE(q + 16);
const entries = [];
for (let i = 0; i < n; i++) {
  if (b.readUInt32LE(r) !== 0x02014b50) break;
  const method = b.readUInt16LE(r + 10);
  const cs = b.readUInt32LE(r + 20);
  const nl = b.readUInt16LE(r + 28);
  const el = b.readUInt16LE(r + 30);
  const cl = b.readUInt16LE(r + 32);
  const lh = b.readUInt32LE(r + 42);
  entries.push({ name: b.toString('utf8', r + 46, r + 46 + nl), method, cs, lh });
  r += 46 + nl + el + cl;
}
const readEntry = (e) => {
  const a = b.readUInt16LE(e.lh + 26);
  const c = b.readUInt16LE(e.lh + 28);
  const s = e.lh + 30 + a + c;
  const d = b.subarray(s, s + e.cs);
  return e.method === 0 ? d : zlib.inflateRawSync(d);
};

// ---- 导出生群系 ----
const PREFIX = 'data/minecraft/worldgen/biome/';
const biomes = {};
const index = {};
let totalEntries = 0;
const withCosts = [];
const probHist = new Map();

for (const e of entries) {
  if (!e.name.startsWith(PREFIX) || !e.name.endsWith('.json')) continue;
  const id = 'minecraft:' + e.name.slice(PREFIX.length, -'.json'.length);
  const j = JSON.parse(readEntry(e).toString('utf8'));
  const entry = entryFromWorldgen(j);          // ← 唯一转换（与 apply_worldgen 共用）
  const spawners = entry.spawners;
  const idx = {};
  for (const [cat, list] of Object.entries(spawners)) {
    idx[cat] = {
      entries: list.length,
      weightSum: list.reduce((s, x) => s + x.weight, 0),
      maxGroup: list.reduce((s, x) => Math.max(s, x.max), 0),
    };
    totalEntries += list.length;
  }
  if (entry.spawnCosts) withCosts.push(id);
  const prob = j.creature_spawn_probability;
  if (prob !== undefined) probHist.set(prob, (probHist.get(prob) || 0) + 1);

  biomes[id] = entry;
  index[id] = idx;
}

fs.mkdirSync(OUT, { recursive: true });
const doc = {
  source: 'minecraft 1.21.6 data/minecraft/worldgen/biome/*.json',
  exportedFrom: JAR.split('/').pop(),
  biomeCount: Object.keys(biomes).length,
  biomes,
};
fs.writeFileSync(path.join(OUT, 'biomes.json'), JSON.stringify(doc, null, 1));
fs.writeFileSync(path.join(OUT, 'biome-index.json'), JSON.stringify({ note: '每群系每类别的权重和与条目数', index }, null, 1));

const categories = new Set();
for (const v of Object.values(biomes)) for (const c of Object.keys(v.spawners)) categories.add(c);
console.log('=== 群系刷怪表导出 ===');
console.log('群系数:', Object.keys(biomes).length, '| 类别:', [...categories].sort().join(', '));
console.log('刷怪条目总数:', totalEntries);
console.log('带 spawn_costs 的群系 (' + withCosts.length + '):', withCosts.join(', ') || '无');
console.log('creature_spawn_probability 分布:', [...probHist].map(([k, v]) => k + '×' + v).join(' '));
console.log();
const sample = index['minecraft:plains'];
console.log('样例 plains:', JSON.stringify(sample));
const nether = index['minecraft:warped_forest'];
console.log('样例 warped_forest:', JSON.stringify(nether));
console.log();
console.log('产物:', path.join(OUT, 'biomes.json'), '(' + (fs.statSync(path.join(OUT, 'biomes.json')).size / 1024).toFixed(0) + ' KB)');
console.log('产物:', path.join(OUT, 'biome-index.json'), '(' + (fs.statSync(path.join(OUT, 'biome-index.json')).size / 1024).toFixed(0) + ' KB)');
