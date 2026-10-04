// gen_mobs.mjs — 生成 doom.nats（v4） 的「物种选择层」。
//
//   node tools/gen_mobs.mjs [--check]
//
// 对齐源码：原版每次刷怪尝试先用 getRandomSpawnMobAt 抽物种——按【当前位置群系 + 类别】的加权表
// （WeightedList.getRandom，即 random.nextInt(weightSum) 后线性扫描），结构优先于群系。
//
// 数据来源：_work/generated/biome-rosters.json（从 vanilla jar 导出，闭区间与原版逐点等价）。
// 实现方式：**不用运行期遍历列表**，而是把每个群系的每个类别展开成
//   ① 设 #wsum = 该类别权重和  ② $rng %= #wsum  ③ 一串 if score $rng matches from..to → 宏取注册表
// 每类别独立抽（与原版"每类别分别抽样"一致），权重和用**原始值**（不做归一化，避免舍入损失）。
import fs from 'node:fs';
import path from 'node:path';
import * as PKG from './lib/packdir.mjs';

// v4.13：逐实体规则表（替代原来的 5 条粗规则 SEL_RULE）——证据见 lib/entity-rules.mjs 顶部注释
import { ruleOf, clusterOf, buildRuleTable, tagId, PLACE, LIGHT, isWide, isWide2, isTall, EXTRA_RULE_TYPES } from './lib/entity-rules.mjs';
// v4.23 作者规则层（默认空白 ⇒ active=false；下面所有分支都不执行 ⇒ 产物逐字节不变）
import { entriesFor, groupByYOf, entryTypes, entryPredicateIds } from './lib/author-rules.mjs';
// v4.25 实验性 AJ 桥接（同样：DOOM_EXP 未设或 rules/rigs.json 为空 ⇒ active=false ⇒ 产物逐字节不变）
import { EXP_RIGS, rigIdOf } from './lib/exp-rigs.mjs';

// v4.25：物种 → rig id（没配就是 null）。写进 $sel 的 `rig` 字段，供 spawn/emit 改路到 exp/aj/emit/<id>。
// 空 rigs.json ⇒ 恒为 null ⇒ 下列所有拼接都退化成原字符串（逐字节等价）。
const rigField = (type) => { const id = rigIdOf(type); return id ? ',rig:' + JSON.stringify(id) : ''; };

const ROOT = path.resolve(import.meta.dirname, '..');
const GEN = path.join(ROOT, '_work', 'generated');
// v4.24：产物根目录由 lib/packdir.mjs 统一解析（DOOM_EXP=1 ⇒ pack/doom.nats-experimental 实验性变体）
const PACK = PKG.PACK;
const LF = String.fromCharCode(10);
const NS = 'doom.nats';

// 逐实体规则 id（v4.5）：0=仅通用落位 1=水面水生 2=深水水生 3=蝙蝠 4=史莱姆
const Q = String.fromCharCode(34);   // 双引号，避免嵌套引号

// 群系 id → 函数名片段（Q7）：原版群系省略 minecraft: 前缀；**地图自带群系**（如 wgtest:wg_plains）
// 折叠成子目录，否则 ':' 会进文件名与函数 id（Windows 非法文件名 + 非法函数 id）。
const shortOf = (biome) => biome.replace(/^minecraft:/, '').replace(/:/g, '/');

const rosters = JSON.parse(fs.readFileSync(path.join(GEN, 'biome-rosters.json'), 'utf8')).rosters;
const mobsDoc = JSON.parse(fs.readFileSync(path.join(GEN, 'mobs.json'), 'utf8'));

// v4.13：把 roster 里出现的每个实体映射到"规则签名 → 编号"，两边（roster 与 check/entity）用同一张表
{
  const types = new Set();
  for (const data of Object.values(rosters)) for (const cat of Object.values(data.categories)) for (const r of cat.rows) types.add(r.type);
  for (const t of EXTRA_RULE_TYPES) types.add(t);   // 要塞表里的实体也要有规则
  for (const t of entryTypes()) types.add(t);       // v4.23 作者条目的实体（漏了会把 $sel.rule 写成 undefined ⇒ 整表加载失败）
  globalThis.__RULE_TABLE = buildRuleTable(types);
}
const RULE_TABLE = globalThis.__RULE_TABLE;
const F = {};
const stats = { biomeFiles: 0, rows: 0, categories: new Set() };

// ---------------------------------------------------------------- v4.23 作者层：条件条目与 Y 曲线
const authorSlug = (type) => String(type).replace(/^minecraft:/, '').replace(/[^a-z0-9_/.-]/g, '_');
const yBandCond = (b) => (b.yMin != null && b.yMax != null ? 'matches ' + b.yMin + '..' + b.yMax
  : b.yMax != null ? 'matches ..' + b.yMax
    : 'matches ' + (b.yMin ?? 0) + '..');
const entryCond = (e) => {
  const C = [];
  if (e.when.thundering) C.push('if predicate ' + NS + ':weather/thunder');   // 已有谓词（predicate/weather/thunder.json）
  if (e.when.raining) C.push('if predicate ' + NS + ':weather/rain');
  if (e.when.lightMax != null) C.push('if predicate ' + NS + ':author/entry_light_le_' + e.when.lightMax);
  if (e.when.lightMin != null) C.push('if predicate ' + NS + ':author/entry_light_ge_' + e.when.lightMin);
  if (e.when.yMin != null) C.push('if score $py ' + NS + ' matches ' + e.when.yMin + '..');
  if (e.when.yMax != null) C.push('if score $py ' + NS + ' matches ..' + e.when.yMax);
  return C.join(' ');
};
// ⚠ nbt 必须**整体替换**（data merge 递归 ⇒ 上一条目的 NBT 会累加到下一只）⇒ 拆成"结构字段 merge + nbt set"。
const entryNbt = (e, cat) => {
  const extra = e.nbt ? e.nbt.replace(/^\s*\{/, '').replace(/\}\s*$/, '').trim() : '';
  const tags = 'Tags:[' + [JSON.stringify(NS + '.spawned'), JSON.stringify(NS + '.cat.' + cat), JSON.stringify(NS + '.author.' + e.id)].join(',') + ']';
  return '{' + [tags, extra].filter(Boolean).join(',') + '}';
};
const entrySel = (e, cat) => '{type:' + JSON.stringify(e.mob) + ',slug:' + JSON.stringify(authorSlug(e.mob)) + ',cat:' + Q + cat + Q
  + ',min:' + e.min + ',max:' + e.max + rigField(e.mob) + '}';
function authorWeightLines(biome, cat) {
  const list = entriesFor(biome, cat);
  if (!list.length) return [];
  const L = ['', '# ---- 作者层条件条目（rules/entries.json）：条件成立才把权重并入 #wsum',
    '#   语义 =「先按条件过滤候选表，再按权重掷」：#wsum 只在条件成立时变大，条目命中区间紧接香草区间之后，',
    '#   #off 只在条件成立时才前进 ⇒ 多条目之间不会出现空档（空档会让 $rng 白丢一次尝试）。',
    'scoreboard players operation #off ' + NS + ' = #wsum ' + NS];
  for (const e of list) {
    const C = entryCond(e);
    const pre = 'execute ' + (C ? C + ' ' : '');
    const hit = (extra) => pre + 'if score $rng ' + NS + ' >= #off ' + NS + ' if score $rng ' + NS + ' < #hi ' + NS + (extra ? ' ' + extra : '') + ' run ';
    L.push('# ' + e.id + '（' + e.mob + ' · 权重 ' + e.weight + (C ? '' : ' · 无条件') + (e.nbt ? ' · 自定义 NBT' : '') + '）' + (e.comment ? ' —— ' + e.comment : ''));
    L.push(pre + 'run scoreboard players add #wsum ' + NS + ' ' + e.weight);
    L.push(pre + 'run scoreboard players operation #hi ' + NS + ' = #off ' + NS);
    L.push(pre + 'run scoreboard players add #hi ' + NS + ' ' + e.weight);
    L.push(hit('') + 'scoreboard players set $sel.ok ' + NS + ' 1');
    L.push(hit('') + 'data merge storage ' + NS + ':sel ' + entrySel(e, cat));
    L.push(hit('') + 'data modify storage ' + NS + ':sel nbt set value ' + entryNbt(e, cat));
    // 条目级覆盖（place/light/tag）只改这一条写进 $sel 的值；$sel.rule 仍是该物种的规则 id，
    //   所以 check/entity 里该物种的原版门（掷币/深水/窗口…）照旧生效 —— 要连那些一起去掉，就在 entity-rules.json 里改物种规则。
    const rl = { ...ruleOf(e.mob), ...(e.place ? { place: e.place } : {}), ...(e.light ? { light: e.light } : {}), ...(e.tag ? { tag: e.tag } : {}) };
    L.push(hit('') + 'scoreboard players set $sel.rule ' + NS + ' ' + RULE_TABLE.idOf(e.mob));
    L.push(hit('') + 'scoreboard players set $sel.place ' + NS + ' ' + PLACE[rl.place]);
    L.push(hit('') + 'scoreboard players set $sel.light ' + NS + ' ' + LIGHT[rl.light]);
    L.push(hit('') + 'scoreboard players set $sel.tag ' + NS + ' ' + (rl.tag ? tagId(rl.tag) : 0));
    L.push(hit('') + 'scoreboard players set $sel.grp1 ' + NS + ' ' + (rl.grp1 ? 1 : 0));
    L.push(hit('') + 'scoreboard players set $sel.cluster ' + NS + ' ' + (e.cluster ?? clusterOf(e.mob)));
    L.push(hit('') + 'scoreboard players set $sel.wide ' + NS + ' ' + (isWide(e.mob) ? 1 : 0));
    L.push(hit('') + 'scoreboard players set $sel.wide2 ' + NS + ' ' + (isWide2(e.mob) ? 1 : 0));
    L.push(hit('') + 'scoreboard players set $sel.tall ' + NS + ' ' + (isTall(e.mob) ? 1 : 0));
    for (const b of e.groupByY ?? []) L.push(hit('if score $py ' + NS + ' ' + yBandCond(b)) + 'data merge storage ' + NS + ':sel {min:' + b.min + ',max:' + b.max + '}');
    L.push(pre + 'run scoreboard players add #off ' + NS + ' ' + e.weight);
  }
  L.push('');
  return L;
}

// ---------------------------------------------------------------- 1) 生物注册表（storage）
{
  const rows = [
    '# ' + NS + ':mob/load —— 生物注册表装载（由 tools/gen_mobs.mjs 从 vanilla 数据生成，勿手改）',
    '# 取用：function ' + NS + ':spawn/one with storage ' + NS + ':mobs <id>',
    '# 条目 = { type, nbt }：type 为实体 id（宏替换时字符串不带引号插入），nbt 为生成时的实体 NBT。',
    '',
  ];
  for (const [id, m] of Object.entries(mobsDoc.mobs).sort()) {
    const tags = [NS + '.spawned', NS + '.cat.' + m.category];
    // v4.24：额外写一份 `rt`（原版规则数据）——运行时刻条目（storage entries）只能拿到实体 id，
    //   靠 `author/lookup` 反查到 slug 后**一条 data modify** 就能把整套判定参数搬进 $sel
    //   （rule/place/light/tag/grp1/cluster/wide/wide2/tall），不必在运行期重算规则表。
    const rl = ruleOf(m.type);
    const rt = '{rule:' + RULE_TABLE.idOf(m.type) + ',place:' + PLACE[rl.place] + ',light:' + LIGHT[rl.light]
      + ',tag:' + (rl.tag ? tagId(rl.tag) : 0) + ',grp1:' + (rl.grp1 ? 1 : 0) + ',cluster:' + clusterOf(m.type)
      + ',wide:' + (isWide(m.type) ? 1 : 0) + ',wide2:' + (isWide2(m.type) ? 1 : 0) + ',tall:' + (isTall(m.type) ? 1 : 0) + '}';
    //   v4.25：配了 rig 的物种多写一个 `rig` 字段（诊断用：`data get storage doom.nats:mobs <id>.rig`）。
    const rigId = rigIdOf(m.type);
    rows.push('data modify storage ' + NS + ':mobs ' + id + ' set value {type:' + JSON.stringify(m.type) + ',rule:' + RULE_TABLE.idOf(m.type) + ',rt:' + rt + (rigId ? ',rig:' + JSON.stringify(rigId) : '') + ',nbt:{Tags:[' + tags.map((t) => JSON.stringify(t)).join(',') + ']}}');
  }
  F['data/' + NS + '/function/mob/load.mcfunction'] = rows.join(LF) + LF;
  // v4.24：生成端三路派发。为什么要拆：运行时刻条目（storage entries）带自己的 NBT 与标签，
  //   不能套用 post/<slug>（它的 $(nbt) 来自 sel.nbt 复合标签，而作者条目给的是 SNBT 字符串）；
  //   香草路径包一层 post_chain，是为了把 on_spawn 钩子跑在"@s = 新实体"的上下文里。
  F['data/' + NS + '/function/spawn/emit_vanilla.mcfunction'] = [
    '# ' + NS + ':spawn/emit_vanilla [MACRO] —— 香草路径的 summon（包装层 author/post_chain 会补 on_spawn 钩子）',
    '# 用法：function ' + NS + ':spawn/emit_vanilla with storage ' + NS + ':sel（在**玩家**上下文里调用）',
    // 默认变体：直连 post/<slug>（与 v4.23 同一条链）；实验性变体：经 exp/post_chain 多一次 on_spawn 钩子判定
    '$execute summon $(type) run function ' + NS + ':' + (PKG.EXP ? 'exp/post_chain' : 'post/$(slug)') + ' with storage ' + NS + ':sel',
    '',
  ].join(LF);
  F['data/' + NS + '/function/spawn/emit.mcfunction'] = [
    '# ' + NS + ':spawn/emit —— 生成宏（宏参数来自选物种结果 ' + NS + ':sel）',
    '#',
    '# 用法：function ' + NS + ':spawn/emit with storage ' + NS + ':sel',
    '#   $(type) 实体 id、$(slug) 物种短名（派发 post/<slug>）',
    '#',
    '# v4.15：改用 execute summon。源码依据（SummonCommand.createEntity）——',
    '#   execute summon 走 SummonCommand.createEntity(source, type, pos, {}, true)，',
    '#   末尾那个 true 就是「对 Mob 调一次 finalizeSpawn(getCurrentDifficultyAt(pos), COMMAND, null)」，',
    '#   而且发生在 tryAddFreshEntityWithPassengers **之前**，与 NaturalSpawner 的顺序一致。',
    '#   ⇒ 单只层面的 finalizeSpawn（装备/武器/变体/婴儿/鸡骑士/蛛骑骷髅/僵尸首领/山羊角/村民数据…）',
    '#     原版已替我们跑过；新实体还作为 @s 交给 run 的命令，给刚生成的那只补 NBT 再没有歧义',
    '#     （旧写法 summon + @e[distance=..1,sort=nearest] 在同点连续生成时会认错人）。',
    '# 朝向：vanilla 自然生成用 snapTo(..., random*360, 0)；宏参数必须在 post 实例化之前就位，所以在这里掷',
    '# 注意：这一行不能写宏前缀 —— 不含任何参数占位符的行若带宏前缀，会让整个函数加载失败（实测）',
    'execute store result storage ' + NS + ':sel rot int 1 run random value 0..359',
    '# ① 运行时刻条目命中（storage ' + NS + ':author → entries）⇒ 走 author/emit_rt（自带 NBT/标签）',
    'execute if score $auth.hit ' + NS + ' matches 1 run function ' + NS + ':author/emit_rt with storage ' + NS + ':sel',
    ...(PKG.EXP ? ['# ①b 实验性条目命中（storage ' + NS + ':exp → entries，仅 enabled:1b）⇒ 走 exp/emit_rt',
      'execute if score $exp.hit ' + NS + ' matches 1 run function ' + NS + ':exp/emit_rt with storage ' + NS + ':sel'] : []),
    '# ② 香草路径（含构建期 rules/entries.json 的条目）：post/<slug> + on_spawn 钩子',
    ...(EXP_RIGS.active ? [
      '# ②a 实验性 AJ 桥接（v4.25）：该物种在 rules/rigs.json 里配了 rig ⇒ 内核照常 summon，另把 rig 挂上当外观。',
      '#   守卫是**非宏**的、且带**类型**的复合匹配 `{rig:"<id>",type:"<载体>"}`：',
      '#   ① 宏缺参会让整个函数中止 ⇒ 必须先守卫再进 emit_sel；',
      '#   ② $sel 是**持久 storage**，只写 `rig` 而不校验 type 会被上一只的残留值骗到',
      '#      （空 rigs.json 的 A/B 实测踩过：默认构建里残留的 rig 字段仍在）⇒ 两条一起匹配才认。',
      '# 没配 rig 的物种走 ②b，与不带这一层时逐字节同一条命令（唯一的差别是多个 unless 守卫）。',
      '# 每条 rig 一个 if 行（**分开的行才是"或"**；写在同一条 execute 里会被当成"与"，实测踩过：一个都不出），',
      '# ②b 用它们的否定链（unless ... unless ...）＝"没有命中任何一条 rig"。',
      ...EXP_RIGS.list.map((r) => 'execute if score $auth.hit ' + NS + ' matches 0' + (PKG.EXP ? ' if score $exp.hit ' + NS + ' matches 0' : '')
        + ' if data storage ' + NS + ':sel {rig:' + JSON.stringify(r.id) + ',type:' + JSON.stringify(r.carrier) + '}'
        + ' run function ' + NS + ':exp/aj/emit_sel with storage ' + NS + ':sel'),
      'execute if score $auth.hit ' + NS + ' matches 0' + (PKG.EXP ? ' if score $exp.hit ' + NS + ' matches 0' : '')
      + EXP_RIGS.list.map((r) => ' unless data storage ' + NS + ':sel {rig:' + JSON.stringify(r.id) + ',type:' + JSON.stringify(r.carrier) + '}').join('')
      + ' run function ' + NS + ':spawn/emit_vanilla with storage ' + NS + ':sel',
    ] : [
      'execute if score $auth.hit ' + NS + ' matches 0' + (PKG.EXP ? ' if score $exp.hit ' + NS + ' matches 0' : '') + ' run function ' + NS + ':spawn/emit_vanilla with storage ' + NS + ':sel',
    ]),
    '',
  ].join(LF);
}

// ---------------------------------------------------------------- 1b) 按 MobCategory 的实体类型标签
// 用途：生成端与调试都可以用 `@e[type=#doom.nats:monster]` 这样的标签筛选，
// 而不必在每条命令里枚举实体 id；也是「生物名称谓词」体系的挂载点（见 mob/names）。
{
  const byCat = new Map();
  // v4.14d：类别标签要覆盖**该类别在 vanilla 里的全部实体**（不只是 roster 里出现过的），
  //   因为 mobcap 的原版语义是"该维度里这一类的所有生物"（含刷怪笼/结构/指令生成的）。
  //   数据来源：_work/extract_categories.mjs 从 EntityType 注册块抽的 entity-categories.json。
  const catFile = path.join(GEN, 'entity-categories.json');
  if (fs.existsSync(catFile)) {
    const full = JSON.parse(fs.readFileSync(catFile, 'utf8')).byCat;
    for (const [cat, ids] of Object.entries(full)) byCat.set(cat, [...ids]);
  }
  for (const [id, m] of Object.entries(mobsDoc.mobs)) {
    if (!byCat.has(m.category)) byCat.set(m.category, []);
    if (!byCat.get(m.category).includes(id)) byCat.get(m.category).push(id);
  }
  for (const [cat, ids] of byCat) {
    F['data/' + NS + '/tags/entity_type/' + cat + '.json'] = JSON.stringify({ values: ids.sort() }, null, 2) + LF;
  }
  console.log('  实体类型标签:', [...byCat.keys()].sort().join(', '));
}

// ---------------------------------------------------------------- 1c) 名称谓词清单（可查看/可扩展）
// 原版没有「按名字筛选生成」的数据结构，这里把注册表里的名字信息集中成一份可查看的清单，
// 并留出 names.json 作为作者扩展点（按自定义名/CustomName 分组）。
F['data/' + NS + '/names.json'] = JSON.stringify({
  note: '生物名称清单（按类别分组）；生成端可用 #doom.nats:<category> 实体标签筛选，也可在注册表条目里加 name 字段做谓词匹配',
  byCategory: Object.fromEntries([...new Set(Object.values(mobsDoc.mobs).map((m) => m.category))].sort().map((c) => [c, Object.entries(mobsDoc.mobs).filter(([, m]) => m.category === c).map(([id]) => id).sort()])),
}, null, 2) + LF;

// ---------------------------------------------------------------- 1d) 注册表查看（接 doom.log）
F['data/' + NS + '/function/debug/mobs.mcfunction'] = [
  '# ' + NS + ':debug/mobs —— 查看生物注册表规模与按类别的实体标签（走 doom.log 的 [dump]）',
  'function doom.log:info {code:"E913", message:"' + NS + ' 生物注册表：条目 ' + Object.keys(mobsDoc.mobs).length + ' 条"}',
  ...['monster', 'creature', 'ambient', 'water_ambient', 'water_creature', 'underground_water_creature', 'axolotls'].map((c) =>
    'function doom.log:dump {key:"mobs.' + c + '", message:"可用 @e[type=#' + NS + ':' + c + '] 筛选"}'),
  'tellraw @a [{"text":"[nats] 注册表清单见 data/' + NS + '/names.json；实体标签 #' + NS + ':<category>","color":"gray"}]',
  ''
].join(LF);

// ---------------------------------------------------------------- 2) 每群系一份选择表

// ---------------------------------------------------------------- 2b-0) 结构 spawn_overrides（v4.17 / P1-6）
//
// 数据来源：vanilla 1.21.6 里**带非空 spawn_overrides 的结构共 6 个**（从 server-1.21.6.jar 的
//   data/minecraft/worldgen/structure/*.json 逐个抄出）：fortress / pillager_outpost / swamp_hut /
//   monument / ancient_city / trial_chambers。fortress 走 `spawn/pick_one` 的专用分支（已有 `mob/fortress`，
//   那还额外复刻了 NetherFortressStructure 的"下方是下界砖"前置），这里补其余 5 个。
//
// 语义（ChunkGenerator.getMobsAt，1.21.6 逐字）：
//   for (StructureStart s : structureManager.getAllStructuresAt(pos))
//      StructureSpawnOverride o = s.getStructure().spawnOverrides().get(category);
//      if (o != null && 位置落在 o.boundingBox() 声明的盒内（full=整体包围盒 / piece=具体部件）)
//         return o.spawns();                       // ← **整表替换**群系表
//   return biome.getMobSettings().getMobs(category);
//   空表（spawns: []）⇒ WeightedList.getRandom 返回 empty ⇒ NaturalSpawner 直接 break 整个组循环。
//
// 实现：把检查挂在**每个「群系 × 类别」表**的开头（命中即 `return` 早退）。挂在表里而不是 pick_one 里，
//   是因为只有到表这一层才知道"本次抽中的是哪个类别"，而原版的覆盖判定正是**按类别匹配**的。
//   顺序固定 outpost → swamp_hut → monument → ancient_city → trial_chambers（原版是 map 遍历，重叠时顺序不定）。
//   ⚠ 已知近似（2026-09-28 更正，证据见 docs/19 §八）：`location_check.structures` 走的其实是
//     `StructureManager.getStructureWithPieceAt` ⇒ 与 chunkGenerator 的 **PIECE 分支同义**（不是整体包围盒）。
//     于是：`swamp_hut` / `trial_chambers` / `fortress` 这类原版写 `piece` 的 ⇒ 本包**精确一致**；
//     而 `ancient_city` / `monument` / `pillager_outpost` 原版写 `full`（整体包围盒）⇒ "盒内、部件外"那一圈
//     本包会回落到群系表 ⇒ 比原版**偏松**（会刷怪的地方更多）。数据包没有 full 级 API ⇒ 属不可达缺口。
const STRUCT_OVERRIDES = {
  // v4.18（P1-6b）：要塞补进表里 —— 原版它有**两条**路径（NaturalSpawner.mobsAt:276-290）：
  //   ① 硬编码：cat==MONSTER ∧ 脚下 NETHER_BRICKS ∧ getStructureAt(整体包围盒) 有效 ⇒ FORTRESS_ENEMIES
  //   ② 它的 JSON spawn_overrides：monster / bounding_box=piece ⇒ 脚下**不是**下界砖时才会走到
  //   两张表逐字段相同（NetherFortressStructure:21-27 vs fortress.json）⇒ 用 `ref` 直接复用 mob/fortress（单一事实来源）。
  //   并且这**修掉了一个保真度 bug**：旧实现在 pick_one 里按"下界 ∧ 下界砖 ∧ in_fortress"**不分类别**地抢走尝试，
  //   于是要塞内连 creature/ambient 的尝试也被换成 monster 表；而原版是按类别调用 mobsAt 的
  //   —— 非 monster 类别在要塞内照样用群系表（要塞 JSON 只写了 monster）。挂进 monster 表后语义与原版一致。
  //   ⚠ 仍保留的近似：原版路径①用"整体包围盒"（full）、路径②用 piece；本包只能用 piece ⇒ 见上面的更正说明。
  fortress: { monster: { ref: 'mob/fortress' } },
  pillager_outpost: { monster: [{ type: 'minecraft:pillager', min: 1, max: 1, weight: 1 }] },
  swamp_hut: {
    creature: [{ type: 'minecraft:cat', min: 1, max: 1, weight: 1 }],
    monster: [{ type: 'minecraft:witch', min: 1, max: 1, weight: 1 }],
  },
  monument: {
    monster: [{ type: 'minecraft:guardian', min: 2, max: 4, weight: 1 }],
    axolotls: [],
    underground_water_creature: [],
  },
  ancient_city: { '*': [] },      // 8 个类别全清空（ambient 等）
  trial_chambers: { '*': [] },    // 同上
};
const ALL_CATS = ['monster', 'creature', 'ambient', 'axolotls', 'underground_water_creature', 'water_creature', 'water_ambient'];
const structPreambleLines = (cat) => {
  const L = ['# ---- 结构 spawn_overrides 优先（原版 ChunkGenerator.getMobsAt：命中即整表替换；空表 = 该类别无物种）----'];
  for (const [name, spec] of Object.entries(STRUCT_OVERRIDES)) {
    const table = spec['*'] !== undefined ? spec['*'] : spec[cat];
    if (table === undefined) continue;
    // `{ ref: 'mob/xxx' }`：复用已有表（要塞两条路径同表）——不要在这里再抄一份，避免两处漂移
    if (!Array.isArray(table) && table.ref) {
      L.push('execute if predicate ' + NS + ':spawn/in_' + name + ' run return run function ' + NS + ':' + table.ref);
      continue;
    }
    L.push(table.length === 0
      ? 'execute if predicate ' + NS + ':spawn/in_' + name + ' run return 0'
      : 'execute if predicate ' + NS + ':spawn/in_' + name + ' run return run function ' + NS + ':mob/struct/' + name + '_' + cat);
  }
  L.push('');
  return L;
};

for (const [biome, data] of Object.entries(rosters)) {
  const short = shortOf(biome);
  const cats = Object.entries(data.categories);
  // ⚠ 结构要点（v4.3 修）：原版是**每个类别的 spawnCategoryForChunk 各自一次尝试**；
  //   若把 7 个类别塞进同一个函数里各掷一次，最后一个命中的类别会覆盖前面的 ⇒
  //   永远只刷表尾那个类别（实测 plains 只出 glow_squid，一加类别落位规则就 0 生成）。
  //   正确结构：先均匀抽一个"本群系存在的类别"，再在该类别内按权重掷物种。
  const head = [
    '# ' + NS + ':mob/biome/' + short + ' —— ' + biome + ' 的类别分发（vanilla 权重，区间与原版逐点等价）',
    '#',
    '# 类别数 N=' + cats.length + '：本函数自己掷 $rng → 均匀抽一类 → 在该类内按「$rng % 权重和」掷物种。',
    '# ⚠ v4.19 关键修复（P0-4）：此前 $rng 只由**测试脚本**（_work/verify_*、_work/_probe_*）掷骰，',
    '#   生产链路里没有任何地方掷它 ⇒ $rng 恒为 0 ⇒ 每个类别的 "if score $rng matches from..to" 只命中第一条，',
    '#   **权重整体失效**：海洋怪物永远蜘蛛（溺尸 5/520 永远选不中）、海洋 ambient 永远蝙蝠、要塞永远烈焰人…',
    '#   真机证据：深海 4 分钟 batch=24 零溺尸零鱼；矩阵 12 点里 8 点是 spider —— 全是"表里第一条"。',
    '# 掷骰范围 0..999999：对最大权重和 615 的取模偏差 < 0.1%，且 /random value 一定接受这个区间。',
    'execute store result score $rng ' + NS + ' run random value 0..999999',
    '',
    ...(cats.length > 1 ? ['execute store result score $catid ' + NS + ' run random value 0..' + (cats.length - 1)] : [
      '# 只有一个类别：不掷（random value 0..0 是退化区间，会被游戏拒绝）。',
      '# ⚠ 必须**显式置 0**（v4.18/Q7 实测修）：$catid 是全局计分板，会被上一个群系的抽取留下 0..N-1 的值；',
      '#   少了这一行，本群系下面那句「if score $catid matches 0」就会随上一个群系随机不成立 ⇒ 整片群系不刷怪。',
      '#   受害面：原版就有 5 个单类别群系（the_end / end_barrens / end_highlands / end_midlands / small_end_islands，',
      '#   全是 monster=末影人）；地图 worldgen 覆盖成「只有一类」的群系同样中招。',
      'scoreboard players set $catid ' + NS + ' 0',
    ]),
  ];
  cats.forEach(([cat, entry], i) => {
    stats.categories.add(cat);
    const rows = [
      '# ' + NS + ':mob/biome/' + short + '/' + cat + ' —— ' + biome + ' · ' + cat + '（权重和 ' + entry.weightSum + '，' + entry.rows.length + ' 条）',
      '',
      ...structPreambleLines(cat),
      'scoreboard players set #wsum ' + NS + ' ' + entry.weightSum,
      ...authorWeightLines(biome, cat),
      // v4.24 运行时刻条目（storage doom.nats:author → entries[]）：接在构建期条目之后，
      //   #off 在这里重新对齐到 #wsum（构建期条目已经把两者一起推进过，所以这是幂等的）。
      'scoreboard players operation #off ' + NS + ' = #wsum ' + NS,
      'execute if data storage ' + NS + ':author entries[0] run function ' + NS + ':author/entry_scan_' + cat,
      ...(PKG.EXP ? [
        '# 实验性条目（storage doom.nats:exp → entries[]）：总开关 enabled=1b 时才进池',
        // 实验性总开关：当场读进 $exp.on（改 storage 即刻生效；execute if data storage <id>{…} 是非法语法）
        'scoreboard players set $exp.on ' + NS + ' 0',
        'execute if data storage ' + NS + ':exp enabled run execute store result score $exp.on ' + NS + ' run data get storage ' + NS + ':exp enabled',
        'execute if score $exp.on ' + NS + ' matches 1 if data storage ' + NS + ':exp entries[0] run function ' + NS + ':exp/entry_scan_' + cat,
      ] : []),
      'scoreboard players operation $rng ' + NS + ' %= #wsum ' + NS,
    ];
    for (const r of entry.rows) {
      const cond = r.from === r.to ? 'matches ' + r.from : 'matches ' + r.from + '..' + r.to;
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.ok ' + NS + ' 1');
      const rl = ruleOf(r.type);
      // v4.14：规则里 persist=true 的物种，召唤 NBT 直接带 PersistenceRequired:1b（原版语义：永不消失）
      const mobNbt = '{Tags:[' + JSON.stringify(NS + '.spawned') + ',' + JSON.stringify(NS + '.cat.' + cat) + ']' + (rl.persist ? ',PersistenceRequired:1b' : '') + '}';
      // ⚠ data merge 是**递归**的：nbt 写进同一个 merge 时，上一条目残留的键会累积到下一只身上
      //   （真机实测：上一条作者条目的 CustomName/HandItems 会粘到下一只香草生物）⇒ 结构字段 merge、nbt 整体 set。
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run data merge storage ' + NS + ':sel {type:' + JSON.stringify(r.type) + ',slug:' + JSON.stringify(String(r.type).replace(/^minecraft:/, '')) + ',cat:' + Q + cat + Q + ',min:' + r.min + ',max:' + r.max + rigField(r.type) + '}');
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run data modify storage ' + NS + ':sel nbt set value ' + mobNbt);
      // v4.23 作者层：按 Y 段覆盖「每次生几只」（rules/counts.json groupByY）—— 在香草 min/max 之后合并，故覆盖它
      for (const b of groupByYOf(r.type) ?? []) {
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' if score $py ' + NS + ' ' + yBandCond(b) + ' run data merge storage ' + NS + ':sel {min:' + b.min + ',max:' + b.max + '}');
      }
      const placeId = PLACE[rl.place];
      const lightId = LIGHT[rl.light];
      const tag = rl.tag ? tagId(rl.tag) : 0;
      const grp1 = rl.grp1 ? 1 : 0;
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.rule ' + NS + ' ' + RULE_TABLE.idOf(r.type));
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.place ' + NS + ' ' + placeId);
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.light ' + NS + ' ' + lightId);
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.tag ' + NS + ' ' + tag);
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.grp1 ' + NS + ' ' + grp1);
      // v4.14b：AABB 近似用的尺寸标记（原版 noCollision(type.getSpawnAABB(...))）
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.wide ' + NS + ' ' + (isWide(r.type) ? 1 : 0));
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.wide2 ' + NS + ' ' + (isWide2(r.type) ? 1 : 0));
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.tall ' + NS + ' ' + (isTall(r.type) ? 1 : 0));
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.cluster ' + NS + ' ' + clusterOf(r.type));
      // v4.24：命中该行后跑一次"运行时刻装载"（规则补丁 + groupByY）。空层时 author/row 只做几次 no-op。
      rows.push('execute if score $rng ' + NS + ' ' + cond + ' run function ' + NS + ':author/row with storage ' + NS + ':sel');
      if (PKG.EXP) {
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' if score $exp.on ' + NS + ' matches 1 run function ' + NS + ':exp/row with storage ' + NS + ':sel');
      }
    }
    F['data/' + NS + '/function/mob/biome/' + short + '/' + cat + '.mcfunction'] = rows.join(LF) + LF;
    // v4.14：被动生物（creature）在原版只有 gameTime % 400 == 0 那一拍才进候选类别（MobCategory.isPersistent()
    //   ⇒ getFilteredSpawningCategories 的第三个开关）；其余友好类别（ambient/water_*/axolotls）不受此限。
    //   · creature 只在 gameTime % 400 == 0 那一拍（MobCategory.isPersistent 语义）
    //   · monster 在和平难度下整类不进候选（MinecraftServer.isSpawningMonsters ⇒ spawnEnemies=false；
    //     数据包读不到难度，故由作者用 $cfg.peaceful 声明）
    const gate = (cat === 'creature' ? ' if score $gt ' + NS + ' matches 0' : '')
      + (cat === 'monster' ? ' if score $cfg.peaceful ' + NS + ' matches 0' : '');
    head.push('execute if score $catid ' + NS + ' matches ' + i + gate + ' run function ' + NS + ':mob/biome/' + short + '/' + cat);
    stats.rows += entry.rows.length;
    stats.biomeFiles++;
  });
  F['data/' + NS + '/function/mob/biome/' + short + '.mcfunction'] = head.join(LF) + LF;
  stats.biomeFiles++;
}

// ---------------------------------------------------------------- 2b) 规则表落盘（check/entity 生成时读同一份）
{
  const out = path.join(GEN, 'entity-rules.json');
  fs.writeFileSync(out, JSON.stringify({
    place: PLACE, light: LIGHT,
    rules: RULE_TABLE.rules.map((r) => ({ id: r.id, sample: r.sample, ...r.rule, tagId: r.rule.tag ? tagId(r.rule.tag) : 0 })),
    byType: Object.fromEntries([...new Set(Object.values(rosters).flatMap((d) => Object.values(d.categories).flatMap((c) => c.rows.map((r) => r.type))))].map((t) => [t, RULE_TABLE.idOf(t)])),
  }, null, 2) + LF);
  console.log('规则表:', RULE_TABLE.rules.length, '条 →', out);
}
// ---------------------------------------------------------------- 2c) 下界要塞优先（v4.14c）
// 源码：NaturalSpawner.mobsAt → isInNetherFortressBounds(pos, level, MONSTER, structureManager)
//        ⇒ 若"类别是 MONSTER ∧ 下方方块是下界砖 ∧ 该处属于 fortress 结构"，就用 NetherFortressStructure.FORTRESS_ENEMIES
//          这张**固定加权表**替代群系表（原版源码里的权重与数量见下）。
// 数据（逐字抄自 NetherFortressStructure.FORTRESS_ENEMIES）：
//   blaze            min 2 max 3  weight 10
//   zombified_piglin min 4 max 4  weight  5
//   wither_skeleton  min 5 max 5  weight  8
//   skeleton         min 5 max 5  weight  2
//   magma_cube       min 4 max 4  weight  3     （权重和 28）
// 说明：要塞路径**不做 spawn cost**（该机制只在 warped_forest / soul_sand_valley 非空；要塞里若需要可自行接线）。
{
  const FORTRESS = [
    { type: 'minecraft:blaze', min: 2, max: 3, weight: 10 },
    { type: 'minecraft:zombified_piglin', min: 4, max: 4, weight: 5 },
    { type: 'minecraft:wither_skeleton', min: 5, max: 5, weight: 8 },
    { type: 'minecraft:skeleton', min: 5, max: 5, weight: 2 },
    { type: 'minecraft:magma_cube', min: 4, max: 4, weight: 3 },
  ];
  const sum = FORTRESS.reduce((a, b) => a + b.weight, 0);
  const rows = [
    '# ' + NS + ':mob/fortress —— 下界要塞固定刷怪表（等价 NetherFortressStructure.FORTRESS_ENEMIES，权重和 ' + sum + '）',
    '# 触发：' + NS + ':mob/biome/<群系>/monster 的**结构前置**（v4.18 起）—— 即 "本次抽中的类别是 monster ∧ 位置在 fortress 内（piece 级）"。',
    '#   原版有两条同表路径（NaturalSpawner.mobsAt:276-290）：①硬编码"下方是下界砖 ∧ 要塞内"；',
    '#   ②要塞 JSON 的 spawn_overrides（monster / piece，"下方不是下界砖"时才走到）。本表被两条共用。',
    '',
    'scoreboard players set #wsum ' + NS + ' ' + sum,
    'scoreboard players operation $rng ' + NS + ' %= #wsum ' + NS,
    'scoreboard players set $cost.threshold ' + NS + ' 0',
  ];
  let from = 0;
  for (const r of FORTRESS) {
    const to = from + r.weight - 1;
    const cond = from === to ? 'matches ' + from : 'matches ' + from + '..' + to;
    const rl = ruleOf(r.type);
    const mobNbt = '{Tags:[' + JSON.stringify(NS + '.spawned') + ',' + JSON.stringify(NS + '.cat.monster') + ']' + (rl.persist ? ',PersistenceRequired:1b' : '') + '}';
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.ok ' + NS + ' 1');
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run data merge storage ' + NS + ':sel {type:' + JSON.stringify(r.type) + ',slug:' + JSON.stringify(String(r.type).replace(/^minecraft:/, '')) + ',cat:' + Q + 'monster' + Q + ',min:' + r.min + ',max:' + r.max + rigField(r.type) + '}');
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run data modify storage ' + NS + ':sel nbt set value ' + mobNbt);
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.rule ' + NS + ' ' + RULE_TABLE.idOf(r.type));
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.place ' + NS + ' ' + PLACE[rl.place]);
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.light ' + NS + ' ' + LIGHT[rl.light]);
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.tag ' + NS + ' ' + (rl.tag ? tagId(rl.tag) : 0));
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.grp1 ' + NS + ' ' + (rl.grp1 ? 1 : 0));
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.cluster ' + NS + ' ' + clusterOf(r.type));
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.wide ' + NS + ' ' + (isWide(r.type) ? 1 : 0));
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.wide2 ' + NS + ' ' + (isWide2(r.type) ? 1 : 0));
    rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.tall ' + NS + ' ' + (isTall(r.type) ? 1 : 0));
    from = to + 1;
  }
  F['data/' + NS + '/function/mob/fortress.mcfunction'] = rows.join(LF) + LF;
}

// ---------------------------------------------------------------- 2d) 结构 spawn_overrides 的谓词与表（v4.17 / P1-6）
{
  for (const name of Object.keys(STRUCT_OVERRIDES)) {
    F['data/' + NS + '/predicate/spawn/in_' + name + '.json'] = JSON.stringify({
      condition: 'minecraft:location_check',
      predicate: { structures: ['minecraft:' + name] },
    }, null, 2) + LF;
  }
  console.log('  结构 spawn_overrides:', Object.keys(STRUCT_OVERRIDES).join(', '), '（fortress 以 ref 复用 mob/fortress）');
  for (const [name, spec] of Object.entries(STRUCT_OVERRIDES)) {
    for (const cat of ALL_CATS) {
      const table = spec['*'] !== undefined ? spec['*'] : spec[cat];
      if (!table || !table.length) continue;
      const sum = table.reduce((a, b) => a + b.weight, 0);
      const rows = [
        '# ' + NS + ':mob/struct/' + name + '_' + cat + ' —— ' + name + '.spawn_overrides[' + cat + ']（权重和 ' + sum + '）',
        '# 数据：vanilla data/minecraft/worldgen/structure/' + name + '.json 的 spawn_overrides，逐字抄（type/minCount/maxCount/weight）',
        '# 调用点：' + NS + ':mob/biome/<群系>/' + cat + ' 的**前置结构检查**（命中即整表替换群系表）。',
        '# ⚠ 不改 $cost.threshold：原版 spawn cost 取的是**群系**的 MobSpawnSettings.getMobSpawnCost，与结构覆盖无关。',
        '',
        'scoreboard players set #wsum ' + NS + ' ' + sum,
      ];
      if (sum > 1) rows.push('execute store result score $rng ' + NS + ' run random value 0..' + (sum - 1));
      else rows.push('# 单条目表：不掷骰（random value 0..0 是退化区间，游戏会拒）', 'scoreboard players set $rng ' + NS + ' 0');
      let from = 0;
      for (const r of table) {
        const to = from + r.weight - 1;
        const cond = from === to ? 'matches ' + from : 'matches ' + from + '..' + to;
        const rl = ruleOf(r.type);
        const mobNbt = '{Tags:[' + JSON.stringify(NS + '.spawned') + ',' + JSON.stringify(NS + '.cat.' + cat) + ']' + (rl.persist ? ',PersistenceRequired:1b' : '') + '}';
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.ok ' + NS + ' 1');
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run data merge storage ' + NS + ':sel {type:' + JSON.stringify(r.type) + ',slug:' + JSON.stringify(String(r.type).replace(/^minecraft:/, '')) + ',cat:' + Q + cat + Q + ',min:' + r.min + ',max:' + r.max + rigField(r.type) + '}');
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run data modify storage ' + NS + ':sel nbt set value ' + mobNbt);
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.rule ' + NS + ' ' + RULE_TABLE.idOf(r.type));
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.place ' + NS + ' ' + PLACE[rl.place]);
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.light ' + NS + ' ' + LIGHT[rl.light]);
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.tag ' + NS + ' ' + (rl.tag ? tagId(rl.tag) : 0));
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.grp1 ' + NS + ' ' + (rl.grp1 ? 1 : 0));
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.cluster ' + NS + ' ' + clusterOf(r.type));
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.wide ' + NS + ' ' + (isWide(r.type) ? 1 : 0));
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.wide2 ' + NS + ' ' + (isWide2(r.type) ? 1 : 0));
        rows.push('execute if score $rng ' + NS + ' ' + cond + ' run scoreboard players set $sel.tall ' + NS + ' ' + (isTall(r.type) ? 1 : 0));
        from = to + 1;
      }
      F['data/' + NS + '/function/mob/struct/' + name + '_' + cat + '.mcfunction'] = rows.join(LF) + LF;
    }
  }
}

// ---------------------------------------------------------------- 3) 群系探测（缓存到快照节拍）
{
  const NB = Object.keys(rosters).length;
  const rows = [
    '# ' + NS + ':biome/detect —— 探测执行者所在群系（写 $snap.biome 为表内序号；每快照节拍一次）',
    '#',
    '# 为什么缓存：逐次刷怪都枚举 ' + NB + ' 个群系太贵；而群系在 20 tick 内几乎不变。',
    '# 未收录的群系保持 0（= 不刷怪），便于作者显式声明允许刷怪的群系。',
    '# v4.17（Q7）：表里可以有非 minecraft 命名空间的地图群系（--worldgen 合并进来的）—— 在表内就能被探测到。',
    'scoreboard players set $snap.biome ' + NS + ' 0',
  ];
  let i = 1;
  const map = {};
  for (const biome of Object.keys(rosters).sort()) {
    rows.push('execute if biome ~ ~ ~ ' + biome + ' run scoreboard players set $snap.biome ' + NS + ' ' + i);
    map[i] = biome;
    i++;
  }
  rows.push('');
  F['data/' + NS + '/function/biome/detect.mcfunction'] = rows.join(LF);
  // v4.16：原版在**候选点**读群系（NaturalSpawner.getRandomSpawnMobAt -> chunkGenerator.getMobsAt(level.getBiome(pos), ...)），
  //   不是玩家脚下的缓存值 => 同一个探测体再出一份写 $sel.biome 的版本，供"本组首次抽物种"时按候选点判定。
  //   代价：表内群系数条 execute if biome × 每组一次（<=3 次/尝试），满吞吐下约 0.4 ms/tick（65 群系时）。
  F['data/' + NS + '/function/biome/detect_at.mcfunction'] = rows.join(LF)
    .split('$snap.biome').join('$sel.biome')
    .split('探测执行者所在群系（写 $snap.biome 为表内序号；每快照节拍一次）').join('探测**当前执行点**所在群系（写 $sel.biome；每组抽物种前一次）');
  // spawn cost 阈值（v4.17 · Q7）：**从 roster 数据推导**，不再硬编码。
  //   原版：Σ(charge_i / r_i) ≤ energy_budget，同一群系内 charge 恒定 ⇒ 化为 Σ(1000/r) ≤ 1000·budget/charge²。
  //   自检：warped_forest(0.12, charge 1.0) → 120、soul_sand_valley(0.15, charge 0.7) → 306
  //         —— 与旧硬编码 COST 表数值一致 ⇒ 原版数据下产物逐字节不变（见 check_static）。
  //   为什么必须推导：地图用 --worldgen 覆盖 spawn_costs（例如 RC4 把这两个群系改成 {}）时，
  //   硬编码会让包体继续按原版阈值拒生成 —— 与地图语义相反，而且不报错（静默）。
  const costThreshold = (biome) => {
    const entries = Object.values(rosters[biome].spawnCosts || {}).filter(Boolean);
    if (!entries.length) return 0;   // 无字段/空表 ⇒ 该群系不适用（0 = 不做 cost 判定）
    const charges = [...new Set(entries.map((c) => c.charge))];
    if (charges.length !== 1 || !charges[0]) {
      console.log('⚠ ' + biome + '：spawn_costs 的 charge 不一致或为 0（' + charges.join('/') + '）⇒ 阈值置 0（每群系单阈值实现，待决）');
      return 0;
    }
    const budgets = [...new Set(entries.map((c) => c.budget))];
    if (budgets.length !== 1) console.log('⚠ ' + biome + '：spawn_costs 的 budget 不一致（' + budgets.join('/') + '）⇒ 取最大值');
    const t = Math.round((1000 * Math.max(...budgets)) / (charges[0] * charges[0]));
    return t > 0 ? t : 1;   // 有 cost 就至少留 1（0 会被 check/cost 当成"不适用"）
  };
  const COST = {};
  for (const biome of Object.keys(rosters)) { const t = costThreshold(biome); if (t) COST[biome] = t; }
  stats.costs = COST;
  F['data/' + NS + '/function/biome/dispatch.mcfunction'] = [
    'scoreboard players set $cost.threshold ' + NS + ' 0',
    '# ' + NS + ':biome/dispatch —— 按探测到的群系调用对应选择表（' + NB + ' 个群系，只命中一个）',
    '',
  ].concat(Object.entries(map).map(([idx, biome]) =>
    'execute if score $sel.biome ' + NS + ' matches ' + idx + ' run function ' + NS + ':mob/biome/' + shortOf(biome)
      + (COST[biome] ? String.fromCharCode(10) + 'execute if score $sel.biome ' + NS + ' matches ' + idx + ' run scoreboard players set $cost.threshold ' + NS + ' ' + COST[biome] : ''),
  )).join(LF) + LF;
  F['data/' + NS + '/biome-index.json'] = JSON.stringify({ note: '$snap.biome 序号到群系的映射', map }, null, 2) + LF;
}

// ---------------------------------------------------------------- 写出
const checkOnly = process.argv.slice(2).includes('--check');
// ---------------------------------------------------------------- v4.23 作者层谓词（只在真用到时生成）
for (const name of entryPredicateIds()) {
  const num = Number(name.slice(9));
  const obj = name.startsWith('light_le_') ? { condition: 'minecraft:location_check', predicate: { light: { light: { max: num } } } }
    : { condition: 'minecraft:location_check', predicate: { light: { light: { min: num } } } };
  F['data/' + NS + '/predicate/author/entry_' + name + '.json'] = JSON.stringify(obj, null, 2) + LF;
}

const drift = [];
for (const [rel, content] of Object.entries(F)) {
  const p = path.join(PACK, ...rel.split('/'));
  if (checkOnly) {
    const old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (old !== content) drift.push(rel);
    continue;
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

// ---------------------------------------------------------------- 清理陈旧文件（v4.18/Q7）
// 为什么必须做：roster 变了以后，上一次构建留下的 mob/biome/<群系>/<类别>.mcfunction 会变成"幽灵物种"——
//   Q7 实测：把 minecraft:plains 覆盖成「只有 husk」后，包里仍留着 creature/ambient/underground_water_creature
//   三份旧表（生成器只写不删），`--check` 也看不出来（它只比对新写的内容，不比对目录里多出来的文件）。
// 范围：只清 mob/biome/**（本生成器独占的 roster 派生目录），不动其它生成器的产物。
const BIOME_DIR = path.join(PACK, 'data', NS, 'function', 'mob', 'biome');
const wanted = new Set(Object.keys(F).filter((k) => k.startsWith('data/' + NS + '/function/mob/biome/')).map((k) => k.replace('data/' + NS + '/function/', '')));
function staleUnder(dir, rel) {
  const extras = [];
  if (!fs.existsSync(dir)) return extras;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name), r = rel ? rel + '/' + name : name;
    if (fs.statSync(p).isDirectory()) extras.push(...staleUnder(p, r));
    else if (!wanted.has(r)) extras.push(r);
  }
  return extras;
}
const stale = staleUnder(BIOME_DIR, 'mob/biome');
if (checkOnly) {
  for (const s of stale) drift.push('(+陈旧文件应删除) ' + s);
  if (stale.length) console.log('陈旧文件 ' + stale.length + ' 个（生成器已不再产出，应删除）: ' + stale.slice(0, 8).join(', '));
} else {
  for (const s of stale) { fs.rmSync(path.join(BIOME_DIR, ...s.split('/').slice(2)), { force: true }); }
  if (stale.length) console.log('已清理陈旧文件 ' + stale.length + ' 个: ' + stale.slice(0, 8).join(', '));
  // 顺带收掉空目录（roster 整个类别消失时）
  const pruneEmpty = (d) => {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) return;
    for (const n of fs.readdirSync(d)) pruneEmpty(path.join(d, n));
    if (d !== BIOME_DIR && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
  };
  pruneEmpty(BIOME_DIR);
}
if (checkOnly) {
  if (drift.length) { console.log('与生成器不一致 (' + drift.length + '):'); for (const d of drift.slice(0, 8)) console.log('  -', d); process.exit(1); }
  console.log('一致：' + Object.keys(F).length + ' 个文件');
} else {
  console.log('=== gen_mobs 完成 ===');
  console.log('输出:', PACK);
  console.log('群系选择表:', stats.biomeFiles, '| 选择行:', stats.rows, '| 类别:', [...stats.categories].sort().join(', '));
  console.log('spawn cost 阈值:', Object.entries(stats.costs || {}).map(([b, t]) => b + '=' + t).join(' ') || '(无)');
  console.log('文件总数:', Object.keys(F).length);
}
