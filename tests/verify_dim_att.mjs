// _work/verify_dim_att.mjs —— v4.20 专项：尝试维度 $att.dim 与快照维度 $snap.dim 的拆分（P0 竞态回归）
//
//   node _work/verify_dim_att.mjs
//
// 背景（v4.20 P0，见 reports/极端-E4-容量密度-20260929.md §3.5）：
//   生产链 spawn/try → spawn/try_at → pos/pick_local **从不刷新"本次尝试的维度"**，
//   而 check/cap 与 check/sealevel 读的是**快照层**的 $snap.dim ⇒ 末地/下界的尝试被拿主世界的
//   计数、容量与海平面窗口判定。真机实测：末地怪物堆到 500 只、$cap.monster=40、$rej.5 恒为 0
//   （容量门形同不存在）；冻结节拍下直接戳 check/cap 却正确拒 r5 ⇒ 差异只可能来自"尝试链里维度没被刷新"。
//   修复：新增 circ/detect_dim_att 写 $att.dim（由 pos/ctx 在每次尝试开头调用）；
//         check/cap + check/sealevel + cfg 的 per-dim 分支改读 $att.dim；$snap.dim 只留给快照/情形层。
//
// 断言（每条都对应"修复前会红"）：
//   A 归属：detect_dim_att 在 主世界/下界/末地 ⇒ $att.dim = 0/1/2
//   B 隔离：detect_dim_att **不写** $snap.dim（哨兵 0→仍 0、1→仍 1）
//   C 末地满 cap ⇒ 必 r5（确定性：直接戳 check/cap，$snap.dim 故意摆成 0=主世界）
//   D 反向不连坐：主世界满 + 尝试维度=末地 ⇒ **不得** r5（修复前读 $snap.dim=0=主世界满 ⇒ 误 r5）
//   E 生产链正向：末地满 cap ⇒ 24 次 spawn/try_at 里 $rej.5 增长、$spawned 不增长
//   F 生产链反向：主世界满 + 末地空 ⇒ 末地尝试 $rej.5 不增长（修复前会涨）
//
// 环境：需要一个可 tp 的机器人（优先 DoomBot、其次 DoomBot2），都没有就自起临时机器人（收尾删掉）。
//   末地锚点 (0,62,0)：主岛 end_stone 顶面 y=61（_work/_end_probe.mjs 实测 ±112 范围内 56..61）。
//   ⚠ 冻结必须**回读确认**：circ/apply 每拍把 $eff.period 从 $cfg.period 重算，只 set 不回读会被下一拍抹掉。
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const ok = (n, p, d) => { res.push(p); console.log((p ? 'PASS ' : 'FAIL ') + n + '  ' + d); };
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const set = (h, v) => cmd('scoreboard players set ' + h + ' doom.nats ' + v);
const score = async (h) => { const t = await cmd('scoreboard players get ' + h + ' doom.nats'); const m = /has (-?\d+)/.exec(t); return m ? Number(m[1]) : NaN; };
const passed = async (c) => /passed/i.test(await cmd(c));
const num = (s) => String(s).replace(/[\u2212\u2013\u2014]/g, '-');
const posOf = async (e) => { const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(num(await cmd('data get entity ' + e + ' Pos'))); return m ? [Math.floor(+m[1]), Math.floor(+m[2]), Math.floor(+m[3])] : null; };
const N_TRY = 24;

console.log('=== 尝试维度 $att.dim · 真机回归 ===');

// ---- 冻结（回读确认，最多 4 次） ----
const freeze = async () => {
  for (let i = 0; i < 4; i++) {
    await set('$snap_period', 20000);
    await set('$eff.period', 100000);
    await sleep(160);
    const sp = await score('$snap_period'), ep = await score('$eff.period');
    if (Number.isFinite(sp) && sp >= 1000 && Number.isFinite(ep) && ep >= 1000) return '快照=' + sp + '/刷怪=' + ep;
  }
  return '';
};

// ---- 机器人：优先复用锚点机器人，没有就自起（收尾删） ----
let bot = null, ownBot = null;
for (const n of ['DoomBot', 'DoomBot2']) if (await passed('execute if entity ' + n)) { bot = n; break; }
if (!bot) {
  const bp = path.join(import.meta.dirname, 'mcserver', 'bot.mjs');
  ownBot = spawn(process.execPath, [bp, '--minutes', '6', '--name', 'DoomBotDim'], { cwd: path.dirname(bp), stdio: 'ignore' });
  bot = 'DoomBotDim';
  for (let i = 0; i < 45; i++) { if (await passed('execute if entity DoomBotDim')) break; await sleep(1000); }
}
const botHere = await passed('execute if entity ' + bot);
const home = botHere ? await posOf(bot) : null;
const homeDim = botHere ? (/the_nether/.test(await cmd('data get entity ' + bot + ' Dimension')) ? 'the_nether' : /the_end/.test(await cmd('data get entity ' + bot + ' Dimension')) ? 'the_end' : 'overworld') : 'overworld';

const frz = await freeze();
if (!frz) console.log('⚠ 冻结回读失败（$snap_period/$eff.period 没站住）⇒ 下面的分数断言可能被后台节拍改写');

// ---- A：$att.dim 归属 ----
const dimOf = async (d) => { await cmd('execute in minecraft:' + d + ' run function doom.nats:circ/detect_dim_att'); return await score('$att.dim'); };
const dOw = await dimOf('overworld'), dNe = await dimOf('the_nether'), dEn = await dimOf('the_end');
ok('A $att.dim 三处归属（主/下/末 = 0/1/2）', dOw === 0 && dNe === 1 && dEn === 2, `主世界=${dOw} · 下界=${dNe} · 末地=${dEn} · ${frz || '冻结失败'}`);

// ---- B：isolated —— detect_dim_att 不碰 $snap.dim ----
await set('$snap.dim', 0);
const b1 = await dimOf('the_end'), snap1 = await score('$snap.dim');
await set('$snap.dim', 1);
const b2 = await dimOf('the_end'), snap2 = await score('$snap.dim');
ok('B detect_dim_att 不写 $snap.dim（哨兵 0/1 都不变）', b1 === 2 && snap1 === 0 && b2 === 2 && snap2 === 1,
  `哨兵0：att=${b1} snap=${snap1} · 哨兵1：att=${b2} snap=${snap2}`);

// ---- check/cap 直戳前置：宏参数 cat=monster（收尾还原） ----
const catTxt = await cmd('data get storage doom.nats:sel cat');
const catBackup = /"cat"\s*:\s*"([^"]+)"/.exec(catTxt)?.[1] || null;
await cmd('data modify storage doom.nats:sel cat set value "monster"');
const capM = await score('$cap.monster');
const capCall = async (dim) => {
  await set('$chk.ok', 1); await set('$chk.reason', 0);
  await cmd('execute in minecraft:' + dim + ' run function doom.nats:check/cap with storage doom.nats:sel');
  return { ok: await score('$chk.ok'), reason: await score('$chk.reason') };
};

// ---- C：末地满 cap ⇒ 必 r5（$snap.dim 故意摆成 0=主世界，复现修复前的读法） ----
await set('$cnt.monster', 0);
await set('$cnt.monster.end', capM + 100);
await set('$snap.dim', 0);
await dimOf('the_end');
const C = await capCall('the_end');
ok('C 末地满 cap ⇒ 必 r5（尝试维度=末地）', C.ok === 0 && C.reason === 5,
  `$cnt.monster.end=${capM + 100} ≥ $cap.monster=${capM} · 主世界=0 · $snap.dim=0(哨兵) ⇒ ok=${C.ok} reason=${C.reason}`);

// ---- D：主世界满不得连坐末地（修复前读 $snap.dim=0 ⇒ 误 r5） ----
await set('$cnt.monster', capM + 100);
await set('$cnt.monster.end', 0);
await set('$snap.dim', 0);
await dimOf('the_end');
const D = await capCall('the_end');
ok('D 主世界满 + 尝试在末地 ⇒ 不得 r5（反向不连坐）', D.reason !== 5,
  `主世界=${capM + 100}(满) · 末地=0 · $snap.dim=0(哨兵) ⇒ ok=${D.ok} reason=${D.reason}（修复前读 $snap.dim ⇒ 会误报 5）`);

// ---- E/F：生产链（spawn/try_at 会自己跑 pos/ctx 刷新 $att.dim） ----
const inEnd = async () => {
  await cmd('execute in minecraft:the_end run tp ' + bot + ' 0 62 0');
  await sleep(2600);
  const p = await posOf(bot);
  return p ? p[1] : NaN;
};
const hops = async (n) => { for (let i = 0; i < n; i++) await cmd('execute in minecraft:the_end as ' + bot + ' at @s run function doom.nats:spawn/try_at'); };
const hist = async () => { const o = []; for (let i = 0; i <= 11; i++) o.push(await score('$rej.' + i)); return o; };

let E = { ok: false, why: '机器人不在末地实地（环境）' };
let F = { ok: false, why: '同上（未跑）' };
let histTxt = '';
if (botHere) {
  const by = await inEnd();
  if (Number.isFinite(by) && by >= 40) {
    // E：末地满 cap
    await set('$cnt.monster', 0);
    await set('$cnt.monster.end', capM + 100);
    const h0 = await hist();
    const r50 = await score('$rej.5'), sp0 = await score('$spawned'), pt0 = await score('$dbg.points');
    await hops(N_TRY);
    const r51 = await score('$rej.5'), sp1 = await score('$spawned'), pt1 = await score('$dbg.points');
    E = { ok: (r51 - r50) >= 1 && (sp1 - sp0) === 0, why: `${N_TRY} 次 try_at · $rej.5 ${r50}→${r51}(+${r51 - r50}) · $spawned ${sp0}→${sp1}(+${sp1 - sp0}) · 候选点 ${pt0}→${pt1}` };
    const h1 = await hist();
    histTxt = '归因增量(E 段)：' + h1.map((v, i) => i + '=+' + (v - h0[i])).filter((s) => !/=\+0$/.test(s) && !/^(8|9)=/.test(s)).join(' ');
    // F：主世界满、末地空
    await set('$cnt.monster', capM + 100);
    await set('$cnt.monster.end', 0);
    const r52 = await score('$rej.5'), sp2 = await score('$spawned');
    await hops(N_TRY);
    const r53 = await score('$rej.5'), sp3 = await score('$spawned');
    F = { ok: (r53 - r52) === 0, why: `主世界=${capM + 100}(满) · 末地=0 · ${N_TRY} 次 try_at · $rej.5 ${r52}→${r53}(+${r53 - r52}) · $spawned ${sp2}→${sp3}（修复前读主世界计数 ⇒ 会涨）` };
  } else {
    console.log('⚠ 机器人在末地没站到实地（y=' + by + '）⇒ E/F 记 FAIL 并注明环境');
  }
}
ok('E 生产链：末地满 cap ⇒ 被容量门拦下（r5 增长、零生成）', E.ok, E.why + (histTxt ? ' · ' + histTxt : '') + (frz ? ' · ' + frz : ''));
ok('F 生产链反向：主世界满不得让末地尝试吃到 r5', F.ok, F.why);

// ---- 收尾：清末地生成物 / 送回机器人 / 解冻 / 还原宏参数 ----
await cmd('execute in minecraft:the_end as @e[tag=doom.nats.spawned,nbt=!{PersistenceRequired:true}] run kill @s');
if (botHere) await cmd('execute in minecraft:' + homeDim + ' run tp ' + bot + (home ? ` ${home[0]} ${home[1]} ${home[2]}` : ' -240 64 -592'));
await set('$snap_period', 20);
await set('$eff.period', 5);
await cmd('function doom.nats:circ/snapshot');
await sleep(1300);
await set('$chk.ok', 1);
await set('$chk.reason', 0);
if (catBackup) await cmd('data modify storage doom.nats:sel cat set value "' + catBackup + '"'); else await cmd('data remove storage doom.nats:sel cat');
console.log('收尾：$snap.dim=' + (await score('$snap.dim')) + ' · $cnt.monster=' + (await score('$cnt.monster')) + '/' + (await score('$cap.monster')) + ' · $cnt.monster.end=' + (await score('$cnt.monster.end')) + ' · $att.dim=' + (await score('$att.dim')));
if (ownBot) { try { ownBot.kill(); } catch {} console.log('（已关闭自起机器人 ' + bot + '）'); }
const pass = res.filter(Boolean).length;
console.log(String.fromCharCode(10) + '汇总: ' + pass + ' PASS / ' + (res.length - pass) + ' FAIL');
r.close && r.close();
process.exit(pass === res.length ? 0 : 1);
