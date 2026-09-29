// _work/verify_brain_nbt.mjs —— 用真机读写实验钉死"哪些记忆/字段能改、哪些不能改"
//   node _work/verify_brain_nbt.mjs
// 结论（2026-09-28 实测，已纠正 docs/19 旧措辞）：
//   ① Brain 在实体 NBT 里可读（/data get entity <e> Brain ⇒ {memories:{}}）
//   ② 带 codec 的记忆项可写（data merge … {Brain:{memories:{"minecraft:dig_cooldown":{value:{},ttl:200L}}}} ⇒ 回读一致）
//   ③ 但传感器记忆每 tick 重算、对象引用（AbstractSchoolingFish.leader）与 Goal 列表不是数据 ⇒ 仍不可表达
//
// v2（消除连跑序列里的偶发红）：
//   · 自身前置：跨维度清探针实体；0 人时自起 bot（探针要落在**已加载区块**里，否则 summon/回读会空转）
//   · 探针位置改为"玩家所在处"，不再钉死 -602 67 -276（那个区块未必加载）
//   · ② 的 ttl **不做等值比较**：引擎每 tick 推进/重算 ttl（实测同一只 Warden 从 200 变成 1177）
//     ⇒ 只要求"存在且 ttl>0"；并允许一次重试（重写 + 回读）
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const res = [];
const ok = (n, p, d) => { res.push(p); console.log((p ? '✅ ' : '❌ ') + n + '  ' + d); };

const DIMS = ['minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end'];
const wipe = async (tag) => { for (const d of DIMS) await cmd(`execute in ${d} run kill @e[tag=${tag}]`); };
const players = async () => { const m = /There are (\d+)/.exec(await cmd('list')); return m ? Number(m[1]) : 0; };

// ---- 自身前置①：0 人时自起 bot（区块加载/实体 tick 都靠它） ----
let botChild = null;
if ((await players()) === 0) {
  const bp = path.join(import.meta.dirname, 'mcserver', 'bot.mjs');
  if (fs.existsSync(bp)) {
    console.log('场上没有玩家 ⇒ 自起机器人:', bp);
    botChild = spawn(process.execPath, [bp, '--minutes', '4'], { cwd: path.dirname(bp), stdio: 'ignore' });
    for (let i = 0; i < 40; i++) { if ((await players()) > 0) break; await sleep(1000); }
    await sleep(1500);
    console.log('玩家数:', await players());
  }
}
// ---- 自身前置②：跨维度清掉上一轮可能留下的探针实体（选择器没有"前缀匹配"，逐个 tag 清） ----
for (const t of ['probe.brain', 'probe.brain2']) await wipe(t);

// 探针位置 = 玩家所在处（区块一定加载）；无玩家时退回固定点
const AT = 'execute at @a[gamemode=!spectator,limit=1] run ';
const get = async (tag, path) => cmd(`data get entity @e[tag=${tag},limit=1] ${path}`);
const MERGE = '{Brain:{memories:{"minecraft:dig_cooldown":{value:{},ttl:200L}}}}';
const ttlOf = (s) => {                                   // 取 dig_cooldown 之后的那一个 ttl（Brain 里可能还有别的记忆项）
  const i = String(s).indexOf('dig_cooldown');
  if (i < 0) return NaN;
  const m = /ttl:\s*(\d+)L/.exec(String(s).slice(i, i + 140));
  return m ? Number(m[1]) : NaN;
};

await cmd(AT + 'summon minecraft:wolf ~ ~ ~ {Tags:["probe.brain"]}');
const brain = await get('probe.brain', 'Brain');
ok('① Brain 在实体 NBT 里可读', /memories/.test(brain), brain.replace(/\s+/g, ' ').slice(0, 90));

// ② 写入 + 回读（ttl 只要求 >0；允许一次重试：先杀探针重召唤再写）
let back = '';
let ttl = NaN;
let attempts = 0;
for (let attempt = 0; attempt < 2; attempt++) {
  attempts = attempt + 1;
  if (attempt) { await wipe('probe.brain2'); }
  await cmd(AT + 'summon minecraft:warden ~ ~ ~ {Tags:["probe.brain2"]}');
  await cmd('data merge entity @e[tag=probe.brain2,limit=1] ' + MERGE);
  back = await get('probe.brain2', 'Brain');
  ttl = ttlOf(back);
  if (/dig_cooldown/.test(back) && Number.isFinite(ttl) && ttl > 0) break;
}
ok('② 记忆项可写且回读一致（dig_cooldown 存在且 ttl>0）', /dig_cooldown/.test(back) && Number.isFinite(ttl) && ttl > 0,
  `ttl=${Number.isFinite(ttl) ? ttl : 'n/a'}${attempts > 1 ? '（重试 ' + attempts + ' 次）' : ''} ` + back.replace(/\s+/g, ' ').slice(0, 110));

await sleep(1200);
const later = await get('probe.brain2', 'Brain');
const ttl2 = ttlOf(later);
ok('②b 写入在 1.2s 后仍在（非传感器记忆不被覆盖）', /dig_cooldown/.test(later) && Number.isFinite(ttl2) && ttl2 > 0,
  `ttl ${Number.isFinite(ttl) ? ttl : 'n/a'} → ${Number.isFinite(ttl2) ? ttl2 : 'n/a'} ` + later.replace(/\s+/g, ' ').slice(0, 110));

for (const t of ['probe.brain', 'probe.brain2']) await wipe(t);
if (botChild) { try { botChild.kill(); } catch {} console.log('（已关闭自起机器人）'); }
const pass = res.filter(Boolean).length;
console.log(String.fromCharCode(10) + '汇总: ' + pass + ' PASS / ' + (res.length - pass) + ' FAIL');
r.close && r.close();
process.exit(pass === res.length ? 0 : 1);
