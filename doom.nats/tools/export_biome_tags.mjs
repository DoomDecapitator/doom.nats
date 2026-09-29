// export_biome_tags.mjs — 从 1.21.6 的 jar 导出**生物群系标签 → 群系 id 列表**（作者规则层要用）。
//
//   node tools/export_biome_tags.mjs            # 自动找 jar（env DOOM_JAR > 本地服务端 jar > 客户端 jar）
//
// 为什么需要：作者在 rules/entries.json 里写 `"biomes": ["#minecraft:is_deep_ocean"]` 时，
//   生成器必须知道这个标签到底包含哪些群系才能落进 `mob/biome/<群系>/<类别>` 分发表。
//   标签文件在 jar 的 `data/minecraft/tags/worldgen/biome/*.json` 里（嵌套标签要**递归展开**）。
//
// 产物：_work/generated/biome-tags.json = { tags: { "minecraft:is_deep_ocean": ["minecraft:deep_ocean", …] } }
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, '_work', 'generated', 'biome-tags.json');
const CANDIDATES = [
  process.env.DOOM_JAR,
  path.join(ROOT, '_work', 'mcserver', 'server.jar'),
  'C:/minecraft/Release 2.8.3.zip/.minecraft/versions/1.21.6-Fabric 0.16.14/1.21.6-Fabric 0.16.14.jar',
].filter(Boolean);
const JAR = CANDIDATES.find((p) => fs.existsSync(p));
if (!JAR) { console.error('找不到 jar；用 DOOM_JAR=<path> 指定（需要含 data/minecraft/tags/worldgen/biome/ 的服务端或客户端 jar）'); process.exit(2); }

// ---- 极简 zip 读取（与 export_biomes.mjs 同一套）----
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

const PREFIX = 'data/minecraft/tags/worldgen/biome/';
const raw = {};
for (const e of entries) {
  if (!e.name.startsWith(PREFIX) || !e.name.endsWith('.json')) continue;
  const id = 'minecraft:' + e.name.slice(PREFIX.length, -'.json'.length);
  raw[id] = JSON.parse(readEntry(e).toString('utf8')).values ?? [];
}

// 递归展开嵌套标签（原版允许标签里再放标签；required=false 的条目与 # 标签同样处理）
const resolving = new Set();
const cache = {};
function resolve(id) {
  if (cache[id]) return cache[id];
  if (resolving.has(id)) return [];       // 自引用保护（原版不会出现，防御性）
  resolving.add(id);
  const out = [];
  for (const v of raw[id] ?? []) {
    const s = typeof v === 'string' ? v : v.id;
    if (typeof s !== 'string') continue;
    if (s.startsWith('#')) out.push(...resolve('minecraft:' + s.slice(1)));
    else out.push(s.startsWith('minecraft:') ? s : s);
  }
  resolving.delete(id);
  cache[id] = [...new Set(out)].sort();
  return cache[id];
}
const tags = {};
for (const id of Object.keys(raw).sort()) tags[id] = resolve(id);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ source: path.basename(JAR), tags }, null, 1) + '\n');
const sample = ['minecraft:is_deep_ocean', 'minecraft:is_ocean', 'minecraft:is_forest'].filter((t) => tags[t]);
console.log('群系标签导出：' + Object.keys(tags).length + ' 个 → ' + path.relative(ROOT, OUT));
for (const t of sample) console.log('  ' + t + ' (' + tags[t].length + ') ' + tags[t].slice(0, 4).join(', ') + (tags[t].length > 4 ? ' …' : ''));
