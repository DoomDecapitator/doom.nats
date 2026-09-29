// _work/verify_biome_at.mjs —— v4.16「逐候选点群系」真机验证（v3：A/A2 改成自洽写法）
//
//  A  detect（快照层函数）与 detect_at（候选点函数）在同一位置必须给出同一个表内索引。
//     v1 的坑：detect_at 固定打 -602 67 -276，却拿"玩家点的 $snap.biome"比对 —— 前提就不成立。
//     v2 的坑（仍会翻转）：拿"刚算出的 detect_at"去比"上一次快照节拍写的 $snap.biome"；
//       别的脚本（verify_rules）会把 $snap_period 冻成 20000 ⇒ $snap.biome 可能是几十万 tick 前的陈旧值。
//     v3：① 先恢复快照节拍并等满一拍（$snap.biome / $cnt.* / $cap.* 全部刷新）
//         ② 三个值都在**同一上下文**取：快照节拍写的 $snap.biome、`at @a[gamemode=!spectator,limit=1]` 的两个函数
//         —— 位置与选择器都与 circ/snapshot:45 的引擎路径完全一致，不再依赖坐标解析。
//  A2 换个执行点做位置敏感：同一坐标下两个函数仍必须一致，并报告与玩家点是否不同。
//  B  集成：连打 100 次 spawn/try 确认仍在生成；先读 $cnt/$cap，容量满先 debug/clear（否则全是与接线无关的假 FAIL）。
import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const set = (h, v) => cmd('scoreboard players set ' + h + ' doom.nats ' + v);
const score = async (h) => { const t = await cmd('scoreboard players get ' + h + ' doom.nats'); const m = /has (-?\d+)/.exec(t); return m ? Number(m[1]) : NaN; };
const res = []; const ok = (n, p, d) => { res.push(p); console.log((p ? 'PASS ' : 'FAIL ') + n + '  ' + d); };
const index = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'v4', 'doom.nats', 'data', 'doom.nats', 'biome-index.json'), 'utf8')).map;
const nameOf = (i) => index[String(i)] || ('#' + i);

let bot = null;
const players = async () => { const m = /There are (\d+)/.exec(await cmd('list')); return m ? Number(m[1]) : 0; };
if ((await players()) === 0) { const bp = path.join(import.meta.dirname, 'mcserver', 'bot.mjs'); bot = spawn(process.execPath, [bp, '--minutes', '6'], { cwd: path.dirname(bp), stdio: 'ignore' }); for (let i = 0; i < 40; i++) { if ((await players()) > 0) break; await sleep(1000); } }
await sleep(1200);

// 玩家坐标只用于报告（负数在 data get 输出里可能是 Unicode 减号，先归一化）
const posOut = String(await cmd('data get entity @a[gamemode=!spectator,limit=1] Pos')).replace(/[\u2212\u2013\u2014]/g, '-');
const pm = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(posOut);
const P = pm ? `${Math.floor(+pm[1])},${Math.floor(+pm[2])},${Math.floor(+pm[3])}` : '?';

// ---- ① 恢复快照节拍并等满一拍（别的脚本会把 $snap_period 冻成 20000 ⇒ $snap.biome/$cnt/$cap 全是陈旧值） ----
const snapP0 = await score('$snap_period');
let envNote = '';
if (!Number.isFinite(snapP0) || snapP0 > 20) { await set('$snap_period', 20); envNote = `快照节拍 ${Number.isFinite(snapP0) ? snapP0 : 'n/a'}→20`; }
await sleep(1700);   // > 1 个节拍（20 tick）⇒ 必定跑过 circ/snapshot（它同时刷新 biome/caps/eff）

// 这台服务器上可能同时有别的脚本/机器人（实测：并发跑 regress 时会互相覆写 $sel.biome、$grp.mem）
// ⇒ 计分板取"双读一致"才采信，命令级断言允许重试；断言本身仍是"两个函数同点必须同索引"。
const readStable = async (h) => { const v1 = await score(h); const v2 = await score(h); return v1 === v2 ? v1 : NaN; };
const SEL_PLAYER = '@a[gamemode=!spectator,limit=1]';
// ctx 是 `execute` 后面的上下文串：默认与 circ/snapshot 完全一致（at 第一个非旁观玩家）
const detectAt = async (ctx = `at ${SEL_PLAYER}`) => {          // detect_at：写 $sel.biome
  for (let i = 0; i < 4; i++) {
    await cmd(`execute ${ctx} run function doom.nats:biome/detect_at`);
    const v = await readStable('$sel.biome');
    if (Number.isFinite(v)) return v;
  }
  return NaN;
};
const detect = async (ctx = `at ${SEL_PLAYER}`) => {            // detect：快照层函数，写 $snap.biome
  await cmd(`execute ${ctx} run function doom.nats:biome/detect`);
  return await readStable('$snap.biome');
};

// ---- A：同一上下文三值比对（引擎节拍值 / detect_at / detect 直调） ----
// ⚠ v4.22j（本轮门里的假红根因）：**引擎值必须归属到"引擎选择器当时选中的那个玩家"的坐标**。
//   `circ/snapshot` 用 `at @a[gamemode=!spectator,limit=1]` 写 `$snap.biome`，而本脚本随后的
//   detect_at/detect 默认也用同一个选择器 —— 但那**两次调用之间选择器可能换人、玩家也可能移动**
//   （实测：真人玩家在线且走动，引擎值读到 plains(41)、detect_at 却在 meadow(33)）。
//   修法：① 三值统一显式 `in <维度> positioned <x y z>`（坐标取自同一个选择器）② 采样前后各读一次该玩家
//   坐标与维度，**三次完全一致**才采信（否则重试）⇒ 断言语义不变，只是把"位置归属"钉死。
const selPos = async () => {
  const dim = String(await cmd(`data get entity ${SEL_PLAYER} Dimension`)).match(/"(minecraft:[a-z_]+)"/)?.[1];
  const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(String(await cmd(`data get entity ${SEL_PLAYER} Pos`)).replace(/[−–—]/g, '-'));
  return m && dim ? { dim, x: Math.floor(+m[1]), y: Math.floor(+m[2]), z: Math.floor(+m[3]) } : null;
};
const samePos = (a, b) => !!a && !!b && a.dim === b.dim && a.x === b.x && a.y === b.y && a.z === b.z;
const tryA = async () => {
  await set('$snap_period', 20);
  const p0 = await selPos();
  await sleep(1700);                                    // 等引擎自己写一次 $snap.biome
  const sEngine = await readStable('$snap.biome');
  const p1 = await selPos();
  const ctx = p1 ? `in ${p1.dim} positioned ${p1.x} ${p1.y} ${p1.z}` : `at ${SEL_PLAYER}`;
  const a = await detectAt(ctx);
  const sDirect = await detect(ctx);
  const p2 = await selPos();
  const stable = samePos(p0, p1) && samePos(p1, p2);
  return { sEngine, a, sDirect, stable, p1, ok: stable && Number.isFinite(a) && a === sDirect && a === sEngine };
};
let A = await tryA();
for (let i = 0; i < 2 && !A.ok; i++) { await sleep(1200); A = await tryA(); }
ok('A 快照 detect 与 detect_at 同点同索引（坐标归属到引擎选择器选中的玩家）', A.ok,
  `${A.p1 ? A.p1.dim + ' @' + A.p1.x + ',' + A.p1.y + ',' + A.p1.z : '玩家点(' + P + ')'}${A.stable ? '' : ' ⚠采样期间玩家移动/换人，值不可归属'}` +
  ` 引擎 $snap.biome=${A.sEngine}(${nameOf(A.sEngine)}) · detect_at=$sel.biome=${A.a}(${nameOf(A.a)}) · detect 直调=${A.sDirect}(${nameOf(A.sDirect)})`);

// ---- A2：位置敏感 + 同点一致 ----
// v4.21 重写（原来是把世界原点的 (0,0) 区块 forceload 起来再探）：
//   坑①：**远处 forceload 区块的 `if biome` 读数不稳定** —— 同一坐标 (0,64,0) 三次分别读出
//        41(plains) / 22(forest) / 23(frozen_ocean)（同一份包、同一台服）⇒ "同点两函数一致"这条断言
//        在**前提层**就崩了，跟包无关。
//   坑②：把冻结做对（回读 20000/100000）之后，detect 直调读回的仍是"玩家点的 25(frozen_river)" ——
//        说明还有别的写入者会改 $snap.biome（真人玩家在场时会跑 debug/env / mode/* 等会调 circ/snapshot 的入口）。
//   对策：改用**锚定机器人所在处**（区块常驻加载、位置稳定；锚点由 gate 的 resetEnv 保证）
//        + 下界 (0,64,0)（forceload 后稳定，实测两函数都读 50），并对每次配对做"复读不变"守卫：
//        写完 detect 后立刻复读一次 $snap.biome，若变了说明有后台写入者 ⇒ 重试配对（断言语义不变）。
const BOTNAME = /passed/i.test(await cmd('execute if entity DoomBot')) ? 'DoomBot' : null;
const BOT2NAME = /passed/i.test(await cmd('execute if entity DoomBot2')) ? 'DoomBot2' : null;
await cmd('execute in minecraft:the_nether run forceload add 0 0');
await sleep(1500);
// v4.20a：A2 必须在**冻结**下做 —— detect 写 $snap.biome、detect_at 写 $sel.biome，而活循环（每 tick 的尝试 +
//   每 20 tick 的快照）会在两次 RCON 调用之间改写它们 ⇒ 实测 (0,64,0) 出现 detect_at=41(plains) vs
//   detect=25(frozen_river) 的假红。冻结只关"后台改写"，不关 detect 自己的写入，所以 A2 语义不变。
// v4.20b：冻结必须**回读确认**：circ/apply 每拍都把 $eff.period 从 $cfg.period 重算，只 set 一次的话紧接着的一拍快照就把它抹掉。
let frzNote = '';
for (let i = 0; i < 4; i++) {
  await cmd('scoreboard players set $snap_period doom.nats 20000');
  await cmd('scoreboard players set $eff.period doom.nats 100000');
  await sleep(160);
  const sp = await score('$snap_period'), ep = await score('$eff.period');
  if (sp >= 1000 && ep >= 1000) { frzNote = `冻结 快照=${sp}/刷怪=${ep}`; break; }
}
const pairAt = async (ctx) => {
  for (let i = 0; i < 4; i++) {
    const a = await detectAt(ctx);                        // detect_at → $sel.biome
    const s = await detect(ctx);                          // detect    → $snap.biome
    const s2 = await score('$snap.biome');                // 复读：变了 = 有后台写入者
    if (Number.isFinite(a) && a === s && s === s2) return { a, s, tries: i + 1 };
    await sleep(400);
  }
  return { a: NaN, s: NaN, tries: 4 };
};
const p1 = await pairAt(BOTNAME ? `at ${BOTNAME}` : `at ${SEL_PLAYER}`);
const p2 = await pairAt(BOT2NAME ? `at ${BOT2NAME}` : `at ${SEL_PLAYER}`);
const pn = await pairAt('in minecraft:the_nether positioned 0 64 0');
const sensitive = [p1.a, p2.a, pn.a].some((v, i, arr) => Number.isFinite(v) && v !== arr[0]);
ok('A2 位置敏感 + 同点两函数一致（机器人锚点 / 下界点）',
  frzNote !== '' && p1.a === p1.s && p2.a === p2.s && pn.a === pn.s && sensitive,
  `${frzNote || '⚠冻结回读失败'} · 锚点1(${BOTNAME || '玩家'}) detect_at=${p1.a}(${nameOf(p1.a)}) detect=${p1.s}(${nameOf(p1.s)})` +
  ` · 锚点2(${BOT2NAME || '玩家'}) detect_at=${p2.a}(${nameOf(p2.a)}) detect=${p2.s}(${nameOf(p2.s)})` +
  ` · 下界(0,64,0) detect_at=${pn.a}(${nameOf(pn.a)}) detect=${pn.s}(${nameOf(pn.s)})` +
  ` · 玩家点(A)=${A.a}(${nameOf(A.a)})` + (sensitive ? ' ← 位置敏感成立' : ' ← 三处同索引（无法区分）'));
// A2 读完立刻解冻（B 段依赖真实刷怪，且它自己会再清场/回读容量）
await cmd('scoreboard players set $snap_period doom.nats 20');
await cmd('scoreboard players set $eff.period doom.nats 5');
await cmd('execute in minecraft:the_nether run forceload remove 0 0');
await cmd('function doom.nats:circ/snapshot');
await sleep(1200);   // 让引擎节拍把 $snap.biome 写回玩家点，再跑 B（B 不依赖它，但保持环境干净）

// ---- B：活性（开跑前必须先清场并把容量**回读确认**腾出来，否则上限顶满 ⇒ 100 次尝试全被 check/cap 拒 ⇒ 假 FAIL） ----
const caps = async () => ({ cnt: await score('$cnt.monster'), cap: await score('$cap.monster') });
const capFull = (c) => Number.isFinite(c.cnt) && Number.isFinite(c.cap) && c.cap > 0 && c.cnt >= c.cap;
let c = await caps();
envNote += (envNote ? ' · ' : '') + `容量(开跑前) ${c.cnt}/${c.cap}`;
// 至少清一次（顺手清掉别的脚本残留）；仍顶格就再来一轮，每轮都回读 $cnt.* 与 $cap.*
for (let i = 0; i < 4 && (i === 0 || capFull(c)); i++) {
  await cmd('function doom.nats:debug/clear');
  await sleep(1300);                       // 等一节拍刷新 $cnt.*（A 段已把 $snap_period 恢复成 20）
  const c2 = await caps();
  envNote += ` · debug/clear#${i + 1} ${c.cnt}/${c.cap}→${c2.cnt}/${c2.cap}`;
  c = c2;
}
if (capFull(c)) {
  // debug/clear 只清**本包**生物；若额度是被背景野怪（原版/别的脚本留下的同类怪物）占满，它清不动 ⇒ 按类别再清一次。
  // 盒子参数与 v4 的 check/caps 同款：不带体积约束的 @e 会跨维度选实体，必须用全图盒限定"执行维度=主世界"。
  const BOX = 'x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000';
  // ⚠ v4.20（安全）：加"命名 / 有主 / 持久化 / 拴绳"守卫 —— 否则真人玩家在线时他的命名僵尸/驯服生物会被这行清掉。
  await cmd(`execute as @e[type=#doom.nats:monster,${BOX}] unless data entity @s CustomName unless data entity @s Owner unless data entity @s PersistenceRequired unless data entity @s Leash run kill @s`);
  await sleep(1300);
  const c3 = await caps();
  envNote += ` · 类别清场(主世界 monster) ${c.cnt}/${c.cap}→${c3.cnt}/${c3.cap}`;
  c = c3;
}
if (capFull(c)) envNote += ' ⚠清场后仍顶格，活性断言可能被容量拒';
// B 前置③（v4.17/P1-5）：$cfg.spawn24=1 时"距声明的出生点 24 格内"的候选会被 reason=10 否决。
// 机器人通常就站在世界出生点上 ⇒ 100 次尝试全被拒、生成增量=0（实测出现过的假 FAIL，容量并不满）。
// 所以先把玩家挪到出生点 64 格外再跑。
const s24 = await score('$cfg.spawn24'), sx = await score('$cfg.spawn_x'), sz = await score('$cfg.spawn_z');
if (Number.isFinite(s24) && s24 >= 1 && Number.isFinite(sx) && Number.isFinite(sz)) {
  // ⚠ v4.20（安全）：**只挪锚定机器人**。原来写的是 `tp @a[gamemode=!spectator,limit=1]` —— 真人玩家在线时
  //   会被这行一起 tp 走（自动化不得触碰用户的实时会话）。真人玩家在场而机器人不在场时，这条前置直接跳过。
  const hasBot = /passed/i.test(await cmd('execute if entity DoomBot'));
  const pm2 = hasBot ? /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(num(await cmd('data get entity DoomBot Pos'))) : null;
  if (pm2) {
    const d = Math.hypot(Math.floor(+pm2[1]) - sx, Math.floor(+pm2[3]) - sz);
    if (d < 40) {
      await cmd(`tp DoomBot ${sx + 64} ~ ${sz + 64}`);
      await sleep(2500);                       // 等目标区块加载
      envNote += ` · DoomBot 离出生点 ${d.toFixed(0)} 格 ⇒ 挪到 (+64,+64)`;
    }
  } else envNote += ' · 无 DoomBot ⇒ 跳过"离开出生点"前置（只测活性，不挪真人玩家）';
}
// B 前置④：活性还受**时段**支配 —— 白天（实测 time=6000）地表天空光满格，怪物候选几乎全被光照门拒
//（实测 200 次只成 1 只、连 800 次都可能 0）。测试自己把时段摆到午夜再跑，别让活性断言看天色。
await cmd('time set midnight');
await cmd('gamerule doDaylightCycle false');
await sleep(800);
envNote += ' · 时段=midnight（doDaylightCycle=false）';
const t0 = await score('$dbg.tries');
const r10a = await score('$rej.10');
const before = await score('$spawned.total');
// 单批 100 次在当前世界只有 ~2% 命中率（多数候选被方块/光照/距离门拒）⇒ 单批常出现 0 生成（假 FAIL）。
// 改成"每批 200 次，最多 4 批，一旦有生成就收尾"：期望命中 ~16 次，四批全 0 的概率可忽略。
let done = 0;
let delta = 0;
for (let b = 0; b < 4 && delta === 0; b++) {
  for (let i = 0; i < 200; i++) await cmd('function doom.nats:spawn/try');
  done += 200;
  delta = (await score('$spawned.total')) - before;
}
const after = await score('$spawned.total');
const r10b = await score('$rej.10');
const tries = (await score('$dbg.tries')) - t0;
ok('B 集成：真实尝试仍有生成', delta > 0,
  `生成增量=${delta}（累计 ${after}）· 尝试 ${done} 次${Number.isFinite(tries) ? '（$dbg.tries +' + tries + '）' : ''} · 容量 ${c.cnt}/${c.cap}` +
  (Number.isFinite(r10b - r10a) ? ` · reason10 +${r10b - r10a}` : '') + (envNote ? ' · ' + envNote : ''));

if (bot) { try { bot.kill(); } catch {} console.log('（已关闭自起机器人）'); }
const pass = res.filter(Boolean).length;
console.log(String.fromCharCode(10) + '汇总: ' + pass + ' PASS / ' + (res.length - pass) + ' FAIL');
r.close && r.close();
process.exit(pass === res.length ? 0 : 1);
