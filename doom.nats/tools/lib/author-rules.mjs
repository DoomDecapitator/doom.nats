// tools/lib/author-rules.mjs —— 作者规则层（v4.23）的**唯一**读取/校验入口。
//
// 契约（很重要）：
//   **默认 = 原版。** `rules/` 不存在或三个文件都为空时 `AUTHOR.active === false`，
//   所有生成器走原路径 ⇒ 产物与"没有这一层"**逐字节一致**。
//   这条契约由 `tools/check_static.mjs`（9 个生成器 `--check`）把守，别绕过它。
//
// 目录：`<repo>/rules/`（环境变量 `DOOM_RULES=<dir>` 可指向别处，验收用例就是这么跑的）
//   entity-rules.json  逐实体规则补丁：落位面 / 光照 / Y 窗口 / 群系 / 天气
//   entries.json       追加"条件刷怪条目"：权重组内条件成立才进池，可带自定义 NBT
//   counts.json        按 Y 轴定义数量：`groupByY`（每次生几只）/ `capByY`（该类容量）
//
// 字段与用例见 `rules/README.md`；四个验收用例在 `rules/examples/full/`。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const GEN = path.join(ROOT, '_work', 'generated');
export const RULES_DIR = process.env.DOOM_RULES ? path.resolve(process.env.DOOM_RULES) : path.join(ROOT, 'rules');

const readJson = (name, fallback) => {
  const p = path.join(RULES_DIR, name);
  if (!fs.existsSync(p)) return fallback;
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { throw new Error('rules/' + name + ' JSON 解析失败：' + e.message); }
};

const entityRules = readJson('entity-rules.json', {});
const entriesRaw = readJson('entries.json', []);
const counts = readJson('counts.json', {});
const entries = Array.isArray(entriesRaw) ? entriesRaw : (entriesRaw.entries ?? []);

// ---------------------------------------------------------------- 校验
// 可补丁的字段 = ENTITY_RULES 的词表 ∪ 本层新增的扩展字段
const PATCH_FIELDS = new Set([
  // 原版词表（lib/entity-rules.mjs）
  'place', 'light', 'tag', 'coins', 'cluster', 'persist', 'biome', 'sky', 'notWart', 'deep',
  'moreDrowned', 'river98', 'd64', 'noPlayer5', 'ySea', 'yTurtle', 'lavaToAir', 'grp1', 'water',
  'noSky', 'belowSurface',
  // 本层扩展
  'belowAny',      // [方块标签] 额外允许的"下方落位面"（与 #standable ∪ #full_collision 取并）
  'yMin', 'yMax',  // 候选点 y 窗口（闭区间；$py）
  'lightMax',      // 综合亮度 ≤ N（location_check.light.light.max）
  'lightMin',      // 综合亮度 ≥ N（用 light.light.min）
  'biomeIn',       // ['#tag'|'biome'] 只在这些群系里刷
  'biomeNot',      // ['#tag'|'biome'] 这些群系里不刷
  'weather',       // 'thunder' | 'rain' | 'clear'
]);
const PLACES = new Set(['ground', 'any', 'water', 'water_surface', 'below_tag', 'lava']);
const LIGHTS = new Set(['none', 'dark', 'bright', 'bat', 'slime', 'glow', 'bl8']);
const WEATHERS = new Set(['thunder', 'rain', 'clear']);

const problems = [];
const warn = (msg) => problems.push(msg);

for (const [type, patch] of Object.entries(entityRules)) {
  if (type.startsWith('_')) continue;    // `_note` / `_comment`：给人看的注释，不参与校验
  if (!type.includes(':')) warn('entity-rules.json：实体 id 应带命名空间（' + type + '）');
  for (const [k, v] of Object.entries(patch)) {
    if (k.startsWith('_')) continue;
    if (!PATCH_FIELDS.has(k)) warn('entity-rules.json[' + type + ']：未知字段 ' + k + '（可用：' + [...PATCH_FIELDS].join('/') + '）');
    if (k === 'place' && v !== null && !PLACES.has(v)) warn('entity-rules.json[' + type + '].place 非法：' + v);
    if (k === 'light' && v !== null && !LIGHTS.has(v)) warn('entity-rules.json[' + type + '].light 非法：' + v);
    if (k === 'weather' && v !== null && !WEATHERS.has(v)) warn('entity-rules.json[' + type + '].weather 非法：' + v);
    if ((k === 'belowAny' || k === 'biomeIn' || k === 'biomeNot') && !Array.isArray(v)) warn('entity-rules.json[' + type + '].' + k + ' 必须是数组');
    if (k === 'belowAny' && Array.isArray(v)) for (const t of v) if (!/^#?[a-z0-9_.-]+:[a-z0-9_/.-]+$/.test(t)) warn('entity-rules.json[' + type + '].belowAny 项不像方块标签：' + t);
  }
}
for (const e of entries) {
  for (const need of ['id', 'mob', 'category']) if (!e[need]) warn('entries.json：条目缺 ' + need + '：' + JSON.stringify(e).slice(0, 80));
  if (e.biomes && !Array.isArray(e.biomes)) warn('entries.json[' + e.id + '].biomes 必须是数组');
  if (!e.biomes && !e.biome) warn('entries.json[' + e.id + ']：必须给 biomes（数组，可含 #标签）或 biome');
  if (e.weight != null && !(Number.isInteger(e.weight) && e.weight > 0)) warn('entries.json[' + e.id + '].weight 必须是正整数');
  if (e.when && typeof e.when !== 'object') warn('entries.json[' + e.id + '].when 必须是对象');
  if (e.place != null && !PLACES.has(e.place)) warn('entries.json[' + e.id + '].place 非法：' + e.place);
  if (e.light != null && !LIGHTS.has(e.light)) warn('entries.json[' + e.id + '].light 非法：' + e.light);
  if (e.cluster != null && !Number.isInteger(e.cluster)) warn('entries.json[' + e.id + '].cluster 必须是整数');
  const w = e.when ?? {};
  for (const k of Object.keys(w)) if (!['thundering', 'raining', 'yMin', 'yMax', 'lightMax', 'lightMin'].includes(k)) warn('entries.json[' + e.id + '].when：未知条件 ' + k);
}
for (const [cat, bands] of Object.entries(counts.groupByY ?? {})) {
  if (!Array.isArray(bands)) warn('counts.json.groupByY[' + cat + '] 必须是数组');
  else for (const b of bands) if (!(Number.isInteger(b.min) && Number.isInteger(b.max))) warn('counts.json.groupByY[' + cat + ']：每段需要整数 min/max');
}
for (const [cat, bands] of Object.entries(counts.capByY ?? {})) {
  if (!Array.isArray(bands)) warn('counts.json.capByY[' + cat + '] 必须是数组');
  else for (const b of bands) if (!Number.isInteger(b.max)) warn('counts.json.capByY[' + cat + ']：每段需要整数 max（该 Y 段的容量）');
}
if (problems.length) throw new Error('作者规则层校验失败（' + RULES_DIR + '）：\n  - ' + problems.join('\n  - '));

// ---------------------------------------------------------------- 群系标签解析
// entries 里的 `#minecraft:is_deep_ocean` 这类标签要展开成具体群系 id 才能落到 biome 分发表。
// 数据来源：tools/export_biome_tags.mjs → _work/generated/biome-tags.json
let BIOME_TAGS = {};
const tagFile = path.join(GEN, 'biome-tags.json');
if (fs.existsSync(tagFile)) BIOME_TAGS = JSON.parse(fs.readFileSync(tagFile, 'utf8')).tags ?? {};

export const expandBiomes = (list) => {
  const out = new Set();
  for (const b of list) {
    if (typeof b === 'string' && b.startsWith('#')) {
      const tag = b.slice(1);
      const hit = BIOME_TAGS[tag] ?? BIOME_TAGS['minecraft:' + tag];
      if (!hit) throw new Error('群系标签 ' + b + ' 无法解析：先跑 `node tools/export_biome_tags.mjs`（产物 _work/generated/biome-tags.json），或在 entries.json 里直接写群系列表');
      for (const x of hit) out.add(x);
    } else out.add(b);
  }
  return [...out].sort();
};
export const isBiomeTag = (s) => typeof s === 'string' && s.startsWith('#');

// ---------------------------------------------------------------- 归一化后的视图
const normEntry = (e) => ({
  id: e.id,
  mob: e.mob,
  category: e.category,
  weight: e.weight ?? 1,
  min: e.group?.[0] ?? e.min ?? 1,
  max: e.group?.[1] ?? e.max ?? (e.group?.[0] ?? 1),
  nbt: e.nbt ?? null,
  // 条目级覆盖：只影响这一条的落位/光照/下方标签/簇上限（其余仍按该物种的原版规则）
  place: e.place ?? null,
  light: e.light ?? null,
  tag: e.tag ?? null,
  cluster: e.cluster ?? null,
  biomes: expandBiomes(e.biomes ?? (e.biome ? [e.biome] : [])),
  when: e.when ?? {},
  groupByY: e.groupByY ?? null,
  comment: e.comment ?? '',
});
export const ENTRIES = entries.map(normEntry);

export const AUTHOR = {
  active: Object.keys(entityRules).filter((t) => !t.startsWith('_')).length > 0 || ENTRIES.length > 0
    || Object.keys(counts).filter((k) => !k.startsWith('_')).length > 0,
  dir: RULES_DIR,
  entityRules,
  counts: { groupByY: counts.groupByY ?? {}, capByY: counts.capByY ?? {} },
  entryCount: ENTRIES.length,
};

export const patchOf = (type) => entityRules[type] ?? null;
export const patchedTypes = () => Object.keys(entityRules).filter((t) => !t.startsWith('_'));

/** 把补丁并到规则表上（null = 删字段）。由 lib/entity-rules.mjs 在模块初始化时调用一次。 */
export function applyPatches(table) {
  for (const [type, patch] of Object.entries(entityRules)) {
    if (type.startsWith('_')) continue;
    const base = { ...(table[type] ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (k.startsWith('_')) continue;
      if (v === null) delete base[k];
      else base[k] = v;
    }
    table[type] = base;
  }
  return table;
}

export const belowAnyOf = (type) => entityRules[type]?.belowAny ?? [];
export const entriesFor = (biome, category) => ENTRIES.filter((e) => e.category === category && e.biomes.includes(biome));
export const groupByYOf = (type) => counts.groupByY?.[type] ?? null;
export const capByYOf = (cat) => counts.capByY?.[cat] ?? null;
export const entryTypes = () => [...new Set(ENTRIES.map((e) => e.mob))];
// 天气条件直接复用已有的 predicate/weather/{thunder,rain}.json；这里只列**需要新生成**的亮度谓词。
export const entryPredicateIds = () => {
  const need = new Set();
  for (const e of ENTRIES) {
      if (e.when.lightMax != null) need.add('light_le_' + e.when.lightMax);
    if (e.when.lightMin != null) need.add('light_ge_' + e.when.lightMin);
  }
  return [...need].sort();
};
export const ruleLightWindows = () => {
  // 规则补丁里的 lightMax/lightMin/yMin/yMax 需要落到 check/entity（见 gen_ctm_check.mjs）
  const out = new Map();
  for (const [type, patch] of Object.entries(entityRules)) {
    if (type.startsWith('_')) continue;
    const w = {};
    for (const k of ['lightMax', 'lightMin', 'yMin', 'yMax', 'weather', 'biomeIn', 'biomeNot']) if (patch[k] != null) w[k] = patch[k];
    if (Object.keys(w).length) out.set(type, w);
  }
  return out;
};

export const describe = () => {
  if (!AUTHOR.active) return '作者规则层：未启用（默认 = 原版）';
  return '作者规则层：' + RULES_DIR + ' ⇒ 规则补丁 ' + patchedTypes().length + ' 个实体 · 追加条目 ' + ENTRIES.length
    + ' 条 · Y 曲线 ' + (Object.keys(AUTHOR.counts.groupByY).length + Object.keys(AUTHOR.counts.capByY).length) + ' 项';
};
