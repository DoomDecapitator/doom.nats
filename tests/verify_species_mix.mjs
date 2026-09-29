// _work/verify_species_mix.mjs —— P0-4 回归门：生产分发表的**权重**必须真的生效
//
// 背景（v4.19 修）：$rng 以前只由测试脚本（verify_*/probe_*）掷骰，生产链路里没有任何地方掷它
//   ⇒ $rng 恒为 0 ⇒ 每个类别永远命中"表里第一条"（海洋怪物=蜘蛛、海洋 ambient=蝙蝠、要塞=烈焰人…），
//   权重整体失效、溺尸这种靠权重才出现的物种永远选不中。测试当时"绿"正是因为脚本自己补掷了 $rng。
//
// 本脚本刻意**不预掷 $rng**，只走生产路径：
//   A 确定性桶：直接摆 $rng = 该行的桶起点 → 调类别表 → 断言选中的物种（9 行 + 要塞 5 行）
//   B 掷骰真的在跑：连调群系分发 200 次 → $rng 不同取值数、首行物种占比
//   C 类别份额：monster 在 ocean 的 6 类里应约 1/5
//   D 活性：连打 60 次 spawn/try，$dbg.tries 必须增长
import fs from 'node:fs'; import path from 'node:path';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const score = async (h) => { const m = /has (-?\d+)/.exec(await cmd('scoreboard players get ' + h + ' doom.nats')); return m ? Number(m[1]) : NaN; };
const set = async (h, v) => { await cmd('scoreboard players set ' + h + ' doom.nats ' + v); };
const res = []; const ok = (n, p, d) => { res.push(p); console.log((p ? 'PASS ' : 'FAIL ') + n + '  ' + d); };
const selType = async () => { const m = /"(.*)"/.exec(await cmd('data get storage doom.nats:sel type')); return m ? m[1] : null; };
const selCat = async () => { const m = /"(.*)"/.exec(await cmd('data get storage doom.nats:sel cat')); return m ? m[1] : null; };

// 冻结：本脚本要反复戳 $rng / $sel，必须让生产循环停手（冻结口径与别的 verify 脚本一致）
await set('$snap_period', 20000); await set('$eff.period', 20000);
await sleep(1200);
if ((await score('$eff.period')) !== 20000 || (await score('$eff.period')) !== 20000) {
  ok('0 冻结生效', false, '$eff.period 没冻住（circ/apply 又还原了？）');
} else ok('0 冻结生效', true, '$snap_period/$eff.period=20000');

const roster = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'doom.nats', '_work', 'generated', 'biome-rosters.json'), 'utf8')).rosters;
const rowsOf = (biome, cat) => roster[biome].categories[cat].rows;

// ---- A 确定性桶：$rng = 行起点 ⇒ 必须选中该行物种
{
  let bad = [];
  const rows = rowsOf('minecraft:ocean', 'monster');
  for (const row of rows) {
    await cmd('data remove storage doom.nats:sel');
    await cmd('scoreboard players set $sel.ok doom.nats 0');
    await set('$rng', row.from);
    await cmd('execute positioned 0 55 0 run function doom.nats:mob/biome/ocean/monster');
    const t = await selType();
    if (t !== row.type) bad.push(row.from + '→' + t + '（应 ' + row.type + '）');
  }
  ok('A1 海洋 monster 9 个桶逐一对齐', bad.length === 0, bad.length ? bad.join(' · ') : '9/9 行桶起点都命中该行物种（含溺尸 515..519）');
}
{
  let bad = [];
  const rows = [{ from: 0, type: 'minecraft:blaze' }, { from: 10, type: 'minecraft:zombified_piglin' }, { from: 15, type: 'minecraft:wither_skeleton' }, { from: 23, type: 'minecraft:skeleton' }, { from: 25, type: 'minecraft:magma_cube' }];
  for (const row of rows) {
    await cmd('data remove storage doom.nats:sel');
    await cmd('scoreboard players set $sel.ok doom.nats 0');
    await set('$rng', row.from);
    await cmd('execute positioned 0 55 0 run function doom.nats:mob/fortress');
    const t = await selType();
    if (t !== row.type) bad.push(row.from + '→' + t);
  }
  ok('A2 要塞 5 个桶逐一对齐', bad.length === 0, bad.length ? bad.join(' · ') : '5/5（烈焰人/僵尸猪灵/凋灵骷髅/骷髅/岩浆怪）');
}

// ---- B/C 生产分发连打 200 次（不预掷 $rng）
const rngVals = new Set(); const spCount = {}; let monsterShare = 0, n = 0;
for (let i = 0; i < 200; i++) {
  await cmd('data remove storage doom.nats:sel');
  await cmd('scoreboard players set $sel.ok doom.nats 0');
  await cmd('execute positioned 0 55 0 run function doom.nats:mob/biome/ocean');
  const g = await score('$rng'); if (Number.isFinite(g)) rngVals.add(g);
  const t = (await selType()) || '(空)'; const c = (await selCat()) || '(空)';
  spCount[t] = (spCount[t] || 0) + 1; if (c === 'monster') monsterShare++;
  n++;
}
const spider = spCount['minecraft:spider'] || 0;
const top = Object.entries(spCount).sort((a, b) => b[1] - a[1])[0];
ok('B1 $rng 真的在掷（生产路径）', rngVals.size >= 20, '200 次分发后 $rng 不同取值 ' + rngVals.size + ' 个（注意：读到的已是 %= 权重和 之后的值，单行表只剩 0..9，所以不必贪大；修复前恒为 1）');
// B1b：把 $rng 毒成"溺尸桶起点"，再连调分发 —— 若分发自己不掷骰，就会一直出溺尸（1/5 类别 × 100%）
{
  let drowned = 0, m = 0;
  for (let i = 0; i < 150; i++) {
    await cmd('data remove storage doom.nats:sel');
    await cmd('scoreboard players set $sel.ok doom.nats 0');
    await set('$rng', 515);                       // ocean/monster 表里溺尸的桶起点
    await cmd('execute positioned 0 55 0 run function doom.nats:mob/biome/ocean');
    const t = await selType(); if (t === 'minecraft:drowned') drowned++;
    m++;
  }
  ok('B1b 分发不采信调用方残留的 $rng', drowned / m <= 0.08, '把 $rng 固定成溺尸桶起点后连调 ' + m + ' 次：溺尸 ' + drowned + ' 次 = ' + (100 * drowned / m).toFixed(1) + '%（分发自掷 ⇒ 期望 ~0.2%；不掷 ⇒ ~20%）');
}
ok('B2 首行物种不再垄断', spider / n <= 0.40, '蜘蛛（海洋 monster 表首行）占比 ' + spider + '/' + n + ' = ' + (100 * spider / n).toFixed(0) + '%（权重 19% ⇒ 修复前 100%）');
ok('B3 出现多物种', Object.keys(spCount).length >= 4, '选中物种 ' + Object.keys(spCount).length + ' 种，最多的是 ' + top[0].replace('minecraft:', '') + '×' + top[1]);
ok('C1 monster 类别份额 ≈ 1/5', monsterShare / n >= 0.08 && monsterShare / n <= 0.35, 'monster ' + monsterShare + '/' + n + ' = ' + (100 * monsterShare / n).toFixed(0) + '%（5 类均匀 ⇒ 20%）');

// ---- D 活性：连打 spawn/try
const t0 = await score('$dbg.tries');
for (let i = 0; i < 60; i++) await cmd('function doom.nats:spawn/try');
const dt = (await score('$dbg.tries')) - t0;
ok('D1 生产链路仍有尝试', dt >= 60, '$dbg.tries +' + dt + '（60 次手工 spawn/try）');

const pass = res.filter(Boolean).length;
console.log(String.fromCharCode(10) + '汇总: ' + pass + ' PASS / ' + (res.length - pass) + ' FAIL');
r.close && r.close();
process.exit(pass === res.length ? 0 : 1);
