// gen_group.mjs — 生成 doom.nats（v4） 的「finalizeSpawn 组数据层」（SpawnGroupData 复刻）。
//
//   node tools/gen_group.mjs [--check]
//
// 为什么需要这一层（源码事实，见 docs/19）：
//   · /summon 与 execute summon 都会走 SummonCommand.createEntity(..., EntitySpawnReason.COMMAND, true)，
//     其中的 true 就是「对 Mob 调一次 finalizeSpawn(..., groupData = null)」。
//     ⇒ 单只层面的所有 finalizeSpawn 行为（装备、武器、变体、婴儿、鸡骑士、蛛骑骷髅、僵尸首领、
//       山羊尖叫/断角、村民数据、幻翼体型、海龟 home_pos、左手 5%、follow_range 加成）**原版已经跑过**，
//       数据包不需要、也不应该重写一遍。
//   · 真正缺的是 NaturalSpawner 传给 finalizeSpawn 的 **SpawnGroupData**：它把「同一簇」的多只生物
//     绑成一个家庭——共同决定要不要幼年、共用同一个变体、共用同一个药水效果。groupData=null 时这些
//     共享语义全部退化成「每只独立随机」，于是：僵尸不再成组出幼年、狼/狐/美西螈/马/羊驼不再同簇同色、
//     蜘蛛不再同簇同效果、动物永远不会出现崽。
//   ⇒ 本层就是把 SpawnGroupData 搬到计分板/存储上，按 vanilla 的概率与分组语义重放。
//
// 数据来源（全部核对过源码，行号见 docs/19）：
//   AgeableMob.finalizeSpawn          → 成员 2+ 按 babySpawnChance 掷幼年（首个成员恒成年）
//   AgeableMobGroupData(boolean)      → 默认 chance 0.05；AgeableMobGroupData(float) 指定 chance
//   Zombie.finalizeSpawn              → ZombieGroupData(getSpawnAsBabyOdds=5%, canSpawnJockey=true)
//   Spider.finalizeSpawn              → SpiderEffectsGroupData：HARD ∧ rand < 0.1*special ⇒ 效果，组内共享
//   Fox/Axolotl                       → groupSize >= 2 ⇒ 幼年（即成员 3+），组内共享变体
//   Wolf.WolfPackData                 → super(false)：无幼年判定，组内共享变体
//   Rabbit.RabbitGroupData            → super(1.0F)：成员 2+ 恒幼年，组内共享 RabbitType
//   Horse/Llama GroupData             → super(true)=0.05，组内共享 Variant（马还要保留各自的 Markings）
import fs from 'node:fs';
import path from 'node:path';
import * as PKG from './lib/packdir.mjs';
// v4.23 作者规则层：条目里的实体也要有 post/<slug>（宏派发的 id 在运行期拼出，缺文件只会在真机上报错）
import { entryTypes } from './lib/author-rules.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
// v4.24：产物根目录由 lib/packdir.mjs 统一解析（DOOM_EXP=1 ⇒ pack/doom.nats-experimental 实验性变体）
const PACK = PKG.PACK;
const GEN = path.join(ROOT, '_work', 'generated');
const LF = String.fromCharCode(10);
const NS = 'doom.nats';
const F = {};

const slugOf = (type) => type.replace(/^minecraft:/, '');

// ---------------------------------------------------------------- 1) 组数据规格表
// kind:
//   zombie  —— 组内共享婴儿（5%）
//   age     —— 成员 2+ 按 c 掷幼年（首只恒成年）
//   baby3   —— 成员 3+ 恒幼年（fox / axolotl 的 groupSize >= 2）
//   effect  —— 组内共享药水效果（蜘蛛）
//   none    —— 只有（可能的）共享变体
// variant.pick: rabbit / fox / axolotl / wolf / horse / llama
const GROUP = {
  // ---- 僵尸家族：整组同一个婴儿决定 ----
  'minecraft:zombie': { kind: 'zombie' },
  'minecraft:husk': { kind: 'zombie' },
  'minecraft:drowned': { kind: 'zombie' },
  'minecraft:zombie_villager': { kind: 'zombie' },
  'minecraft:zombified_piglin': { kind: 'zombie' },

  // ---- 蜘蛛：整组同一个效果 ----
  'minecraft:spider': { kind: 'effect' },

  // ---- 家畜/动物：默认 chance 0.05 ----
  'minecraft:cow': { kind: 'age', c: 0.05 },
  'minecraft:mooshroom': { kind: 'age', c: 0.05 },
  'minecraft:sheep': { kind: 'age', c: 0.05 },
  'minecraft:pig': { kind: 'age', c: 0.05 },
  'minecraft:chicken': { kind: 'age', c: 0.05 },
  'minecraft:cat': { kind: 'age', c: 0.05 },
  'minecraft:frog': { kind: 'age', c: 0.05 },
  'minecraft:bee': { kind: 'age', c: 0.05 },
  'minecraft:goat': { kind: 'age', c: 0.05 },
  'minecraft:turtle': { kind: 'age', c: 0.05 },
  'minecraft:camel': { kind: 'age', c: 0.05 },
  'minecraft:armadillo': { kind: 'age', c: 0.05 },
  'minecraft:sniffer': { kind: 'age', c: 0.05 },
  'minecraft:squid': { kind: 'age', c: 0.05 },
  'minecraft:glow_squid': { kind: 'age', c: 0.05 },
  // ---- 显式 chance（源码里写死的那些） ----
  'minecraft:dolphin': { kind: 'age', c: 0.1 },
  'minecraft:panda': { kind: 'age', c: 0.2 },
  'minecraft:strider': { kind: 'age', c: 0.5 },
  'minecraft:polar_bear': { kind: 'age', c: 1.0 },
  'minecraft:ocelot': { kind: 'age', c: 1.0 },

  // ---- 共享变体（+ 幼年规则） ----
  'minecraft:rabbit': { kind: 'age', c: 1.0, variant: { key: 'RabbitType', kind: 'int', pick: 'rabbit' } },
  'minecraft:fox': { kind: 'baby3', variant: { key: 'Type', kind: 'str', pick: 'fox' } },
  'minecraft:axolotl': { kind: 'baby3', variant: { key: 'Variant', kind: 'int', pick: 'axolotl' } },
  'minecraft:wolf': { kind: 'none', variant: { key: 'variant', kind: 'str', pick: 'wolf' } },
  'minecraft:horse': { kind: 'age', c: 0.05, variant: { key: 'Variant', kind: 'horsemerge', pick: 'horse' } },
  'minecraft:llama': { kind: 'age', c: 0.05, variant: { key: 'Variant', kind: 'int', pick: 'llama' } },

  // ---- 显式"无组数据"（源码里传 false / 不是 AgeableMob） ----
  'minecraft:parrot': { kind: 'none' },
  'minecraft:trader_llama': { kind: 'none' },
  'minecraft:villager': { kind: 'none' },
  'minecraft:wandering_trader': { kind: 'none' },
  'minecraft:allay': { kind: 'none' },
  'minecraft:bat': { kind: 'none' },
  'minecraft:cod': { kind: 'none' },
  'minecraft:salmon': { kind: 'none' },          // SchoolSpawnGroupData：只影响"跟队"，无婴儿
  'minecraft:tropical_fish': { kind: 'none' },
  'minecraft:pufferfish': { kind: 'none' },
};

// 变体选择的群系条件（与 vanilla 变体注册表 spawn_conditions 一一对应）
// VAR_FALLBACK = grp/init 写入的"兜底值"（= vanilla 无群系条件命中时的默认分支）：
//   grp/mem/<slug> 是宏函数，$(v) 必须在实例化前存在；兜底值保证"跳过首只掷骰"的调用路径也不失效。
const VAR_FALLBACK = { rabbit: 0, fox: 'red', axolotl: 0, wolf: 'pale', horse: 0, llama: 0 };
const BIOME_COND = {
  spawns_white_rabbits: { tag: '#minecraft:spawns_white_rabbits' },
  spawns_gold_rabbits: { tag: '#minecraft:spawns_gold_rabbits' },
  spawns_snow_foxes: { tag: '#minecraft:spawns_snow_foxes' },
  wolf_snowy: { biome: 'minecraft:grove' },
  wolf_ashen: { biome: 'minecraft:snowy_taiga' },
  wolf_black: { biome: 'minecraft:old_growth_pine_taiga' },
  wolf_chestnut: { biome: 'minecraft:old_growth_spruce_taiga' },
  wolf_rusty: { tag: '#minecraft:is_jungle' },
  wolf_spotted: { tag: '#minecraft:is_savanna' },
  wolf_striped: { tag: '#minecraft:is_badlands' },
  wolf_woods: { biome: 'minecraft:forest' },
};
for (const [name, spec] of Object.entries(BIOME_COND)) {
  F['data/' + NS + '/predicate/grp/biome/' + name + '.json'] = JSON.stringify({
    condition: 'minecraft:location_check',
    predicate: { biomes: spec.tag ?? [spec.biome] },
  }, null, 2) + LF;
}

// ---------------------------------------------------------------- 2) 共享变体：**首只真正生成时**掷一次（v4.17 对齐原版）
//
// 源码依据（_work/decomp/out/net/minecraft/world/level/NaturalSpawner.java）：
//   :186  $$17 = $$26.finalizeSpawn(level, level.getCurrentDifficultyAt($$26.blockPosition()), NATURAL, $$17)
//   该行在 `isValidPositionForMob($$1, $$26, $$24)`（:254）通过之后才执行 ⇒ 组数据（SpawnGroupData）由
//   **本组第一只真正生成成功的个体**创建，取位置用的是那只个体的 `blockPosition()`（= 它的生成点）。
//   旧实现把变体掷骰放在 `grp/init`（= 本组首个抽中物种的候选点）⇒ 与原文相差"首个被否掉的候选点 + 组内随机游走"
//   的几格，在群系边界上会选错变体。现在：grp/init 只置 `$grp.vneed=1`，掷骰推迟到 grp/mem 的 `$grp.mem==0` 分支
//   （此时 @s = 刚生成的那只，执行位置 = 它的生成点），语义仍是"每组一次"。
// 写 storage doom.nats:grp v（int 或 string，取决于键的类型）
function variantRollLines(pick) {
  const L = [];
  L.push('# 组内共享变体：由本组**第一只真正生成**的个体在其生成点决定（其余沿用首只结果）');
  if (pick === 'rabbit') {
    // getRandomRabbitVariant：白兔群系 80/20；金兔群系恒 gold；其余 50/40/10
    L.push('scoreboard players set $grp.vset ' + NS + ' 0');
    L.push('execute if predicate ' + NS + ':grp/biome/spawns_white_rabbits unless score $grp.vset ' + NS + ' matches 1 run execute store result score $grp.t ' + NS + ' run random value 1..100');
    L.push('execute if predicate ' + NS + ':grp/biome/spawns_white_rabbits unless score $grp.vset ' + NS + ' matches 1 if score $grp.t ' + NS + ' matches ..80 run data modify storage ' + NS + ':grp v set value 1');
    L.push('execute if predicate ' + NS + ':grp/biome/spawns_white_rabbits unless score $grp.vset ' + NS + ' matches 1 if score $grp.t ' + NS + ' matches 81.. run data modify storage ' + NS + ':grp v set value 3');
    L.push('execute if predicate ' + NS + ':grp/biome/spawns_white_rabbits run scoreboard players set $grp.vset ' + NS + ' 1');
    L.push('execute if predicate ' + NS + ':grp/biome/spawns_gold_rabbits unless score $grp.vset ' + NS + ' matches 1 run data modify storage ' + NS + ':grp v set value 4');
    L.push('execute if predicate ' + NS + ':grp/biome/spawns_gold_rabbits run scoreboard players set $grp.vset ' + NS + ' 1');
    L.push('execute if score $grp.vset ' + NS + ' matches 0 run execute store result score $grp.t ' + NS + ' run random value 1..100');
    L.push('execute if score $grp.vset ' + NS + ' matches 0 if score $grp.t ' + NS + ' matches ..50 run data modify storage ' + NS + ':grp v set value 0');
    L.push('execute if score $grp.vset ' + NS + ' matches 0 if score $grp.t ' + NS + ' matches 51..90 run data modify storage ' + NS + ':grp v set value 5');
    L.push('execute if score $grp.vset ' + NS + ' matches 0 if score $grp.t ' + NS + ' matches 91.. run data modify storage ' + NS + ':grp v set value 2');
  } else if (pick === 'fox') {
    L.push('data modify storage ' + NS + ':grp v set value "red"');
    L.push('execute if predicate ' + NS + ':grp/biome/spawns_snow_foxes run data modify storage ' + NS + ':grp v set value "snow"');
  } else if (pick === 'axolotl') {
    // getCommonSpawnVariant：在 common=true 的变体里均匀抽（lucy 0 / wild 1 / gold 2 / cyan 3）
    L.push('execute store result storage ' + NS + ':grp v int 1 run random value 0..3');
  } else if (pick === 'wolf') {
    // wolf_variant 注册表：优先级 1 的 8 条（群系互斥）→ 否则 pale
    L.push('data modify storage ' + NS + ':grp v set value "pale"');
    for (const [cond, id] of [['wolf_woods', 'woods'], ['wolf_snowy', 'snowy'], ['wolf_ashen', 'ashen'], ['wolf_black', 'black'],
      ['wolf_chestnut', 'chestnut'], ['wolf_rusty', 'rusty'], ['wolf_spotted', 'spotted'], ['wolf_striped', 'striped']]) {
      L.push('execute if predicate ' + NS + ':grp/biome/' + cond + ' run data modify storage ' + NS + ':grp v set value "' + id + '"');
    }
  } else if (pick === 'horse') {
    // Horse.finalizeSpawn：Util.getRandom(Variant.values()) = 7 种均匀；Markings 每只各自再抽（vanilla 管）
    L.push('execute store result storage ' + NS + ':grp v int 1 run random value 0..6');
  } else if (pick === 'llama') {
    // Llama.finalizeSpawn：Util.getRandom(Llama.Variant.values()) = creamy/white/brown/gray 均匀
    L.push('execute store result storage ' + NS + ':grp v int 1 run random value 0..3');
  }
  return L;
}

// ---------------------------------------------------------------- 3) 组初始化函数（每组一次）
const initLines = (type) => {
  const spec = GROUP[type];
  const L = [
    '# ' + NS + ':grp/init/' + slugOf(type) + ' —— 一组开始时的组数据（SpawnGroupData 复刻）',
    '# 由 spawn/pick_one 在"本组首次抽中物种"后调用一次；@s 无意义，位置=候选点。',
    '',
    'scoreboard players set $grp.mem ' + NS + ' 0',
    '# $grp.vneed：本组是否还欠一次"首只变体掷骰"（v4.17）；1 ⇒ 由 grp/mem 的首只分支消费',
    'scoreboard players set $grp.vneed ' + NS + ' 0',
  ];
  if (spec.kind === 'zombie') {
    L.push('# ZombieGroupData(getSpawnAsBabyOdds(rand), canSpawnJockey=true)：整组同一个婴儿决定（5%）');
    L.push('execute store result score $grp.r ' + NS + ' run random value 1..100');
    L.push('execute if score $grp.r ' + NS + ' matches ..5 run scoreboard players set $grp.baby ' + NS + ' 1');
    L.push('execute if score $grp.r ' + NS + ' matches 6.. run scoreboard players set $grp.baby ' + NS + ' 0');
  } else if (spec.kind === 'effect') {
    L.push('# SpiderEffectsGroupData：HARD ∧ rand < 0.1*special ⇒ 整组同一个效果（nextInt(5)：0,1 速度 2 力量 3 再生 4 隐身）');
    L.push('scoreboard players set $grp.fx ' + NS + ' 0');
    L.push('data remove storage ' + NS + ':grp fx');
    L.push('execute if score $cfg.difficulty ' + NS + ' matches 3 run execute store result score $grp.r ' + NS + ' run random value 1..10000');
    L.push('execute if score $cfg.difficulty ' + NS + ' matches 3 if score $grp.r ' + NS + ' <= $cfg.special_x10 ' + NS + ' run execute store result score $grp.t ' + NS + ' run random value 0..4');
    L.push('execute if score $cfg.difficulty ' + NS + ' matches 3 if score $grp.r ' + NS + ' <= $cfg.special_x10 ' + NS + ' if score $grp.t ' + NS + ' matches 0..1 run data modify storage ' + NS + ':grp fx set value "speed"');
    L.push('execute if score $cfg.difficulty ' + NS + ' matches 3 if score $grp.r ' + NS + ' <= $cfg.special_x10 ' + NS + ' if score $grp.t ' + NS + ' matches 2 run data modify storage ' + NS + ':grp fx set value "strength"');
    L.push('execute if score $cfg.difficulty ' + NS + ' matches 3 if score $grp.r ' + NS + ' <= $cfg.special_x10 ' + NS + ' if score $grp.t ' + NS + ' matches 3 run data modify storage ' + NS + ':grp fx set value "regeneration"');
    L.push('execute if score $cfg.difficulty ' + NS + ' matches 3 if score $grp.r ' + NS + ' <= $cfg.special_x10 ' + NS + ' if score $grp.t ' + NS + ' matches 4 run data modify storage ' + NS + ':grp fx set value "invisibility"');
  }
  if (spec.variant) {
    L.push('# 共享变体**不在这里掷**（v4.17）：原版 groupData 由"首只真正生成的个体"创建，位置也取那只的');
    L.push('#   blockPosition ⇒ 掷骰推迟到 ' + NS + ':grp/var/' + slugOf(type) + '（由 post/' + slugOf(type) + ' 在调用 grp/mem 之前调用）');
    L.push('# 但这里必须留一个**合法兜底值**：grp/mem/<slug> 是宏函数，$(v) 在**实例化那一刻**就必须存在');
    L.push('#   （否则 Missing argument v ⇒ 整个 grp/mem 失效：婴儿/幼年/效果都不施加）。兜底值取 vanilla 在');
    L.push('#   "没有群系条件命中"时的默认分支；真实链路里首只生成时会被 grp/var/<slug> 覆盖。');
    L.push('#   为什么需要它：测试/作者可能直接以"成员 2+"身份调 post/<slug>（跳过 $grp.mem==0 那一只），');
    L.push('#   此时 grp/var 不跑 —— 有兜底值就不会整函数失效。');
    L.push('data modify storage ' + NS + ':grp v set value ' + JSON.stringify(VAR_FALLBACK[spec.variant.pick]));
    L.push('scoreboard players set $grp.vneed ' + NS + ' 1');
  }
  return L;
};

// ---------------------------------------------------------------- 4) 成员级施加（每只生成时）
const memLines = (type) => {
  const spec = GROUP[type];
  const L = [
    '# ' + NS + ':grp/mem/' + slugOf(type) + ' —— 成员级组数据施加（@s = 刚生成的那只）',
    '# 由 ' + NS + ':post/' + slugOf(type) + ' 在 execute summon 的上下文里调用。',
    '',
  ];
  if (spec.kind === 'zombie') {
    L.push('execute if score $grp.baby ' + NS + ' matches 1 run data merge entity @s {IsBaby:1b}');
    L.push('# 非婴儿组要显式清零：execute summon 走的 finalizeSpawn 拿的是 null 组数据，会**每只**独立掷 5%');
    L.push('execute if score $grp.baby ' + NS + ' matches 0 run data merge entity @s {IsBaby:0b}');
  } else if (spec.kind === 'age') {
    const t = Math.round(spec.c * 10000);
    L.push('# AgeableMobGroupData(' + spec.c + ')：首只恒成年，之后每只掷一次');
    L.push('# 幼年态用 Age:-24000（AgeableMob 的存档键是 int Age；IsBaby 只有僵尸系自己实现）');
    if (t >= 10000) {
      L.push('execute if score $grp.mem ' + NS + ' matches 1.. run data merge entity @s {Age:-24000}');
    } else {
      L.push('execute if score $grp.mem ' + NS + ' matches 1.. run execute store result score $grp.r ' + NS + ' run random value 1..10000');
      L.push('execute if score $grp.mem ' + NS + ' matches 1.. if score $grp.r ' + NS + ' matches ..' + t + ' run data merge entity @s {Age:-24000}');
    }
  } else if (spec.kind === 'baby3') {
    L.push('# 源码：groupSize >= 2 ⇒ setAge(-24000)（首只在检查时 groupSize=0 ⇒ 成员 3+ 恒幼年）');
    L.push('execute if score $grp.mem ' + NS + ' matches 2.. run data merge entity @s {Age:-24000}');
  } else if (spec.kind === 'effect') {
    L.push('execute if data storage ' + NS + ':grp fx run function ' + NS + ':grp/fx_apply with storage ' + NS + ':grp');
  }
  if (spec.variant) {
    const v = spec.variant;
    L.push('# 组内共享变体：**首只真正生成时**在它的生成点掷一次（v4.17），其余沿用首只的结果');
    L.push('#   ⚠ 掷骰**不在这里**：本函数是**宏函数**，$(v) 在**实例化时**就必须存在（否则 Missing argument v，');
    L.push('#     整函数失效、组数据不施加）。⇒ 由调用方 ' + NS + ':post/' + slugOf(type)
      + ' 在 `function ...grp/mem... with storage` **之前**调用 grp/var/' + slugOf(type) + '。');
    L.push('#     grp/init 已写入兜底值 ⇒ 即使跳过首只（直接以成员 2+ 身份调本函数）也不会整函数失效。');
    if (v.kind === 'str') L.push('$data merge entity @s {' + v.key + ':"$(v)"}');
    else if (v.kind === 'int') L.push('$data merge entity @s {' + v.key + ':$(v)}');
    else if (v.kind === 'horsemerge') {
      L.push('# 马：Variant 是"变体 | 纹样<<8"的合成值，只替换低 8 位，保留每只各自的 Markings');
      L.push('scoreboard players set #256 ' + NS + ' 256');
      L.push('execute store result score $h.cur ' + NS + ' run data get entity @s Variant');
      L.push('scoreboard players operation $h.m ' + NS + ' = $h.cur ' + NS);
      L.push('scoreboard players operation $h.m ' + NS + ' /= #256 ' + NS);
      L.push('scoreboard players operation $h.m ' + NS + ' %= #256 ' + NS);
      L.push('scoreboard players operation $h.m ' + NS + ' *= #256 ' + NS);
      L.push('execute store result score $h.v ' + NS + ' run data get storage ' + NS + ':grp v');
      L.push('scoreboard players operation $h.m ' + NS + ' += $h.v ' + NS);
      L.push('execute store result storage ' + NS + ':grp h int 1 run scoreboard players get $h.m ' + NS);
      L.push('# $(h) 是**每只各自**的值（各自的 Markings）⇒ 必须单独用一个宏函数，在写完 h 之后调用；');
      L.push('#   直接写成本函数的宏行会拿到上一只的 h（实例化早于函数体执行）——v4.16 的首只马正是因此整函数失效。');
      L.push('function ' + NS + ':grp/apply/' + slugOf(type) + ' with storage ' + NS + ':grp');
    }
  }
  L.push('scoreboard players add $grp.mem ' + NS + ' 1');
  return L;
};

// 效果施加（宏用 doom.nats:grp 存储，$(fx) 只在 spider 组里存在）
F['data/' + NS + '/function/grp/fx_apply.mcfunction'] = [
  '# ' + NS + ':grp/fx_apply [MACRO] —— 施加组内共享效果（MobEffectInstance(effect, -1)：无限时长、amplifier 0）',
  '# 用法：function ' + NS + ':grp/fx_apply with storage ' + NS + ':grp',
  '$data merge entity @s {active_effects:[{id:"minecraft:$(fx)",amplifier:0b,duration:-1,ambient:0b,show_particles:1b,show_icon:1b}]}',
  '',
].join(LF);

// ---------------------------------------------------------------- 5) 生成 post/<slug> + grp/init/<slug> + grp/mem/<slug>
const mobsDoc = JSON.parse(fs.readFileSync(path.join(GEN, 'mobs.json'), 'utf8'));
const FORTRESS_TYPES = ['minecraft:blaze', 'minecraft:zombified_piglin', 'minecraft:wither_skeleton', 'minecraft:skeleton', 'minecraft:magma_cube'];
const types = [...new Set([...Object.keys(mobsDoc.mobs), ...FORTRESS_TYPES, ...entryTypes()])].sort();

const initRows = [
  '# ' + NS + ':grp/init [MACRO] —— 组数据初始化派发（按物种）',
  '# 用法：function ' + NS + ':grp/init with storage ' + NS + ':sel',
  '# 调用点：spawn/pick_one —— 本组首次抽中物种之后（清 $grp.inited 见 spawn/group）',
  '# ⚠ 共享变体**不在本层掷**（v4.17）：见 grp/var/<slug>，由 grp/mem 在本组首只真正生成时调用',
  '$function ' + NS + ':grp/init/$(slug) with storage ' + NS + ':sel',
  '',
];

const stats = { group: 0, variant: 0, effect: 0 };
for (const type of types) {
  const slug = slugOf(type);
  const spec = GROUP[type] ?? { kind: 'none' };
  // post：本包 NBT + 全局持久化 +（可选）组数据
  const post = [
    '# ' + NS + ':post/' + slug + ' —— 生成后的收尾（execute summon 的 run 目标，@s = 新生成的那只）',
    '#',
    '# 为什么不是"重写 finalizeSpawn"：execute summon → SummonCommand.createEntity(..., COMMAND, true)',
    '#   内部已经替我们跑过 vanilla 的 finalizeSpawn（含装备/变体/婴儿/骑士/属性）。这里只补三件事：',
    '#   ① 本包标签与规则 NBT（原来的 summon NBT 参数）② 全局持久化开关 ③ 组数据（SpawnGroupData）',
    '$data merge entity @s $(nbt)',
    'execute if score $cfg.persist ' + NS + ' matches 1 run data merge entity @s {PersistenceRequired:1b}',
    '# 朝向：rot 由 spawn/emit 掷好（宏参数必须在本函数实例化前就位）——此处只负责施加',
    '$tp @s ~ ~ ~ $(rot) 0',
  ];
  if (spec.kind !== 'none' || spec.variant) {
    post.push('# ③a 共享变体的"首只掷骰"：**必须在 grp/mem 实例化之前**跑完 —— grp/mem 是宏函数，');
    post.push('#     它的 $(v) 在实例化的那一刻就要存在，否则整函数失效（Missing argument v）。');
    post.push('#     位置语义不变：本函数由 execute summon 的 run 调用，@s = 刚生成的那只 ⇒ 用它的生成点求值。');
    if (spec.variant) post.push('function ' + NS + ':grp/var/' + slug);
    post.push('# ③b 组数据（成员级；$grp.mem 在函数末尾自增，故"首只/成员 2+/成员 3+"判定天然对齐原版）');
    // 参数源必须是 grp 存储：组数据里的 v/fx 都写在那里（写 sel 会让变体行缺 $(v) ⇒ 整函数实例化失败）
    post.push('function ' + NS + ':grp/mem/' + slug + ' with storage ' + NS + ':grp');
  } else {
    post.push('# ③ 该物种在原版不参与 SpawnGroupData（或只有跟队语义）⇒ 无组数据');
  }
  post.push('');
  F['data/' + NS + '/function/post/' + slug + '.mcfunction'] = post.join(LF);

  // grp/init + grp/mem：即使无组数据也生成（派发用），内容为说明性空函数
  const L = spec.kind === 'none' && !spec.variant
    ? ['# ' + NS + ':grp/init/' + slug + ' —— 该物种无 SpawnGroupData（占位，派发用）', '', 'scoreboard players set $grp.mem ' + NS + ' 0', '']
    : [...initLines(type), ''];
  F['data/' + NS + '/function/grp/init/' + slug + '.mcfunction'] = L.join(LF);
  if (spec.variant) {
    // 掷骰的守卫写进 grp/var 自身（它是**非宏**函数）：只有"本组第一只"（$grp.mem==0）且还欠一次
    // （$grp.vneed==1，由 grp/init 置位）时才真的掷，掷完消费标记 ⇒ 语义仍是"每组一次"。
    const VG = 'execute if score $grp.vneed ' + NS + ' matches 1 run ';
    F['data/' + NS + '/function/grp/var/' + slug + '.mcfunction'] = [
      '# ' + NS + ':grp/var/' + slug + ' —— 共享变体的首次掷骰（v4.17：首只真正生成时、在它的生成点求值）',
      '# 调用点：' + NS + ':post/' + slug + '（**在调用 grp/mem 之前**，见那里的 ③a 注释）。@s = 刚生成的那只。',
      '# 守卫：$grp.vneed==1（由 grp/init 置位，掷完消费）⇒ 严格"每组一次"。',
      '#   ⚠ 不额外要求 $grp.mem==0：真实链路里"本组第一只"就是 $grp.mem==0 的那次调用；',
      '#     但测试/作者可能直接以"成员 2+"身份调 post/<slug>（mem 已经非 0），若在这里拦一道，',
      '#     $(v) 就只能靠兜底值 —— 那会让断言失去区分度。语义上"首次 post 调用"即"首只生成"。',
      '# 为什么放这里：原版 groupData 由首只创建，掷骰用的群系/位置都是那只个体的 blockPosition',
      '#   （NaturalSpawner.java:186 在 isValidPositionForMob(:254) 之后）。',
      '',
      ...variantRollLines(spec.variant.pick).map((l) => (l.startsWith('#') ? l : VG + l)),
      '# 消费掉"欠一次"标记：其余成员只会沿用上面掷出的结果',
      VG + 'scoreboard players set $grp.vneed ' + NS + ' 0',
      '',
    ].join(LF);
  }
  if (spec.variant && spec.variant.kind === 'horsemerge') {
    // 马的合成值 $(h) 是**每只各自**的（Variant 低 8 位换成组变体，保留各自的 Markings）⇒ 不能写进
    // grp/mem 的宏行（宏在实例化那刻展开，只会拿到上一只的 h）。单独成函数，在 h 写完后调用。
    F['data/' + NS + '/function/grp/apply/' + slug + '.mcfunction'] = [
      '# ' + NS + ':grp/apply/' + slug + ' [MACRO] —— 把合成后的变体写进实体（$(h) 由调用方先写进 grp 存储）',
      '# 调用点：' + NS + ':grp/mem/' + slug + '（h 算完之后）',
      '$data merge entity @s {' + spec.variant.key + ':$(h)}',
      '',
    ].join(LF);
  }
  if (spec.kind !== 'none' || spec.variant) {
    F['data/' + NS + '/function/grp/mem/' + slug + '.mcfunction'] = [...memLines(type), ''].join(LF);
    stats.group++;
    if (spec.variant) stats.variant++;
    if (spec.kind === 'effect') stats.effect++;
  }
  initRows.push('# ' + slug + ' → ' + spec.kind + (spec.variant ? ' +variant(' + spec.variant.pick + ')' : ''));
}
F['data/' + NS + '/function/grp/init.mcfunction'] = initRows.join(LF) + LF;

// ---------------------------------------------------------------- 6) 写出
const checkOnly = process.argv.slice(2).includes('--check');
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
if (checkOnly) {
  if (drift.length) { console.log('与生成器不一致:'); for (const d of drift) console.log('  -', d); process.exit(1); }
  console.log('一致：' + Object.keys(F).length + ' 个文件');
} else {
  console.log('=== gen_group 完成 ===');
  console.log('输出:', PACK, '| 文件:', Object.keys(F).length, '| 带组数据物种:', stats.group, '(含共享变体', stats.variant, '/共享效果', stats.effect, ')');
  console.log('链路: pick_one → grp/init → emit(execute summon) → post/<slug> → grp/mem/<slug>');
}
