import { R, W } from './_root.mjs';   // 可移植路径解析（见 tests/README.md）
// _work/verify_group.mjs —— 真机验证 v4.15「finalizeSpawn 组数据层」（SpawnGroupData 复刻）
//
//   node _work/verify_group.mjs
//
// 前提：本地测试服在跑（RCON 127.0.0.1:25575），且已装载本仓 v4 包。
//
// 断言（每条都对应一个源码事实，见 docs/19）：
//   T1 grp/init/<slug> 派发可用；僵尸组婴儿率 = Zombie.getSpawnAsBabyOdds = 5%
//   T2 僵尸组"整组同一个婴儿决定"：$grp.baby=1 ⇒ 全幼年；=0 ⇒ 全成年（哪怕 finalizeSpawn 单只掷过 5%）
//   T3 AgeableMobGroupData：首只恒成年；成员 2+ 按 chance（牛 0.05 / 北极熊 1.0）掷幼年
//   T4 Fox/Axolotl：groupSize>=2 ⇒ 成员 3+ 恒幼年
//   T5 狼：组内共享变体（首只决定，其余沿用）
//   T6 蜘蛛：HARD ∧ rand<0.1*special ⇒ 整组共享效果（默认 special=100% ⇒ 10%）
//   T7 朝向随机（vanilla snapTo(..., random*360, 0)）
//   T8 spawn/emit（execute summon + post/$(slug) 宏派发）真的能生成，且标签/持久化开关生效
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
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
const str = async (c) => { try { return await cmd(c); } catch (e) { return 'ERR ' + e.message; } };

// ---- 测试卫生（v2）：每个用例只数**自己打的探针标签**，不数全类型 ----
// 原因：场上有别的玩家/后台自然生成时，@e[type=fox] 之类的全量计数会被野生成体与其它脚本的残留污染
// ⇒ 门内 3/11、单跑 13/1 这种随环境翻转的假 FAIL。
const DIMS = ['minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end'];
const TI = (tag, extra = '') => '@e[tag=' + tag + extra + ']';
/** 清掉自己的探针实体：跨三个维度都杀一遍（执行维度不一定是它们所在的维度） */
const wipe = async (tag) => { for (const d of DIMS) await cmd('execute in ' + d + ' run kill ' + TI(tag)); };
/** 幼年计数：Age 是逐 tick 自增的（-24000 → -23999…），用 nbt={Age:-24000} 精确匹配会随 tick 漂移 ⇒ 改判 Age<0 */
const OBJ = 'pvtmp';
let objReady = false;
const babies = async (tag) => {
  if (!objReady) { await str('scoreboard objectives add ' + OBJ + ' dummy'); objReady = true; }
  await str(`scoreboard players reset ${TI(tag)} ${OBJ}`);
  await cmd(`execute as ${TI(tag)} store result score @s ${OBJ} run data get entity @s Age`);
  return cnt(TI(tag, `,scores={${OBJ}=..-1}`));
};

console.log('=== v4.15 组数据层（SpawnGroupData 复刻）· 真机验证 ===');
const listOut = await str('list');
console.log('服务器:', listOut.split('\n')[0]);
if (!/There are/.test(listOut)) { console.log('❌ 服务器不可用（RCON 不通）'); process.exit(1); }

// 测试用地：玩家脚下（超平坦/正常地形都可站）
// 需要"真人在场"：没有就直接起一个 mineflayer 机器人（脚本自洽，结束时关掉）
let botChild = null;
const players = async () => {
  const t = await str('list');
  const m = /There are (\d+)/.exec(t);
  return m ? Number(m[1]) : 0;
};
if ((await players()) === 0) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const botPath = path.join(here, 'mcserver', 'bot.mjs');
  console.log('场上没有玩家 ⇒ 自起机器人:', botPath);
  botChild = spawn(process.execPath, [botPath, '--minutes', '8'], { cwd: path.dirname(botPath), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { if ((await players()) > 0) break; await sleep(1000); }
  console.log('玩家数:', await players());
  await sleep(1500);
}
let posOut = await str('data get entity @e[type=player,name=DoomBot,limit=1] Pos');
let pm = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(posOut);
for (let i = 0; i < 20 && !pm; i++) { await sleep(1000); posOut = await str('data get entity @e[type=player,name=DoomBot,limit=1] Pos'); pm = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(posOut); }
if (!pm) { console.log('❌ 取不到玩家坐标：' + posOut); botChild?.kill(); process.exit(1); }
const P = { x: Math.floor(+pm[1]), y: Math.floor(+pm[2]), z: Math.floor(+pm[3]) };
const AT = `execute positioned ${P.x} ${P.y} ${P.z}`;
console.log('测试位置', JSON.stringify(P));

// ---- 用例前清场（跨维度）+ 容量回读 ----
// ① 上一轮崩溃/中断可能留下带探针标签的实体 ⇒ 先按标签清一遍（跨三个维度），否则计数被污染；
// ② 容量顶格时"能生成"类用例会假红 ⇒ 回读 $cnt/$cap，必要时 debug/clear 再回读。
const PROBE_TAGS = ['pv.t2', 'pv.t3', 'pv.t3c', 'pv.t4', 'pv.t5', 'pv.t5b', 'pv.t6', 'pv.t7', 'pv.t8'];
for (const t of PROBE_TAGS) await wipe(t);
const capOf = async () => ({ cnt: await score('$cnt.monster'), cap: await score('$cap.monster') });
let cap0 = await capOf();
let capNote = `容量 ${cap0.cnt}/${cap0.cap}` + (cap0.cap === 0 ? '（上限未刷新：快照节拍被冻 ⇒ 仅供参考）' : '');
if (Number.isFinite(cap0.cnt) && Number.isFinite(cap0.cap) && cap0.cap > 0 && cap0.cnt >= cap0.cap) {
  await cmd('function doom.nats:debug/clear');
  await sleep(1300);
  const cap1 = await capOf();
  capNote += ` ⇒ debug/clear ⇒ ${cap1.cnt}/${cap1.cap}`;
  cap0 = cap1;
}

// ---- 冻结刷怪（不影响被测函数，只防止后台生成干扰计数）----
// 设完必须**回读确认**：改 $snap_period 的那一拍 $snap_phase 是按旧周期算的，可能刚好为 0 ⇒ 立刻跑一次快照，
// 快照里的 circ/apply 又把 $eff.period 写回 cfg 值 ⇒ 冻结失效、后台生成继续干扰计数（本轮实测踩到过）。
await cmd('time set midnight');
await cmd('gamerule doDaylightCycle false');
const freezeTick = async () => { await set('$snap_period', 20000); await set('$eff.period', 100000); };
let eff = 0;
for (let i = 0; i < 4; i++) { await freezeTick(); await sleep(700); eff = await score('$eff.period'); if (eff >= 1000) break; }
const snapNow = await score('$snap_period');
console.log('刷怪冻结回读: $snap_period =', snapNow, '· $eff.period =', eff, eff >= 1000 ? '✅ 已冻结' : '⚠ 未生效（后台生成可能干扰计数）');
ok('T0 刷怪冻结回读确认（$eff.period≥1000，防止后台生成干扰计数）', eff >= 1000, `$snap_period=${snapNow}，$eff.period=${eff} · ${capNote}`);

// 逐键写入：data modify storage <id> <path> set value … 必须带 path（缺 path 会被 Brigadier 拒）
// 同时补 rot=0：post/<slug> 是宏函数，$(rot) 必须在**实例化前**就位（直调时由测试自己给；走 spawn/emit 时由 emit 掷随机值）
const SEL = async (obj) => {
  await cmd('data modify storage doom.nats:sel rot set value 0');
  for (const [k, v] of Object.entries(obj)) await cmd('data modify storage doom.nats:sel ' + k + ' set value ' + JSON.stringify(v));
};
const n0 = () => {};

// ---------------------------------------------------------------- T1 僵尸组婴儿率 5%
{
  await SEL({ slug: 'zombie' });
  const N = 2000;
  let babies = 0;
  for (let i = 0; i < N; i++) {
    await cmd('function doom.nats:grp/init with storage doom.nats:sel');
    if ((await score('$grp.baby')) === 1) babies++;
  }
  const p = babies / N;
  ok('T1 僵尸组婴儿率 ≈ 5%（ZombieGroupData/Zombie.getSpawnAsBabyOdds）', Math.abs(p - 0.05) < 0.015, `${babies}/${N} = ${(p * 100).toFixed(2)}%（期望 5%±1.5%）`);
  ok('T1b grp/init 也把 $grp.mem 归零', (await score('$grp.mem')) === 0, '$grp.mem = ' + (await score('$grp.mem')));
}

// ---------------------------------------------------------------- T2 僵尸组"整组同一决定"
{
  const TAG = 'pv.t2';
  const NBT = { Tags: ['doom.nats.spawned', 'doom.nats.cat.monster', TAG] };
  const spawnN = async (n) => {
    await SEL({ slug: 'zombie', nbt: NBT });
    for (let i = 0; i < n; i++) await cmd(`${AT} run execute summon minecraft:zombie run function doom.nats:post/zombie with storage doom.nats:sel`);
  };
  await wipe(TAG);
  await set('$grp.baby', 1); await set('$grp.mem', 0);
  await spawnN(5);
  const b1 = await cnt(TI(TAG, ',nbt={IsBaby:1b}'));
  const t1 = await cnt(TI(TAG));
  ok('T2 婴儿组：整组 5 只全幼年', b1 === 5 && t1 === 5, `IsBaby=${b1}/总数=${t1}`);

  await wipe(TAG);
  await set('$grp.baby', 0); await set('$grp.mem', 0);
  await spawnN(8);
  const b0 = await cnt(TI(TAG, ',nbt={IsBaby:1b}'));
  const t0 = await cnt(TI(TAG));
  ok('T2b 成年组：8 只无一只幼年（清掉 finalizeSpawn 的单只 5%）', b0 === 0 && t0 === 8, `IsBaby=${b0}/总数=${t0}`);
}

// ---------------------------------------------------------------- T3 AgeableMobGroupData
{
  const TAG = 'pv.t3';
  const NBT = { Tags: ['doom.nats.spawned', 'doom.nats.cat.creature', TAG] };
  const spawn = async (slug, type) => cmd(`${AT} run execute summon ${type} run function doom.nats:post/${slug} with storage doom.nats:sel`);

  await wipe(TAG);
  await SEL({ slug: 'cow', nbt: NBT });
  await set('$grp.mem', 0);
  await spawn('cow', 'minecraft:cow');
  const first = await babies(TAG);
  const firstAll = await cnt(TI(TAG));
  ok('T3 首只恒成年（AgeableMobGroupData: groupSize>0 才掷）', first === 0 && firstAll === 1, `IsBaby=${first}/总数=${firstAll}`);

  const N = 400;
  let babies2 = 0, read2 = 0;
  // 每轮先清场：400 只牛挤在同一点会触发原版挤伤（maxEntityCramming=24）死于拥挤，计数会失真
  // v4.22l：**只把"读到了 Age 的样本"计入分母** —— 生成物被丢弃/被挤死/索引不到时，
  //   旧写法把它们当成"非幼年"，会把 5% 的比率压低（实测 5/401 = 1.25% ⇒ 3.4σ 的假红）。
  for (let i = 0; i < N; i++) {
    await cmd('kill ' + TI(TAG));       // 同维度清场（本用例的生成物都在执行维度 = 主世界）
    await set('$grp.mem', 1);          // 模拟"成员 2"
    await spawn('cow', 'minecraft:cow');
    const age = await str(`data get entity ${TI(TAG, ',limit=1,sort=nearest')} Age`);
    const m = /entity data: (-?\d+)/.exec(age);
    if (m) { read2++; if (Number(m[1]) < 0) babies2++; }
  }
  const p = babies2 / Math.max(read2, 1);
  ok('T3b 成员 2+ 婴儿率 ≈ 5%（牛）', Math.abs(p - 0.05) < 0.03 && read2 >= 0.8 * N,
    `${babies2}/${read2} = ${(p * 100).toFixed(2)}%（读到 Age 的样本 ${read2}/${N}）`);

  const TAG2 = 'pv.t3c';
  await wipe(TAG2);
  await SEL({ slug: 'polar_bear', nbt: { Tags: ['doom.nats.spawned', 'doom.nats.cat.creature', TAG2] } });
  for (let i = 0; i < 4; i++) { await set('$grp.mem', 1); await spawn('polar_bear', 'minecraft:polar_bear'); }
  const pb = await babies(TAG2);
  ok('T3c 北极熊 chance=1.0 ⇒ 成员 2+ 恒幼年', pb === 4, `幼年=${pb}/4`);
}

// ---------------------------------------------------------------- T4 Fox / Axolotl：成员 3+
{
  const TAG = 'pv.t4';
  await wipe(TAG);
  await SEL({ slug: 'fox', nbt: { Tags: ['doom.nats.spawned', 'doom.nats.cat.creature', TAG] } });
  await cmd('function doom.nats:grp/init with storage doom.nats:sel');   // 组内共享变体 $(v) 由此写入 grp 存储
  // 不依赖"首次自增"路径：每个成员显式设 $grp.mem，并回读确认（后台快照/别的脚本可能重置它）
  const spawnFox = async (mem) => { await set('$grp.mem', mem); await cmd(`${AT} run execute summon minecraft:fox run function doom.nats:post/fox with storage doom.nats:sel`); return await score('$grp.mem'); };
  let memBack = [];
  for (let i = 0; i < 3; i++) memBack.push(await spawnFox(1));
  const f1 = await babies(TAG);
  const f1t = await cnt(TI(TAG));
  for (let i = 0; i < 3; i++) memBack.push(await spawnFox(2));
  const f2 = await babies(TAG) - f1;
  const f2t = await cnt(TI(TAG));
  ok('T4 狐：成员 2 不幼年、成员 3+ 恒幼年（groupSize>=2）', f1 === 0 && f2 === 3 && f1t === 3 && f2t === 6,
    `mem=1: 幼年=${f1}/${f1t}；mem=2: 幼年=${f2}/${f2t - f1t}；post 后 $grp.mem 回读=${memBack.join(',')}（期望 2,2,2,3,3,3）`);
}

// ---------------------------------------------------------------- T5 狼：组内共享变体
{
  const TAG = 'pv.t5';
  const IDS = ['pale', 'woods', 'snowy', 'ashen', 'black', 'chestnut', 'rusty', 'spotted', 'striped'];
  await wipe(TAG);
  await SEL({ slug: 'wolf', nbt: { Tags: ['doom.nats.spawned', 'doom.nats.cat.creature', TAG] } });
  await cmd('function doom.nats:grp/init with storage doom.nats:sel');
  // 强化：把组变体显式改成 snowy（测试点群系并不满足 snowy 条件）⇒ 若 4 只都是 snowy，只能是组共享生效
  await cmd('data modify storage doom.nats:grp v set value "snowy"');
  // v4.17：post/<slug> 会在「首只真正生成」时掷骰（$grp.vneed=1 ⇒ 覆盖显式值）。本用例考的是"沿用已有组变体"，
  //   所以显式清掉"欠一次"标记 ⇒ 首只不再掷骰，组变体完全由上面这行决定。
  await set('$grp.vneed', 0);
  const v = await str('data get storage doom.nats:grp v');
  for (let i = 0; i < 4; i++) await cmd(`${AT} run execute summon minecraft:wolf run function doom.nats:post/wolf with storage doom.nats:sel`);
  const per = {};
  for (const id of IDS) per[id] = await cnt(TI(TAG, `,nbt={variant:"minecraft:${id}"}`));
  const total = await cnt(TI(TAG));
  const max = Math.max(...Object.values(per));
  ok('T5 狼：4 只同组全部同变体', total === 4 && max === 4, `总数=${total}，各变体计数=${JSON.stringify(per)}，组变体=${v.split('value:')[1] || v}`);
}

// ---------------------------------------------------------------- T5b 首只**位置**决定组变体（v4.17 · P0-3）
// 源码依据：NaturalSpawner.spawnCategoryForPosition
//   :186 `$$17 = $$26.finalizeSpawn(level, level.getCurrentDifficultyAt($$26.blockPosition()), NATURAL, $$17)`
//   该行在 :254 `isValidPositionForMob($$1, $$26, $$24)` 通过之后 ⇒ 组数据由**首只真正生成成功**的个体创建，
//   掷骰用的位置/群系是那只个体的 blockPosition（不是"本组首个抽中物种的候选点"）。
// 做法：用 /fillbiome 造两个群系区——A=forest（狼的 8 条群系条件里森林唯一对应 woods）、B=plains（不在条件里 ⇒ pale）：
//   ① init 在 B 区（若 init 掷骰 ⇒ 只能是 pale），首只生成在 A 区 ⇒ 断言必为 woods（只有"首只位置"能解释）；
//   ② 其余 3 只生成在 B 区 ⇒ 仍全为 woods（B 区单独掷骰不可能出 woods）⇒ 首只位置决定 + 组内共享一次；
//   ③ 反向对照：init 在 A 区、首只在 B 区 ⇒ 必为 pale，再来一只生在 A 区也不改成 woods。
{
  const TAG = 'pv.t5b';
  const IDS = ['pale', 'woods', 'snowy', 'ashen', 'black', 'chestnut', 'rusty', 'spotted', 'striped'];
  await wipe(TAG);
  // ⚠ 教训（本轮踩到）：**不要用脚本开头抓的绝对坐标 P**。测试中途玩家会被生成物推动几十格，
  //   绝对坐标随即落到未加载区块：`execute summon` 仍会实例化实体并跑 post/<slug>（$grp.mem 照样自增），
  //   但 tryAddFreshEntityWithPassengers 因区块未加载而丢弃它 ⇒ 选择器查不到、"总数=0"。
  //   这里全部改用**相对玩家**的坐标（execute at @e[type=player] run …），并用实体标签计数（不依赖盒子）。
  // v4.18 根因修（T5b-0 假红）：原来 fillbiome 与校验都用 `~`（相对玩家当前坐标）——
  //   而本文件自己的注释就警告过「玩家会被生成物推动几十格」⇒ 校验点漂出填充区 ⇒ 读到 false（A 却常过，看运气）。
  //   这里改成：先取一次 DoomBot 的**绝对坐标**，fillbiome 与后续校验都用同一个绝对点。
  const _bp = await str('data get entity @e[type=player,name=DoomBot,limit=1] Pos');
  const _bm = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(_bp) || [0, -600, 66, -280];
  const BX = Math.floor(+_bm[1]), BY = Math.floor(+_bm[2]), BZ = Math.floor(+_bm[3]);
  const ATP = 'execute at @e[type=player,name=DoomBot,limit=1] run ';
  // ⚠ v4.21（T5b 假红根因）：`forceload add` 的两个参数是**区块坐标**，而且一次最多 256 区块。
  //   旧写法 `forceload add ~-16 ~-16 ~16 ~16` = 33×33 = 1089 区块 ⇒ **命令直接失败**（Too many chunks）
  //   ⇒ 区块没被强加载 ⇒ `if biome` 对未加载区块返回**空串**（不是 Test failed）⇒ T5b-0/T5b-4 偶发假红。
  //   改成机器人所在区块 ±2 = 5×5 = 25 ✔，收尾 remove。
  const bcx = Math.floor(BX / 16), bcz = Math.floor(BZ / 16);
  await cmd(`forceload add ${bcx - 2} ${bcz - 2} ${bcx + 2} ${bcz + 2}`);
  await sleep(1200);
  // ⚠ v4.21b：**先记录原群系，再 fillbiome**（旧顺序是先填后记 ⇒ 记下来的是"填过的"值，收尾"还原"等于没还原）。
  const IDX = JSON.parse(fs.readFileSync(R('v4/doom.nats/data/doom.nats/biome-index.json'), 'utf8')).map;
  const origBiome = async (rx, rz) => { await cmd(ATP + `execute positioned ~${rx} ~ ~${rz} run function doom.nats:biome/detect_at`); return IDX[String(await score('$sel.biome'))]; };
  const origA = await origBiome(10, 10);
  const origB = await origBiome(-11, -11);
  ok('T5b-0b 记录两个测试区的原群系（fillbiome 之前；收尾还原用）', !!origA && !!origB, `A=${origA} / B=${origB}`);
  await cmd(`fillbiome ${BX + 8} ${BY - 2} ${BZ + 8} ${BX + 13} ${BY + 6} ${BZ + 13} minecraft:forest`);
  await cmd(`fillbiome ${BX - 13} ${BY - 2} ${BZ - 13} ${BX - 8} ${BY + 6} ${BZ - 8} minecraft:plains`);
  await sleep(800);
  // ⚠ v4.21c：校验点取**填充区内部**（+10/-11），不要取边界角（+8/-13）：
  //   实测 `fillbiome` 的最小角那一格（坐标恰为 4 的倍数处）读出来仍是旧群系
  //   （-232,71,-584 → 非 forest；-231,71,-583 → forest），即"填了但最小值边界读不到"
  //   —— 与包无关的 /fillbiome 边界行为。记录原群系与校验都用同一批内部点。
  const inA = await str(`execute positioned ${BX + 10} ${BY} ${BZ + 10} run execute if biome ~ ~ ~ minecraft:forest`);
  const inB = await str(`execute positioned ${BX - 11} ${BY} ${BZ - 11} run execute if biome ~ ~ ~ minecraft:plains`);
  ok('T5b-0 /fillbiome 两个群系区生效（A=forest / B=plains）',
    /Test passed/.test(inA) && /Test passed/.test(inB), `A:${inA.trim().slice(0, 46) || '(空=区块没加载)'} | B:${inB.trim().slice(0, 46) || '(空=区块没加载)'}`);

  const spawnWolf = async (rx, rz) => cmd(ATP + `execute positioned ~${rx} ~ ~${rz} run execute summon minecraft:wolf run function doom.nats:post/wolf with storage doom.nats:sel`);
  const initAt = async (rx, rz) => cmd(ATP + `execute positioned ~${rx} ~ ~${rz} run function doom.nats:grp/init with storage doom.nats:sel`);
  const perOf = async () => {
    const o = {};
    for (const id of IDS) o[id] = await cnt(`@e[tag=${TAG},nbt={variant:"minecraft:${id}"}]`);
    o.total = await cnt(`@e[tag=${TAG}]`);
    return o;
  };
  await SEL({ slug: 'wolf', nbt: { Tags: ['doom.nats.spawned', 'doom.nats.cat.creature', TAG] } });
  await cmd('data remove storage doom.nats:grp v');
  await initAt(-11, -11);                                  // init 在**平原区**（若 init 掷骰 ⇒ 只能 pale）
  const vGone = await str('data get storage doom.nats:grp v');
  const vneed1 = await score('$grp.vneed');
  ok('T5b-1 grp/init（在平原区）不再掷变体：v 不存在且 $grp.vneed=1',
    !/value:/.test(vGone) && vneed1 === 1, `data get 回读="${vGone.trim().slice(0, 60)}"，$grp.vneed=${vneed1}`);
  await spawnWolf(10, 10);                                 // 首只：森林区 ⇒ 只有"首只位置"能给 woods
  const firstPer = await perOf();
  for (let i = 0; i < 3; i++) await spawnWolf(-11 + i, -11);   // 其余 3 只：平原区（$grp.mem 由 grp/mem 自增）
  const per = await perOf();
  ok('T5b-2 首只在森林区 ⇒ 组变体 woods，其余（平原区）沿用 ⇒ 4/4 woods',
    firstPer.woods === 1 && per.woods === 4 && per.total === 4,
    `首只：${JSON.stringify(firstPer)}；全组：${JSON.stringify(per)}（判定：woods=4 而平原区不可能掷出 woods）`);

  // ③ 反向对照
  await wipe(TAG);
  await cmd('data remove storage doom.nats:grp v');
  await initAt(10, 10);                                    // init 在森林区
  await spawnWolf(-11, -9);                                // 首只：平原区 ⇒ 只能 pale
  await spawnWolf(10, 8);                                  // 第二只：森林区 ⇒ 不得改成 woods（沿用首只）
  const per2 = await perOf();
  ok('T5b-3 反向对照：首只在平原区 ⇒ 组变体 pale，森林区那只也沿用 ⇒ 2/2 pale', per2.pale === 2 && per2.total === 2,
    `全组：${JSON.stringify(per2)}（判定：森林区那只若各自掷骰 ⇒ woods）`);
  // ⑤ 反证（证明这条断言真的能区分新旧语义）：把掷骰放回"init 位置"（平原区）——这正是 v4.16 的行为——
  //    再在森林区生成首只 ⇒ 得到的只能是 pale。⇒ 旧实现下 T5b-2 必红（期望 woods 却得 pale）。
  await wipe(TAG);
  await cmd('data remove storage doom.nats:grp v');
  await set('$grp.mem', 0);
  await set('$grp.vneed', 1);
  await cmd(ATP + 'execute positioned ~-11 ~ ~-11 run function doom.nats:grp/var/wolf');   // = 旧实现的 init 掷骰
  await spawnWolf(10, 10);
  const per3 = await perOf();
  ok('T5b-5 反证：掷骰若放在 init 位置（平原）⇒ 首只生在森林区也只有 pale（旧语义下 T5b-2 必红）',
    per3.pale === 1 && per3.woods === 0, `${JSON.stringify(per3)}`);
  // 还原群系
  if (origA) await cmd(ATP + `fillbiome ~8 ~-2 ~8 ~13 ~6 ~13 ${origA}`);
  if (origB) await cmd(ATP + `fillbiome ~-13 ~-2 ~-13 ~-8 ~6 ~-8 ${origB}`);
  await sleep(600);
  const backA = await str(ATP + `execute positioned ~10 ~ ~10 run execute if biome ~ ~ ~ ${origA}`);
  const backB = await str(ATP + `execute positioned ~-11 ~ ~-11 run execute if biome ~ ~ ~ ${origB}`);
  ok('T5b-4 群系已还原', /Test passed/.test(backA) && /Test passed/.test(backB),
    `${origA}: ${backA.trim().slice(0, 30) || '(空=区块没加载)'} · ${origB}: ${backB.trim().slice(0, 30) || '(空=区块没加载)'}`);
  await cmd(`forceload remove ${bcx - 2} ${bcz - 2} ${bcx + 2} ${bcz + 2}`);
}

// ---------------------------------------------------------------- T6 蜘蛛：困难难度共享效果
{
  // v4.22l：这套"比率断言"必须先把配置写进**权威来源**（storage doom.nats:config）——
  //   `circ/apply` 每拍会把 `$cfg.*` 从 storage 重新派生 ⇒ 直接 `set` 的分数会被抹回旧值；
  //   实测同一份包在门里读出过 0.7% / 11.3% / 39.4% 三种互相矛盾的比率（都源于"测到一半 cfg 被换掉"）。
  //   这里同时写 storage + 分数，并在循环里每 100 次补一次分数；收尾把 storage 的键删掉（不留副作用）。
  await cmd('data merge storage doom.nats:config {difficulty:3,special:100}');
  await set('$cfg.difficulty', 3);
  await set('$cfg.special', 100);
  await set('$cfg.special_x10', 1000);
  await SEL({ slug: 'spider' });
  const N = 1000;
  let fx = 0;
  for (let i = 0; i < N; i++) {
    if (i % 100 === 0) { await set('$cfg.difficulty', 3); await set('$cfg.special_x10', 1000); }
    await cmd('function doom.nats:grp/init with storage doom.nats:sel');
    const has = await cmd('execute if data storage doom.nats:grp fx');
    if (/Test passed/.test(has)) fx++;
  }
  const p = fx / N;
  ok('T6 蜘蛛组效果率 ≈ 10%（HARD ∧ rand<0.1*special，special=100%）', Math.abs(p - 0.1) < 0.035,
    `${fx}/${N} = ${(p * 100).toFixed(2)}% · $cfg.special=${await score('$cfg.special')} special_x10=${await score('$cfg.special_x10')}`);
  await cmd('data remove storage doom.nats:config special');
  await cmd('data remove storage doom.nats:config difficulty');

  // 共享施加：给定 fx，同组两只应当都带该效果
  await cmd('data modify storage doom.nats:grp fx set value "invisibility"');
  const TAG = 'pv.t6';
  await wipe(TAG);
  await SEL({ slug: 'spider', nbt: { Tags: ['doom.nats.spawned', 'doom.nats.cat.monster', TAG] } });
  for (let i = 0; i < 2; i++) await cmd(`${AT} run execute summon minecraft:spider run function doom.nats:post/spider with storage doom.nats:sel`);
  const eff = await str(`data get entity ${TI(TAG, ',limit=1,sort=nearest')} active_effects`);
  const both = await cnt(TI(TAG, ',nbt={active_effects:[{id:"minecraft:invisibility"}]}'));
  ok('T6b 同组共享效果：两只都带 invisibility', /invisibility/.test(eff) && both === 2, `命中 ${both}/2；样本=${eff.replace(/\s+/g, ' ').slice(0, 120)}`);
  await set('$cfg.difficulty', 2);
  await set('$cfg.special', -1);
  await cmd('data remove storage doom.nats:grp fx');
}

// ---------------------------------------------------------------- T7 朝向随机
{
  const TAG = 'pv.t7';
  await SEL({ type: 'minecraft:zombie', slug: 'zombie', cat: 'monster', min: 2, max: 4, nbt: { Tags: ['doom.nats.spawned', 'doom.nats.cat.monster', TAG] }, cluster: 4, grp1: 0, place: 0, light: 1, tag: 0, wide: 0, wide2: 0, tall: 0, ok: 1, rule: 0 });
  await set('$grp.baby', 0);
  // 朝向在 spawn/emit 里掷（宏参数必须在 post 实例化前就位）⇒ 走真实链路。
  // 活性断言允许**一次重试**（先按探针标签清场再重跑）：连跑序列里偶发被环境门挡掉时不该直接判红。
  let total = -1;
  let vals = [];
  let attempts = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    attempts = attempt + 1;
    await wipe(TAG);
    for (let i = 0; i < 24; i++) await cmd(`${AT} run function doom.nats:spawn/emit with storage doom.nats:sel`);
    total = await cnt(TI(TAG));
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      const r = await str(`data get entity ${TI(TAG, ',limit=1,sort=random')} Rotation`);
      const m = /entity data: \[(-?[\d.]+)f/.exec(r);
      if (m) seen.add(m[1]);
    }
    vals = [...seen];
    if (total === 24 && vals.length >= 6) break;
  }
  ok('T7 朝向随机（vanilla snapTo(random*360,0)）', total === 24 && vals.length >= 6,
    `抽样 ${vals.length} 个不同 yaw（期望 ≥6）：${vals.slice(0, 8).join(', ')}${attempts > 1 ? '（重试 ' + attempts + ' 次）' : ''}`);
}

// ---------------------------------------------------------------- T8 真实生成链路（execute summon + post/$(slug) 宏派发）
{
  const TAG = 'pv.t8';
  await SEL({ type: 'minecraft:husk', slug: 'husk', cat: 'monster', min: 2, max: 4, nbt: { Tags: ['doom.nats.spawned', 'doom.nats.cat.monster', TAG] }, cluster: 4, grp1: 0, place: 0, light: 1, tag: 0, wide: 0, wide2: 0, tall: 0, ok: 1, rule: 0 });
  let tagged = 0;
  let cat = 0;
  let attempts = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    attempts = attempt + 1;
    await wipe(TAG);
    await cmd(`${AT} run function doom.nats:spawn/emit with storage doom.nats:sel`);
    tagged = await cnt(TI(TAG, ',tag=doom.nats.spawned'));
    cat = await cnt(TI(TAG, ',tag=doom.nats.cat.monster'));
    if (tagged === 1 && cat === 1) break;
  }
  ok('T8 spawn/emit（宏派发 post/$(slug)）能生成并带上本包标签', tagged === 1 && cat === 1,
    `spawned 标签=${tagged}，cat 标签=${cat}${attempts > 1 ? '（重试 ' + attempts + ' 次）' : ''}`);

  await set('$cfg.persist', 1);
  let pers = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    await wipe(TAG);
    await cmd(`${AT} run function doom.nats:spawn/emit with storage doom.nats:sel`);
    pers = await cnt(TI(TAG, ',nbt={PersistenceRequired:1b}'));
    if (pers === 1) break;
  }
  await set('$cfg.persist', 0);
  ok('T8b $cfg.persist=1 ⇒ 生成物带 PersistenceRequired', pers === 1, `持久化=${pers}/1`);
}

// ---------------------------------------------------------------- 收尾
for (const t of ['pv.t2', 'pv.t3', 'pv.t3c', 'pv.t4', 'pv.t5', 'pv.t5b', 'pv.t6', 'pv.t7', 'pv.t8']) await wipe(t);
// ⚠ v4.20（安全）：原来这里是 `kill @e[type=zombie]` / cow / polar_bear / fox / wolf / spider / husk ——
//   没有任何守卫 ⇒ **真人玩家在线时会把他的宠物、命名生物、驯服的狼、僵尸村民一起杀掉**。
//   改成与其他脚本一致的安全过滤：命名 / 有主 / 持久化 / 拴绳的一律不动（本脚本自己的试验体都不带这些标记）。
for (const t of ['zombie', 'cow', 'polar_bear', 'fox', 'wolf', 'spider', 'husk']) {
  await cmd(`execute as @e[type=${t}] unless data entity @s CustomName unless data entity @s Owner unless data entity @s PersistenceRequired unless data entity @s Leash run kill @s`);
}
await str('scoreboard objectives remove ' + OBJ);   // 拆掉幼年判定用的临时 objective

if (botChild) { try { botChild.kill(); } catch {} console.log('已关闭自起机器人'); }
const pass = results.filter((x) => x.pass).length;
const fail = results.length - pass;
console.log('\n=== 结果: ' + pass + ' PASS / ' + fail + ' FAIL ===');
const rep = ['# v4.15 组数据层真机验证', '', `时间: ${new Date().toISOString()}`, `位置: ${JSON.stringify(P)}`, '', '| 断言 | 结果 | 细节 |', '| --- | --- | --- |',
  ...results.map((x) => `| ${x.name} | ${x.pass ? 'PASS' : 'FAIL'} | ${x.detail.replace(/\|/g, '/')} | `), '', `合计 ${pass} PASS / ${fail} FAIL`].join('\n');
const out = W('doom.nats/reports/验证-组数据层-') + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.md';
try { fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true }); fs.writeFileSync(out, rep); console.log('报告已写入 ' + out); } catch (e) { console.log('报告写入失败: ' + e.message); }
r.close?.();
process.exit(fail ? 1 : 0);
