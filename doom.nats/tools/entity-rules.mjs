// tools/lib/entity-rules.mjs —— 逐实体刷怪规则表（1.21.6 源码逐条对照，v4.13）
//
// 证据来源：
//   · 规则速览（自动生成）：doom.nats/_work/ref/spawn-rules-digest.txt
//   · 注册表出处：net.minecraft.world.entity.SpawnPlacements 静态块（82 条 register）
//   · 各谓词实现：out3/out4 反编译产物里对应的 check*SpawnRules 方法
//   · 数据侧：vanilla 方块标签（animals_spawnable_on / foxes_spawnable_on / …）
//             与群系标签（allows_surface_slime_spawns / reduce_water_ambient_spawns / …）
//
// 用法：gen_ctm_mobs.mjs 把每条规则写进 roster 行的 $sel.*；gen_ctm_check.mjs 按规则生成 check/block 与 check/entity。
//
// 字段说明
//   place : ground       → 通用陆生（脚/头为空位 + 下方可站立）
//           any          → 无落位限制（NO_RESTRICTIONS，只查脚/头空位）
//           water        → IN_WATER（位置是水；上方不是红石导体）
//           water_surface→ IN_WATER + 水面窗口（seaLevel-13 ≤ y ≤ seaLevel，下方是水，上方是水）
//           below_tag    → 通用陆生 + 下方必须属于某个 vanilla 方块标签（动物族）
//           lava         → IN_LAVA（位置是岩浆；炽足兽另查"上方岩浆直到空气"）
//   light : none    → 无光照要求
//           dark    → 综合亮度 ≤ $eff.light 档（怪物：Monster.isDarkEnoughToSpawn 的档位近似）
//           bright  → 综合亮度 ≥ 9（Animal.isBrightEnoughToSpawn / getRawBrightness(pos,0) > 8）
//           bat     → 亮度 ≤ 3（万圣节 7）+ 50% 掷币（Bat.checkBatSpawnRules）
//           slime   → 50% 掷币 + 月相掷币 + 亮度 ≤ 7（Slime.checkSlimeSpawnRules）
//           glow    → 亮度必须为 0（GlowSquid.checkGlowSquidSpawnRules）
//           bl8     → 方块光 ≤ 8 的近似（PatrollingMonster：掠夺者巡逻队）
//   coins : half(50%) / moon(月相) / 2of3 / 1of15 / 1of20 / 1of40
//   cluster: getMaxSpawnClusterSize（源码实测：仅 8 个类覆写，其余默认 4）
//   persist: true → 生成的生物带 PersistenceRequired:1b（**原版语义**：该 NBT 为真时 Mob.checkDespawn 直接跳过，
//            永不消失）。默认 false —— 本包召出的是普通生物，交给原版消失逻辑（docs/17 第五节）。
//            另有一个全局运行时开关 $cfg.persist（见 cfg 层）覆盖"全部生成物都持久"的场景。
// 实体尺寸（width/height）来自 EntityType 静态注册的 Builder.sized(w,h)，
// 由 _work/extract_hitboxes.mjs 从反编译产物抽取 → _work/generated/hitboxes.json。
// 用途：原版 isValidSpawnPostitionForType 最后一步是 level.noCollision(type.getSpawnAABB(...))，
//       AABB 以方块中心为原点、按 width 向两侧各展开 width/2 ⇒ width > 1 的实体会跨进相邻方块。
import fsLib from 'node:fs';
import pathLib from 'node:path';
// v4.23 作者规则层：默认空白 ⇒ applyPatches 是恒等变换（产物逐字节不变）。
// 规则补丁在**模块初始化时**并进 ENTITY_RULES，之后 ruleOf/ruleKeyOf/buildRuleTable 自动带上补丁。
import { applyPatches, belowAnyOf } from './author-rules.mjs';
const _hbPath = pathLib.resolve(import.meta.dirname, '..', '..', '_work', 'generated', 'hitboxes.json');
const HITBOXES = fsLib.existsSync(_hbPath) ? JSON.parse(fsLib.readFileSync(_hbPath, 'utf8')).hitboxes : {};
export const sizeOf = (type) => HITBOXES[type] ?? { width: 0.6, height: 1.8 };
export const isWide = (type) => sizeOf(type).width > 1.0;      // 跨进相邻方块
export const isWide2 = (type) => sizeOf(type).width > 2.0;     // 跨两格（恶魂 4.0）
export const isTall = (type) => sizeOf(type).height > 2.0;     // 需要第三格净空（末影人 2.9 / 骆驼 2.375）

export const PLACE = { ground: 0, any: 1, water: 2, water_surface: 3, below_tag: 4, lava: 5 };
export const LIGHT = { none: 0, dark: 1, bright: 2, bat: 3, slime: 4, glow: 5, bl8: 6 };

// 下方方块标签（vanilla 原标签，直接用 `if block ~ ~-1 ~ #…` 判定）
export const BELOW_TAGS = [
  'minecraft:animals_spawnable_on',      // 1
  'minecraft:foxes_spawnable_on',        // 2
  'minecraft:rabbits_spawnable_on',      // 3
  'minecraft:wolves_spawnable_on',       // 4
  'minecraft:goats_spawnable_on',        // 5
  'minecraft:camels_spawnable_on',       // 6
  'minecraft:armadillo_spawnable_on',    // 7
  'minecraft:parrots_spawnable_on',      // 8
  'minecraft:frogs_spawnable_on',        // 9
  'minecraft:mooshrooms_spawnable_on',   // 10
  'minecraft:axolotls_spawnable_on',     // 11
  'minecraft:bats_spawnable_on',         // 12
  'minecraft:polar_bears_spawnable_on_alternate', // 13
  'minecraft:sand',                      // 14（海龟：TurtleEggBlock.onSand）
];
export const tagId = (id) => BELOW_TAGS.indexOf(id) + 1;

const ANIMALS = 'minecraft:animals_spawnable_on';

// 下界要塞固定表里的实体（NetherFortressStructure.FORTRESS_ENEMIES）：
// 它们不在任何群系 roster 里，但也要进规则表（否则默认规则会套错光照）
// v4.17（P1-6）：结构 spawn_overrides 里的实体同理 —— guardian/pillager/cat/witch **只**从结构覆盖表里来
//   （原版群系 spawners 里没有它们），所以也必须显式加进来，否则它们的 `$sel.rule` 会写成 undefined
//   ⇒ `scoreboard players set $sel.rule doom.nats undefined` 直接让整张表**加载失败**（真机抓到）。
export const EXTRA_RULE_TYPES = [
  'minecraft:blaze', 'minecraft:wither_skeleton', 'minecraft:zombified_piglin', 'minecraft:skeleton', 'minecraft:magma_cube',
  'minecraft:guardian', 'minecraft:pillager', 'minecraft:cat', 'minecraft:witch',
];

// ------------------------------------------------------------------ 规则表
// 每条：{ place, light, tag?, coins?, sky?, notWart?, deep?, river98?, d64?, noPlayer5?, ySea?, yTurtle?, lavaToAir?, grp1?, cluster? }
export const ENTITY_RULES = {
  // ---------- 怪物（暗） ----------
  'minecraft:zombie': { place: 'ground', light: 'dark' },
  'minecraft:zombie_villager': { place: 'ground', light: 'dark' },
  'minecraft:skeleton': { place: 'ground', light: 'dark' },
  'minecraft:bogged': { place: 'ground', light: 'dark' },
  'minecraft:creeper': { place: 'ground', light: 'dark' },
  'minecraft:spider': { place: 'ground', light: 'dark' },
  'minecraft:enderman': { place: 'ground', light: 'dark' },
  'minecraft:witch': { place: 'ground', light: 'dark' },
  'minecraft:husk': { place: 'ground', light: 'dark', sky: true },              // + canSeeSky
  'minecraft:stray': { place: 'ground', light: 'dark', sky: true },             // + canSeeSky（粉雪之上）
  'minecraft:drowned': { place: 'water', light: 'dark', coins: ['1of40'], deep: true, moreDrowned: '1of15' },
  'minecraft:slime': { place: 'ground', light: 'slime', coins: ['half', 'moon'], biome: 'slime' },

  // ---------- 环境（蝙蝠：低于地表 + 亮度 ≤ 3 + 50% 掷币 + 下方必须是石头族） ----------
  'minecraft:bat': { place: 'below_tag', tag: 'minecraft:bats_spawnable_on', light: 'bat', coins: ['half'], belowSurface: true },

  // ---------- 怪物（不限光） ----------
  'minecraft:magma_cube': { place: 'ground', light: 'none' },                   // 只查难度
  'minecraft:blaze': { place: 'ground', light: 'none' },                        // Monster.checkAnyLightMonsterSpawnRules
  'minecraft:wither_skeleton': { place: 'ground', light: 'dark' },              // Monster.checkMonsterSpawnRules
  'minecraft:ghast': { place: 'ground', light: 'none', coins: ['1of20'], cluster: 1 },
  'minecraft:zombified_piglin': { place: 'ground', light: 'none', notWart: true },
  'minecraft:piglin': { place: 'ground', light: 'none', notWart: true },
  'minecraft:hoglin': { place: 'ground', light: 'none', notWart: true },
  'minecraft:ocelot': { place: 'ground', light: 'none', coins: ['2of3'] },      // 无光照要求（源码如此）
  'minecraft:guardian': { place: 'water', light: 'none', coins: ['1of20'], noSky: true },
  // v4.17（P1-6）：掠夺者只从 pillager_outpost 的 spawn_overrides 来（pale 除外，巡逻队是另一套机制）
  //   Monster.checkMonsterSpawnRules ⇒ 通用陆生 + 暗（与原版其它怪物一致）
  'minecraft:pillager': { place: 'ground', light: 'dark' },

  // ---------- 水生 ----------
  'minecraft:cod': { place: 'water_surface', light: 'none', river98: true, d64: true },
  'minecraft:pufferfish': { place: 'water_surface', light: 'none', river98: true, d64: true },
  'minecraft:salmon': { place: 'water_surface', light: 'none', river98: true, d64: true },
  'minecraft:tropical_fish': { place: 'water_surface', light: 'none', river98: true, d64: true, grp1: true, cluster: 8 },
  'minecraft:squid': { place: 'water_surface', light: 'none' },
  'minecraft:dolphin': { place: 'water_surface', light: 'none' },
  'minecraft:glow_squid': { place: 'water', light: 'glow', ySea: -33 },         // y ≤ seaLevel-33 且亮度 0 且是水
  'minecraft:axolotl': { place: 'below_tag', tag: 'minecraft:axolotls_spawnable_on', light: 'none', water: true },

  // ---------- 被动（亮） ----------
  // v4.17（P1-6）：猫只从 swamp_hut 的 spawn_overrides 来（群系表里没有）⇒ 规则按 Animal：
  //   checkAnimalSpawnRules = ANIMALS_SPAWNABLE_ON ∧ getRawBrightness>8（用 bright 近似）
  'minecraft:cat': { place: 'below_tag', tag: ANIMALS, light: 'bright' },
  'minecraft:sheep': { place: 'below_tag', tag: ANIMALS, light: 'bright' },
  'minecraft:cow': { place: 'below_tag', tag: ANIMALS, light: 'bright' },
  'minecraft:pig': { place: 'below_tag', tag: ANIMALS, light: 'bright' },
  'minecraft:chicken': { place: 'below_tag', tag: ANIMALS, light: 'bright' },
  'minecraft:horse': { place: 'below_tag', tag: ANIMALS, light: 'bright', cluster: 6 },
  'minecraft:donkey': { place: 'below_tag', tag: ANIMALS, light: 'bright', cluster: 6 },
  'minecraft:llama': { place: 'below_tag', tag: ANIMALS, light: 'bright', cluster: 6 },
  'minecraft:camel': { place: 'below_tag', tag: ANIMALS, light: 'bright', cluster: 6 },
  'minecraft:fox': { place: 'below_tag', tag: 'minecraft:foxes_spawnable_on', light: 'bright' },
  'minecraft:rabbit': { place: 'below_tag', tag: 'minecraft:rabbits_spawnable_on', light: 'bright' },
  'minecraft:wolf': { place: 'below_tag', tag: 'minecraft:wolves_spawnable_on', light: 'bright', cluster: 8 },
  'minecraft:goat': { place: 'below_tag', tag: 'minecraft:goats_spawnable_on', light: 'bright' },
  'minecraft:armadillo': { place: 'below_tag', tag: 'minecraft:armadillo_spawnable_on', light: 'bright' },
  'minecraft:parrot': { place: 'below_tag', tag: 'minecraft:parrots_spawnable_on', light: 'bright' },
  'minecraft:frog': { place: 'below_tag', tag: 'minecraft:frogs_spawnable_on', light: 'bright' },
  'minecraft:mooshroom': { place: 'below_tag', tag: 'minecraft:mooshrooms_spawnable_on', light: 'bright' },
  'minecraft:panda': { place: 'any', light: 'bright', tag: ANIMALS },            // NO_RESTRICTIONS 落位
  'minecraft:polar_bear': { place: 'below_tag', light: 'bright', biome: 'polar_bear' },
  'minecraft:turtle': { place: 'below_tag', tag: 'minecraft:sand', light: 'bright', yTurtle: true },
  'minecraft:strider': { place: 'lava', light: 'none', lavaToAir: true },

  // ---------- 默认（未列出的实体）：通用陆生 + 暗（最保守，且与"怪物占多数"一致） ----------
};

const DEFAULT_RULE = { place: 'ground', light: 'dark' };

// v4.23：把 rules/entity-rules.json 的补丁并进来（空 = 不变）
applyPatches(ENTITY_RULES);

// 规则名 = 结构化签名的字符串化（相同规则复用同一个 id，避免函数爆炸）
export function ruleKeyOf(type) {
  const r = ENTITY_RULES[type] ?? DEFAULT_RULE;
  return JSON.stringify({
    p: r.place, t: r.tag ? tagId(r.tag) : 0, l: r.light,
    c: r.coins ?? [], s: r.sky ? 1 : 0, n: r.notWart ? 1 : 0,
    dd: r.deep ? 1 : 0, md: r.moreDrowned ?? '', b: r.biome ?? '',
    rv: r.river98 ? 1 : 0, d: r.d64 ? 1 : 0, np: r.noPlayer5 ? 1 : 0,
    ys: r.ySea ?? 0, yt: r.yTurtle ? 1 : 0, la: r.lavaToAir ? 1 : 0,
    ns: r.noSky ? 1 : 0, w: r.water ? 1 : 0, g1: r.grp1 ? 1 : 0, bs: r.belowSurface ? 1 : 0,
    pe: r.persist ? 1 : 0, wd: isWide(type) ? 1 : 0, wd2: isWide2(type) ? 1 : 0, tl: isTall(type) ? 1 : 0,
    // v4.23 作者层扩展字段（全部缺省 null ⇒ 不自证差异、不影响既有去重）
    ba: belowAnyOf(type), y0: r.yMin ?? null, y1: r.yMax ?? null,
    lx: r.lightMax ?? null, ln: r.lightMin ?? null, wx: r.weather ?? null,
    bi: r.biomeIn ?? null, bn: r.biomeNot ?? null,
  });
}

export function ruleOf(type) {
  return { ...DEFAULT_RULE, ...(ENTITY_RULES[type] ?? {}) };
}

export function clusterOf(type) {
  return ruleOf(type).cluster ?? 4;
}

// 生成期把"规则签名 → 编号"钉死，供 roster 与 check/entity 两边共用
export function buildRuleTable(types) {
  const keys = new Map();
  const list = [];
  for (const t of [...types].sort()) {
    const k = ruleKeyOf(t);
    if (!keys.has(k)) { keys.set(k, list.length + 1); list.push({ id: list.length + 1, key: k, rule: ruleOf(t), sample: t }); }
  }
  return { rules: list, idOf: (type) => keys.get(ruleKeyOf(type)) };
}
