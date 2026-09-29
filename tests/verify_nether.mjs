// _work/verify_nether.mjs —— 真机验证「下界维度里也能刷怪」（端到端）
//
//   node _work/verify_nether.mjs
//
// 为什么要单独测：维度相关的三件事（海平面 32 / 无天空光 / 维度探测在玩家位置）此前只有"配置层"级的断言，
// 没有"真的在下界刷出生物"的端到端证据。本脚本把机器人客户端传送到下界，让刷怪循环在那里跑一段，再看结果。
//
// 断言：
//   ① 玩家进下界后 $snap.dim=1（circ/detect_dim 在玩家位置判定）
//   ② 海平面窗口随维度变化（$chk.sea_lo..sea_hi = 19..32）
//   ③ 下界里确实生成了本包生物（tag=doom.nats.spawned 且在该维度）
//   ④ 收尾：机器人传回原位置、维度探测恢复
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
// 按维度计数：**必须带体积约束**（真机实测：不带位置/体积约束的 @e 会跨维度选实体，execute in 也不管用）
const BOX = 'x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000';
const countIn = async (dim, sel) => {
  // 盒子必须写在方括号**里面**（踩过：@e[tag=x],x=... 是非法语法，命令直接报错）
  const withBox = sel.replace(/\]$/, ',' + BOX + ']');
  const t = await cmd(`execute in minecraft:${dim} if entity ${withBox}`);
  const m = /count: (\d+)/.exec(t);
  return m ? Number(m[1]) : (t.includes('Test passed') ? 1 : 0);
};

console.log('=== 下界刷怪端到端 · 真机验证 ===');
const players = await cmd('list');
const botName = /DoomBot/.test(players) ? 'DoomBot' : (/Doom_Flare/.test(players) ? 'Doom_Flare' : null);
if (!botName) { console.log('❌ 没有可用的玩家（需要 DoomBot / Doom_Flare）'); process.exit(1); }
const pos0 = await cmd(`data get entity ${botName} Pos`);
const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(pos0);
const P0 = m ? { x: +m[1], y: +m[2], z: +m[3] } : { x: 0, y: 64, z: 0 };
console.log('玩家 ' + botName + ' 原位置', JSON.stringify(P0));

// 找一个要塞（那里有下界砖地面，最容易出怪）
const loc = await cmd('execute in minecraft:the_nether run locate structure minecraft:fortress');
const lm = /at \[(-?\d+), (~|-?\d+), (-?\d+)\]/.exec(loc);
const FX = lm ? Number(lm[1]) : 0, FZ = lm ? Number(lm[3]) : 0;
await cmd(`execute in minecraft:the_nether run forceload add ${FX - 32} ${FZ - 32} ${FX + 32} ${FZ + 32}`);
await sleep(2000);

// 在要塞里找一块"下方是方块、自身与上方是空气"的落脚地
let spot = null;
outer:
for (let dx = -16; dx <= 16; dx += 8) {
  for (let dz = -16; dz <= 16; dz += 8) {
    for (const y of [50, 64, 78, 92]) {
      await set('$probe', 0);
      await cmd(`execute in minecraft:the_nether positioned ${FX + dx} ${y} ${FZ + dz} if predicate doom.nats:spawn/in_fortress run scoreboard players set $probe doom.nats 1`);
      if ((await score('$probe')) === 1) { spot = { x: FX + dx, y, z: FZ + dz }; break outer; }
    }
  }
}
if (!spot) spot = { x: FX, y: 70, z: FZ };
console.log('下界测试点', JSON.stringify(spot));

// 把玩家放到测试点（真客户端；mineflayer 会被服务端强拉过去）
await cmd(`execute in minecraft:the_nether run tp ${botName} ${spot.x} ${spot.y} ${spot.z}`);
// 等"玩家所在区块真的加载"——只 sleep 不够（第一版就是这里导致 0 生成）：轮询 if loaded
let loadedOk = false;
for (let i = 0; i < 30; i++) {
  await set('$probe', 0);
  await cmd(`execute in minecraft:the_nether positioned ${spot.x} ${spot.y} ${spot.z} if loaded ~ ~ ~ run scoreboard players set $probe doom.nats 1`);
  if ((await score('$probe')) === 1) { loadedOk = true; break; }
  await sleep(700);
}
console.log('玩家区块已加载:', loadedOk);
await sleep(2000);
const dimNow = await cmd(`execute in minecraft:the_nether run data get entity ${botName} Dimension`);
console.log('玩家维度 NBT:', dimNow.slice(0, 80));

// ① 维度探测
await cmd(`execute at ${botName} run function doom.nats:circ/detect_dim`);
await cmd('function doom.nats:cfg/apply');
// v4.20：check/sealevel 的 per-dim 取数改读 **$att.dim**（尝试维度），不再读 $snap.dim。
//   ⇒ 这里必须先写 $att.dim，否则窗口会停在陈旧维度（实测：下界报 50..63 而不是 19..32 ⇒ 1 条假红）。
// ② 要在**冻结**下读：$chk.* 是全局计分板，活循环每 tick 都会按"它自己那次尝试的维度"改写它，
//   分开两次 RCON 读 $chk.sea_lo / $chk.sea_hi 会被中途覆盖（实测：lo=19 正确、hi 已被改成主世界的 63）。
await cmd('scoreboard players set $snap_period doom.nats 20000');
await cmd('scoreboard players set $eff.period doom.nats 100000');
await cmd(`execute at ${botName} run function doom.nats:circ/detect_dim_att`);
await cmd('function doom.nats:check/sealevel');
const dim = await score('$snap.dim');
ok('① 玩家在下界 ⇒ $snap.dim=1', dim === 1, '$snap.dim=' + dim);

// ② 海平面窗口
const lo = await score('$chk.sea_lo'), hi = await score('$chk.sea_hi');
ok('② 下界海平面窗口 19..32', lo === 19 && hi === 32, lo + '..' + hi + '（冻结下读）');
// 读完立刻解冻：③④ 依赖活体刷怪
await cmd('scoreboard players set $snap_period doom.nats 20');
await cmd('function doom.nats:circ/snapshot');
await cmd('scoreboard players set $eff.period doom.nats 5');

// ③ 端到端：让刷怪循环在下界跑一段（临时加速），再看下界里有没有本包生物
{
  const before = await countIn('the_nether', '@e[tag=doom.nats.spawned]');
  await cmd('scoreboard players set $eff.period doom.nats 2');
  await cmd('scoreboard players set $eff.batch doom.nats 40');
  await cmd('gamerule doMobSpawning false');
  let peak = before;
  // 诊断：把归因增量与刷怪计数一起打出来（否则只看到"峰值 0"没法定位）
  const rejSnap = async () => { const o = []; for (let i = 1; i <= 9; i++) o.push(await score('$rej.' + i)); return o; };
  const spawnedBefore = await score('$spawned.total');
  const rejBefore = await rejSnap();
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    // 每轮重设一次：快照的 circ/apply 会把它写回 cfg 值（这里就是要它快）
    await cmd('scoreboard players set $eff.period doom.nats 2');
    await cmd('scoreboard players set $eff.batch doom.nats 40');
    // 把玩家留在下界（真客户端可能掉进岩浆/被推走/重生回主世界 —— 诊断里 reason=2 飙升就是这个原因）
    const near = await cmd(`execute in minecraft:the_nether positioned ${spot.x} ${spot.y} ${spot.z} if entity @e[type=player,distance=..64]`);
    if (!/Test passed/.test(near)) {
      await cmd(`execute in minecraft:the_nether run tp ${botName} ${spot.x} ${spot.y} ${spot.z}`);
      await cmd(`execute in minecraft:the_nether run effect give ${botName} minecraft:resistance 30 4 true`);
      await cmd(`execute in minecraft:the_nether run effect give ${botName} minecraft:fire_resistance 30 0 true`);
    }
    const n = await countIn('the_nether', '@e[tag=doom.nats.spawned]');
    if (n > peak) peak = n;
    const d = await score('$snap.dim');
    if (d !== 1) { await cmd(`execute at ${botName} run function doom.nats:circ/detect_dim`); }
  }
  const spawnedAfter = await score('$spawned.total');
  const rejAfter = await rejSnap();
  console.log('   诊断: spawned +' + (spawnedAfter - spawnedBefore) + ' | rej 增量 ' + rejAfter.map((v, i) => (i + 1) + ':' + (v - rejBefore[i])).join(' '));
  console.log('   诊断: $snap.dim=' + (await score('$snap.dim')) + ' $cnt.monster.nether=' + (await score('$cnt.monster.nether')) + ' $cnt.monster=' + (await score('$cnt.monster')) + ' $cap.monster=' + (await score('$cap.monster')));
  ok('③ 下界里生成出了本包生物（端到端）', peak > before, '起始 ' + before + ' → 峰值 ' + peak);
  const types = await cmd('execute in minecraft:the_nether as @e[tag=doom.nats.spawned,limit=5] run data get entity @s id');
  console.log('   样本:', types.replace(/\s+/g, ' ').slice(0, 160));
  await cmd('execute in minecraft:the_nether as @e[tag=doom.nats.spawned] run tp @s ~ ~-500 ~');
}

// ④ 收尾：传回原位置
await cmd(`execute in minecraft:overworld run tp ${botName} ${Math.floor(P0.x)} ${Math.floor(P0.y)} ${Math.floor(P0.z)}`);
await sleep(2500);
await cmd('function doom.nats:cfg/apply');
await cmd(`execute at ${botName} run function doom.nats:circ/detect_dim`);
await cmd('function doom.nats:cfg/apply');
const dimBack = await score('$snap.dim');
ok('④ 收尾：维度探测恢复主世界（0）', dimBack === 0, '$snap.dim=' + dimBack);
await cmd(`execute in minecraft:the_nether run forceload remove ${FX - 32} ${FZ - 32} ${FX + 32} ${FZ + 32}`);
await cmd('scoreboard players set $eff.period doom.nats 5');
await cmd('function doom.nats:cfg/apply');
await cmd('function doom.nats:circ/apply');
r.close();

const fails = results.filter((x) => !x.pass).length;
console.log('');
console.log('汇总: ' + (results.length - fails) + ' PASS / ' + fails + ' FAIL');
fs.writeFileSync('C:/Users/Dell/Downloads/datapack/_work/verify-nether.json', JSON.stringify({ at: new Date().toISOString(), spot, results }, null, 2));
process.exit(fails ? 1 : 0);
