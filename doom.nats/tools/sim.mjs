// sim.mjs — silent (headless) execution of the datapack against a synthetic world.
//   node tools/sim.mjs
// Runs the SAME scenario against `ported` (faithful 1.21.6 port, still using the upstream
// marker/AEC/binary-tree machinery) and `optimized` (v2, entity-free), then compares the
// per-attempt event streams to prove the optimisation is behaviour preserving.
import fs from 'node:fs';
import path from 'node:path';
import { World } from './lib/mcworld.mjs';
import { Interp } from './lib/interp.mjs';
import { PACKS, SCENARIOS, run } from './lib/simrun.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

// ---------------------------------------------------------------- scenarios
const TICKS = Number(process.argv[2] || 6000);           // 6000 ticks = 5 min of play
const results = [];
console.log(`=== 静默计算：每场景 ${TICKS} tick（${(TICKS / 20 / 60).toFixed(1)} 分钟游戏时间）===\n`);
console.log('场景'.padEnd(24), '包'.padEnd(11), '尝试', ' 刷怪', ' 错误', ' 告警', ' 命令数', ' 最大递归', ' 假实体');
console.log('-'.repeat(88));

for (const scen of SCENARIOS) {
  const a = run(PACKS.ported, scen, TICKS);
  const b = run(PACKS.optimized, scen, TICKS, { seed: 0xC0FFEE });
  const d = run(PACKS.doom, scen, TICKS, { seed: 0xC0FFEE });
  for (const [tag, r] of [['ported', a], ['optimized', b], ['doom(v3)', d]]) {
    console.log(
      scen.name.padEnd(24), tag.padEnd(11),
      String(r.attempts.length).padStart(6),
      String(r.spawns.length).padStart(5),
      String(r.it.errors.length).padStart(5),
      String(r.it.warnings.length).padStart(5),
      String(r.it.steps).padStart(9),
      String(r.it.maxDepth).padStart(8),
      String(r.it.auxSummons).padStart(6),
      r.crashed ? ' CRASH: ' + r.crashed : '');
  }
  results.push({ scen, a, b, d });
}

// ---------------------------------------------------------------- equivalence
console.log();
console.log('=== 行为等价性（逐事件比对）===');
console.log('场景'.padEnd(24), 'p→o 尝试'.padEnd(9), 'p→o 刷怪'.padEnd(9), 'o→v3 尝试'.padEnd(10), 'o→v3 刷怪'.padEnd(10), '结论');
console.log('-'.repeat(86));
let allEqual = true;
const sig = (r) => JSON.stringify(r.spawns.map((s) => [s.type, s.x, s.y, s.z]));
const cmp = (x, y) => [JSON.stringify(x.attempts) === JSON.stringify(y.attempts), sig(x) === sig(y)];
for (const { scen, a, b, d } of results) {
  const r1 = cmp(a, b), r2 = cmp(b, d);
  const ok = r1[0] && r1[1] && r2[0] && r2[1];
  if (!ok) allEqual = false;
  const mark = (v) => (v ? '✅ 一致' : '❌ 差异');
  console.log(scen.name.padEnd(24), mark(r1[0]).padEnd(9), mark(r1[1]).padEnd(9), mark(r2[0]).padEnd(10), mark(r2[1]).padEnd(10), ok ? "PASS" : "FAIL");
  if (!r2[0]) {
    for (let i = 0; i < Math.max(b.attempts.length, d.attempts.length); i++) {
      if (JSON.stringify(b.attempts[i]) !== JSON.stringify(d.attempts[i])) {
        console.log("   v3 首个差异 #" + i + ": optimized=" + JSON.stringify(b.attempts[i]) + "  v3=" + JSON.stringify(d.attempts[i]));
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- distribution
console.log('\n=== 定位分布核验（ported + optimized + v3 合并，场景 flat/forest/dark）===');
{
  const { a, b, d } = results[0];
  const att = [...a.attempts, ...b.attempts, ...d.attempts];
  const dists = att.map((p) => Math.hypot(p.x - 0.5, p.z - 0.5));
  const buckets = new Map();
  for (const d of dists) { const k = Math.round(d); buckets.set(k, (buckets.get(k) || 0) + 1); }
  const ys = att.map((p) => p.y);
  const pitches = att.map((p) => p.pitch), yaws = att.map((p) => p.yaw);
  const stat = (arr) => ({ min: Math.min(...arr).toFixed(1), max: Math.max(...arr).toFixed(1), avg: (arr.reduce((x, y) => x + y, 0) / arr.length).toFixed(2) });
  console.log('尝试次数:', att.length);
  console.log('水平距离  min/max/avg:', stat(dists));
  console.log('候选点 y  min/max/avg:', stat(ys));
  console.log('俯仰      min/max/avg:', stat(pitches), ' (期望偏向 0° 的三角分布)');
  console.log('偏航      min/max/avg:', stat(yaws), ' (期望均匀 0..360)');
  const hist = [...buckets].sort((x, y) => x[0] - y[0]).filter(([k]) => k % 6 === 0).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log('距离直方图(每6格):', hist);
}

console.log();
console.log('=== 包体对比（加载期成本）===');
const packStat = (p) => {
  let files = 0, bytes = 0, body = 0, max = 0, maxF = "", inlineNbt = 0;
  const walk = (d2) => { for (const e of fs.readdirSync(d2, { withFileTypes: true })) { const q = path.join(d2, e.name); if (e.isDirectory()) { walk(q); continue; }
    if (!q.endsWith(".mcfunction")) continue;
    const txt = fs.readFileSync(q, "utf8"); files++; bytes += Buffer.byteLength(txt);
    for (const l of txt.split(String.fromCharCode(10))) { const s = l.trim(); if (!s || s.startsWith("#")) continue; body++; if (s.includes("summon ")) inlineNbt += Buffer.byteLength(s); }
    if (Buffer.byteLength(txt) > max) { max = Buffer.byteLength(txt); maxF = path.basename(q); } } };
  walk(path.join(p.dir, "data"));
  return { files, bytes, body, max, maxF, inlineNbt };
};
for (const key of ["optimized", "doom"]) {
  const s = packStat(PACKS[key]);
  console.log(key.padEnd(10), "函数", String(s.files).padStart(3), "| 字节", String(s.bytes).padStart(6), "| 有效命令行", String(s.body).padStart(4), "| 最大单文件", String(s.max).padStart(5), "B", s.maxF.padEnd(28), "| summon 行内联字节", String(s.inlineNbt).padStart(6));
}

// ---------------------------------------------------------------- spawn detail
console.log('\n=== 刷怪明细（optimized，全部场景）===');
const byType = new Map();
let totalSpawns = 0, errs = 0, warns = new Map();
const byTypeV3 = new Map();
for (const { d } of results) for (const s of d.spawns) byTypeV3.set(s.type, (byTypeV3.get(s.type) || 0) + 1);
for (const { b, d } of results) {
  totalSpawns += b.spawns.length;
  for (const s of b.spawns) byType.set(s.type, (byType.get(s.type) || 0) + 1);
  errs += b.it.errors.length + d.it.errors.length;
  for (const w of b.it.warnings) warns.set(w, (warns.get(w) || 0) + 1);
  for (const w of d.it.warnings) warns.set("v3:" + w, (warns.get("v3:" + w) || 0) + 1);
}
console.log('总刷怪:', totalSpawns, '| 按类型:', [...byType].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}×${v}`).join(' '));
console.log("总刷怪(v3)       :", [...byTypeV3.values()].reduce((x, y) => x + y, 0), "| 按类型:", [...byTypeV3].sort((x, y) => y[1] - x[1]).map(([k, v]) => k + "x" + v).join(" "));
console.log('解释器错误总数:', errs);
if (errs) {
  const e = new Map();
  for (const { b } of results) for (const x of b.it.errors) e.set(x, (e.get(x) || 0) + 1);
  for (const [k, v] of [...e].slice(0, 12)) console.log('   ❌', v + '×', k);
}
console.log('未实现指令/条件告警:', warns.size ? [...warns].map(([k, v]) => `${k}(${v})`).join(' | ') : '无');
