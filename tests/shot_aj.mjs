// _work/shot_aj.mjs —— 实验性 AJ 桥接的出图（**副路：自绘等轴投影，零依赖，永远可行**）
//
//   RCON_PORT=25582 node _work/shot_aj.mjs [--spawn real|placeholder] [--label "..."]
//
// 与验收断言**同一时刻**：先在实例里把 rig 造出来（或复用在场的），随即 `function probe:snap`
// 把内核 + 全部 rig display 的运行时位姿收进 storage，再按 list[i] 逐条读（每条几十字节，
// 避开 RCON 单条响应 >4KB 会被丢的限制），最后做等轴投影 + 手写 PNG 编码器出图。
//
// 为什么需要"副路"：无头浏览器 + WebGL 能不能截图不由本包决定（见 --viewer 那条路）；
// 这条路的输入全部来自**游戏里的真实数据**（Pos + transformation + block_state），不猜。
//
// 输出：
//   _work/aj-shots/aj-rig-<时间戳>.png / .json       中间产物
//   doom.nats/reports/图-实验性AJ样例 rig-<日期>.png  成品（进报告）
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { R } from './_root.mjs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const NS = 'doom.nats';
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const SPAWN = arg('--spawn', '');
const LABEL = arg('--label', 'ASSERTION 1b/1c/6: RIG CLOUD MOUNTED ON CARRIER');
const SHOTS = R('_work/aj-shots');
const sleep = (ms) => new Promise((x) => setTimeout(x, ms));
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const AX = -1264, WY = 56, AZ = -2128;      // 验收用的深海试验场（mcs erver-aj 同一处）

// ---------------------------------------------------------------- 0) 探针包（测试资产，不进产物）
const PROBE = path.join(SHOTS, 'probe-pack');
const DP = R('_work/mcserver-aj/world/datapacks');
fs.rmSync(path.join(DP, 'zz-aj-probe'), { recursive: true, force: true });
fs.cpSync(PROBE, path.join(DP, 'zz-aj-probe'), { recursive: true });
await cmd('reload');
await sleep(2000);

// ---------------------------------------------------------------- 1) 造现场（可选）+ 快照
if (SPAWN) {
  await cmd(`kill @e[type=#${NS}:exp_aj_display]`);
  await cmd(`kill @e[tag=${NS}.exp.aj.carrier]`);
  await sleep(300);
  const [biome, cat, slug] = SPAWN === 'placeholder'
    ? ['plains', 'monster', 'zombie']
    : ['deep_ocean', 'water_creature', 'squid'];
  let rng = null;
  for (let k = 0; k < 4000 && rng === null; k++) {
    await cmd(`scoreboard players set $rng ${NS} ${k}`);
    await cmd(`execute positioned ${AX + 0.5} ${WY + 2} ${AZ + 0.5} run function ${NS}:mob/biome/${biome}/${cat}`);
    const m = new RegExp('slug:\\s*"([^"]*)"').exec(await cmd(`data get storage ${NS}:sel`));
    if (m && m[1] === slug) rng = k;
  }
  const x = SPAWN === 'placeholder' ? AX + 13.5 : AX + 0.5;
  const y = SPAWN === 'placeholder' ? 53 : WY + 2;
  await cmd(`scoreboard players set $rng ${NS} ${rng ?? 0}`);
  await cmd(`execute positioned ${x} ${y} ${AZ + 0.5} run function ${NS}:mob/biome/${biome}/${cat}`);
  await cmd(`execute positioned ${x} ${y} ${AZ + 0.5} run function ${NS}:spawn/emit with storage ${NS}:sel`);
  await sleep(900);
  await cmd(`function ${NS}:exp/aj/sweep`);
  await sleep(300);
  console.log(`已在 (${x}, ${y}, ${AZ}) 生成 ${slug} + rig（$rng=${rng}）`);
}
await cmd('function probe:snap');
await sleep(400);

// ---------------------------------------------------------------- 2) 读回来（逐条，小响应）
const metaRaw = await cmd('data get storage probe:shot meta');
const numOf = (s, k) => { const m = new RegExp(k + ':\\s*(-?\\d+)').exec(s); return m ? Number(m[1]) : 0; };
const meta = { count: numOf(metaRaw, 'count'), live: numOf(metaRaw, 'live'), carriers: numOf(metaRaw, 'carriers') };
const entries = [];
for (let i = 0; i < meta.count + meta.carriers; i++) {
  const s = await cmd(`data get storage probe:shot list[${i}]`);
  if (/Found no elements/.test(s)) continue;
  const g = (k) => { const m = new RegExp('(?:^|[{,])\\s*' + k + ':\\s*([^,}]+)').exec(s); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null; };
  const num = (k, d) => { const v = g(k); const n = v === null ? NaN : Number(v); return Number.isFinite(n) && n !== 0 ? n : d; };
  entries.push({
    x: num('x', 0), y: num('y', 0), z: num('z', 0),
    tx: num('tx', 0), ty: num('ty', 0), tz: num('tz', 0),
    sx: num('sx', 1), sy: num('sy', 1), sz: num('sz', 1),
    b: (g('b') || 'minecraft:air').replace(/^minecraft:/, ''),
    kind: g('kind'), root: /root:\s*1b/.test(s), child: /child:\s*1b/.test(s), veh: /veh:\s*1b/.test(s),
  });
}
const carrier = entries.find((e) => e.kind === 'carrier') || null;
const rig = entries.filter((e) => e.kind === 'rig');
const t0 = new Date();
const stamp = t0.toISOString().replace(/[:T]/g, '-').slice(0, 16);
const shots = { when: t0.toISOString(), instance: '25572 (mcserver-aj)', rcon: process.env.RCON_PORT || 25582, label: LABEL, arena: [AX, WY, AZ], meta, carrier, rigCount: rig.length, rig };
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(path.join(SHOTS, `aj-rig-${stamp}.json`), JSON.stringify(shots, null, 2));
console.log(`快照：rig display ${meta.count} 只（已挂载 ${meta.live}）· 内核 ${meta.carriers} 只 · 读到 ${rig.length} 条位姿`);

// ---------------------------------------------------------------- 3) 画布 + PNG 编码器（手写，零依赖）
const W = 1400, H = 900;
const px = Buffer.alloc(W * H * 3);
const put = (x, y, c, a = 1) => {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = Math.round(px[i] * (1 - a) + c[0] * a);
  px[i + 1] = Math.round(px[i + 1] * (1 - a) + c[1] * a);
  px[i + 2] = Math.round(px[i + 2] * (1 - a) + c[2] * a);
};
const line = (x0, y0, x1, y1, c, a = 1) => {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (let n = 0; n < 6000; n++) { put(x0, y0, c, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x0 += sx; } if (e2 < dx) { err += dx; y0 += sy; } }
};
const quad = (p1, p2, p3, p4, c) => {          // 简单凸四边形填充（扫描线靠三角形近似）
  const tri = (a, b, c2, col) => {
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c2[1]))), maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c2[1])));
    const area = (b[0] - a[0]) * (c2[1] - a[1]) - (b[1] - a[1]) * (c2[0] - a[0]);
    if (Math.abs(area) < 1e-9) return;
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (const [p, q] of [[a, b], [b, c2], [c2, a]]) {
        const t = (y + 0.5 - p[1]) / (q[1] - p[1]);
        if (t >= 0 && t < 1) xs.push(p[0] + t * (q[0] - p[0]));
      }
      if (xs.length < 2) continue;
      for (let x = Math.round(Math.min(...xs)); x <= Math.round(Math.max(...xs)); x++) put(x, y, col);
    }
  };
  tri(p1, p2, p3, c); tri(p1, p3, p4, c);
};
// 5x7 位图字体（只做 ASCII：图里写英文，中文解释放报告/文件名）
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '11110', '10001', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '10000', '10000', '11111'], F: ['11111', '10000', '11110', '10000', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'], H: ['10001', '10001', '11111', '10001', '10001', '10001', '10001'],
  I: ['111', '010', '010', '010', '010', '010', '111'], J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '11100', '10010', '10001', '10001', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10001', '10101', '11011', '10001'], X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['000', '000', '000', '000', '000', '000', '000'], '.': ['00', '00', '00', '00', '00', '00', '11'],
  ',': ['00', '00', '00', '00', '00', '01', '10'], ':': ['00', '11', '11', '00', '11', '11', '00'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['0010', '0100', '1000', '1000', '1000', '0100', '0010'], ')': ['1000', '0100', '0010', '0010', '0010', '0100', '1000'],
  '+': ['000', '010', '010', '111', '010', '010', '000'], '=': ['000', '000', '111', '000', '111', '000', '000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'], '<': ['001', '010', '100', '100', '100', '010', '001'],
  '>': ['100', '010', '001', '001', '001', '010', '100'], '*': ['000', '101', '010', '101', '000', '000', '000'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'], '!': ['1', '1', '1', '1', '1', '0', '1'],
  '@': ['01110', '10001', '10111', '10101', '10111', '10000', '01110'], ';': ['00', '11', '11', '00', '11', '01', '10'],
  "'": ['1', '1', '0', '0', '0', '0', '0'], '[': ['11', '10', '10', '10', '10', '10', '11'],
  ']': ['11', '01', '01', '01', '01', '01', '11'], '|': ['1', '1', '1', '1', '1', '1', '1'], '%': ['10001', '00010', '00100', '00100', '01000', '10001', '00000'],
};
const text = (x, y, str, col, sc = 2) => {
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const g = FONT[ch] || FONT['?'];
    const w = g[0].length;
    for (let ry = 0; ry < 7; ry++) for (let rx = 0; rx < w; rx++) {
      if (g[ry][rx] === '1') for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) put(cx + rx * sc + a, y + ry * sc + b, col);
    }
    cx += (w + 1) * sc;
  }
  return cx;
};
const textW = (str, sc = 2) => [...String(str).toUpperCase()].reduce((n, ch) => n + ((FONT[ch] || FONT['?'])[0].length + 1) * sc, 0);

// 背景
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, [16, 18, 24]);
// 等轴投影
const BLOCK_COLOR = {
  blue_concrete_powder: [70, 110, 190], yellow_concrete: [215, 195, 70], black_concrete: [40, 40, 46],
  red_concrete: [190, 60, 60], blue_concrete: [60, 100, 190], oak_log: [140, 110, 70],
  oak_leaves: [70, 130, 70], mangrove_leaves: [60, 120, 80], bush: [80, 130, 60], short_grass: [110, 160, 80],
  white_dye: [225, 225, 230], gold_block: [230, 190, 60],
};
const colorOf = (b) => BLOCK_COLOR[b] || [150, 150, 160];
const all = [...rig, ...(carrier ? [carrier] : [])];
const vis = all.map((e) => ({ ...e, vx: e.x + e.tx, vy: e.y + e.ty, vz: e.z + e.tz }));
const cxs = vis.map((e) => e.vx), cys = vis.map((e) => e.vy), czs = vis.map((e) => e.vz);
const cxm = cxs.reduce((a, b) => a + b, 0) / (cxs.length || 1);
const cym = cys.reduce((a, b) => a + b, 0) / (cys.length || 1);
const czm = czs.reduce((a, b) => a + b, 0) / (czs.length || 1);
const spanX = Math.max(6, Math.max(...cxs) - Math.min(...cxs)), spanY = Math.max(6, Math.max(...cys) - Math.min(...cys)), spanZ = Math.max(6, Math.max(...czs) - Math.min(...czs));
const iso1 = (x, y, z) => [(x - z) * 0.866, (x + z) * 0.5 - y * 1.15];
const ext = [];
for (const e of vis) {
  const szx = Math.max(0.2, Math.min(Math.abs(e.sx || 1), 8)), szy = Math.max(0.2, Math.min(Math.abs(e.sy || 1), 8)), szz = Math.max(0.2, Math.min(Math.abs(e.sz || 1), 8));
  for (const dx of [0, szx]) for (const dy of [0, szy]) for (const dz of [0, szz]) ext.push(iso1(e.vx - dx / 2 - cxm, e.vy + dy - cym, e.vz - dz / 2 - czm));
}
const bw = Math.max(...ext.map((p) => p[0])) - Math.min(...ext.map((p) => p[0]));
const bh = Math.max(...ext.map((p) => p[1])) - Math.min(...ext.map((p) => p[1]));
const S = Math.max(6, Math.min(46, (W - 200) / Math.max(4, bw), (H - 330) / Math.max(3, bh)));
const iso = (x, y, z) => [(x - z) * 0.866 * S + W / 2, ((x + z) * 0.5 - y * 1.15) * S + H / 2 + 40];
const drawCube = (e, alpha = 1) => {
  const size = Math.max(0.12, Math.min(Math.abs(e.sx || 1), 8));
  const sy = Math.max(0.12, Math.min(Math.abs(e.sy || 1), 8));
  const sz = Math.max(0.12, Math.min(Math.abs(e.sz || 1), 8));
  const [x0, y0, z0] = [(e.vx - cxm) - size / 2, (e.vy - cym), (e.vz - czm) - sz / 2];
  const p = (dx, dy, dz) => iso(x0 + dx, y0 + dy, z0 + dz);
  const c = colorOf(e.b);
  const top = [p(0, sy, 0), p(size, sy, 0), p(size, sy, sz), p(0, sy, sz)];
  const right = [p(size, 0, 0), p(size, 0, sz), p(size, sy, sz), p(size, sy, 0)];
  const left = [p(0, 0, 0), p(0, 0, sz), p(0, sy, sz), p(0, sy, 0)];
  quad(...left, c.map((v) => Math.round(v * 0.62)), alpha);
  quad(...right, c.map((v) => Math.round(v * 0.78)), alpha);
  quad(...top, c, alpha);
};
// 从"锚点"连线：内核 → 顶层 rig 实体（显示挂载关系）
const cpos = carrier ? iso(carrier.x - cxm, carrier.y - cym, carrier.z - czm) : null;
for (const e of rig.filter((x) => !x.child)) {
  const p = iso(e.vx - cxm, e.vy - cym + 0.6, e.vz - czm);
  line(cpos[0], cpos[1], p[0], p[1], [80, 220, 140], 0.5);
}
// 画：先远后近（按 (x+z+y) 排序）
vis.slice().sort((a, b) => (a.vx + a.vz - a.vy) - (b.vx + b.vz - b.vy)).forEach((e) => {
  if (e.kind === 'carrier') {
    const p = iso(e.vx - cxm, e.vy - cym, e.vz - czm);
    const rr = Math.max(5, 0.8 * S);
    for (let a = 0; a < 360; a += 4) put(p[0] + rr * Math.cos(a * Math.PI / 180), p[1] + rr * 0.5 * Math.sin(a * Math.PI / 180), [70, 230, 130]);
    for (let k = -rr; k <= rr; k++) { put(p[0] + k, p[1], [70, 230, 130]); put(p[0], p[1] + k, [70, 230, 130]); }
    return;
  }
  drawCube(e, 0.62);
  if (e.root) {
    const p = iso(e.vx - cxm, e.vy - cym + 1.2, e.vz - czm);
    for (let k = -9; k <= 9; k++) { put(p[0] + k, p[1], [255, 90, 90]); put(p[0], p[1] + k, [255, 90, 90]); }
  }
});
// 内核与根画在最上层（否则会被巨大的骨架方块挡住）
if (carrier) {
  const p2 = iso(carrier.x - cxm, carrier.y - cym, carrier.z - czm);
  const rr = Math.max(6, 0.9 * S);
  for (let a = 0; a < 360; a += 3) put(p2[0] + rr * Math.cos(a * Math.PI / 180), p2[1] + rr * 0.5 * Math.sin(a * Math.PI / 180), [70, 240, 130]);
  for (let k = -rr; k <= rr; k++) { put(p2[0] + k, p2[1], [70, 240, 130]); put(p2[0], p2[1] + k, [70, 240, 130]); }
  text(p2[0] + rr + 6, p2[1] - 6, 'CARRIER', [150, 250, 180], 2);
}
for (const e of rig.filter((x) => x.root)) {
  const p2 = iso(e.vx - cxm, e.vy - cym, e.vz - czm + 1.0);
  for (let k = -11; k <= 11; k++) { put(p2[0] + k, p2[1], [255, 90, 90]); put(p2[0], p2[1] + k, [255, 90, 90]); }
  text(p2[0] + 14, p2[1] - 6, 'RIG ROOT', [255, 160, 160], 2);
}
// 标题/图例（ASCII：图里不画中文，中文解释在报告与文件名）
let ty = 22;
text(24, ty, 'DOOM.NATS  EXP AJ BRIDGE  --  RIG RENDERED FROM LIVE SERVER ENTITY DATA', [235, 235, 240], 2); ty += 24;
text(24, ty, LABEL, [120, 220, 255], 2); ty += 22;
text(24, ty, 'INSTANCE ' + shots.instance + '   RCON ' + shots.rcon + '   ARENA ' + AX + ',' + WY + ',' + AZ + ' (DEEP OCEAN)', [200, 200, 210], 2); ty += 20;
text(24, ty, 'CARRIER ' + (carrier ? 'minecraft:squid (invisible, silent) @ ' + carrier.x.toFixed(1) + ',' + carrier.y.toFixed(1) + ',' + carrier.z.toFixed(1) : 'n/a'), [140, 240, 170], 2); ty += 20;
text(24, ty, 'RIG DISPLAY ENTITIES ' + meta.count + '   MOUNTED (PASSENGER CLOSURE) ' + meta.live + '   CARRIERS ' + meta.carriers, [255, 220, 140], 2); ty += 20;
text(24, ty, 'MODEL TRANSLATIONS FROM transformation.* ; POSITIONS READ AT ' + shots.when.slice(0, 19) + 'Z', [170, 170, 180], 2);
// 图例
const ly = H - 96;
text(24, ly, 'LEGEND', [220, 220, 230], 2);
for (let k = 0; k < 12; k++) { put(30 + k, ly + 26, [190, 60, 60]); put(36, ly + 20 + k, [190, 60, 60]); }
text(54, ly + 20, 'RED CROSS = RIG ROOT (aj.global.root)', [220, 200, 200], 2);
for (let k = 0; k < 26; k++) { put(30 + k, ly + 50, [70, 230, 130]); }
text(70, ly + 44, 'GREEN = CARRIER (REAL MOB) AND MOUNT LINKS', [200, 230, 200], 2);
quad([620, ly + 50], [640, ly + 44], [660, ly + 50], [640, ly + 56], [70, 110, 190]);
quad([646, ly + 50], [666, ly + 44], [686, ly + 50], [666, ly + 56], [215, 195, 70]);
text(700, ly + 44, 'BLOCKS = RIG PARTS (COLOR = block_state)', [210, 210, 220], 2);
text(24, H - 20, 'SOURCE rigns:summon (第三方 rig 样例, Modrinth thirdparty-rig) -- THIRD-PARTY, ACCEPTANCE ONLY, NOT SHIPPED', [150, 150, 160], 2);

// ---------------------------------------------------------------- 4) 写 PNG
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const outShot = path.join(SHOTS, `aj-rig-${stamp}.png`);
fs.writeFileSync(outShot, png);
const reportPng = R('doom.nats/reports/图-实验性AJ样例 rig-20260929.png');
fs.mkdirSync(path.dirname(reportPng), { recursive: true });
fs.copyFileSync(outShot, reportPng);
console.log('出图：' + outShot);
console.log('成品：' + reportPng + '（' + (png.length / 1024).toFixed(0) + ' KB, ' + W + 'x' + H + '）');
console.log('位姿 JSON：' + path.join(SHOTS, `aj-rig-${stamp}.json`));
r.close();
