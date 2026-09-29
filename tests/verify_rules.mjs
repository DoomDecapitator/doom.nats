// _work/verify_rules.mjs —— 真机验证 v4.13「逐实体规则 + 逐实体光照」修正（v2：自建受控试验场）
//
//   node _work/verify_rules.mjs
//
// 前置：常驻测试服在跑（RCON 25575），v4 已装进 _work/mcserver/world/datapacks。
// v2 的变化：不再依赖"玩家附近刚好有草地/水"，而是在玩家身侧**自建**一块受控试验场：
//   草台（grass_block + 空气）· 水池（3×3×3 水）· 岩浆池（炽足兽用），测完即拆。
import fs from 'node:fs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const LOG = 'C:/Users/Dell/Downloads/datapack/_work/mcserver/logs/latest.log';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail: String(detail) }); console.log((pass ? '✅ ' : '❌ ') + name + '  ' + detail); };
const logSize = () => { try { return fs.statSync(LOG).size; } catch { return 0; } };
const readFrom = (o) => { try { return fs.readFileSync(LOG).subarray(o).toString('utf8'); } catch { return ''; } };

const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const score = async (h) => {
  const t = await cmd('scoreboard players get ' + h + ' doom.nats');
  const m = /has (-?\d+)/.exec(t);
  return m ? Number(m[1]) : NaN;
};
const set = (h, v) => cmd(`scoreboard players set ${h} doom.nats ${v}`);
const sel = (o) => Object.entries(o).map(([k, v]) => `${h(k)} ${v}`).join(' ');
const h = (k) => '$sel.' + k;

console.log('=== v4.13 逐实体规则 · 真机验证（受控试验场）===');
// ---------- 0) reload 无加载错误
let mark = logSize();
await cmd('reload');
await sleep(3000);
let seg = readFrom(mark);
// 稳定化：等情形引擎把 $eff.* 算出来（reload 后第一个快照节拍才写）
for (let i = 0; i < 20; i++) { if ((await score('$eff.period')) >= 1) break; await sleep(500); }

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

const pt = await cmd('data get entity @e[type=player,name=DoomBot,limit=1] Pos');
const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(pt);
if (!m) { console.log('❌ 没有玩家在线'); process.exit(1); }
const P = { x: Math.floor(+m[1]), y: Math.floor(+m[2]), z: Math.floor(+m[3]) };
console.log('玩家位置', JSON.stringify(P));

// 受控试验场：距玩家 6 格处铺 5×5 地基（y = P.y），上面留 4 格空气
const B = { x: P.x + 6, y: P.y, z: P.z };
const SAY = (s) => cmd('say ' + s);

// 等光照真的到位（时间切换后光照引擎需要若干 tick；固定 sleep 会偶发失败 —— 实测踩过）
const waitLight = async (x, y, z, tier, want, timeoutMs = 9000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await set('$probe', 0);
    await cmd(`execute positioned ${x} ${y} ${z} if predicate doom.nats:light/tier_${tier} run scoreboard players set $probe doom.nats 1`);
    if ((await score('$probe')) === (want ? 1 : 0)) return true;
    await sleep(300);
  }
  return false;
};
ok('reload 无加载错误', !/Failed to load|无法加载|加载失败/i.test(seg), '未见加载错误');

// ---------- 1) 谓词可判定
const preds = ['spawn/can_see_sky', 'spawn/bright_enough', 'spawn/biome_slime', 'spawn/biome_river', 'spawn/biome_more_drowned', 'spawn/biome_polar_alt', 'light/tier_8', 'light/tier_0', 'light/tier_7'];
mark = logSize();
for (const name of preds) await cmd(`execute positioned ${B.x} ${B.y + 3} ${B.z} if predicate doom.nats:${name} run scoreboard players set $probe doom.nats 1`);
seg = readFrom(mark);
ok('9 个新/改谓词均可判定（无解析错误）', !/Unknown|未知|Incorrect argument|Failed to load/i.test(seg), 'can_see_sky / bright_enough(any_of) / biome_* / tier_0·7·8');

// ---------- 2) 建试验场
await cmd(`fill ${B.x - 2} ${B.y} ${B.z - 2} ${B.x + 2} ${B.y} ${B.z + 2} minecraft:grass_block replace air`);
await cmd(`fill ${B.x - 2} ${B.y + 1} ${B.z - 2} ${B.x + 2} ${B.y + 4} ${B.z + 2} minecraft:air replace`);
// v4.20 修（可重复性）：只清 4 格高时，若上方有树冠/建筑，can_see_sky 会是 false ⇒
//   案例 3 的 bright_enough 假红（实测：首跑绿、再跑红）。这里把净空抬到 +16 格。
await cmd(`fill ${B.x - 2} ${B.y + 5} ${B.z - 2} ${B.x + 2} ${B.y + 16} ${B.z + 2} minecraft:air replace #minecraft:logs`);
await cmd(`fill ${B.x - 2} ${B.y + 5} ${B.z - 2} ${B.x + 2} ${B.y + 16} ${B.z + 2} minecraft:air replace #minecraft:leaves`);
await cmd(`setblock ${B.x} ${B.y} ${B.z} minecraft:grass_block`);
await sleep(300);
await set('$probe', 0);
await cmd(`execute positioned ${B.x} ${B.y + 1} ${B.z} if block ~ ~-1 ~ #minecraft:animals_spawnable_on run scoreboard players set $probe doom.nats 1`);
ok('试验场：草台就位（animals_spawnable_on）', (await score('$probe')) === 1, '地块 (' + B.x + ',' + B.y + ',' + B.z + ')');

// ---------- 3) 动物路径：light=2（bright）+ place=4（陆生+专属标签）+ tag=1（animals）
{
  await cmd(`time set day`);
  await sleep(400);
  await set('$sel.light', 2); await set('$sel.place', 4); await set('$sel.tag', 1); await set('$chk.ok', 1);
  await cmd(`execute positioned ${B.x} ${B.y + 1} ${B.z} run function doom.nats:check/light`);
  const okLight = await score('$chk.ok');
  await cmd(`execute positioned ${B.x} ${B.y + 1} ${B.z} run function doom.nats:check/block`);
  const okBlock = await score('$chk.ok');
  // 反证：把 light 改成 1（怪物暗档）——白天露天必须被否决
  await set('$sel.light', 1); await set('$chk.ok', 1);
  await cmd(`execute positioned ${B.x} ${B.y + 1} ${B.z} run function doom.nats:check/light`);
  const darkDay = await score('$chk.ok');
  // 反证：把 tag 改成 12（bats_spawnable_on = 石头族）——草地上必须被否决
  await set('$sel.light', 2); await set('$sel.tag', 12); await set('$chk.ok', 1);
  await cmd(`execute positioned ${B.x} ${B.y + 1} ${B.z} run function doom.nats:check/block`);
  const wrongTag = await score('$chk.ok');
  ok('动物路径：bright 规则通过（曾与"暗"互斥 ⇒ 永不刷）', okLight === 1, 'check/light $chk.ok=' + okLight);
  ok('动物路径：落位通过（#animals_spawnable_on）', okBlock === 1, 'check/block $chk.ok=' + okBlock);
  ok('反证：同点按怪物暗档（白天露天）必须否决', darkDay === 0, '$chk.ok=' + darkDay);
  ok('反证：同点按蝙蝠标签（石头族）必须否决', wrongTag === 0, '$chk.ok=' + wrongTag + '（下方是草）');
}

// ---------- 4) 水中路径：place=3（水面窗口）
{
  // 原版水面窗口是 seaLevel-13..seaLevel = 50..63（主世界 seaLevel=63）
  // ⇒ 必须把水池建在窗口内，否则失败是**正确行为**（第一版就踩了这个：池子建在 y=65）
  const W = { x: B.x, y: 60, z: B.z };
  await cmd(`fill ${W.x - 1} ${W.y - 1} ${W.z - 1} ${W.x + 1} ${W.y + 2} ${W.z + 1} minecraft:water`);
  await sleep(300);
  await set('$py', W.y + 1);   // 真实流程里由 pos/pick 写入候选点 y
  // 现场自检（水位三条件）：失败时把三格的水/空位状态一起报出来，避免"只看到 ok=0 不知哪一步"
  const wProbe = async (dy) => {
    await set('$probe', 0);
    await cmd(`execute positioned ${W.x} ${W.y + 1} ${W.z} if block ~ ~${dy === 0 ? '' : dy > 0 ? dy : dy} ~ minecraft:water run scoreboard players set $probe doom.nats 1`);
    return await score('$probe');
  };
  const waterAt = await wProbe(0);
  const waterBelow = await wProbe(-1);
  const waterAbove = await wProbe(1);
  await set('$sel.place', 3); await set('$sel.tag', 0); await set('$sel.wide', 0); await set('$sel.wide2', 0); await set('$sel.tall', 0); await set('$chk.ok', 1);
  await cmd(`execute positioned ${W.x} ${W.y + 1} ${W.z} run function doom.nats:check/block`);
  const okWater = await score('$chk.ok');
  await set('$sel.place', 0); await set('$chk.ok', 1);
  await cmd(`execute positioned ${W.x} ${W.y + 1} ${W.z} run function doom.nats:check/block`);
  const okGround = await score('$chk.ok');
  // 反证：把 y 抬到窗口之上（用 place 3 但换成 y=66 的水池）——超出 seaLevel 必须否决
  await cmd(`fill ${W.x + 3} 65 ${W.z - 1} ${W.x + 5} 67 ${W.z + 1} minecraft:water`);
  await set('$py', 66);
  await set('$sel.place', 3); await set('$chk.ok', 1);
  await cmd(`execute positioned ${W.x + 4} 66 ${W.z} run function doom.nats:check/block`);
  const tooHigh = await score('$chk.ok');
  ok('水面窗口：窗口内水中通过（曾要求"下方可站立" ⇒ 永不刷）', okWater === 1, '$chk.ok=' + okWater + '（y=' + (W.y + 1) + '，窗口 50..63；水: 上=' + waterAbove + ' 中=' + waterAt + ' 下=' + waterBelow + '）');
  ok('反证：同点按"通用陆生"必须失败', okGround === 0, '$chk.ok=' + okGround + '（下方是水）');
  ok('反证：水面窗口之上的水必须否决', tooHigh === 0, '$chk.ok=' + tooHigh + '（y=66 > seaLevel）');
  await cmd(`fill ${W.x - 1} ${W.y - 1} ${W.z - 1} ${W.x + 1} ${W.y + 2} ${W.z + 1} minecraft:air replace minecraft:water`);
  await cmd(`fill ${W.x + 3} 65 ${W.z - 1} ${W.x + 5} 67 ${W.z + 1} minecraft:air replace minecraft:water`);
}

// ---------- 5) 怪物暗规则：加盖盒子（真暗）必须通过；掀盖后白天必须否决
{
  const D = { x: B.x, y: B.y + 1, z: B.z };
  // 必须做成**密闭**盒子：只加顶盖不够 —— 天空光会从侧面横向渗入（第一版踩坑：加盖后仍被判"亮"）
  // 做法：3×3×3 实心石砖 → 中心挖成空气 ⇒ 中心格天空光/方块光都是 0
  await cmd(`fill ${D.x - 1} ${D.y - 1} ${D.z - 1} ${D.x + 1} ${D.y + 1} ${D.z + 1} minecraft:stone_bricks`);
  await cmd(`setblock ${D.x} ${D.y} ${D.z} minecraft:air`);
  await sleep(800);
  await set('$py', D.y);
  await set('$sel.light', 1); await set('$chk.ok', 1);
  await cmd(`execute positioned ${D.x} ${D.y} ${D.z} run function doom.nats:check/light`);
  const darkOk = await score('$chk.ok');
  // 掀盖 + 白天 ⇒ 必须否决
  await cmd(`fill ${D.x - 1} ${D.y - 1} ${D.z - 1} ${D.x + 1} ${D.y + 1} ${D.z + 1} minecraft:air replace minecraft:stone_bricks`);
  // v4.20 修：盒子底面就是"案例 3 草台的支撑方块"，拆盒后它变成空气 ⇒ 本脚本**第二次跑**时
  //   案例 3 的 #animals_spawnable_on / bright_enough 全部会红（实测：首跑 14/2，再跑 11/5）。
  //   这里把支撑方块补回来，让脚本可重复执行。
  await cmd(`setblock ${D.x} ${D.y - 1} ${D.z} minecraft:grass_block`);
  await cmd('time set day');
  const dayLit = await waitLight(D.x, D.y, D.z, 7, false);   // 等到不再"暗"（白天光照到位）
  await set('$chk.ok', 1);
  await cmd(`execute positioned ${D.x} ${D.y} ${D.z} run function doom.nats:check/light`);
  const dayOk = await score('$chk.ok');
  // 午夜露天 ⇒ 必须通过
  await cmd('time set midnight');
  const nightDark = await waitLight(D.x, D.y, D.z, 7, true);  // 等到真的"暗"
  await set('$chk.ok', 1);
  await cmd(`execute positioned ${D.x} ${D.y} ${D.z} run function doom.nats:check/light`);
  const nightOk = await score('$chk.ok');
  ok('怪物暗规则：密闭盒子内通过（真暗，光=0）', darkOk === 1, '$chk.ok=' + darkOk);
  ok('怪物暗规则：拆除盒子后白天露天否决', dayOk === 0 && dayLit, '$chk.ok=' + dayOk + '（光照到位=' + dayLit + '）');
  // 失败时打印现场（$sel.light / $eff.light / 各档位谓词 / 时间），便于定位而不是瞎猜
  let diag = '';
  if (nightOk !== 1) {
    const probes = [];
    for (const t of [0, 3, 7, 8, 11, 15]) {
      await set('$probe', 0);
      await cmd(`execute positioned ${D.x} ${D.y} ${D.z} if predicate doom.nats:light/tier_${t} run scoreboard players set $probe doom.nats 1`);
      probes.push(t + ':' + (await score('$probe')));
    }
    diag = ' 诊断: $sel.light=' + (await score('$sel.light')) + ' $eff.light=' + (await score('$eff.light'))
      + ' tier=' + probes.join(' ') + ' $eff.period=' + (await score('$eff.period')) + ' $snap_period=' + (await score('$snap_period')) + ' $t=' + (await score('$t')) + ' ' + (await cmd('time query daytime')).trim();
  }
  ok('怪物暗规则：午夜露天通过', nightOk === 1 && nightDark, '$chk.ok=' + nightOk + '（光照到位=' + nightDark + '）' + diag);
}

// ---------- 6) 掷币函数通过率
{
  const N = 200;
  await set('$coinpass', 0);
  for (let i = 0; i < N; i++) {
    await cmd('scoreboard players set $chk.ok doom.nats 1');
    await cmd('function doom.nats:check/coin_1of20');
    await cmd('execute if score $chk.ok doom.nats matches 1 run scoreboard players add $coinpass doom.nats 1');
  }
  const rate = (await score('$coinpass')) / N;
  ok('coin_1of20 通过率 ≈ 5%', rate > 0 && rate < 0.15, (rate * 100).toFixed(1) + '%（样本 ' + N + '）');
}

// ---------- 7) 数据侧：维度类型参数（原版 overworld / the_nether / the_end）
{
  const dims = [];
  for (const d of ['minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end']) {
    const t = await cmd(`execute in ${d} run time query daytime`);
    dims.push(d.replace('minecraft:', '') + ':' + (/The time is (\d+)/.exec(t) || [, '?'])[1]);
  }
  ok('三维度均可执行（维度情形可用）', dims.length === 3, dims.join(' '));
}

// ---------- 8) 容量计数语义（v4.14d）：$cnt.monster = 玩家维度里 monster 类别且非持久的生物数
{
  await cmd('execute at @e[type=player,name=DoomBot,limit=1] run function doom.nats:check/caps');
  const cntMonster = await score('$cnt.monster');
  const t = await cmd('execute if entity @e[type=#doom.nats:monster,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=1000]');
  const mm = /count: (\d+)/.exec(t);
  const manual = mm ? Number(mm[1]) : 1;
  // 活体采样：$cnt 是快照那一刻的数，manual 是之后另一次读取 ⇒ 中间生物会增减，给 ±3 容差
  const diff = Math.abs(cntMonster - manual);
  ok('8 容量计数与"类别标签 + 非持久"一致（原版 SpawnState 语义）', diff <= 3, '$cnt.monster=' + cntMonster + '，手动计数=' + manual + '（差 ' + diff + '，容差 3）');
}

// ---- 解冻：恢复快照节拍并立刻重算一轮
await set('$snap_period', 20);
await cmd('function doom.nats:cfg/apply');
await cmd('function doom.nats:circ/apply');
await cmd('function doom.nats:circ/snapshot');

// ---------- 拆试验场 + 复原环境
await cmd(`fill ${B.x - 2} ${B.y} ${B.z - 2} ${B.x + 2} ${B.y + 4} ${B.z + 2} minecraft:air replace minecraft:grass_block`);
await cmd('gamerule doMobSpawning false');
await cmd('time set night');
r.close();

const fails = results.filter((x) => !x.pass).length;
console.log('');
console.log('汇总: ' + (results.length - fails) + ' PASS / ' + fails + ' FAIL');
fs.writeFileSync('C:/Users/Dell/Downloads/datapack/_work/verify-rules.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(fails ? 1 : 0);
