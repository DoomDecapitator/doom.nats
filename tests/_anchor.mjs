// _work/_anchor.mjs —— 手动复现「四道门 ③ 的 resetEnv」（单跑脚本前用，保证单跑环境 == 门内环境）
//
//   node _work/_anchor.mjs
//
// 做三件事（与 gate_merge.mjs 的 resetEnv 完全一致）：
//   ① 清掉遗留机器人（_kill_old_bots.ps1）
//   ② 把 DoomBot / DoomBot2 tp 到锚点 x/z 的**地表**上（自上而下扫第一处「可站 + 上方两格可生成」的层）
//      —— v4.20 修：以前写死 y=64，而测试世界这两处地表高于 64 ⇒ 机器人被埋在实心地形里 ⇒ 天空光=0，
//      verify_rules / verify_animals / verify_persist 成片假红（实测 gate-2026-09-28173704）。
//   ③ doDaylightCycle=false + time midnight（测试世界的既定约定）
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const HERE = import.meta.dirname;
// 默认**不**清机器人（我常常刚起好机器人就要摆锚点，清了反而白等一轮）；需要清时加 --kill。
if (process.argv.includes('--kill')) {
  try {
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(HERE, '_kill_old_bots.ps1')], { stdio: 'ignore', timeout: 20000 });
  } catch {}
}

const r = await openRcon({ timeout: 10000 });
const send = async (c) => String(await r.send(c).catch(() => '')).trim();
const surfaceY = async (x, z) => {
  for (let y = 200; y >= 40; y--) {
    const t = await send(`execute in minecraft:overworld positioned ${x} ${y} ${z} if block ~ ~ ~ #doom.nats:standable if block ~ ~1 ~ #doom.nats:spawnable_at if block ~ ~2 ~ #doom.nats:spawnable_at positioned ~ ~1 ~ if predicate doom.nats:spawn/can_see_sky`);
    if (/passed/i.test(t)) return y + 1;
  }
  return null;
};
const has = async (n) => /passed/i.test(await send('execute if entity ' + n));
const b1 = (await has('DoomBot')) ? await surfaceY(-240, -592) : null;
const b2 = (await has('DoomBot2')) ? await surfaceY(-700, -592) : null;
console.log('锚点地表: DoomBot(-240,-592) y=' + (b1 || 64) + ' · DoomBot2(-700,-592) y=' + (b2 || 64));
await send(`execute in minecraft:overworld run tp DoomBot -240 ${b1 ?? 90} -592`);   // 扫描失败也拉回来（否则机器人可能被上一个脚本留在下界 ⇒ multibot 前置假红）
await send(`execute in minecraft:overworld run tp DoomBot2 -700 ${b2 ?? 90} -592`);
await send('gamerule doDaylightCycle false');
await send('time set midnight');
const p1 = await send('data get entity DoomBot Pos');
const p2 = await send('data get entity DoomBot2 Pos');
console.log('DoomBot  ' + p1);
console.log('DoomBot2 ' + p2);
console.log('天空光自检（DoomBot 站立点 light>11 ⇒ 露天透光；1=透光）:');
await send('scoreboard players set #anch.k doom.nats 0');
await send('execute at DoomBot unless predicate doom.nats:light/tier_11 run scoreboard players set #anch.k doom.nats 1');
console.log('  ' + (await send('scoreboard players get #anch.k doom.nats')));
console.log('  ' + (await send('time query daytime')));
r.close && r.close();
process.exit(0);
// 回读（2026-09-29 补）：把"机器人到底在哪个维度、站在哪"打出来 ——
//   要塞脚本会把机器人留在下界，之后单跑 multibot 会因为"相距只有 167 格"假红（实测）。
for (const n of ["DoomBot", "DoomBot2"]) {
  const pos = await send(`data get entity @e[type=player,name=${n},limit=1] Pos`);
  const dim = await send(`data get entity @e[type=player,name=${n},limit=1] Dimension`);
  console.log("anchor 回读 " + n + ": " + String(dim).replace(/.*following entity data: /, "") + "  " + String(pos).replace(/.*following entity data: /, ""));
}
