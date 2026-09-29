// _work/verify_exp_aj.mjs —— 实验性 AJ/第三方 rig 工具链 rig 桥接（v4.25）真机验收
//
//   RCON_PORT=25582 node _work/verify_exp_aj.mjs [--phase all|rig|empty] [--keep]
//
// 前置：隔离实例 mcserver-aj（25572/RCON 25582）在跑，且已装：
//   · 本变体产物（DOOM_EXP=1 DOOM_RULES=rules/examples/aj DOOM_OUTDIR=_work/aj-build）
//   · 第三方 rig 包 zz-aj-thirdparty-rig（**只用于验收，不并入产物**）
// 探针原则（沿用 v4.23 的教训）：**不自己重算语义**，一律调产物里的真函数（mob/biome/**、spawn/emit、
//   exp/aj/sweep、util/void_kill），并读 scoreboard / NBT 的结果。
//
// 真机踩过的坑（本脚本里都绕开了）：
//   · `ride` 的实体参数必须是**单实体**选择器（否则 "Only one entity is allowed…"）⇒ 一律加 limit=1 或 @n。
//   · display 实体上**没有** RootVehicle NBT（哪怕正在被骑）⇒ 判"是否挂载"要用乘客闭包（exp/aj/sweep 的 live）。
//   · `minecraft:marker` **不能**载客（"Item Display couldn't start riding Marker"）⇒ 挂载没有枢纽层。
//   · 第三方包 thirdparty-rig 的 pack.mcmeta 用 min_format/max_format ⇒ 1.21.6 不认，必须补 pack_format 才可选。
import fs from 'node:fs';
import path from 'node:path';
import { R } from './_root.mjs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const NS = 'doom.nats';
const PHASE = (() => { const i = process.argv.indexOf('--phase'); return i !== -1 ? process.argv[i + 1] : 'all'; })();
const KEEP = process.argv.includes('--keep');
const LOG = process.env.MC_LOG || R('_work/mcserver-aj/logs/latest.log');
const OUT = process.env.DOOM_OUT ? process.env.DOOM_OUT : R('_work');
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const results = [];
const metrics = {};
const ok = (name, pass, detail) => { results.push({ name, pass: !!pass, detail: String(detail) }); console.log((pass ? '✅ ' : '❌ ') + name + '  ' + detail); };

const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const score = async (h) => { const m = /has (-?\d+)/.exec(await cmd(`scoreboard players get ${h} ${NS}`)); return m ? Number(m[1]) : NaN; };
const set = (h, v) => cmd(`scoreboard players set ${h} ${NS} ${v}`);
const nbtRaw = (sel, path) => cmd(`data get entity ${sel} ${path}`);
const posOf = async (sel) => {
  const s = await nbtRaw(sel, 'Pos');
  const m = /\[(-?[\d.]+)d,\s*(-?[\d.]+)d,\s*(-?[\d.]+)d\]/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
/** 实体数（用 scoreboard 转手，避免解析 RCON 文本） */
const count = async (sel) => { await set('$aj.rc', 0); await cmd(`execute store result score $aj.rc ${NS} if entity ${sel}`); return score('$aj.rc'); };
const mspt = async () => { const s = await cmd('tick query'); const m = /Average time per tick: ([\d.]+)ms/.exec(s); return m ? Number(m[1]) : NaN; };
const selNum = async (k) => { const s = await cmd(`data get storage ${NS}:sel`); const m = new RegExp(k + ':\\s*(-?\\d+)').exec(s); return m ? Number(m[1]) : NaN; };
const selStr = async (k) => { const s = await cmd(`data get storage ${NS}:sel`); const m = new RegExp(k + ':\\s*"([^"]*)"').exec(s); return m ? m[1] : ''; };
const T = { live: NS + '.exp.aj.live', rig: NS + '.exp.aj.rig', child: NS + '.exp.aj.child', root: NS + '.exp.aj.root', carrier: NS + '.exp.aj.carrier', anchor: NS + '.exp.aj.anchor' };

const killAll = async () => {
  await cmd(`kill @e[type=#${NS}:exp_aj_display]`);
  await cmd(`kill @e[tag=${T.carrier}]`);
  await cmd('kill @e[tag=doom.nats.exp.aj.live]');
  await sleep(250);
};
const rigCountOf = () => count(`@e[tag=${T.rig}]`);
const liveCountOf = () => count(`@e[tag=${T.rig},tag=${T.live}]`);

// ---------------------------------------------------------------- 头部：加载期门 + 第三方包门
console.log('=== v4.25 实验性 AJ 桥接 · 真机验收（实例 25572/RCON 25582）===');
console.log('phase=' + PHASE + ' · 日志 ' + LOG);

// `--phase empty`：把"空 rigs.json 构建"换进实例做 A/B（探针完全一样），跑完再换回来。
const DP = R('_work/mcserver-aj/world/datapacks');
const swapBuild = (from, to) => {
  fs.rmSync(path.join(DP, to), { recursive: true, force: true });
  fs.cpSync(R('_work/' + from), path.join(DP, to), { recursive: true });
};
const EMPTY_BUILD = 'aj-build-empty';
if (PHASE === 'empty') {
  if (!fs.existsSync(R('_work/' + EMPTY_BUILD))) { console.error('❌ 缺少 ' + EMPTY_BUILD + '（先构建：DOOM_EXP=1 DOOM_RULES=<空 rigs 的目录> DOOM_OUTDIR=_work/aj-build-empty …）'); r.close(); process.exit(2); }
  swapBuild(EMPTY_BUILD, 'doom.nats');
  console.log('（已换入空 rigs.json 构建，跑完会换回 aj-build）');
}

const sizeBefore = (() => { try { return fs.statSync(LOG).size; } catch { return 0; } })();
await cmd('reload');
await sleep(2500);
let tail = '';
try { tail = fs.readFileSync(LOG).subarray(sizeBefore).toString('utf8'); } catch { /* ignore */ }
const badLoad = (tail.match(/Failed to load function/g) || []).length;
ok('0 加载期门：/reload 0 个 Failed to load function', badLoad === 0, '本轮 ' + badLoad + ' 个');

const packList = await cmd('datapack list');
if (!/zz-aj-thirdparty-rig/.test(packList)) {
  console.error('❌ 第三方 rig 包 zz-aj-thirdparty-rig 未启用（下面的验收没意义）：' + packList.slice(0, 240));
  console.error('   原因：它的 pack.mcmeta 用 min_format/max_format（更新的 schema）⇒ 1.21.6 找不到 pack_format，包不可选。');
  console.error('   修法（只动验收实例里的副本，不改第三方内容）：补 "pack_format": 80 → /datapack enable "file/zz-aj-thirdparty-rig"');
  r.close(); process.exit(2);
}

// ---------------------------------------------------------------- 试验场：真·深海 + 受控水槽
let arena = { x: -240, y: 57, z: -592 };
const found = await cmd('locate biome minecraft:deep_ocean');
const lm = /at \[(-?\d+), (-?\d+), (-?\d+)\]/.exec(found);
if (lm) arena = { x: Number(lm[1]), y: Number(lm[2]), z: Number(lm[3]) };
console.log('深海坐标：' + JSON.stringify(arena) + '（' + found.slice(0, 56) + '…）');
const { x: AX, z: AZ } = arena;
const WY = 56;                      // 水槽底（水面 56..62，海平面 63 之下 ⇒ 水下）
const WZ = 53;                      // 僵尸平台（干燥、露天、同上群系）
await cmd(`forceload add ${AX - 48} ${AZ - 48} ${AX + 48} ${AZ + 48}`);
await sleep(900);
await cmd(`fill ${AX - 6} ${WY - 1} ${AZ - 6} ${AX + 6} ${WY - 1} ${AZ + 6} minecraft:stone`);
await cmd(`fill ${AX - 6} ${WY} ${AZ - 6} ${AX + 6} 62 ${AZ + 6} minecraft:water`);
await cmd(`fill ${AX + 10} ${WZ - 1} ${AZ - 3} ${AX + 16} ${WZ - 1} ${AZ + 3} minecraft:stone`);
await cmd(`fill ${AX + 10} ${WZ} ${AZ - 3} ${AX + 16} 66 ${AZ + 3} minecraft:air`);
await sleep(300);
await set('$aj.biome', 0);
await cmd(`execute if biome ${AX} ${WY + 3} ${AZ} minecraft:deep_ocean run scoreboard players set $aj.biome ${NS} 1`);
metrics.arena = { x: AX, y: WY, z: AZ, platform: [AX + 13, WZ, AZ], deep_ocean: (await score('$aj.biome')) === 1 };
await killAll();
// 冻结节拍：探针独占 $sel / $rng（末尾解冻）
await set('$snap_period', 20000); await set('$eff.period', 20000);
await cmd('time set midnight');
await cmd('gamerule doMobSpawning false');
await cmd('gamerule doDaylightCycle false');
await cmd('weather clear');
// 运行时刻作者层（v4.24）可能留了条目 ⇒ 会把生成改道到 author/emit_rt（实测踩过：rig 一个都不出）。
// 本脚本只测**构建期**桥接，所以先把它清空。
await cmd('data remove storage doom.nats:author entries');
await cmd('data remove storage doom.nats:exp entries');
await set('$auth.hit', 0); await set('$exp.hit', 0);

/** 在指定群系表里找第一个命中该 slug 的 $rng（确定性探针，不猜） */
async function rngFor(biomeFn, cat, slug) {
  for (let k = 0; k < 4000; k++) {
    await set('$rng', k);
    await cmd(`execute positioned ${AX} ${WY + 2} ${AZ} run function ${NS}:mob/biome/${biomeFn}/${cat}`);
    if ((await selStr('slug')) === slug) return { rng: k, type: await selStr('type'), rig: await selStr('rig'), ok: await score('$sel.ok') };
  }
  return null;
}
const emitAt = (x, y, z) => cmd(`execute positioned ${x} ${y} ${z} run function ${NS}:spawn/emit with storage ${NS}:sel`);
const ids = { squid: 'demo_rig', zombie: 'placeholder_probe' };
/** 掷点 + 生成 + 等一拍 + 清扫一次（live 标记由 sweep 写） */
async function spawnRig(biomeFn, cat, slug, x, y, z) {
  const hit = await rngFor(biomeFn, cat, slug);
  if (!hit || !hit.rig) return { hit, counts: null };
  await set('$rng', hit.rng);
  await cmd(`execute positioned ${x} ${y} ${z} run function ${NS}:mob/biome/${biomeFn}/${cat}`);
  await emitAt(x, y, z);
  await sleep(700);
  await cmd(`function ${NS}:exp/aj/sweep`);
  await sleep(250);
  return { hit, counts: { carriers: await count(`@e[tag=${T.carrier}.${hit.rig}]`), rigs: await rigCountOf(), roots: await count(`@e[tag=${T.root}]`), live: await liveCountOf() } };
}

// ---------------------------------------------------------------- ①⑥ 命中 + 生成 + 挂载（真 rig）
if (PHASE === 'all' || PHASE === 'rig') {
  await killAll();
  const A = await spawnRig('deep_ocean', 'water_creature', 'squid', AX + 0.5, WY + 2, AZ + 0.5);
  metrics.spawn = A;
  ok('①a 深海 water_creature 表里 squid 命中（固定 $rng）并带上 rig', !!A.hit && A.hit.type === 'minecraft:squid' && A.hit.rig === ids.squid,
    A.hit ? `$rng=${A.hit.rng} type=${A.hit.type} rig=${A.hit.rig || '(空)'}` : '扫了 4000 个 $rng 都没命中 squid');
  if (A.counts) {
    ok('①b 内核生成 1 只 + rig 整云认领（真第三方 rig）', A.counts.carriers === 1 && A.counts.roots === 1 && A.counts.rigs === 50,
      `内核 ${A.counts.carriers} · rig display ${A.counts.rigs}（期望 50：1 根 + 1 空节点 + 16 组实体 + 32 块）· 根 ${A.counts.roots}`);
    ok('①c rig 全部可达内核（乘客闭包：live = rig）', A.counts.live === A.counts.rigs && A.counts.rigs > 0, `已挂载 ${A.counts.live}/${A.counts.rigs}`);
    const pass = await nbtRaw(`@e[tag=${T.carrier}.${ids.squid},limit=1]`, 'Passengers');
    const cPos = await posOf(`@e[tag=${T.carrier}.${ids.squid},limit=1]`);
    const rPos = await posOf(`@e[tag=${T.root},limit=1]`);
    const d = cPos && rPos ? Math.hypot(cPos[0] - rPos[0], cPos[1] - rPos[1], cPos[2] - rPos[2]) : NaN;
    metrics.mount = { passengersPresent: !/Found no elements/.test(pass), carrierPos: cPos, rootPos: rPos, dist: d };
    ok('⑥ rig 真的是内核的乘客（内核 Passengers 非空 + 根与内核同点）', !/Found no elements/.test(pass) && d <= 1.5,
      `内核 Passengers=${/Found no elements/.test(pass) ? '空' : '有'} · 根↔内核距离 ${Number.isNaN(d) ? 'n/a' : d.toFixed(2)} 格（挂载点偏移）`);

    // ---------------------------------------------------------------- ② 位移后跟随
    await cmd(`data merge entity @e[tag=${T.carrier}.${ids.squid},limit=1] {NoAI:1b}`);
    await sleep(200);
    const before = await posOf(`@e[tag=${T.root},limit=1]`);
    await cmd(`tp @e[tag=${T.carrier}.${ids.squid},limit=1] ${AX - 5.5} ${WY + 2} ${AZ + 0.5}`);
    await sleep(400);
    const after = await posOf(`@e[tag=${T.root},limit=1]`);
    const cAfter = await posOf(`@e[tag=${T.carrier}.${ids.squid},limit=1]`);
    const movedRig = before && after ? Math.hypot(after[0] - before[0], after[2] - before[2]) : NaN;
    const relErr = after && cAfter ? Math.hypot(after[0] - cAfter[0], after[2] - cAfter[2]) : NaN;
    metrics.follow = { before, after, carrierAfter: cAfter, rigMoved: movedRig, relErr };
    ok('②a 内核被 tp 后 rig 跟随（位移一致）', movedRig >= 4.0 && relErr <= 0.05,
      `rig 位移 ${movedRig.toFixed(2)} 格 · 与内核水平误差 ${relErr.toFixed(4)} 格`);
    // ②b 逐格位移 ×10：内核每移动 1 格就比一次位置（比"等它自己游"更确定；自走只作观测值记录）
    const steps = [];
    for (let i = 0; i < 10; i++) {
      await cmd(`tp @e[tag=${T.carrier}.${ids.squid},limit=1] ${AX - 5.5 - (i + 1)} ${WY + 2} ${AZ + 0.5}`);
      await sleep(160);
      const cc = await posOf(`@e[tag=${T.carrier}.${ids.squid},limit=1]`);
      const rr = await posOf(`@e[tag=${T.root},limit=1]`);
      if (cc && rr) steps.push(Math.hypot(cc[0] - rr[0], cc[2] - rr[2]));
    }
    const maxErr = steps.length ? Math.max(...steps) : NaN;
    metrics.stepFollow = { steps: steps.length, maxErr, samples: steps.map((x) => Number(x.toFixed(3))) };
    ok('②b 内核逐格位移 ×10，rig 每步同步（10 步最大水平误差）', steps.length === 10 && maxErr <= 0.05,
      `10 步 · 最大误差 ${Number.isNaN(maxErr) ? 'n/a' : maxErr.toFixed(4)} 格（样本 ${steps.map((x) => x.toFixed(2)).join('/')}）`);
    // 观测（不断言）：放开 AI 让它自己游 4s，记录两侧位移（squid 可能压根不动 ⇒ 只作参考）
    await cmd(`data merge entity @e[tag=${T.carrier}.${ids.squid},limit=1] {NoAI:0b}`);
    const p0 = await posOf(`@e[tag=${T.carrier}.${ids.squid},limit=1]`);
    const q0 = await posOf(`@e[tag=${T.root},limit=1]`);
    await sleep(4000);
    const p1 = await posOf(`@e[tag=${T.carrier}.${ids.squid},limit=1]`);
    const q1 = await posOf(`@e[tag=${T.root},limit=1]`);
    const sm = p0 && p1 ? Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) : NaN;
    const rm = q0 && q1 ? Math.hypot(q1[0] - q0[0], q1[2] - q0[2]) : NaN;
    const drift = p1 && q1 ? Math.hypot(p1[0] - q1[0], p1[2] - q1[2]) : NaN;
    metrics.selfMove = { carrier: sm, rig: rm, drift };
    console.log(`  观测②b'：放开 AI 4s，内核自走 ${sm.toFixed(2)} 格 · rig ${rm.toFixed(2)} 格 · 水平漂移 ${drift.toFixed(4)} 格（squid 可能不动，故不断言）`);
  } else {
    ok('①b 内核生成 1 只 + rig 整云认领（真第三方 rig）', false, '掷点失败');
    ok('①c rig 全部可达内核（乘客闭包：live = rig）', false, '掷点失败');
    ok('⑥ rig 真的是内核的乘客（内核 Passengers 非空 + 根与内核同点）', false, '掷点失败');
    ok('②a 内核被 tp 后 rig 跟随（位移一致）', false, '掷点失败');
    ok('②b 内核**自己游**时 rig 同步跟随', false, '掷点失败');
  }

  // ---------------------------------------------------------------- ④ 容量按内核计入（monster：主世界有计数行）
  //  ⚠ 旁证发现（未改默认产物）：check/caps 只给 monster/creature/ambient 写了**主世界**计数，
  //     water_creature / water_ambient / underground_water_creature / axolotls 只有 .nether/.end
  //     ⇒ 主世界这 4 类的全局容量判定恒读 0。所以这里用 monster（僵尸/占位 rig）做容量验收。
  {
    await killAll();
    await cmd(`function ${NS}:circ/snapshot`);
    await sleep(300);
    const cnt0 = await score('$cnt.monster');
    const z = await rngFor('plains', 'monster', 'zombie');
    if (z) {
      await set('$rng', z.rng);
      await cmd(`execute positioned ${AX + 13} ${WZ} ${AZ} run function ${NS}:mob/biome/plains/monster`);
      await emitAt(AX + 13.5, WZ, AZ + 0.5);
      await sleep(500);
      await cmd(`function ${NS}:circ/snapshot`);
      await sleep(300);
      const cnt1 = await score('$cnt.monster');
      const disps = await count(`@e[tag=${T.rig}]`);
      const catDisplays = await count(`@e[tag=${T.rig},type=#${NS}:monster]`);
      metrics.cap = { without: cnt0, withRig: cnt1, displays: disps, displaysInCat: catDisplays };
      ok('④ 容量只按内核计入（display 不属于任何 mob 类别）', cnt1 - cnt0 === 1 && catDisplays === 0 && disps === 4,
        `$cnt.monster ${cnt0} → ${cnt1}（Δ${cnt1 - cnt0}，期望 1）· 场上 display ${disps} 只，属于 monster 类别的 ${catDisplays} 只`);
    } else {
      ok('④ 容量只按内核计入（display 不属于任何 mob 类别）', false, 'zombie 掷点失败');
    }
    await killAll();
  }

  // ---------------------------------------------------------------- ③ 消失层 + 清扫（0 残留）
  {
    await killAll();
    const B = await spawnRig('deep_ocean', 'water_creature', 'squid', AX + 0.5, WY + 2, AZ + 0.5);
    if (B.counts) {
      await cmd(`execute as @e[tag=${T.carrier}.${ids.squid},limit=1] run function ${NS}:util/void_kill`);
      await sleep(2000);
      const carGone = await count(`@e[tag=${T.carrier}.${ids.squid}]`);
      const leftAt40 = await rigCountOf();
      await sleep(4600);                  // 再过两轮 40t 清扫
      const left = await rigCountOf();
      const children = await count(`@e[tag=${T.child}]`);
      metrics.sweep = { rigsBefore: B.counts.rigs, carGone, leftAt40, left, children };
      ok('③ 内核被回收后 rig 被清扫干净（0 残留）', carGone === 0 && left === 0 && children === 0 && B.counts.rigs === 50,
        `清扫前 ${B.counts.rigs} 只 · 内核 2s 内消失 ${carGone === 0 ? '✔' : '✘（还在 ' + carGone + ' 只）'} · 40t 后残留 ${leftAt40} · ~6.6s 后残留 ${left}（乘客块 ${children}）`);
    } else {
      ok('③ 内核被回收后 rig 被清扫干净（0 残留）', false, '掷点失败');
    }
    await killAll();
  }

  // ---------------------------------------------------------------- ①d ②c 占位 rig（零依赖）+ 自走跟随
  {
    const Z = await spawnRig('plains', 'monster', 'zombie', AX + 13.5, WZ, AZ + 0.5);
    metrics.spawnZombie = Z;
    if (Z.counts) {
      ok('①d 占位 rig（零依赖手搓骨架）：生成 4 件 + 挂载', Z.counts.rigs === 4 && Z.counts.roots === 1 && Z.counts.live === 4,
        `display ${Z.counts.rigs}（期望 4）· 根 ${Z.counts.roots} · 已挂载 ${Z.counts.live}`);
      const p0 = await posOf(`@e[tag=${T.carrier}.${ids.zombie},limit=1]`);
      const q0 = await posOf(`@e[tag=${T.root},limit=1]`);
      await cmd(`tp @e[tag=${T.carrier}.${ids.zombie},limit=1] ${AX + 18.5} ${WZ} ${AZ + 0.5}`);
      await sleep(900);
      const p1 = await posOf(`@e[tag=${T.carrier}.${ids.zombie},limit=1]`);
      const q1 = await posOf(`@e[tag=${T.root},limit=1]`);
      const move = p0 && p1 ? Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) : NaN;
      const rmove = q0 && q1 ? Math.hypot(q1[0] - q0[0], q1[2] - q0[2]) : NaN;
      const drift = p1 && q1 ? Math.hypot(p1[0] - q1[0], p1[2] - q1[2]) : NaN;
      metrics.selfMoveZombie = { carrier: move, rig: rmove, drift };
      ok('②c 僵尸内核被 tp 后占位 rig 跟随（同一路径第二例）', move >= 4.5 && Math.abs(move - rmove) <= 0.05,
        `内核 ${move.toFixed(2)} 格 · rig ${rmove.toFixed(2)} 格 · 漂移 ${drift.toFixed(4)} 格`);
    } else {
      ok('①d 占位 rig（零依赖手搓骨架）：生成 4 件 + 挂载', false, '掷点失败');
      ok('②c 僵尸自走时占位 rig 跟随', false, '掷点失败');
    }
  }
}

// ---------------------------------------------------------------- ⑤ 空 rigs.json ⇒ 行为与原版一致
if (PHASE === 'empty') {
  await killAll();
  const carBefore = await count(`@e[type=minecraft:zombie,tag=${NS}.spawned]`);
  // 先清掉上一相残留的 sel.rig：$sel 是持久 storage，不清的话读到的 rig 值是上一相留下的
  // （实测踩过：空构建里 $sel.rig 仍显示 demo_rig ⇒ 误判）；真正的判据是"有没有 display"。
  await cmd('data remove storage doom.nats:sel rig');
  const z = await rngFor('plains', 'monster', 'zombie');
  if (z) {
    await set('$rng', z.rng);
    await cmd(`execute positioned ${AX + 13} ${WZ} ${AZ} run function ${NS}:mob/biome/plains/monster`);
    await emitAt(AX + 13.5, WZ, AZ + 0.5);
    await sleep(600);
    const spawned = (await count(`@e[type=minecraft:zombie,tag=${NS}.spawned]`)) - carBefore;
    const disps = await count(`@e[type=#${NS}:exp_aj_display]`);
    ok('⑤ 空 rigs.json（默认路径）：只生内核、没有任何 rig/display', spawned === 1 && disps === 0 && !z.rig,
      `内核 +${spawned}（期望 1）· display ${disps}（期望 0）· $sel.rig=${z.rig || '(空)'}`);
  } else {
    ok('⑤ 空 rigs.json（默认路径）：只生内核、没有任何 rig/display', false, 'zombie 掷点失败');
  }
  await killAll();
}

// ---------------------------------------------------------------- ⑦ 动画由谁驱动 + 成本量级
if (PHASE === 'all' || PHASE === 'rig') {
  const animateDir = R('_work/aj-ref/thirdparty-rig/data/rigns/function/animate');
  let kf = 0, merges = 0, schedules = 0, ticks = 0, mergesPerKeyframe = 0;
  if (fs.existsSync(animateDir)) {
    for (const f of fs.readdirSync(animateDir)) {
      kf++;
      const txt = fs.readFileSync(animateDir + '/' + f, 'utf8');
      merges += (txt.match(/^data merge entity /gm) || []).length;
      schedules += (txt.match(/^schedule function /gm) || []).length;
    }
    mergesPerKeyframe = kf ? Math.round((merges / kf) * 10) / 10 : 0;
    const main = fs.readFileSync(R('_work/aj-ref/thirdparty-rig/data/rigns/function/main.mcfunction'), 'utf8');
    ticks = (main.match(/^execute /gm) || []).length;
  }
  const coreTick = fs.readFileSync(R('_work/aj-build/data/doom.nats/function/core/tick.mcfunction'), 'utf8');
  const bridgeLines = coreTick.split(String.fromCharCode(10)).filter((l) => /^function .*exp\/aj\/tick$/.test(l.trim())).length;
  metrics.anim = { keyframes: kf, merges, mergesPerKeyframe, schedules, thirdPartyTickLines: ticks, bridgeTickLines: bridgeLines };
  ok('⑦a 动画由第三方的 schedule 链驱动、不进我们的 tick（我们只多 1 行转发）',
    kf === 176 && schedules === kf && bridgeLines === 1,
    `keyframe 函数 ${kf} 个 · 每个末尾 schedule 下一帧（共 ${schedules} 条，0.1s≈2t）· 每关键帧 ${mergesPerKeyframe} 行 data merge（合计 ${merges} 行）· core/tick 里我们的转发 ${bridgeLines} 行 · 第三方自己进 tick 的是 main（${ticks} 行）`);

  const sample = async (label) => {
    const v = [];
    for (let i = 0; i < 3; i++) { v.push(await mspt()); await sleep(700); }
    const a = v.filter((x) => !Number.isNaN(x));
    const m = a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    console.log(`   MSPT[${label}] = ${Number.isNaN(m) ? 'n/a' : m.toFixed(2) + 'ms'}（样本 ${v.join('/')}）`);
    return m;
  };
  await killAll();
  await sleep(600);
  const m0 = await sample('0 rig');
  const Z = await spawnRig('plains', 'monster', 'zombie', AX + 13.5, WZ, AZ + 0.5);
  const m1 = await sample('1 rig（占位，无动画）');
  const hit5 = await rngFor('deep_ocean', 'water_creature', 'squid');
  for (let i = 0; i < 4 && hit5; i++) {
    await set('$rng', hit5.rng);
    await cmd(`execute positioned ${AX} ${WY + 2} ${AZ} run function ${NS}:mob/biome/deep_ocean/water_creature`);
    await emitAt(AX + 0.5 + i * 1.5, WY + 2, AZ + 0.5);
    await sleep(250);
  }
  await sleep(1500);
  const m5 = await sample('5 rig（含真 rig 的第三方动画）');
  metrics.mspt = { none: m0, one: m1, five: m5, rigs: await rigCountOf(), live: await liveCountOf(), zombieHit: !!Z.counts };
  ok('⑦b 桥接 + 第三方动画的 MSPT 量级（如实记录，不做阈值断言）', true,
    `0 rig ${m0.toFixed(2)}ms · 1 rig ${m1.toFixed(2)}ms · 5 rig ${m5.toFixed(2)}ms · 场上 ${metrics.mspt.rigs} 只 display / ${metrics.mspt.live} 已挂载`);
  if (!KEEP) await killAll();
}

// ---------------------------------------------------------------- 收尾
await cmd(`function ${NS}:exp/aj/status`);
if (KEEP) {
  console.log('（--keep：保留现场供截图；$snap_period 仍冻结在 20000）');
} else {
  await killAll();
  await set('$snap_period', 20); await cmd(`function ${NS}:circ/snapshot`);
}
if (PHASE === 'empty') {           // 换回 rig 构建，别把实例留在 A/B 的另一边
  swapBuild('aj-build', 'doom.nats');
  await cmd('reload');
  await sleep(1500);
  console.log('（已换回 aj-build 并 reload）');
}
const fails = results.filter((x) => !x.pass);
console.log(`\n结论：${results.length - fails.length} PASS / ${fails.length} FAIL`);
for (const f of fails) console.log('  ❌ ' + f.name + ' :: ' + f.detail);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUT + '/aj-verify-' + PHASE + '.json', JSON.stringify({ when: new Date().toISOString(), phase: PHASE, results, metrics }, null, 2));
console.log('明细：' + OUT + '/aj-verify-' + PHASE + '.json');
r.close();
process.exit(fails.length ? 1 : 0);
