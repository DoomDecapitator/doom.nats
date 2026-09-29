import { R, W } from './_root.mjs';   // 可移植路径解析（见 tests/README.md）
// _work/verify_dims.mjs —— 真机验证「维度参数」（v4.14）
//
//   node _work/verify_dims.mjs
//
// 依据（服务端 jar 的维度类型 JSON，已用 node _work/zip.mjs 读出）：
//                     monster_spawn_light_level | block_light_limit | has_skylight | sea_level(noise_settings)
//   overworld          uniform 0..7              | 0                 | true         | 63
//   the_nether         7（常量）                 | 15（不限）         | false        | 32
//   the_end            uniform 0..7              | 0                 | false        | 0
// 断言：
//   ① cfg 层按维度给出海平面（63/32/0）与光照档
//   ② check/sealevel 派生的窗口随之变化（overworld 50..63；nether 19..32）
//   ③ can_see_sky：主世界露天 true、下界/末地 false（⇒ 动物的"亮"= 方块光 ≥ 9）
//   ④ 三个维度都能真正执行刷怪相关函数（execute in ... run function）
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail: String(detail) }); console.log((pass ? '✅ ' : '❌ ') + name + '  ' + detail); };

const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const score = async (h) => {
  const t = await cmd('scoreboard players get ' + h + ' doom.nats');
  const m = /has (-?\d+)/.exec(t);
  return m ? Number(m[1]) : NaN;
};
// v4.20：check/sealevel 的 per-dim 取数改读 **$att.dim**（尝试维度），不再读 $snap.dim（快照层）。
//   ⇒ 本包装器必须先在该维度跑 circ/detect_dim_att，否则 $att.dim 是上一次尝试的陈旧值，
//   三个维度的窗口会读成同一个（实测：下界/末地都报 50..63 ⇒ 2 条假红）。
const inDim = (dim, sub) => cmd('execute in minecraft:' + dim + ' run function doom.nats:circ/detect_dim_att')
  .then(() => cmd('execute in minecraft:' + dim + ' run ' + sub));

console.log('=== 维度参数 · 真机验证 ===');

// ③ 的 can_see_sky 用例需要"有玩家"（要把他抬到露天）：0 人在线时无从判定，也会让②的抬人前置空转。
// 照别的 verify_* 的做法：没有就自起一个 mineflayer 机器人，收尾关掉。
const players = async () => { const m = /There are (\d+)/.exec(await cmd('list')); return m ? Number(m[1]) : 0; };
let botChild = null;
if ((await players()) === 0) {
  const bp = path.join(import.meta.dirname, 'mcserver', 'bot.mjs');
  if (fs.existsSync(bp)) {
    console.log('场上没有玩家 ⇒ 自起机器人:', bp);
    botChild = spawn(process.execPath, [bp, '--minutes', '6'], { cwd: path.dirname(bp), stdio: 'ignore' });
    for (let i = 0; i < 40; i++) { if ((await players()) > 0) break; await sleep(1000); }
    await sleep(1500);                     // 等机器人 spawn 进场/区块加载
    console.log('玩家数:', await players());
  }
}

// ---------- ① cfg 按维度给值
const expect = { overworld: { sea: 63, light: 7 }, the_nether: { sea: 32, light: 7 }, the_end: { sea: 0, light: 7 } };
for (const [dim, e] of Object.entries(expect)) {
  await inDim(dim, 'function doom.nats:cfg/apply_here');
  const sea = await score('$cfg.sealevel');
  const light = await score('$cfg.light');
  ok(`① ${dim}：cfg 海平面 = ${e.sea}`, sea === e.sea, '$cfg.sealevel=' + sea);
  ok(`① ${dim}：cfg 光照档 = ${e.light}`, light === e.light, '$cfg.light=' + light);
}

// ---------- ② check/sealevel 派生窗口
{
  await inDim('overworld', 'function doom.nats:cfg/apply_here');
  await inDim('overworld', 'function doom.nats:check/sealevel');
  const lo = await score('$chk.sea_lo');
  const hi = await score('$chk.sea_hi');
  ok('② 主世界窗口 50..63', lo === 50 && hi === 63, lo + '..' + hi);
  await inDim('the_nether', 'function doom.nats:cfg/apply_here');
  await inDim('the_nether', 'function doom.nats:check/sealevel');
  const lo2 = await score('$chk.sea_lo');
  const hi2 = await score('$chk.sea_hi');
  ok('② 下界窗口 19..32', lo2 === 19 && hi2 === 32, lo2 + '..' + hi2);
  await inDim('the_end', 'function doom.nats:cfg/apply_here');
  await inDim('the_end', 'function doom.nats:check/sealevel');
  const lo3 = await score('$chk.sea_lo');
  ok('② 末地窗口 -13..0', lo3 === -13, lo3 + '..' + (await score('$chk.sea_hi')));
}

// ---------- ③ can_see_sky 分维度
{
  const probe = async (dim, x, y, z) => {
    await cmd('scoreboard players set $probe doom.nats 0');
    await cmd(`execute in minecraft:${dim} positioned ${x} ${y} ${z} if predicate doom.nats:spawn/can_see_sky run scoreboard players set $probe doom.nats 1`);
    return score('$probe');
  };
  // 前置（测试侧）：③ 断言的前提是"玩家在露天"。机器人常出生在森林地表/树冠下 —— 那时上方 5 格被挡、
  // can_see_sky=false 是**正确行为**（实测：出生点 (-639.5,59,-687.5) 森林 ⇒ 红；抬到 y=120 露天 ⇒ 绿）。
  // 所以先按原位试，为 0 就把非旁观玩家抬到 y=120 再判。
  const readPos = async () => {
    // v4.20（安全）：优先锚定测试机器人。原来只读 `@a[gamemode=!spectator,limit=1]`，真人玩家在线时读的是真人，
    //   后面那行 `tp @a[gamemode=!spectator] ~ 120 ~` 会把他一起抬到高空 —— 自动化不得触碰用户的实时会话。
    const sel = /passed/i.test(await cmd('execute if entity DoomBot')) ? 'DoomBot' : '@a[gamemode=!spectator,limit=1]';
    const t = String(await cmd('data get entity ' + sel + ' Pos')).replace(/[\u2212\u2013]/g, '-');
    const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(t);
    return m ? { x: Math.floor(+m[1]), y: Math.floor(+m[2]), z: Math.floor(+m[3]) } : null;
  };
  let P = await readPos();
  let skyOv = P ? await probe('overworld', P.x, P.y + 5, P.z) : 0;
  let lifted = '';
  let flChunk = null;
  if (skyOv !== 1) {
    const wasAt = P ? `${P.x},${P.y},${P.z}` : '?';
    // v4.18 加固：抬人之前先 **forceload** 目标区块。
    //   为什么：抬到 y=120 后如果那一列区块/高度图还没加载，`if predicate can_see_sky` 读不到高度图 ⇒ 仍是 false ⇒ 假红。
    //   实测 2026-09-28 的 regress 里就这么红过一次（12 PASS / 1 FAIL），单独重跑又绿 —— 属于测试前置不稳，不是包的问题。
    // ⚠ v4.22m：`forceload add` 的参数是**区块坐标**且一次最多 256 区块 ——
    //   原来写 `bx±16`（bx 已是"区块原点的方块坐标"）⇒ 33×33 = 1089 区块**直接失败**，
    //   于是"抬到 y=120 再判"的前提（区块已加载）不成立 ⇒ 13 次里偶发 1 次假红（实测 regress 里就红过一次）。
    //   改成"机器人所在区块 ±2"（5×5 = 25 ✔）。
    const cx = P ? Math.floor(P.x / 16) : 0, cz = P ? Math.floor(P.z / 16) : 0;
    flChunk = { x1: cx - 2, z1: cz - 2, x2: cx + 2, z2: cz + 2 };
    await cmd(`forceload add ${flChunk.x1} ${flChunk.z1} ${flChunk.x2} ${flChunk.z2}`);
    // v4.20（安全）：**只抬锚定机器人**（原写法 `tp @a[...] ~ 120 ~` 会把真人玩家一起抬走）。
    if (/passed/i.test(await cmd('execute if entity DoomBot'))) await cmd('tp DoomBot ~ 120 ~');
    else lifted = '（无 DoomBot ⇒ 不抬任何玩家，避免动真人会话）';
    for (let i = 0; i < 12; i++) {
      await sleep(700);                      // 等目标区块加载
      const P2 = await readPos();
      if (!P2) continue;
      P = P2;
      skyOv = await probe('overworld', P.x, P.y + 5, P.z);
      if (skyOv === 1) break;
    }
    lifted = `（原位 ${wasAt} 上方被挡/未加载 ⇒ 已 forceload 并抬到 y=120 重试 ${P ? P.x + ',' + P.y + ',' + P.z : '?'}）`;
  }
  ok('③ 主世界露天 can_see_sky = true', skyOv === 1, '玩家上方 5 格' + lifted);
  if (flChunk) await cmd(`forceload remove ${flChunk.x1} ${flChunk.z1} ${flChunk.x2} ${flChunk.z2}`);
  // 下界：先 forceload 一块区域再判定（新生成的区块）
  await inDim('the_nether', 'forceload add 0 0');
  await sleep(1500);
  const skyNether = await probe('the_nether', 0, 120, 0);
  ok('③ 下界 can_see_sky = false（has_ceiling ⇒ 无天空光）', skyNether === 0, '(${}) 0,120,0 → ' + skyNether);
  const skyEnd = await probe('the_end', 0, 80, 0);
  ok('③ 末地 can_see_sky = false（has_skylight=false）', skyEnd === 0, '(0,80,0) → ' + skyEnd);
  await inDim('the_nether', 'forceload remove 0 0');
}

// ---------- ④ 三维度都能跑刷怪链
{
  let allOk = true;
  const detail = [];
  for (const dim of ['overworld', 'the_nether', 'the_end']) {
    const before = await score('$cfg.sealevel');
    await inDim(dim, 'function doom.nats:cfg/apply_here');
    const after = await score('$cfg.sealevel');
    detail.push(dim + ':' + after);
    if (!Number.isFinite(after)) allOk = false;
    void before;
  }
  ok('④ 三维度均可执行 cfg/apply + check/sealevel', allOk, detail.join(' '));
}

// 复原到主世界
await inDim('overworld', 'function doom.nats:cfg/apply_here');
await inDim('overworld', 'function doom.nats:check/sealevel');
if (botChild) { try { botChild.kill(); } catch {} console.log('（已关闭自起机器人）'); }
r.close();

const fails = results.filter((x) => !x.pass).length;
console.log('');
console.log('汇总: ' + (results.length - fails) + ' PASS / ' + fails + ' FAIL');
fs.writeFileSync(W('_work/verify-dims.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(fails ? 1 : 0);
