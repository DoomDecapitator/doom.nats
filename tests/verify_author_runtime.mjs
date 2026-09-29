// _work/verify_author_runtime.mjs —— 运行时刻作者层（v4.24）真机验收
//
//   RCON_PORT=25581 MC_LOG=_work/mcserver-fid/logs/latest.log node _work/verify_author_runtime.mjs [--variant std|exp]
//
// 前置：隔离实例在跑（默认 25581 = _work/mcserver-fid），且已装好对应变体的产物：
//   std ⇒ v4/doom.nats（无 features，原版复刻 + 稳定扩展）
//   exp ⇒ v4x/doom.nats（DOOM_EXP=1，多一层 doom.nats:exp/*：near / on_spawn / preset）
//
// 写法与 v4.23 的 verify_author_rules.mjs 一致：**固定 $rng / $py 的确定性探针**，全部调产物里的真函数
// （mob/biome/**、check/**、author/**、exp/**），不在探针里重算语义。
//
// 踩坑（v4.23 两条 + 本轮三条，都真机验过）：
//   · data get storage 的 SNBT 是 `key: value`（冒号后有空格）⇒ 正则要容错；
//   · weather thunder 是渐变（±0.01/拍）⇒ 谓词要等 ≈6.5s；
//   · **台子必须在已加载区块**（本轮第一版没回读 loaded ⇒ 树叶台其实没加载 ⇒ if block 恒假 ⇒ 假绿）；
//   · **怪物物种在亮台上会被香草光照门拒（reason=3）**，与运行时刻亮度窗口无关 ⇒ 亮度窗口要用
//     "暗台 + lightMin" 反证（只有运行时刻那一层能把它拦下来）；
//   · 运行时刻条目的 biome 是**候选点**的群系（与构建期"表按群系展开"同义）⇒ 测试点必须与条目声明的群系一致。
import fs from 'node:fs';
import { R } from './_root.mjs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const VARIANT = process.argv.includes('--variant') ? process.argv[process.argv.indexOf('--variant') + 1] : 'std';
const EXP = VARIANT === 'exp';
const NS = 'doom.nats';
const AU = NS + ':author';
const EX = NS + ':exp';
const AUS = 'doom.nats:author_rt';
const LOG = process.env.MC_LOG || R('_work/mcserver-fid/logs/latest.log');
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail: String(detail) }); console.log((pass ? '✅ ' : '❌ ') + name + '  ' + detail); };
const skip = (name, why) => { results.push({ name, pass: true, skip: true, detail: why }); console.log('⏭️  ' + name + '  （跳过：' + why + '）'); };

const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const score = async (h) => { const m = /has (-?\d+)/.exec(await cmd(`scoreboard players get ${h} ${NS}`)); return m ? Number(m[1]) : NaN; };
const set = (h, v) => cmd(`scoreboard players set ${h} ${NS} ${v}`);
const selNum = async (k) => { const m = new RegExp(k + ':\\s*(-?\\d+)').exec(await cmd(`data get storage ${NS}:sel`)); return m ? Number(m[1]) : NaN; };
const selStr = async (k) => { const m = new RegExp(k + ':\\s*"([^"]*)"').exec(await cmd(`data get storage ${NS}:sel`)); return m ? m[1] : ''; };

// ---------- 试验场（隔离实例 fid；建在 forceload 覆盖的区块里，建完必须回读）----------
const LEAF = { x: -250, y: 120, z: -600 };     // 树叶台（全黑密室）——"额外落位面"用
const GRASS = { x: -230, y: 120, z: -600 };    // 草方块台（全黑密室）——"应通过"的基准台（可站立 + 暗）
const SPAWN = { x: -210, y: 120, z: -600 };    // 石台（全黑密室）——真生成用
const S = 15;
const center = (P) => `${P.x + 8} ${P.y + 1} ${P.z + 8}`;

async function ensureLoaded() {
  await cmd('forceload add -256 -640 0 -512');
  for (let i = 0; i < 20; i++) {
    const m = (() => { try { return fs.statSync(LOG).size; } catch { return 0; } })();
    await cmd(`execute if loaded ${center(GRASS)} run say RT_LOADED_${i}`);
    await sleep(400);
    const t = (() => { try { return fs.readFileSync(LOG).subarray(m).toString('utf8'); } catch { return ''; } })();
    if (new RegExp('RT_LOADED_' + i).test(t)) return true;
  }
  return false;
}
// 台子回读：data get block 对非方块实体只回 "not a block entity" ⇒ 只能用 if block + say（v4.23 的坑）
async function blockIs(x, y, z, what) {
  const m = (() => { try { return fs.statSync(LOG).size; } catch { return 0; } })();
  await cmd(`execute if block ${x} ${y} ${z} ${what} run say RT_BLK`);
  await sleep(300);
  const t = (() => { try { return fs.readFileSync(LOG).subarray(m).toString('utf8'); } catch { return ''; } })();
  return /RT_BLK/.test(t);
}
async function rig(P, mat) {
  await cmd(`fill ${P.x} ${P.y} ${P.z} ${P.x + S} ${P.y} ${P.z + S} ${mat}`);
  await cmd(`fill ${P.x} ${P.y + 1} ${P.z} ${P.x + S} ${P.y + 4} ${P.z + S} minecraft:air`);
  await cmd(`fill ${P.x} ${P.y + 5} ${P.z} ${P.x + S} ${P.y + 5} ${P.z + S} minecraft:stone`);
  for (const dy of [1, 2, 3, 4]) {
    await cmd(`fill ${P.x} ${P.y + dy} ${P.z} ${P.x + S} ${P.y + dy} ${P.z} minecraft:stone`);
    await cmd(`fill ${P.x} ${P.y + dy} ${P.z + S} ${P.x + S} ${P.y + dy} ${P.z + S} minecraft:stone`);
    await cmd(`fill ${P.x} ${P.y + dy} ${P.z} ${P.x} ${P.y + dy} ${P.z + S} minecraft:stone`);
    await cmd(`fill ${P.x + S} ${P.y + dy} ${P.z} ${P.x + S} ${P.y + dy} ${P.z + S} minecraft:stone`);
  }
}

// ---------- 判定三连（block → light → entity），返回 $chk ----------
async function judge(P, y) {
  await set('$py', y);
  await set('$chk.ok', 1); await set('$chk.reason', 0);
  await cmd(`execute positioned ${center(P)} run function ${NS}:check/sealevel`);
  for (const f of ['block', 'light', 'entity']) {
    await cmd(`execute positioned ${center(P)} run function ${NS}:check/${f}`);
    if ((await score('$chk.ok')) === 0) break;
  }
  return { ok: await score('$chk.ok'), reason: await score('$chk.reason') };
}

// ---------- 固定 $rng 调真分发表（走**生产**链路：表 → author/row / exp/row）----------
async function dispatch(biomeFn, cat, rng, y, pos = GRASS, thunder = null) {
  if (thunder !== null) { await cmd('weather ' + (thunder ? 'thunder' : 'clear')); await sleep(6500); }
  await set('$rng', rng);
  await set('$py', y);
  // storage 不会自己清：断言用的字段先删掉，否则会读到上一次 dispatch 的残留（探针自身纪律）
  await cmd(`data remove storage ${NS}:sel authorId`);
  await cmd(`data remove storage ${NS}:sel slug`);
  await cmd(`data remove storage ${NS}:sel nbt`);
  await cmd(`execute positioned ${center(pos)} run function ${NS}:mob/biome/${biomeFn}/${cat}`);
  return {
    slug: await selStr('slug'), type: await selStr('type'),
    min: await selNum('min'), max: await selNum('max'),
    raw: await cmd(`data get storage ${NS}:sel`),
    authHit: await score('$auth.hit'), authLoaded: await score('$auth.loaded'),
    expHit: EXP ? await score('$exp.hit') : NaN,
  };
}
const wipe = async () => {
  // 入参 storage 也要清：data merge 是递归的，上一轮的嵌套键（如 when.near）会粘到这一轮
  await cmd(`data remove storage ${NS}:author_in entry`);
  await cmd(`data remove storage ${NS}:exp_in entry`);
  await cmd(`data remove storage ${NS}:exp_in name`);
  await cmd(`function ${NS}:author/reset`);
  if (EXP) await cmd(`function ${NS}:exp/reset`);
  await cmd(`kill @e[tag=${NS}.author.rt_royal]`);
  await cmd(`kill @e[tag=${NS}.exp.rt_hook]`);
  await sleep(150);
};

// ================================================================ 开始
console.log('=== v4.24 运行时刻作者层 · 真机验收（variant=' + VARIANT + '）===');
console.log('RCON_PORT=' + (process.env.RCON_PORT || 25575) + ' · 日志 ' + LOG);

// ---------------------------------------------------------------- §0 加载期门
const sizeBefore = (() => { try { return fs.statSync(LOG).size; } catch { return 0; } })();
await cmd('reload');
await sleep(2000);
let tail = '';
try { tail = fs.readFileSync(LOG).subarray(sizeBefore).toString('utf8'); } catch { /* ignore */ }
const badLoad = (tail.match(/Failed to load function/g) || []).length;
ok('§0 加载期门：/reload 0 个 Failed to load function', badLoad === 0, '本轮 ' + badLoad + ' 个');

// 冻结快照节拍（探针独占 $sel/$chk）
await set('$snap_period', 20000); await set('$eff.period', 20000);

// 台子：先确保区块已加载，再建，再回读（v4.22d 纪律：不许静默降级）
  await cmd('gamerule randomTickSpeed 0');   // 树叶台会腐烂（随机刻、周围无原木）⇒ 关掉随机刻，避免台子中途消失
const loaded = await ensureLoaded();
if (!loaded) { console.log('❌ 试验场区块未加载 ⇒ 中止（不许静默降级）'); r.close(); process.exit(1); }
await rig(LEAF, 'minecraft:oak_leaves');
await rig(GRASS, 'minecraft:grass_block');
await rig(SPAWN, 'minecraft:stone');
await sleep(600);
const floorOK = (await blockIs(LEAF.x + 8, LEAF.y, LEAF.z + 8, 'minecraft:oak_leaves'))
  && (await blockIs(GRASS.x + 8, GRASS.y, GRASS.z + 8, 'minecraft:grass_block'))
  && (await blockIs(SPAWN.x + 8, SPAWN.y, SPAWN.z + 8, 'minecraft:stone'));
ok('§0b 试验场就绪（区块已加载 + 台子回读一致）', loaded && floorOK, 'loaded=' + loaded + ' · 回读树叶/草方块=' + floorOK);
if (!floorOK) { console.log('❌ 台子没建起来 ⇒ 中止'); r.close(); process.exit(1); }

// 先取"真表里 zombie 那一条"的规则 id / 落位
await dispatch('deep_ocean', 'monster', 150, 20);
const ZOMBIE = { rule: await score('$sel.rule'), place: await score('$sel.place') };
// 基准：GRASS 暗台 + zombie 应当通过（后续"应过"的断言都以此为基线）
await set('$sel.rule', ZOMBIE.rule); await set('$sel.place', ZOMBIE.place);
const BASE = await judge(GRASS, 20);
ok('§0c 基准台：僵尸在暗草台通过（空层基线）', BASE.ok === 1, `ok=${BASE.ok} reason=${BASE.reason}（期望 1/0）`);

// ---------------------------------------------------------------- §1 空层 = 原版
const emptyChecks = async (label) => {
  const g = [];
  for (const y of [-10, 30, 100]) g.push((await dispatch('deep_ocean', 'monster', 150, y)).max);
  const d4 = g.every((mx) => mx === 4);
  const D = await dispatch('deep_ocean', 'monster', 150, 30);
  await set('$sel.rule', ZOMBIE.rule); await set('$sel.place', ZOMBIE.place);
  const R1 = await judge(LEAF, LEAF.y + 1);
  const E = await dispatch('deep_ocean', 'monster', 600, 40, GRASS, false);
  const noEntry = !E.raw.includes('nats.author.') && !E.raw.includes('rt_royal') && E.authHit === 0;
  ok('§1' + label + ' 空层 = 原版：组大小/落位/条目都不受影响', d4 && R1.ok === 0 && R1.reason === 4 && noEntry,
    `组大小 max=${g.join('/')}（期望 4/4/4） · 树叶 ok=${R1.ok} reason=${R1.reason}（期望 0/4） · 条目 rng=600 ⇒ ${E.slug} hit=${E.authHit}`);
  return { d4, R1, noEntry };
};
await wipe();
await emptyChecks('a');

// ---------------------------------------------------------------- §2 运行时刻：额外落位面（belowAny）
{
  await cmd(`data modify storage ${AU} entityRules."minecraft:zombie".belowAny set value ["#minecraft:leaves"]`);
  await dispatch('deep_ocean', 'monster', 150, LEAF.y + 1, LEAF);
  const R = await judge(LEAF, LEAF.y + 1);
  ok('§2 运行时刻 belowAny：僵尸可站在树叶上（改 storage 即刻生效）', R.ok === 1 && R.reason === 0,
    `belowAny=["#minecraft:leaves"] ⇒ ok=${R.ok} reason=${R.reason}（期望 1/0）`);
}

// ---------------------------------------------------------------- §3 运行时刻：Y 窗口
{
  await cmd(`data modify storage ${AU} entityRules."minecraft:zombie" merge value {yMax:40}`);
  await dispatch('deep_ocean', 'monster', 150, 100);   // 必须先选一次物种：运行时刻补丁在那一刻装载
  const hi = await judge(GRASS, 100);
  await dispatch('deep_ocean', 'monster', 150, 20);
  const lo = await judge(GRASS, 20);
  ok('§3 运行时刻 Y 窗口（yMax=40）：y=100 拒 / y=20 过', hi.ok === 0 && hi.reason === 9 && lo.ok === 1,
    `y=100 ⇒ ok=${hi.ok} reason=${hi.reason}（期望 0/9） · y=20 ⇒ ok=${lo.ok} reason=${lo.reason}（期望 1）`);
}

// ---------------------------------------------------------------- §4 运行时刻：亮度窗口
//   反证设计：暗台上只有"运行时刻 lightMin"能把僵尸拦下来（香草门在暗台是放行的）⇒ 归因无歧义。
{
  await cmd(`data modify storage ${AU} entityRules."minecraft:zombie" merge value {yMax:2147483647,lightMin:8}`);
  await dispatch('deep_ocean', 'monster', 150, 20);
  const needDark = await judge(GRASS, 20);
  await cmd(`data remove storage ${AU} entityRules."minecraft:zombie".lightMin`);
  await cmd(`data modify storage ${AU} entityRules."minecraft:zombie" merge value {lightMax:15}`);
  await dispatch('deep_ocean', 'monster', 150, 20);
  const pass = await judge(GRASS, 20);
  ok('§4 运行时刻亮度窗口：暗台 + lightMin=8 ⇒ 拒（reason=3）/ lightMax=15 ⇒ 过', needDark.ok === 0 && needDark.reason === 3 && pass.ok === 1,
    `lightMin=8 ⇒ ok=${needDark.ok} reason=${needDark.reason}（期望 0/3） · lightMax=15 ⇒ ok=${pass.ok}（期望 1）`);
}

// ---------------------------------------------------------------- §5 运行时刻：天气门
{
  await cmd(`data modify storage ${AU} entityRules."minecraft:zombie" merge value {lightMin:0,weather:"thunder"}`);
  await dispatch('deep_ocean', 'monster', 150, 20, GRASS, true);
  const th = await judge(GRASS, 20);
  await dispatch('deep_ocean', 'monster', 150, 20, GRASS, false);
  const cl = await judge(GRASS, 20);
  ok('§5 运行时刻天气门（weather=thunder）：雷暴过 / 晴拒', th.ok === 1 && cl.ok === 0 && cl.reason === 9,
    `雷暴 ⇒ ok=${th.ok}（期望 1） · 晴 ⇒ ok=${cl.ok} reason=${cl.reason}（期望 0/9）`);
}

// ---------------------------------------------------------------- §6 运行时刻：群系白/黑名单
{
  await cmd(`data modify storage ${AU} entityRules."minecraft:zombie" merge value {weather:"any",biomeNot:[]}`);
  await cmd(`data modify storage ${AU} entityRules."minecraft:zombie".biomeIn set value ["#minecraft:is_overworld"]`);
  await dispatch('deep_ocean', 'monster', 150, 20);
  const wl = await judge(GRASS, 20);
  await cmd(`data remove storage ${AU} entityRules."minecraft:zombie".biomeIn`);
  await cmd(`data modify storage ${AU} entityRules."minecraft:zombie".biomeNot set value ["#minecraft:is_overworld"]`);
  await dispatch('deep_ocean', 'monster', 150, 20);
  const bl = await judge(GRASS, 20);
  ok('§6 运行时刻群系名单：白名单命中过 / 黑名单命中拒', wl.ok === 1 && bl.ok === 0 && bl.reason === 9,
    `biomeIn=[#is_overworld] ⇒ ok=${wl.ok}（期望 1） · biomeNot=[#is_overworld] ⇒ ok=${bl.ok} reason=${bl.reason}（期望 0/9）`);
}

// ---------------------------------------------------------------- §7 运行时刻：组大小随 Y（命令面）
{
  await wipe();
  for (const [yMin, yMax, min, max] of [[-2147483648, 0, 4, 6], [1, 63, 2, 3], [64, 2147483647, 1, 1]]) {
    await cmd(`data merge storage ${NS}:author_in {type:"minecraft:zombie",yMin:${yMin},yMax:${yMax},min:${min},max:${max}}`);
    await cmd(`function ${NS}:author/set_group_by_y with storage ${NS}:author_in`);
  }
  const rows = [];
  for (const [y, want] of [[-10, '4/6'], [30, '2/3'], [100, '1/1']]) {
    const D = await dispatch('deep_ocean', 'monster', 150, y);
    rows.push({ y, got: `${D.min}/${D.max}`, want, slug: D.slug });
  }
  ok('§7 运行时刻 groupByY（命令面 set_group_by_y）：组大小随 Y 段变化',
    rows.every((x) => x.slug === 'zombie' && x.got === x.want), rows.map((x) => `y=${x.y} ${x.got}（期望 ${x.want}）`).join(' · '));
}

// ---------------------------------------------------------------- §8 运行时刻：容量随 Y（命令面）
{
  await wipe();
  await cmd(`data merge storage ${NS}:author_in {category:"monster",yMin:-2147483648,yMax:0,max:1,localMax:999}`);
  await cmd(`function ${NS}:author/set_cap_y with storage ${NS}:author_in`);
  // 冻结快照下引擎容量可能是 0 ⇒ 显式钉成 70（本探针测的是**运行时刻覆盖**，不是引擎容量）
  await cmd(`scoreboard players set $cap.monster ${NS} 70`);
  await cmd(`scoreboard players set $cnt.monster ${NS} 5`);
  await cmd(`scoreboard players set $cnt.monster.nether ${NS} 5`);
  await cmd(`scoreboard players set $cnt.monster.end ${NS} 5`);
  await set('$att.dim', 0);
  await cmd(`data modify storage ${NS}:sel cat set value "monster"`);
  const capAt = async (y) => {
    await set('$py', y); await set('$chk.ok', 1); await set('$chk.reason', 0);
    await cmd(`execute positioned ${center(GRASS)} run function ${NS}:check/cap with storage ${NS}:sel`);
    return { ok: await score('$chk.ok'), reason: await score('$chk.reason') };
  };
  const rej = await capAt(-10);
  const pass = await capAt(30);
  await cmd(`scoreboard players set $cnt.monster ${NS} 0`);
  await cmd(`scoreboard players set $cnt.monster.nether ${NS} 0`);
  await cmd(`scoreboard players set $cnt.monster.end ${NS} 0`);
  ok('§8 运行时刻 capByY（命令面 set_cap_y）：y≤0 段容量 1 ⇒ 存量 5 必满（reason=5）；y=30 段不过问',
    rej.ok === 0 && rej.reason === 5 && pass.ok === 1,
    `y=-10 ⇒ ok=${rej.ok} reason=${rej.reason}（期望 0/5） · y=30 ⇒ ok=${pass.ok} reason=${pass.reason}（期望 1）`);
}

// ---------------------------------------------------------------- §9 运行时刻：条件条目（含自定义 NBT，端到端生成）
{
  await wipe();
  await cmd('data modify storage ' + NS + ':author_in entry set value {id:"rt_royal",mob:"minecraft:zombie",biome:"#minecraft:is_overworld",category:"monster",weight:120,min:1,max:2,' +
    'when:{yMax:62},nbt:"{CustomName:\'{\\"text\\":\\"运行时刻皇家僵尸\\",\\"color\\":\\"gold\\"}\',equipment:{mainhand:{id:\\"minecraft:trident\\",count:1}}}"}');
  await cmd(`function ${NS}:author/add_entry with storage ${NS}:author_in`);
  const T = await dispatch('deep_ocean', 'monster', 600, 40);            // 香草和 520 + 作者 120 = 640 ⇒ 600 落在作者区间
  const hit = T.raw.includes('rt_royal') && T.authHit === 1;
  const N = await dispatch('deep_ocean', 'monster', 600, 100);           // yMax=62 ⇒ 条件不成立 ⇒ 香草行
  const noCond = !N.raw.includes('rt_royal');
  await cmd(`data modify storage ${NS}:author entries[0].biome set value "minecraft:deep_ocean"`);
  const B = await dispatch('deep_ocean', 'monster', 600, 40);            // 群系不匹配（测试点在主世界非深海）⇒ 不进池
  const noBiome = !B.raw.includes('rt_royal');
  await cmd(`data modify storage ${NS}:author entries[0].biome set value "#minecraft:is_overworld"`);
  await cmd(`kill @e[tag=${NS}.author.rt_royal]`); await sleep(150);
  // 真生成：走 spawn/emit（按 $auth.hit 分流到 author/emit_rt）
  await set('$rng', 600); await set('$py', 40);
  await cmd(`execute positioned ${center(SPAWN)} run function ${NS}:mob/biome/deep_ocean/monster`);
  await cmd(`execute positioned ${center(SPAWN)} run function ${NS}:spawn/emit with storage ${NS}:sel`);
  await sleep(500);
  const gotName = await cmd(`data get entity @e[tag=${NS}.author.rt_royal,limit=1] CustomName`);
  const gotHand = await cmd(`data get entity @e[tag=${NS}.author.rt_royal,limit=1] equipment.mainhand.id`);
  const gotTag = await cmd(`data get entity @e[tag=${NS}.author.rt_royal,limit=1] Tags`);
  const okNbt = gotName.includes('运行时刻皇家僵尸') && gotHand.includes('trident');
  const okTag = gotTag.includes(NS + '.spawned') && gotTag.includes(NS + '.cat.monster');
  ok('§9 运行时刻条件条目：条件门 + 权重派发 + 自定义 NBT 落地（端到端生成）',
    hit && noCond && noBiome && okNbt && okTag,
    `$rng=600/y=40 ⇒ 命中=${hit}(authHit=${T.authHit} expHit=${T.expHit} raw=${T.raw.slice(0,90)})（期望 true） · y=100（Y 门）⇒ 命中=${!noCond}（期望 false） · biome=deep_ocean（群系门）⇒ 命中=${!noBiome}（期望 false） · NBT=${okNbt} · 标签=${okTag}`);
  // 顺带回归：上一条目残留的 NBT 不许粘到下一只香草生物（data merge 递归坑）
  const SP = await dispatch('deep_ocean', 'monster', 80, 40);
  const clean = !/trident|运行时刻皇家僵尸/.test(SP.raw);
  ok('§9b 回归：条目 NBT 不残留到下一条香草物种（sel.nbt 整体替换）', clean, `香草行 rng=80 ⇒ ${SP.slug} · 残留=${!clean}`);
}

// ---------------------------------------------------------------- §10 show / export / reset
{
  const mark = (() => { try { return fs.statSync(LOG).size; } catch { return 0; } })();
  await cmd(`function ${NS}:author/show`);
  await sleep(250);
  const shown = fs.readFileSync(LOG).subarray(mark).toString('utf8');
  const hasSummary = /\[nats\.author\] entries=/.test(shown);
  await cmd(`function ${NS}:author/export`);
  await sleep(250);
  const exported = String(await cmd(`data get storage ${AUS} export.x`));
  const hasExport = exported.includes('rt_royal') || exported.includes('entries');
  await wipe();
  const after = await emptyChecks('b');
  ok('§10 show/export/reset：摘要与导出可见，reset 后回到原版期望',
    hasSummary && hasExport && after.d4 && after.R1.ok === 0 && after.noEntry,
    `摘要行=${hasSummary} · export 含覆盖=${hasExport} · reset 后组大小=${after.d4} 树叶 ok=${after.R1.ok}/reason=${after.R1.reason} 条目未命中=${after.noEntry}`);
}

// ---------------------------------------------------------------- §11–§13 实验性三件套（仅 exp 变体）
if (!EXP) {
  skip('§11 on_spawn 空钩子 = 与原版一致', '默认变体没有实验性层（设计如此）');
  skip('§12 near 关系条件（有狼命中 / 无狼不命中）', '默认变体没有实验性层');
  skip('§13 preset → reset 回到原版期望', '默认变体没有实验性层');
} else {
  // §11：同一条实验性条目，开/关 on_spawn，实体 NBT 与标签必须一致（空钩子 = 零行为差异）
  const entryOf = (onSpawn) => '{id:"rt_hook",mob:"minecraft:zombie",biome:"#minecraft:is_overworld",category:"monster",weight:120,min:1,max:1,when:{yMax:62}' +
    (onSpawn ? ',on_spawn:1b' : '') + ',nbt:"{CustomName:\'{\\"text\\":\\"钩子探针\\"}\'}"}';
  const spawnOnce = async (onSpawn) => {
    await cmd(`data modify storage ${NS}:exp_in entry set value ${entryOf(onSpawn)}`);
    await cmd(`function ${NS}:exp/add_entry with storage ${NS}:exp_in`);
    await cmd(`function ${NS}:exp/enable`);
    await set('$rng', 600); await set('$py', 40);
    await cmd(`execute positioned ${center(SPAWN)} run function ${NS}:mob/biome/deep_ocean/monster`);
    await cmd(`execute positioned ${center(SPAWN)} run function ${NS}:spawn/emit with storage ${NS}:sel`);
    await sleep(500);
    const name = await cmd(`data get entity @e[tag=${NS}.exp.rt_hook,limit=1] CustomName`);
    const tags = await cmd(`data get entity @e[tag=${NS}.exp.rt_hook,limit=1] Tags`);
    const n = /钩子探针/.test(name);
    const t = /doom\.nats\.spawned/.test(tags) && /doom\.nats\.exp\.rt_hook/.test(tags);
    await cmd(`kill @e[tag=${NS}.exp.rt_hook]`);
    return { n, t };
  };
  await wipe();
  const off = await spawnOnce(false);
  await cmd(`function ${NS}:exp/reset`); await sleep(250);
  const on = await spawnOnce(true);
  ok('§11 on_spawn 空钩子 = 与原版一致（有/无 on_spawn 的实体 NBT 与标签一致）',
    off.n && on.n && off.t && on.t, `无钩子：名字=${off.n} 标签=${off.t} · 有空钩子：名字=${on.n} 标签=${on.t}`);

  // §12：near 关系条件（确定性：召唤/击杀一只狼）
  await wipe();
  await cmd('data modify storage ' + NS + ':exp_in entry set value {id:"rt_near",mob:"minecraft:zombie",biome:"#minecraft:is_overworld",category:"monster",weight:120,min:1,max:1,' +
    'when:{yMax:62,near:{type:"minecraft:wolf",radius:24,min:1}}}');
  await cmd(`function ${NS}:exp/add_entry with storage ${NS}:exp_in`);
  await cmd(`function ${NS}:exp/enable`);
  await cmd(`summon minecraft:wolf ${center(GRASS)} {Tags:["zz.probe.wolf"],NoAI:1b,Silent:1b,PersistenceRequired:1b}`);
  await sleep(400);
  const withWolf = await dispatch('deep_ocean', 'monster', 600, 40);
  await cmd('kill @e[tag=zz.probe.wolf]');
  await sleep(400);
  const without = await dispatch('deep_ocean', 'monster', 600, 40);
  ok('§12 near 关系条件（附近有狼 ⇒ 命中；没有 ⇒ 不命中）',
    withWolf.raw.includes('rt_near') && withWolf.expHit === 1 && !without.raw.includes('rt_near'),
    `有狼 ⇒ 命中=${withWolf.raw.includes('rt_near')} hit=${withWolf.expHit}（期望 true/1） · 无狼 ⇒ 命中=${without.raw.includes('rt_near')}（期望 false）`);

  // §13：预设 → reset → 四用例回到 default
  await wipe();
  await cmd(`data modify storage ${NS}:exp_in name set value "blood_moon"`);
  await cmd(`function ${NS}:exp/preset with storage ${NS}:exp_in`);
  const en = String(await cmd(`data get storage ${EX} enabled`));
  const gy = String(await cmd(`data get storage ${EX} counts.groupByY."minecraft:zombie"`));
  await cmd(`data modify storage ${NS}:exp_in name set value "storm_season"`);
  await cmd(`function ${NS}:exp/preset with storage ${NS}:exp_in`);
  const cap = String(await cmd(`data get storage ${EX} counts.capByY.monster`));
  await wipe();
  const afterPreset = await emptyChecks('c');
  ok('§13 预设（blood_moon/storm_season）写入有效，reset 后四用例回到 default 期望',
    /1b/.test(en) && /min: 3/.test(gy) && /max: 200/.test(cap) && afterPreset.d4 && afterPreset.R1.ok === 0 && afterPreset.noEntry,
    `enabled=${/1b/.test(en)} · blood_moon groupByY=${/min: 3/.test(gy)} · storm_season capByY=${/max: 200/.test(cap)} · reset 后组大小=${afterPreset.d4} 树叶=${afterPreset.R1.ok}/${afterPreset.R1.reason} 条目=${afterPreset.noEntry}`);
}

// ---------------------------------------------------------------- 收尾
await wipe();
await cmd('weather clear');
await set('$snap_period', 20); await cmd(`function ${NS}:circ/snapshot`);
const skipped = results.filter((x) => x.skip).length;
const fails = results.filter((x) => !x.pass);
console.log(`\n结论：${results.length - fails.length - skipped} PASS / ${fails.length} FAIL / ${skipped} SKIP（variant=${VARIANT}）`);
for (const f of fails) console.log('  ❌ ' + f.name + ' :: ' + f.detail);
r.close();
process.exit(fails.length ? 1 : 0);
