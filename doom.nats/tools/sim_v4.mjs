// sim_v4.mjs — 把 **v4 本体**（CTM 自然生成复刻）跑进无头解释器，产出与真机同格式的证据。
//
//   node tools/sim_v4.mjs [ticks] [--log <输出日志>]
//
// 与 sim.mjs 的区别：sim.mjs 验的是 v1/v2/v3 的等价性（事件流逐条比对）；
// 这里验的是 v4 自己的**成链**：core/tick 调度 → pos/pick 取点 → pack 游走 → 合法性链 →
// 容量 → summon，并且把 doom.log / tellraw 的输出原样收集成日志，交给 collect.mjs 出报告。
//
// 这不能替代真机实测（真机的区块加载、方块、光照、玩家都是真实数据），但能把
// 「一条指令链是否自洽、闸门会不会永远为 0、情形注册表会不会真的改参数」这类
// 静默失效问题在离线阶段拦住。
import fs from 'node:fs';
import path from 'node:path';
import { World } from './lib/mcworld.mjs';
import { Interp } from './lib/interp.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const WS = path.resolve(ROOT, '..');
const PACK = path.join(WS, 'v4', 'doom.nats');
const HARNESS = path.join(WS, 'harness', 'doom.log');
const NS = 'doom.nats';

const argv = process.argv.slice(2);
const TICKS = Number(argv[0] && !argv[0].startsWith('--') ? argv[0] : 2400);
const logOut = (() => { const i = argv.indexOf('--log'); return i !== -1 ? argv[i + 1] : path.join(WS, '_work', 'sim-v4.log'); })();

// ---- 场景：晴夜 / 雨夜 / 雷暴夜（都让地表够黑，怪物档位能过）----
const SCENARIOS = [
  { name: 'forest/night/clear', weather: 0, daytime: 18000, expectPeriod: 5, expectMonster: 70 },
  // rain 场景：rainy_night 情形应当生效（period 3 / max_monster 90）
  { name: 'forest/night/rain', weather: 1, daytime: 18000, expectPeriod: 3, expectMonster: 90 },
  { name: 'forest/night/thunder', weather: 2, daytime: 18000, expectPeriod: 2, expectMonster: 100 },
];

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
say('=== v4 无头运行（' + TICKS + ' tick ≈ ' + (TICKS / 20 / 60).toFixed(1) + ' 分钟游戏时间）===');

const results = [];
for (const scen of SCENARIOS) {
  const world = new World({
    groundY: 63, biome: 'minecraft:forest', light: 0,
    solidBlock: 'minecraft:grass_block',   // 直接命中 #doom.nats:standable 的显式项
    freeBlock: 'minecraft:air',            // 直接命中 #doom.nats:spawnable_at 的显式项
    daytime: scen.daytime, weather: scen.weather,
  });
  world.entities.push({
    uuid: 'player0', type: 'player', tags: [], nbt: {}, gamemode: 'survival',
    pos: { x: 0.5, y: 64, z: 0.5 }, rot: { yaw: 0, pitch: 0 },
  });

  const it = new Interp({ packDir: PACK, world, seed: 0xc0ffee, budget: 30_000_000, extraDirs: [HARNESS] });
  it.run(NS + ':core/setup', it.ctx());
  let crashed = null;
  try { for (let t = 0; t < TICKS; t++) it.run(NS + ':core/tick', it.ctx()); } catch (e) { crashed = e.message; }

  // 收尾：先读分数（reject_report 会「先打印再清零」），再跑真机同款的调试入口产出可采集的行
  const sc = (n) => it.score(NS, n);
  const snapshot = {
    spawned: sc('$spawned'),
    rej: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => sc('$rej.' + i) ?? 0),
    lit: [0, 3, 7, 11, 15].map((t) => sc('$lit.' + t) ?? 0),
  };
  it.run(NS + ':debug/reject_report', it.ctx());
  it.run(NS + ':debug/env', it.ctx());

  const r = {
    scen, it, crashed,
    spawns: it.spawns.length,
    errors: it.errors, warnings: it.warnings,
    chunks: sc('$snap.chunks'), capMonster: sc('$cap.monster'), period: sc('$eff.period'),
    maxMonster: sc('$eff.max_monster'), weather: sc('$snap.weather'), daytime: sc('$snap.daytime'),
    spawned: snapshot.spawned ?? 0, rej: snapshot.rej, lit: snapshot.lit,
    types: it.spawns.map((s) => s.type),
  };
  results.push(r);
  say('');
  say('--- 场景 ' + scen.name + ' ---');
  say('  刷怪=' + r.spawns + '  spawned=' + r.spawned + '  错误=' + r.errors.length + ' 告警=' + r.warnings.length + (crashed ? '  CRASH=' + crashed : ''));
  say('  chunks=' + r.chunks + ' cap.monster=' + r.capMonster + ' period=' + r.period + ' max.monster=' + r.maxMonster);
  say('  weather=' + r.weather + ' daytime=' + r.daytime);
  say('  归因 0..7 = ' + r.rej.join(', '));
  say('  光照失败档位 0/3/7/11/15 = ' + r.lit.join(', '));
  say('  类型: ' + JSON.stringify([...new Set(r.types)]));
}

// ---- 断言 ----
say('');
say('=== 断言 ===');
let pass = 0, fail = 0;
const chk = (id, ok, msg) => { say(`[check] ${id} ${ok ? 'PASS' : 'FAIL'} :: ${msg}`); ok ? pass++ : fail++; };

for (const r of results) {
  const p = r.scen.name;
  chk(p + '/no-crash', !r.crashed, r.crashed || '无崩溃');
  chk(p + '/no-error', r.errors.length === 0, r.errors.length ? r.errors.slice(0, 3).join(' | ') : '解释器错误 0');
  // cap = maxInstancesPerChunk × chunks / 289（整数除，逐字对齐原版）
  const expectCap = Math.trunc((r.maxMonster * r.chunks) / 289);
  chk(p + '/cap-formula', r.capMonster === expectCap, `cap.monster=${r.capMonster} 期望 ${expectCap}（max=${r.maxMonster} chunks=${r.chunks}）`);
  // 情形注册表：天气必须真的改参数
  chk(p + '/circ-period', r.period === r.scen.expectPeriod, `$eff.period=${r.period} 期望 ${r.scen.expectPeriod}`);
  chk(p + '/circ-max', r.maxMonster === r.scen.expectMonster, `$eff.max_monster=${r.maxMonster} 期望 ${r.scen.expectMonster}`);
  chk(p + '/circ-weather', r.weather === r.scen.weather, `$snap.weather=${r.weather} 期望 ${r.scen.weather}`);
  // 归因链活性：拒绝计数必须真的在涨（v4.2 之前宏占位符写错 ⇒ 计数器恒为 0、整包静默空转）
  const totalRej = r.rej.reduce((a, b) => a + b, 0);
  chk(p + '/attribution-live', totalRej > 0 || r.spawns > 0, `拒绝合计=${totalRej} 刷怪=${r.spawns}（若全 0 则归因链或取点闸门断路）`);
  // 每次尝试都要落到某个出口（成功 或 某个 reason）
  chk(p + '/accounted', totalRej + r.spawned > 0, `成功 ${r.spawned} + 拒绝 ${totalRej} > 0`);
  // 落位方块必须在归因里出现：合成世界的地面层只有 y=64 同时满足「下方可站 / 本体与上方可生」
  chk(p + '/block-attributed', r.rej[4] > 0, `rej4=${r.rej[4]}（合成地形下 y≠64 必然被判落位不合，属预期）`);
}

say('');
say(`汇总: ${pass} PASS / ${fail} FAIL`);
try {
  fs.mkdirSync(path.dirname(logOut), { recursive: true });
  // 把 tellraw 渲染出的行原样写进日志（与 latest.log 同格式，供 collect.mjs 抽）
  const body = results.flatMap((r) => r.it.messages.map((m) => '[0] [Render thread/INFO]: [System] [CHAT] ' + m));
  fs.writeFileSync(logOut, lines.filter((l) => l.startsWith('[check]')).join('\n') + '\n' + body.join('\n') + '\n');
  console.log('日志（可喂给 collect.mjs）:', logOut);
} catch (e) { console.log('写日志失败:', e.message); }
process.exit(fail ? 1 : 0);
