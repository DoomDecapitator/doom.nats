// _work/verify_multibot.mjs —— 双机器人回归：多玩家下的"锚定"与"消失层隔离"（v4.17 那个 bug 的回归用例）
//
//   node _work/verify_multibot.mjs               # 需要 DoomBot 与 DoomBot2 都在线（外面用 bot.mjs 起）
//
// 为什么值得单独测：本包**容量是按维度一份全局面额**（$cnt.<cat>），而**消失层是按玩家逐个判定**
//   （`as @a[gamemode=!spectator] at @s as @e[…,distance=129..]`）。这两者一旦写错，就会出现
//   "A 身边的怪被 B 的距离判掉" —— v4.17 实测过一次（当时用的是**函数执行位置**=世界出生点，害得所有非持久生物
//   在一个消失节拍内被清空）。单机器人测不出这类错，必须两个玩家在**相距很远**的位置上同时在场。
//
// 断言：
//   ① 前置：两名机器人都在线，且相距 > 400 格
//   ② 两处都能刷：在各自 128 格内都能数到本包生成物（证明刷怪锚定是"逐玩家"的）
//   ③ 消失层隔离：A 处的本包生成物在 B 远在数百格外的 60 秒里**不归零**（回归 v4.17 的 bug）
//   ④ 容量是"按维度一份"：$cnt.<cat> 与 cap 的比较在同一维度内对两名玩家一致（读同一个计数）
import { rcon } from '../doom.nats/tools/mcrcon.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const ok = (n, p, d) => { res.push(p); console.log((p ? '✅ ' : '❌ ') + n + '  ' + d); };
const num = (s) => { const m = /has (-?\d+)/.exec(String(s)); return m ? Number(m[1]) : null; };
const score = async (h) => num((await rcon(['scoreboard players get ' + h + ' doom.nats']))[0]);
const posOf = async (name) => {
  const t = String((await rcon(['data get entity ' + name + ' Pos']))[0]);
  const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(t);
  return m ? [Math.floor(+m[1]), Math.floor(+m[2]), Math.floor(+m[3])] : null;
};
// 修：原来窗口写 96 格 ⇒ 漏掉了刷怪环 24..128 里的多数样本（实测最近的在 112 格）⇒ 假红。改成 128（= 原版刷怪环外沿）。
const countNear = async (P, dist = 128) => {
  const ps = P.join(' ');
  await rcon(['scoreboard players set #mb.n doom.nats 0']);
  await rcon([`execute positioned ${ps} as @e[tag=doom.nats.spawned,distance=..${dist}] run scoreboard players add #mb.n doom.nats 1`]);
  return score('#mb.n');
};

console.log('=== 双机器人回归 · 多玩家锚定 + 消失层隔离 ===');
const A = await posOf('DoomBot');
const B = await posOf('DoomBot2');
if (!A || !B) { console.log('❌ 需要 DoomBot 与 DoomBot2 同时在线（外面用 bot.mjs 起）'); process.exit(1); }
const dist = Math.round(Math.hypot(A[0] - B[0], A[2] - B[2]));
ok('① 前置：两名机器人都在线且相距 > 400 格', dist > 400, `DoomBot ${A.join(' ')} ↔ DoomBot2 ${B.join(' ')} = ${dist} 格`);

// ② 两处都能刷：先清一次场（安全清场），等一个采样窗口，再分别数 128 格内的本包生成物
await rcon(['execute as @e[type=!minecraft:player] unless data entity @s CustomName unless data entity @s Owner unless data entity @s PersistenceRequired unless data entity @s Leash run kill @s']);
await sleep(2000);
// ⚠ v4.21：本脚本测的是**活循环**（世界自己的尝试），所以开场必须自己**解冻**并把节拍摆回默认值。
//   踩到的坑：上一个脚本（verify_group / verify_rules 之类）常把 $snap_period/$eff.period 冻住留给后面的
//   分数断言用，门里没有统一解冻（那是刻意的）⇒ 本脚本 75 秒窗口"累计生成 +0"、②③ 全红（实测 gate 里 1 PASS / 3 FAIL）。
//   解冻后还要**回读确认循环真的活了**：5 秒没生成就再来一轮（最多 3 轮）。
{
  let live = 0;
  for (let i = 0; i < 3 && live === 0; i++) {
    await rcon(['scoreboard players set $snap_period doom.nats 20', 'scoreboard players set $eff.period doom.nats 5',
      'function doom.nats:cfg/apply', 'function doom.nats:circ/apply', 'function doom.nats:circ/snapshot']);
    await sleep(1500);
    const a = await score('$spawned.total');
    await sleep(5000);
    live = (await score('$spawned.total')) - a;
    console.log(`  解冻第 ${i + 1} 轮：5 秒生成增量 ${live}（$snap_period=${await score('$snap_period')} $eff.period=${await score('$eff.period')}）`);
  }
  if (live === 0) console.log('  ⚠ 解冻后 5 秒内仍无生成 —— ②③ 会红，先查刷怪循环是否被别的因素挡住');
}
const t0 = await score('$spawned.total');
await sleep(75000);
const t1 = await score('$spawned.total');
const nA = await countNear(A);
const nB = await countNear(B);
console.log(`  75 秒窗口：累计生成 +${t1 - t0}；A 附近（≤128 格）本包生成物 ${nA}；B 附近 ${nB}`);
ok('② 两处都能刷（刷怪锚定逐玩家）', nA > 0 && nB > 0, `A=${nA} B=${nB}（累计 +${t1 - t0}）`);

// ③ 消失层隔离：再等 60 秒，A 处不能归零（B 在数百格外）
const midA = nA;
await sleep(60000);
const nA2 = await countNear(A);
ok('③ A 处的生成物在 B 远距离下不归零（回归 v4.17 消失层 bug）', nA2 > 0 && nA2 >= Math.min(1, midA), `A 128 格内 ${midA} → ${nA2}`);

// ④ 容量一致性：同一维度内两名玩家看到的是同一个 $cnt（按维度一份全局面额）
const c1 = await score('$cnt.monster');
await rcon(['execute at DoomBot2 run function doom.nats:check/caps']);
await sleep(600);
const c2 = await score('$cnt.monster');
ok('④ $cnt.<cat> 是"按维度一份"的全局计数（两名玩家共用，与位置无关）', Number.isFinite(c1) && Number.isFinite(c2) && Math.abs(c2 - c1) <= 2,
  `$cnt.monster ${c1} → ${c2}（cap ${await score('$cap.monster')}）`);

const pass = res.filter(Boolean).length;
console.log(String.fromCharCode(10) + '汇总: ' + pass + ' PASS / ' + (res.length - pass) + ' FAIL');
process.exit(pass === res.length ? 0 : 1);
