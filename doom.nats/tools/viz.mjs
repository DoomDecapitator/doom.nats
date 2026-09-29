// viz.mjs — 把 suso.nats/doom.nats 的刷怪点位导出成一个可交互的三维模型（单文件 HTML）。
//
//   node tools/viz.mjs [--pack v3] [--ticks 1200] [--max 2500] [--open]
//
// 数据来源与 sim.mjs **完全同一条执行路径**（共用 lib/simrun.mjs）——
// 因此你在模型里看到的点，就是无头验证里用于逐事件比对的那批点。
//
// 产物：
//   reports/points.json              原始点位（供二次分析）
//   reports/可视化-<时间戳>.html      可交互模型（拖拽旋转 / 滚轮缩放 / 图层开关）
import fs from 'node:fs';
import path from 'node:path';
import { PACKS, SCENARIOS, run } from './lib/simrun.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const LF = String.fromCharCode(10);
const argv = process.argv.slice(2);
const getArg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };

const alias = { v3: 'doom', doom: 'doom', ported: 'ported', optimized: 'optimized' };
const packKey = alias[getArg('--pack', 'doom')] ?? getArg('--pack', 'doom');
const pack = PACKS[packKey];
if (!pack) { console.error('--pack 只能是 ' + Object.keys(PACKS).join(' / ')); process.exit(2); }
const ticks = Number(getArg('--ticks', 1200));
const maxPerScen = Number(getArg('--max', 2500));
const seed = 0xC0FFEE;

const r1 = (v) => Math.round(v * 10) / 10;
const thin = (arr, max) => {
  if (arr.length <= max) return arr;
  const step = arr.length / max, out = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  return out;
};

console.log(`=== 点位导出：${packKey}（${pack.ns}）· 每场景 ${ticks} tick ===`);
const types = new Set();
const scenarios = [];
for (const scen of SCENARIOS) {
  const r = run(pack, scen, ticks, { seed });
  if (r.crashed) console.warn('  ⚠ ' + scen.name + ' 崩溃：' + r.crashed);
  const att = thin(r.attempts, maxPerScen);
  const sp = thin(r.spawns, maxPerScen);
  sp.forEach((s) => types.add(String(s.type)));
  scenarios.push({
    name: scen.name,
    biome: scen.biome,
    groundY: scen.groundY ?? 63,
    player: [r1(scen.player?.x ?? 0.5), scen.player?.y ?? 64, r1(scen.player?.z ?? 0.5)],
    total: r.attempts.length,
    attempts: att.map((a) => [r1(a.x), r1(a.y), r1(a.z), r1(a.yaw), r1(a.pitch)]),
    spawns: sp.map((s) => [0, r1(s.x), r1(s.y), r1(s.z), String(s.type)]),
  });
  console.log('  ' + scen.name.padEnd(24) + ' attempts=' + String(r.attempts.length).padStart(5) + ' exported=' + att.length + ' spawns=' + String(r.spawns.length).padStart(3));
}

const typeList = [...types].sort();
const idx = new Map(typeList.map((t, i) => [t, i]));
for (const s of scenarios) for (const sp of s.spawns) sp[0] = idx.get(sp[4]) ?? 0;

const now = new Date();
const stamp = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') +
  ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
const data = {
  pack: packKey + '（' + pack.ns + '）',
  ticks,
  stamp,
  types: typeList,
  scenarios,
};

const reports = path.join(ROOT, 'reports');
fs.mkdirSync(reports, { recursive: true });
const jsonPath = path.join(reports, 'points.json');
fs.writeFileSync(jsonPath, JSON.stringify(data));

const tplPath = path.join(ROOT, 'tools', 'viz', 'template.html');
const tpl = fs.readFileSync(tplPath, 'utf8');
if (!tpl.includes('/*__POINTS__*/')) throw new Error('模板缺少 /*__POINTS__*/ 占位符');
const stampTag = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') +
  '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
const htmlPath = path.join(reports, '可视化-' + stampTag + '.html');
fs.writeFileSync(htmlPath, tpl.split('/*__POINTS__*/').join(JSON.stringify(data)));

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0) + ' KB';
console.log();
console.log('点位数据：' + jsonPath + '（' + kb(jsonPath) + '）');
console.log('三维模型：' + htmlPath + '（' + kb(htmlPath) + '）');
console.log('场景 ' + scenarios.length + ' · 类型 ' + typeList.length + ' · 尝试合计 ' +
  scenarios.reduce((s, x) => s + x.attempts.length, 0) + ' · 刷怪合计 ' + scenarios.reduce((s, x) => s + x.spawns.length, 0));

if (argv.includes('--open')) {
  const { spawn } = await import('node:child_process');
  spawn('cmd', ['/c', 'start', '', htmlPath], { detached: true, stdio: 'ignore' }).unref();
  console.log('已在默认浏览器打开。');
}
