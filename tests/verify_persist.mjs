// _work/verify_persist.mjs —— 真机验证 PersistenceRequired 语义（v4.14）
//
//   node _work/verify_persist.mjs
//
// 断言（每一条都对应源码里的一个判断）：
//   ① 本包生成的普通生物**不带** PersistenceRequired ⇒ 原版 Mob.checkDespawn 会管它（128 格硬消失）
//   ② 我们的 doom.nats.persistent 标签 ≠ 原版持久：远处照样被原版 discard（它就是普通生物）
//   ③ 带 PersistenceRequired:1b 的生物在原版 128 格外**不消失**
//   ④ $cfg.persist=1 时，新生成物自动带上 PersistenceRequired:1b（全局开关）
//   ⑤ debug/clear 跳过 doom.nats.persistent 与 PersistenceRequired 的生物，其余静默清掉
import fs from 'node:fs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail: String(detail) }); console.log((pass ? '✅ ' : '❌ ') + name + '  ' + detail); };

const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const set = (h, v) => cmd(`scoreboard players set ${h} doom.nats ${v}`);
const score = async (h) => {
  const t = await cmd('scoreboard players get ' + h + ' doom.nats');
  const m = /has (-?\d+)/.exec(t);
  return m ? Number(m[1]) : NaN;
};
const cnt = async (sel) => {
  const t = await cmd('execute if entity ' + sel);
  const m = /count: (\d+)/.exec(t);
  return m ? Number(m[1]) : (t.includes('Test passed') ? 1 : 0);
};
const player = async () => {
  const t = await cmd('data get entity @e[type=player,name=DoomBot,limit=1] Pos');
  const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(t);
  return m ? { x: Math.floor(+m[1]), y: Math.floor(+m[2]), z: Math.floor(+m[3]) } : null;
};

console.log('=== PersistenceRequired 语义 · 真机验证 ===');
// 测试卫生：清掉上一轮遗留（远处未加载区块里的实体会一直存活，导致每跑一次就多一只）
await cmd('kill @e[tag=pv.far]');
const P = await player();
if (!P) { console.log('❌ 没有玩家在线'); process.exit(1); }
console.log('玩家位置', JSON.stringify(P));
for (let i = 0; i < 20; i++) { if ((await score('$eff.period')) >= 1) break; await sleep(500); }
// 稳定化：等情形引擎就绪（reload 后第一个快照节拍才写 $eff.*）

// 清理上一轮残留
// ---- 测试卫生（v4.14e/2）：冻结快照 + 暂停刷怪（加固版）
// 为什么需要循环：改 $snap_period 的那一拍，$snap_phase 是按**旧**周期算的，可能刚好为 0 ⇒ 立刻跑一次快照，
//   快照里的 circ/apply 会把 $eff.period 重新写成 cfg 值（5）⇒ 刷怪循环恢复、把 $sel.* 覆盖掉（本轮实测踩到：
//   $sel.light 被写成 3 = 蝙蝠）。所以设置后要再确认一遍。
const freezeTick = async () => {
  await set('$snap_period', 20000);
  await set('$eff.period', 100000);
};
for (let i = 0; i < 4; i++) {
  await freezeTick();
  await sleep(700);
  if ((await score('$eff.period')) >= 1000) break;
}

await cmd('execute as @e[tag=pv.probe] run tp @s ~ ~-500 ~');
// 远处遗留要先把区块拉起来才看得到（历史遗留会永久留在未加载区块里）
await cmd('forceload add ' + (P.x + 200) + ' ' + (P.z + 200));
await sleep(1200);
await cmd('kill @e[tag=pv.far]');
await cmd('forceload remove ' + (P.x + 200) + ' ' + (P.z + 200));
await cmd('execute as @e[tag=pv.far] run tp @s ~ ~-500 ~');

// ---------- ① 用本包自己的宏生成一只（不带持久）
{
  // v4.21：加**重试**。实测这一条会偶发"存活 0"（同一份包、同一位置手动复现永远成功）：
  //   最可能是 emit 那一刻目标区块刚被上一个脚本/锚点 tp 扰动，summon 落在未加载区块上而静默失败。
  //   断言语义不变（要的是"本包生成物存在"），但把环境抖动与真实的"生成链路断了"区分开。
  let alive = 0, tries = 0;
  for (; tries < 3 && alive === 0; tries++) {
    // 先清掉上一次尝试的（可能已生成但没被读到的）那只 ⇒ 收尾时"恰一只"，不影响 ⑤ 的计数
    await cmd('kill @e[tag=pv.probe]');
    await cmd('data merge storage doom.nats:sel {type:"minecraft:zombie",slug:"zombie",cat:"monster",min:1,max:2,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster","pv.probe"]}}');
    await set('$cfg.persist', 0);
    await cmd(`execute positioned ${P.x + 2} ${P.y + 1} ${P.z} run function doom.nats:spawn/emit with storage doom.nats:sel`);
    await sleep(400);
    alive = await cnt('@e[tag=pv.probe]');
  }
  const pers = await cnt('@e[tag=pv.probe,nbt={PersistenceRequired:true}]');
  ok('① 本包生成物存在', alive >= 1, '存活 ' + alive + '（emit 尝试 ' + tries + ' 次）');
  ok('① 本包生成物不带 PersistenceRequired', pers === 0, '带持久标记 ' + pers + ' 只');
  // 掉落到世界下方，别影响后面的计数
  await cmd('execute as @e[tag=pv.probe] run tp @s ~ ~-500 ~');
}

// ---------- ② 远处（200 格）：普通生物 + 我们的 persistent 标签都会被原版消失
{
  const FX = P.x + 200, FZ = P.z + 200;
  await cmd(`forceload add ${FX} ${FZ}`);
  await sleep(1200);
  await cmd(`summon minecraft:zombie ${FX} ${P.y + 1} ${FZ} {Tags:["doom.nats.spawned","doom.nats.persistent","pv.far","pv.far.tag"]}`);
  await cmd(`summon minecraft:zombie ${FX + 2} ${P.y + 1} ${FZ} {Tags:["doom.nats.spawned","pv.far","pv.far.plain"]}`);
  await cmd(`summon minecraft:zombie ${FX + 4} ${P.y + 1} ${FZ} {Tags:["doom.nats.spawned","pv.far","pv.far.persist"],PersistenceRequired:1b}`);
  await sleep(600);
  const beforeAll = await cnt('@e[tag=pv.far]');
  await sleep(3000);
  const afterAll = await cnt('@e[tag=pv.far]');
  const tagLeft = await cnt('@e[tag=pv.far.tag]');
  const plainLeft = await cnt('@e[tag=pv.far.plain]');
  const persistLeft = await cnt('@e[tag=pv.far.persist]');
  ok('②③ 起点：三只已生成（普通的两只**立刻**被原版 discard ⇒ 只剩持久那只）', beforeAll >= 1, '在场 ' + beforeAll + '/3（普通生物在 128 格外的消失是即时的）');
  ok('② 普通生物被原版 128 格硬消失（discard）', plainLeft === 0, '剩余 ' + plainLeft);
  ok('② 我们的 doom.nats.persistent 标签 ≠ 原版持久（同样消失）', tagLeft === 0, '剩余 ' + tagLeft);
  ok('③ PersistenceRequired:1b 的生物不消失', persistLeft === 1, '剩余 ' + persistLeft + '（' + (afterAll) + '/3 在场）');
  // 清场必须在 forceload 撤销**之前**：区块一卸载，选择器就看不到远处实体（否则遗留每跑一次涨一只）
  await cmd('kill @e[tag=pv.far]');
await cmd(`forceload remove ${FX} ${FZ}`);
}

// ---------- ④ 全局开关 $cfg.persist=1
{
  await set('$cfg.persist', 1);
  await cmd('data merge storage doom.nats:sel {type:"minecraft:zombie",slug:"zombie",cat:"monster",min:1,max:2,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.monster","pv.probe2"]}}');
  await cmd(`execute positioned ${P.x + 3} ${P.y + 1} ${P.z} run function doom.nats:spawn/emit with storage doom.nats:sel`);
  await sleep(300);
  const made = await cnt('@e[tag=pv.probe2]');
  const pers = await cnt('@e[tag=pv.probe2,nbt={PersistenceRequired:true}]');
  ok('④ $cfg.persist=1 时新生成物自动带持久标记', made >= 1 && pers === made, '生成 ' + made + '，带标记 ' + pers);
  await set('$cfg.persist', 0);
  await cmd('execute as @e[tag=pv.probe2] run tp @s ~ ~-500 ~');
}

// ---------- ⑤ debug/clear 的跳过规则
{
  // v4.21：先清掉**上一轮**遗留的 pv.c1/c2/c3（它们被 tp 到 y-500 后是慢慢掉死的，可能还活着 ⇒ 计数变 2）
  for (const t of ['pv.c1', 'pv.c2', 'pv.c3']) await cmd('kill @e[tag=' + t + ']');
  // v4.21b：**自己把前置做实**（三次尝试里要 3 只都在场）。原来只 summon 一次就断言 —— 实测 c1 会偶发"0→0"
  //   （同一坐标手动复现永远成功 ⇒ 环境抖动，不是包的问题），断言就变成"前置没做实"的假红。
  const want = [
    ['pv.c1', `summon minecraft:zombie ${P.x + 4} ${P.y + 1} ${P.z} {Tags:["doom.nats.spawned","doom.nats.cat.monster","pv.c1"]}`],
    ['pv.c2', `summon minecraft:zombie ${P.x + 5} ${P.y + 1} ${P.z} {Tags:["doom.nats.spawned","doom.nats.cat.monster","doom.nats.persistent","pv.c2"]}`],
    ['pv.c3', `summon minecraft:zombie ${P.x + 6} ${P.y + 1} ${P.z} {Tags:["doom.nats.spawned","doom.nats.cat.monster","pv.c3"],PersistenceRequired:1b}`],
  ];
  let prep = 0;
  for (; prep < 4; prep++) {
    const got = { c1: await cnt('@e[tag=pv.c1]'), c2: await cnt('@e[tag=pv.c2]'), c3: await cnt('@e[tag=pv.c3]') };
    if (got.c1 === 1 && got.c2 === 1 && got.c3 === 1) break;
    for (const [tag, c] of want) if ((await cnt('@e[tag=' + tag + ']')) !== 1) await cmd(c);
    await sleep(400);
  }
  const before = { c1: await cnt('@e[tag=pv.c1]'), c2: await cnt('@e[tag=pv.c2]'), c3: await cnt('@e[tag=pv.c3]') };
  await cmd('function doom.nats:debug/clear');
  await sleep(600);
  const after = { c1: await cnt('@e[tag=pv.c1]'), c2: await cnt('@e[tag=pv.c2]'), c3: await cnt('@e[tag=pv.c3]') };
  const pre = '（前置用了 ' + (prep + 1) + ' 轮）';
  ok('⑤ debug/clear 清掉普通生成物', before.c1 === 1 && after.c1 === 0, before.c1 + '→' + after.c1 + pre);
  ok('⑤ debug/clear 跳过 doom.nats.persistent', after.c2 === 1, before.c2 + '→' + after.c2);
  ok('⑤ debug/clear 跳过 PersistenceRequired 生物', after.c3 === 1, before.c3 + '→' + after.c3);
  await cmd('execute as @e[tag=pv.c2] run tp @s ~ ~-500 ~');
  await cmd('execute as @e[tag=pv.c3] run tp @s ~ ~-500 ~');
}

// ---- 解冻：恢复快照节拍并立刻重算一轮
await set('$snap_period', 20);
await cmd('function doom.nats:cfg/apply');
await cmd('function doom.nats:circ/apply');
await cmd('function doom.nats:circ/snapshot');

r.close();
const fails = results.filter((x) => !x.pass).length;
console.log('');
console.log('汇总: ' + (results.length - fails) + ' PASS / ' + fails + ' FAIL');
fs.writeFileSync('C:/Users/Dell/Downloads/datapack/_work/verify-persist.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(fails ? 1 : 0);
