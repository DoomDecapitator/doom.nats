// gen_ctm_exp.mjs —— 生成「实验性层」（v4.24）：storage `doom.nats:exp`，函数在 `doom.nats:exp/*`。
//
//   DOOM_EXP=1 node tools/gen_ctm_exp.mjs [--check]     # 只有实验性变体（v4x/doom.nats）才有这一层
//
// 为什么单独一层（SPEC 追加第 4 条）：本包把可自定义能力分三层身份
//   ① 原版复刻（默认，逐字节等价）② 本包扩展（稳定：Y 窗口 / 亮度 / 天气 / 群系名单 / 落位面 / 条件条目 / 数量随 Y）
//   ③ 实验性（非原版：`near` 关系条件 / `on_spawn` 演出 / `preset` 预设）
// ③ 的产物一律落在 `doom.nats:exp/*`（函数）、`doom.nats.exp.*`（实体标签）、`doom.nats:exp`（storage），
// 并且**只有实验性变体**（pack.mcmeta 带 `features`，见 gen_ctm.mjs）里才有这些文件 ⇒
// 世界没开对应实验性玩法时，引擎直接**拒绝加载**这个包（拒绝比警告可靠）。
//
// 双轨开关：
//   · 引擎级 `features`（整包级，决定"能不能装"）——由变体承担；
//   · 运行时刻 `doom.nats:exp enabled:1b`（决定"行为回不回滚"）——默认必须显式 enable/预设才置 1，
//     置 0 时整层不参与判定 ⇒ 一条命令回到稳定层/原版。
import fs from 'node:fs';
import path from 'node:path';
import { PACK, EXP } from './lib/packdir.mjs';
import { buildLayer } from './lib/author-runtime.mjs';

const LF = String.fromCharCode(10);
const NS = 'doom.nats';
const ROOT = path.resolve(import.meta.dirname, '..');
const GEN = path.join(ROOT, '_work', 'generated');
const LO = -2147483648;
const HI = 2147483647;
const F = {};

if (!EXP) {
  console.error('❌ gen_ctm_exp 只用于实验性变体：请加 DOOM_EXP=1（见 tools/lib/packdir.mjs）。');
  console.error('   理由：实验性文件不能进默认产物 —— 那会让默认包也要求实验性玩法。');
  process.exit(1);
}

const mobsDoc = JSON.parse(fs.readFileSync(path.join(GEN, 'mobs.json'), 'utf8'));
const SLUGS = Object.entries(mobsDoc.mobs).map(([slug, m]) => [slug, m.type]).sort((a, b) => (a[1] < b[1] ? -1 : 1));

// 构建期 rules/entries.json 的条目 id（给它们生成空的 on_spawn 占位，作者直接填演出）
const { ENTRIES } = await import('./lib/author-rules.mjs');

// ---------------------------------------------------------------- 预设（非原版能力的"一键套餐"）
// 三个内置示例 + `rules/presets/<名>.json`（构建期文件，与 storage 同构）。
const BUILTIN = {
  blood_moon: {
    note: '血月（实验性）：僵尸/骷髅成组更大、怪物上限抬高，并加一条自带力量效果的"血月行者"',
    entityRules: {},
    counts: {
      groupByY: {
        'minecraft:zombie': [{ yMin: LO, yMax: HI, min: 3, max: 5 }],
        'minecraft:skeleton': [{ yMin: LO, yMax: HI, min: 3, max: 5 }],
      },
      capByY: { monster: [{ yMin: LO, yMax: HI, max: 200, localMax: 140 }] },
    },
    entries: [{
      id: 'blood_moon_walker', mob: 'minecraft:zombie', biome: '#minecraft:is_overworld', category: 'monster',
      weight: 30, min: 2, max: 3, when: { yMax: 63 },
      nbt: '{CustomName:\'{"text":"血月行者","color":"red"}\',active_effects:[{id:"minecraft:strength",amplifier:1b,duration:-1,show_particles:0b,show_icon:1b}]}',
      on_spawn: true,
    }],
  },
  storm_season: {
    note: '雷暴季（实验性）：雷暴时才进池的"风暴猎手"（充能苦力怕）+ 雷暴期间怪物上限抬高',
    entityRules: {},
    counts: { groupByY: {}, capByY: { monster: [{ yMin: LO, yMax: HI, max: 200, localMax: 140 }] } },
    entries: [{
      id: 'storm_hunter', mob: 'minecraft:creeper', biome: '#minecraft:is_overworld', category: 'monster',
      weight: 25, min: 1, max: 2, when: { thundering: true },
      nbt: '{powered:1b,CustomName:\'{"text":"风暴猎手","color":"yellow"}\'}',
      on_spawn: true,
    }],
  },
  deep_dark: {
    note: '深暗层（实验性）：僵尸只在 y≤0 出现、骷髅成组更大，并加一条带黑暗效果的"深暗潜行者"',
    entityRules: { 'minecraft:zombie': { yMax: 0 } },
    counts: { groupByY: { 'minecraft:skeleton': [{ yMin: LO, yMax: 0, min: 2, max: 4 }] }, capByY: {} },
    entries: [{
      id: 'deep_dark_stalker', mob: 'minecraft:skeleton', biome: '#minecraft:is_overworld', category: 'monster',
      weight: 30, min: 1, max: 2, when: { yMax: 0 },
      nbt: '{CustomName:\'{"text":"深暗潜行者","color":"dark_purple"}\',active_effects:[{id:"minecraft:darkness",amplifier:0b,duration:-1,show_particles:0b,show_icon:1b}]}',
      on_spawn: true,
    }],
  },
};
const PRESET_DIR = path.join(process.env.DOOM_RULES ? path.resolve(process.env.DOOM_RULES) : path.join(ROOT, 'rules'), 'presets');
const FILE_PRESETS = {};
if (fs.existsSync(PRESET_DIR)) {
  for (const name of fs.readdirSync(PRESET_DIR).filter((n) => n.endsWith('.json')).sort()) {
    FILE_PRESETS[name.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(PRESET_DIR, name), 'utf8'));
  }
}
const PRESETS = { ...BUILTIN, ...FILE_PRESETS };

// ---------------------------------------------------------------- 实验性层的函数
Object.assign(F, buildLayer({
  dir: 'exp',
  title: '实验性层（非原版）',
  storage: NS + ':exp',
  scratch: NS + ':exp_rt',
  input: NS + ':exp_in',
  score: '$exp',
  tagPrefix: NS + '.exp.',
  exp: true,
  entryIds: ENTRIES.map((e) => e.id),
  slugs: SLUGS,
  presets: PRESETS,
}));

// ---------------------------------------------------------------- 入口帮助（把两条轨讲清楚）
F['data/' + NS + '/function/exp/usage.mcfunction'] = [
  '# ' + NS + ':exp/usage —— 实验性层总览（引擎门 + 运行时刻开关）',
  'tellraw @s [{"text":"=== doom.nats 实验性层（非原版能力）===","color":"gold"}]',
  'tellraw @s [{"text":"引擎门：本产物（v4x）在 pack.mcmeta 里声明了 features ⇒ 世界没开对应实验性玩法时**整包被拒**。","color":"gray"}]',
  'tellraw @s [{"text":"运行时刻开关：storage ' + NS + ':exp 的 enabled=1b 时实验性能力才生效；disable 一条命令回滚。","color":"gray"}]',
  'tellraw @s [{"text":"非原版能力：when.near 关系条件 · on_spawn 演出钩子 · preset 预设。用法见 ' + NS + ':exp/help。","color":"gray"}]',
  '',
].join(LF);

// ---------------------------------------------------------------- 写出
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
  if (drift.length) { console.log('与生成器不一致 (' + drift.length + '):'); for (const d of drift.slice(0, 8)) console.log('  -', d); process.exit(1); }
  console.log('一致：' + Object.keys(F).length + ' 个文件');
} else {
  console.log('=== gen_ctm_exp 完成（实验性变体）===');
  console.log('输出:', PACK, '| 文件:', Object.keys(F).length);
  console.log('storage ' + NS + ':exp（entityRules / entries / counts + enabled 总开关）· 预设 ' + Object.keys(PRESETS).join('/')
    + ' · on_spawn 占位 ' + Object.keys(F).filter((k) => k.includes('/exp/on_spawn/')).length + ' 个');
}
