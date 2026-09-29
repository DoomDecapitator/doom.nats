import { R, W } from './_root.mjs';   // 可移植路径解析（见 tests/README.md）
// _work/verify_spawn24.mjs —— P1-5「世界出生点 24 格排除」真机验证（v4.17）
//
//   node _work/verify_spawn24.mjs
//
// 源码依据（NaturalSpawner.isRightDistanceToPlayerAndSpawnPoint，1.21.6 named 208 行）：
//   if (distSq <= 576.0) return false;                                  ← 玩家 24 格（既有 reason=1）
//   else if (level.getSharedSpawnPos().closerToCenterThan(
//                new Vec3(pos.getX()+0.5, pos.getY(), pos.getZ()+0.5), 24.0)) return false;   ← 本次新增
// 数据包读不到 getSharedSpawnPos() ⇒ 由作者在 doom.nats:config 声明 spawnX/Y/Z（+ spawn24:1），默认关闭。
//
// 断言：
//   T0 离线：整数判定（4d² < 2304）与 vanilla 浮点判定逐点等价（含 y 轴半格偏移）
//   T1 默认关闭：未声明坐标时不拒（cfg 门槛把 spawn24 压回 0）
//   T2 d=0 ⇒ 拒（reason=10）；T3 边界 dx=23 拒 / dx=24 不拒（vanilla 用 `<`）
//   T4 y 轴半格：dy=23（23.5 ⇒ 552.25）拒 / dy=24（24.5 ⇒ 600.25）不拒
//   T5 三轴合成：400.25 拒 / 592.25 不拒（与整数式一致）
//   T6 只写 spawn24=1 而缺坐标 ⇒ 门槛生效（$cfg.spawn24=0）
//   T7 远距离（+1000）不误拒，且不溢出
//   T8 真链路集成：pack 原点声明为出生点 ⇒ 每组的首个候选点必被 reason=10 拒（$rej.10 增长）；
//      同一位置关掉 spawn24 的对照跑 ⇒ $rej.10 零增长
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const ok = (n, p, d) => { res.push(p); console.log((p ? 'PASS ' : 'FAIL ') + n + '  ' + d); };

// ---------------------------------------------------------------- T0 离线等价
{
  const mine = (sx, sy, sz, px, py, pz) => {
    const dx = sx - px, dy = sy - py, dz = sz - pz;
    if (Math.abs(dx) > 24 || Math.abs(dy) > 24 || Math.abs(dz) > 24) return false;
    const q = 4 * dx * dx + (2 * dy + 1) * (2 * dy + 1) + 4 * dz * dz;   // 4d²
    return q <= 2303;                                                    // 4d² < 2304
  };
  const vanilla = (sx, sy, sz, px, py, pz) => {
    const dx = sx + 0.5 - (px + 0.5), dy = sy + 0.5 - py, dz = sz + 0.5 - (pz + 0.5);
    return dx * dx + dy * dy + dz * dz < 576;
  };
  let diff = 0, hits = 0, maxQ = 0, n = 0;
  for (let dx = -30; dx <= 30; dx++) for (let dy = -30; dy <= 30; dy++) for (let dz = -30; dz <= 30; dz++) {
    const a = mine(dx, dy, dz, 0, 0, 0), b = vanilla(dx, dy, dz, 0, 0, 0);
    n++; if (a !== b) diff++; if (a) hits++;
    if (Math.abs(dx) <= 24 && Math.abs(dy) <= 24 && Math.abs(dz) <= 24) maxQ = Math.max(maxQ, 4 * dx * dx + (2 * dy + 1) * (2 * dy + 1) + 4 * dz * dz);
  }
  ok('T0 离线：整数判定 ≡ vanilla 浮点判定（61³ 点全扫）', diff === 0, `${n} 点 · 不一致 ${diff} · 命中(拒) ${hits} · 最大 4d²=${maxQ}（int 安全）`);
}

// ---------------------------------------------------------------- 连接与前置
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const set = (h, v) => cmd('scoreboard players set ' + h + ' doom.nats ' + v);
const score = async (h) => { const t = await cmd('scoreboard players get ' + h + ' doom.nats'); const m = /has (-?\d+)/.exec(t); return m ? Number(m[1]) : NaN; };
const num = (s) => String(s).replace(/[\u2212\u2013\u2014]/g, '-');

let bot = null;
const players = async () => { const m = /There are (\d+)/.exec(await cmd('list')); return m ? Number(m[1]) : 0; };
if ((await players()) === 0) {
  const bp = path.join(import.meta.dirname, 'mcserver', 'bot.mjs');
  bot = spawn(process.execPath, [bp, '--minutes', '12'], { cwd: path.dirname(bp), stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { if ((await players()) > 0) break; await sleep(1000); }
  console.log('（自起机器人供玩家距离用例使用）');
}
await sleep(1200);

const playerPos = async () => {
  for (let i = 0; i < 20; i++) {
    const t = num(await cmd('data get entity @a[gamemode=!spectator,limit=1] Pos'));
    const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(t);
    if (m) return { x: Math.floor(+m[1]), y: Math.floor(+m[2]), z: Math.floor(+m[3]) };
    await sleep(1000);
  }
  return null;
};
// ⚠ 距离选择器 `@a[distance=..N]` 是**按执行维度**选人的：机器人可能在下界（别的脚本把玩家带过去过），
//   所以每次判定都要 `execute in <玩家维度>` 再 positioned，否则整条链在"本维度没有玩家"下退化成 reason=2。
const playerDim = async () => {
  const t = await cmd('data get entity @a[gamemode=!spectator,limit=1] Dimension');
  const m = /"(minecraft:[a-z_]+)"/.exec(t);
  return m ? m[1] : 'minecraft:overworld';
};
const P = await playerPos();
if (!P) { console.log('FAIL 取不到玩家坐标（无玩家在线）'); r.close && r.close(); process.exit(1); }
const DIM = await playerDim();
// 候选点选在玩家 +70 格：> 24（不触发 reason=1）、< 128（不触发 reason=2），且区块已加载（真链路要用）
const Q = { x: P.x + 70, y: P.y, z: P.z };
console.log('玩家', JSON.stringify(P), '· 维度', DIM, '· 候选/执行点', JSON.stringify(Q));

// 冻结后台刷怪（只为本脚本计数干净；结束时恢复）
const OLD = { snap: await score('$snap_period'), eff: await score('$eff.period') };
await set('$snap_period', 20000);
await set('$eff.period', 100000);
await sleep(600);

const applyCfg = async (cfg) => {
  await cmd('data remove storage doom.nats:config spawn24');
  await cmd('data remove storage doom.nats:config spawnX');
  await cmd('data remove storage doom.nats:config spawnY');
  await cmd('data remove storage doom.nats:config spawnZ');
  if (cfg) await cmd('data merge storage doom.nats:config ' + JSON.stringify(cfg));
  await cmd('function doom.nats:cfg/apply');
  return { on: await score('$cfg.spawn24'), x: await score('$cfg.spawn_x'), y: await score('$cfg.spawn_y'), z: await score('$cfg.spawn_z') };
};
// 在候选点跑**真的** check/distance（$wx/$py/$wz 与执行位置都设成候选点，与真实链路一致）
const runCheck = async (cand) => {
  await set('$wx', cand.x); await set('$py', cand.y); await set('$wz', cand.z);
  await cmd('scoreboard players set $chk.ok doom.nats 1');
  await cmd('scoreboard players set $chk.reason doom.nats 0');
  const dim = await playerDim();
  await cmd(`execute in ${dim} positioned ${cand.x} ${cand.y} ${cand.z} run function doom.nats:check/distance`);
  return { ok: await score('$chk.ok'), reason: await score('$chk.reason') };
};

// ---------------------------------------------------------------- T1 默认关闭
{
  const c = await applyCfg(null);
  const q = await runCheck(Q);
  ok('T1 未声明坐标 ⇒ 默认关闭（不拒）', c.on === 0 && q.ok === 1 && q.reason === 0,
    `$cfg.spawn24=${c.on}（门槛把默认 0,0,0 压回关闭）· 判定 ok=${q.ok} reason=${q.reason}`);
}

// ---------------------------------------------------------------- T2/T3 d=0 与边界
{
  const c = await applyCfg({ spawn24: 1, spawnX: Q.x, spawnY: Q.y, spawnZ: Q.z });
  const q0 = await runCheck(Q);
  ok('T2 候选点=出生点（d=0）⇒ 拒 reason=10', c.on === 1 && q0.ok === 0 && q0.reason === 10,
    `$cfg=(${c.x},${c.y},${c.z}) · ok=${q0.ok} reason=${q0.reason}`);

  await applyCfg({ spawn24: 1, spawnX: Q.x + 23, spawnY: Q.y, spawnZ: Q.z });
  const q23 = await runCheck(Q);
  await applyCfg({ spawn24: 1, spawnX: Q.x + 24, spawnY: Q.y, spawnZ: Q.z });
  const q24 = await runCheck(Q);
  ok('T3 边界 dx=23 拒 / dx=24 不拒（vanilla 判定用 `<`）', q23.reason === 10 && q24.ok === 1 && q24.reason === 0,
    `dx=23: ok=${q23.ok} reason=${q23.reason}（23²=529<576）· dx=24: ok=${q24.ok} reason=${q24.reason}（576 不 < 576）`);
}

// ---------------------------------------------------------------- T4 y 轴半格
{
  await applyCfg({ spawn24: 1, spawnX: Q.x, spawnY: Q.y + 23, spawnZ: Q.z });
  const qy23 = await runCheck(Q);
  await applyCfg({ spawn24: 1, spawnX: Q.x, spawnY: Q.y + 24, spawnZ: Q.z });
  const qy24 = await runCheck(Q);
  ok('T4 y 轴半格偏移（BlockPos 中心 +0.5）照抄 vanilla', qy23.reason === 10 && qy24.ok === 1 && qy24.reason === 0,
    `dy=23（23.5 ⇒ 552.25）: reason=${qy23.reason} · dy=24（24.5 ⇒ 600.25）: ok=${qy24.ok} reason=${qy24.reason}`);
}

// ---------------------------------------------------------------- T5 三轴合成
{
  await applyCfg({ spawn24: 1, spawnX: Q.x + 12, spawnY: Q.y + 12, spawnZ: Q.z + 10 });
  const cfgA = { on: await score('$cfg.spawn24'), x: await score('$cfg.spawn_x'), y: await score('$cfg.spawn_y'), z: await score('$cfg.spawn_z') };
  const a = await runCheck(Q);
  const sA = { x: await score('$s24.x'), y: await score('$s24.y'), z: await score('$s24.z'), c2: await score('#2'), c4: await score('#4') };
  await applyCfg({ spawn24: 1, spawnX: Q.x + 16, spawnY: Q.y + 16, spawnZ: Q.z + 8 });
  const b = await runCheck(Q);
  const sB = { x: await score('$s24.x'), y: await score('$s24.y'), z: await score('$s24.z') };
  ok('T5 三轴合成：400.25 拒 / 592.25 不拒', a.reason === 10 && b.ok === 1 && b.reason === 0,
    `(12,12,10)=400.25: reason=${a.reason} [cfg=${JSON.stringify(cfgA)} s24=${JSON.stringify(sA)}] · (16,16,8)=592.25: ok=${b.ok} reason=${b.reason} s24=${JSON.stringify(sB)}`);
}

// ---------------------------------------------------------------- T6 门槛
{
  const c = await applyCfg({ spawn24: 1 });
  const q = await runCheck(Q);
  ok('T6 只写 spawn24=1 缺坐标 ⇒ 门槛生效（不拒）', c.on === 0 && q.ok === 1,
    `$cfg.spawn24=${c.on}（spawnX/Y/Z 未声明）· 判定 ok=${q.ok} reason=${q.reason}`);
}

// ---------------------------------------------------------------- T7 远距离不误拒
{
  const c = await applyCfg({ spawn24: 1, spawnX: Q.x + 1000, spawnY: Q.y - 300, spawnZ: Q.z - 1000 });
  const q = await runCheck(Q);
  const s24 = { x: await score('$s24.x'), y: await score('$s24.y'), z: await score('$s24.z') };
  ok('T7 出生点远在 1000+ 格外 ⇒ 不误拒（预筛短路）', c.on === 1 && q.ok === 1 && q.reason === 0,
    `判定 ok=${q.ok} reason=${q.reason} · $s24=(${s24.x},${s24.y},${s24.z})（预筛后未做平方，故仍为原始 Δ）`);
}

// ---------------------------------------------------------------- T8 真链路集成
{
  const pos = `data merge storage doom.nats:pos {x:${Q.x},y:${Q.y},z:${Q.z}}`;
  const rejTenth = async () => {
    await cmd('scoreboard players add $rej.10 doom.nats 0');
    return await score('$rej.10');
  };
  const N = 12;
  const dimNow = await playerDim();
  // 实验组：出生点 = pack 原点 ⇒ 每组的**首个候选点**（游走偏移 ≤ ±5）必落入 24 格内 ⇒ reason=10
  await applyCfg({ spawn24: 1, spawnX: Q.x, spawnY: Q.y, spawnZ: Q.z });
  await cmd(pos); await set('$py', Q.y);
  const a0 = await rejTenth();
  const s0 = await score('$spawned');
  for (let i = 0; i < N; i++) {
    await set('$py', Q.y);
    await cmd(`execute in ${dimNow} run function doom.nats:spawn/at with storage doom.nats:pos`);
  }
  const a1 = await rejTenth();
  const s1 = await score('$spawned');
  // 对照组：同一位置、同一流程，只把 spawn24 关掉
  await applyCfg(null);
  await cmd(pos); await set('$py', Q.y);
  const b0 = await rejTenth();
  for (let i = 0; i < N; i++) {
    await set('$py', Q.y);
    await cmd(`execute in ${dimNow} run function doom.nats:spawn/at with storage doom.nats:pos`);
  }
  const b1 = await rejTenth();
  const dOn = a1 - a0, dOff = b1 - b0;
  ok('T8 真链路：pack 原点=出生点 ⇒ 首候选被 reason=10 拒（关闭时零增长）', dOn > 0 && dOff === 0 && a1 > 0,
    `维度=${dimNow} · 启用(${N} 次 spawn/at): $rej.10 +${dOn}（累计 ${a1}）· 同位置关闭: +${dOff} · 真生成 ${s1 - s0} 只`);
  await cmd(`execute in ${dimNow} run kill @e[tag=doom.nats.spawned]`);
}

// ---------------------------------------------------------------- 收尾
await applyCfg(null);
await cmd('data remove storage doom.nats:pos');
if (Number.isFinite(OLD.snap) && OLD.snap > 0) await set('$snap_period', OLD.snap);
if (Number.isFinite(OLD.eff) && OLD.eff > 0) await set('$eff.period', OLD.eff);
if (bot) { try { bot.kill(); } catch {} console.log('（已关闭自起机器人）'); }

const pass = res.filter(Boolean).length;
console.log(String.fromCharCode(10) + '汇总: ' + pass + ' PASS / ' + (res.length - pass) + ' FAIL');
const rep = ['# P1-5 世界出生点 24 格排除 · 真机验证', '', `时间: ${new Date().toISOString()}`, `玩家: ${JSON.stringify(P)} · 候选点: ${JSON.stringify(Q)}`, '',
  `合计 ${pass} PASS / ${res.length - pass} FAIL`, '', `（控制台逐条见运行输出）`].join('\n');
try {
  const out = W('doom.nats/reports/验证-出生点24格-') + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.md';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, rep);
  console.log('报告已写入 ' + out);
} catch (e) { console.log('报告写入失败: ' + e.message); }
r.close && r.close();
process.exit(pass === res.length ? 0 : 1);
