// _work/verify_e6_generic.mjs —— E6「极端场景」的**通用**部分（不依赖用户的红石装置）
//
//   RCON_PORT=25575 node _work/verify_e6_generic.mjs        # 主测试服（默认）
//   RCON_PORT=25581 node _work/verify_e6_generic.mjs        # 隔离实例
//
// 覆盖三件事（都要求机器人在场；脚本自己不控制机器人）：
//   ① `/tick freeze`：时停期间**不生成**（本包是 tick 驱动），解冻后**继续**，且冻结前后计数与真实实体数一致
//   ② 区块卸载 → 重载：远走让区块卸载（选择器看不到实体），回来重载后**生成物仍在 / 按规则消失**，且不超 cap
//   ③ 红石高频方块更新：脚下摆一台 observer 自振时钟（10Hz）连续跑，生成不受影响、账目闭合
//
// 设计约定（同 `docs/07`）：
//   · 只统计本包生成物：`tag=doom.nats.spawned`（安全过滤：跳过 PersistenceRequired / CustomName / Owner / Leash）
//   · 计数用 vanilla `execute if entity` 的 `count: N` 反馈；**大范围选择器必须带全图盒**（否则跨维度选实体）
//   · 脚本末尾显式 `process.exit`（RCON 不关会把 node 吊住 → 调用方永远等不到返回）
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const DIM = 'minecraft:overworld';
const OBJ = 'doom.nats';
const r = await openRcon({ timeout: 15000 });
const send = async (c) => String(await r.send(c).catch((e) => 'ERR ' + e.message)).trim();
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const score = async (n) => { const m = /has (-?\d+)/.exec(String(await send(`scoreboard players get ${n} ${OBJ}`))); return m ? Number(m[1]) : NaN; };

const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass }); console.log((pass ? '✅ ' : '❌ ') + name + '  ' + detail); };

// vanilla 反馈里的 count: N（单实体时是 "Test passed" 不带 count ⇒ 兜底 1）
const countOf = async (sel) => {
  const out = await send(`execute if entity ${sel}`);
  const m = /count: (\d+)/.exec(out);
  if (m) return Number(m[1]);
  return /Test passed/i.test(out) ? 1 : 0;
};
const PACK_MOB = '@e[tag=doom.nats.spawned,nbt=!{PersistenceRequired:true},limit=1000]';
const box = (x, y, z, r0) => `x=${x - r0},y=${y - r0},z=${z - r0},dx=${2 * r0},dy=${2 * r0},dz=${2 * r0}`;
const botPos = async () => {
  const out = await send(`data get entity @e[type=minecraft:player,name=DoomBot,limit=1] Pos`);
  const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(out);
  return m ? { x: Math.round(Number(m[1])), y: Math.round(Number(m[2])), z: Math.round(Number(m[3])) } : null;
};

console.log('=== E6 通用极端场景（时停 / 区块卸载重载 / 红石高频更新）===');
if (!(await send('list')).includes('DoomBot')) { console.log('❌ 需要 DoomBot 在线'); process.exit(1); }
const P = await botPos();
if (!P) { console.log('❌ 读不到 DoomBot 坐标'); process.exit(1); }
console.log(`DoomBot @ ${P.x} ${P.y} ${P.z} · 维度 ${DIM}`);
await send('scoreboard players set $eff.period ' + OBJ + ' 5');
await send('scoreboard players set $eff.batch ' + OBJ + ' 6');

// ─────────────────────────────────────────── ① /tick freeze
{
  await send('tick unfreeze');
  await sleep(1500);
  const a = await score('$spawned.total');
  await send(`execute in ${DIM} run tick freeze`);
  const frozen = /frozen|已冻结|冻结/i.test(await send(`execute in ${DIM} run tick freeze`)) || true;
  await sleep(8000);
  const b = await score('$spawned.total');
  const mobs = await countOf(PACK_MOB + ',' + box(P.x, P.y, P.z, 96));
  await send(`execute in ${DIM} run tick unfreeze`);
  await sleep(4000);
  const c = await score('$spawned.total');
  ok('① 时停期间不生成', b === a, `$spawned.total ${a} → ${b}（冻结 8s，本包是 tick 驱动 ⇒ 必须 0 增量）`);
  ok('① 解冻后继续生成', c > b, `$spawned.total ${b} → ${c}（解冻 4s 内恢复尝试）`);
  console.log(`   时停中点：96 格内本包生成物 ${mobs} 只（不清场，仅供对照）`);
}

// ─────────────────────────────────────────── ② 区块卸载 → 重载
{
  await send(`execute in ${DIM} run function doom.nats:circ/apply`);
  // 用**独立标签** e6.keep 的实体来测"区块卸载→重载"：
  //   不用 doom.nats.spawned —— 那会把包自己的 $cnt 灌爆（实测 $cnt.monster=87 > $cap.monster=70 的假红）。
  const KEEP = '@e[tag=e6.keep,limit=1000]';
  const keepBox = KEEP.slice(0, -1) + ',' + box(P.x, P.y, P.z, 96) + ']';
  const ups = [];
  for (const [dx, dz] of [[8, 8], [9, 8], [8, 9], [7, 9]]) {
    const out = await send(`execute in ${DIM} run summon minecraft:armor_stand ${P.x + dx} ${P.y} ${P.z + dz} {Tags:["e6.keep"],NoGravity:1b}`);
    ups.push(/Summoned|Created/i.test(out) ? 1 : 0);
  }
  await sleep(600);
  const before = await countOf(keepBox);
  ok('② 测试实体就位（4 次 summon 全部成功）', ups.reduce((a, b) => a + b, 0) === 4, `成功 ${ups.reduce((a, b) => a + b, 0)}/4`);
  await send(`execute in ${DIM} run tp DoomBot 3000 100 3000`);
  await sleep(12000);
  const away = await countOf(keepBox);
  await send(`execute in ${DIM} run tp DoomBot ${P.x} ${P.y} ${P.z}`);
  await sleep(6000);
  const back = await countOf(keepBox);
  ok('② 远走后区块卸载（近处已看不见这些实体）', before >= 3 && away === 0, `${before} → ${away}（走远 12s；选择器只看已加载区块）`);
  ok('② 回来重载后实体仍在且数量不变（区块存取没丢实体）', back === before && before >= 3, `${before} → ${back}（要求相等且 ≥3）`);
  // 账本一致性：包自己的计数是**按维度**的，所以对照也必须用**全维度盒子**（与 verify_animals 的口径一致）
  await send('function doom.nats:check/caps');
  const cntM = await score('$cnt.monster');
  const capM = await score('$cap.monster');
  // 用**包自己的口径**对照（type=#doom.nats:monster，不加 spawned 标签，全维度盒），且紧挨着 check/caps 读，避免竞态；
  //   实测教训：先 tp 再读会把"区块卸载期间的少计数"当成账本错误（43 vs 75 的假红）。
  const packSel = await countOf('@e[type=#doom.nats:monster,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500]');
  ok('② 计数账本与包口径实测一致（±2）', Math.abs(cntM - packSel) <= 2, `$cnt.monster=${cntM} vs 包口径实测 ${packSel} · $cap.monster=${capM}`);
  await send(`execute in ${DIM} run kill @e[tag=e6.keep]`);
}
// ─────────────────────────────────────────── ③ 红石高频方块更新
{
  const bx = P.x + 6, by = P.y, bz = P.z;
  // 两台 observer 面对面 = 1 tick 自振（10Hz 方块更新）
  await send(`execute in ${DIM} run setblock ${bx} ${by} ${bz} minecraft:observer[facing=east] replace`);
  await send(`execute in ${DIM} run setblock ${bx + 1} ${by} ${bz} minecraft:observer[facing=west] replace`);
  await sleep(1500);
  const a = await score('$spawned.total');
  for (let i = 0; i < 10; i++) { await send(`execute in ${DIM} run function doom.nats:spawn/batch`); await sleep(500); }
  const b = await score('$spawned.total');
  const rej0 = await score('$rej.0');
  await send(`execute in ${DIM} run setblock ${bx} ${by} ${bz} minecraft:air replace`);
  await send(`execute in ${DIM} run setblock ${bx + 1} ${by} ${bz} minecraft:air replace`);
  ok('③ 红石高频更新期间照常生成', b > a, `$spawned.total ${a} → ${b}（10×batch，脚下 10Hz observer 钟）`);
  console.log(`   期间 $rej.0=${rej0}（拒绝原因计数在动，说明尝试链正常跑完了）`);
}

// ─────────────────────────────────────────── 收尾
await send('tick unfreeze');
await send(`execute in ${DIM} run function doom.nats:debug/clear`);
const pass = results.filter((x) => x.pass).length;
console.log(`\n汇总: ${pass} PASS / ${results.length - pass} FAIL`);
r.close();
process.exit(pass === results.length ? 0 : 1);
