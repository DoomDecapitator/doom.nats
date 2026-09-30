// export_hitboxes.mjs — 从 named.jar 导出原版实体的碰撞盒尺寸（width × height）。
//
//   node tools/export_hitboxes.mjs
//
// 为什么要自己导：Minecraft 的实体尺寸**硬编码在各类的 EntityType.Builder.sized(w,h) 里**，
// 既没有数据文件，也不是 NBT 可读字段；Bookshelf 的 hitbox 模块只做运行时操作，不含尺寸表。
// 而"落位合法性"里的碰撞检测恰恰需要尺寸 ⇒ 把尺寸表显式导出成数据，供生成端近似判定。
//
// 方法：按实体 id 猜类名 → 在 named.jar 里定位 class → javap -p -c → 从 `sized:(FF)` 调用前的
// 两条 float 常量取 width/height。
//
// 产物：_work/generated/hitboxes.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const JAR = path.join(ROOT, '_work', 'decomp', 'named.jar');
const OUT = path.join(ROOT, '_work', 'generated');
const TMP = path.join(ROOT, '_work', 'decomp', 'hb');
const LF = String.fromCharCode(10);

const mobs = JSON.parse(fs.readFileSync(path.join(OUT, 'mobs.json'), 'utf8')).mobs;
const ids = Object.keys(mobs).map((t) => t.replace('minecraft:', ''));

// ---- zip 读取 ----
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

const ALIAS = { enderman: 'EnderMan', mooshroom: 'MushroomCow' };
const camel = (id) => ALIAS[id] ?? id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const out = {};
const notFound = [];
const noSize = [];

for (const id of ids) {
  const cls = camel(id);
  // 优先 entity 包下的同名类
  const cands = entries.filter((e) => e.name.endsWith('/' + cls + '.class') && e.name.startsWith('net/minecraft/world/entity/'));
  if (!cands.length) { notFound.push(id); continue; }
  // 排除内部类与抽象基类路径过深者，取最浅的
  const pick = cands.sort((x, y) => x.name.split('/').length - y.name.split('/').length)[0];
  const dst = path.join(TMP, pick.name);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, readEntry(pick));
  let dis = '';
  try {
    const fqcn = pick.name.replace('.class', '').split('/').join('.');
    dis = execFileSync('javap', ['-p', '-c', '-cp', TMP, fqcn], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (err) { noSize.push(id + '(javap 失败)'); continue; }
  // 找 sized: 调用，回溯最近的两条 float 常量
  const lines = dis.split(LF);
  let w = null, h = null;
  for (let i = 0; i < lines.length; i++) {
    if (!/EntityType\$Builder\.sized:\(FF\)/.test(lines[i])) continue;
    const floats = [];
    for (let k = i - 1; k >= 0 && floats.length < 2; k--) {
      const m = /\/\/ float ([0-9.]+)f/.exec(lines[k]);
      if (m) floats.unshift(Number(m[1]));
    }
    if (floats.length === 2) { w = floats[0]; h = floats[1]; break; }
  }
  if (w === null) { noSize.push(id + '(' + pick.name.split('/').pop() + ')'); continue; }
  out['minecraft:' + id] = { width: w, height: h, source: pick.name.replace('.class', '') };
}

fs.writeFileSync(path.join(OUT, 'hitboxes.json'), JSON.stringify({
  note: 'width/height 取自各类 EntityType.Builder.sized(w,h)；source 为定义它的类',
  count: Object.keys(out).length,
  unresolved: { notFound, noSize },
  hitboxes: out,
}, null, 1));

console.log('=== 碰撞盒尺寸导出 ===');
console.log('成功:', Object.keys(out).length, '/', ids.length);
console.log('未找到类:', notFound.length ? notFound.join(', ') : '无');
console.log('未解析尺寸:', noSize.length ? noSize.join(', ') : '无');
console.log();
for (const k of ['minecraft:zombie', 'minecraft:creeper', 'minecraft:spider', 'minecraft:enderman', 'minecraft:slime']) {
  if (out[k]) console.log('  ', k.padEnd(26), out[k].width + ' × ' + out[k].height, '  (' + out[k].source + ')');
}
console.log();
console.log('产物:', path.join(OUT, 'hitboxes.json'), '(' + (fs.statSync(path.join(OUT, 'hitboxes.json')).size / 1024).toFixed(1) + ' KB)');
