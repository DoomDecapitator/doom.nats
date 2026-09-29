// tools/lib/exp-rigs.mjs —— 实验性「AJ/BDEngine rig 桥接」的**唯一**读取/校验入口（v4.25）。
//
// 契约（与作者规则层同款，很重要）：
//   **空 = 不存在。** `rules/rigs.json` 缺文件 / 空文件 / `{}` ⇒ `EXP_RIGS.active === false`，
//   生成器不写任何 `exp/aj/**` 文件，`spawn/emit` 也不改一个字 ⇒ 默认产物与实验性产物都**逐字节不变**
//   （由 `tools/check_static.mjs` 的两个变体 `--check` 把守）。
//
// 为什么要这一层（背景结论，别推翻）：
//   Animated Java / BDEngine 导出的是**资源包 + display 实体骨架 + 动画函数**；display 是 `Display`
//   实体、**不是 `Mob`** ⇒ 没有 `MobCategory`/`SpawnPlacements`/`checkDespawn`/`finalizeSpawn`，
//   当不了群系表里的物种。A 方案「**真实体当内核，rig 当外观**」：
//     内核（普通生物）走原有刷怪链 → 在同一位置召唤 rig → rig 挂到内核上（乘客）⇒ 自动跟随移动/消失。
//
// 输入：`<rules>/rigs.json`（`DOOM_RULES=<dir>` 可指向别处，验收用例就是这么跑的）
//   {
//     "<rig id>": {
//       "carrier": "minecraft:glow_squid",  // 必填：真实体内核（必须是注册表里的物种）
//       "rig": "calamar:summon",            // 必填：第三方 rig 的召唤入口函数 id
//       "carrier_nbt": "{Silent:1b,...}",   // 可选：并入内核的 SNBT（隐形/静音/无 AI…）
//       "rig_args": "{args:{}}",            // 可选：传给 rig 召唤函数的宏参数（默认 {args:{}}）
//       "rig_root_tag": "calamar1727993704352", // 可选：rig 根的标签（AJ 默认 aj.global.root）
//       "claim_radius": 2,                  // 可选：认领 rig 实体云的半径（默认 2 格）
//       "on_spawn": "calamar:start_animation",  // 可选：挂载完成后调用的函数（@s = 内核）
//       "cat": "water_creature",            // 可选：类别（默认取注册表里内核的类别）
//       "count_with_carrier": true,         // 可选：内核是否计入 mobcap（默认 true）
//       "mount": true,                       // 可选：是否挂载（默认 true）
//       "comment": "…"                       // 可选：给人看的注释
//     }
//   }
import fs from 'node:fs';
import path from 'node:path';
import { RULES_DIR } from './author-rules.mjs';
import { EXP } from './packdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const REPO = path.resolve(ROOT, '..');
const GEN = path.join(ROOT, '_work', 'generated');

export const RIG_FILE = path.join(RULES_DIR, 'rigs.json');
export const CATEGORIES = ['monster', 'creature', 'ambient', 'axolotls', 'underground_water_creature', 'water_creature', 'water_ambient'];
export const DEFAULT_ROOT_TAG = 'aj.global.root';     // Animated Java 的约定：rig 根 display 带这个标签
export const DISPLAY_TYPE_TAG = 'doom.nats:exp_aj_display';   // block/item/text display 的实体类型标签
const ID_RE = /^[a-z0-9_.-]+$/;                        // rig id：进函数 id / 标签 / 存储键，禁止 `:` 与 `/`
const FN_RE = /^[a-z0-9_.-]+:[a-z0-9_/.-]+$/;          // 函数 id
const TYPE_RE = /^[a-z0-9_.-]+:[a-z0-9_/.-]+$/;        // 实体 id
const TAG_RE = /^[a-z0-9_.-]+$/;                       // 实体标签（不含命名空间的裸标签，AJ 就是这么打的）

const readJson = (p, fallback) => {
  if (!fs.existsSync(p)) return fallback;
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { throw new Error('rules/rigs.json JSON 解析失败：' + e.message); }
};

const raw = readJson(RIG_FILE, {});
const problems = [];
const snbtOk = (s) => typeof s === 'string' && s.trim().startsWith('{') && s.trim().endsWith('}');

// 注册表（内核必须真的是能被刷怪层生成的物种；拿不到就跳过这条校验）
let registry = {};
try {
  const p = path.join(GEN, 'mobs.json');
  if (fs.existsSync(p)) registry = JSON.parse(fs.readFileSync(p, 'utf8')).mobs ?? {};
} catch { /* 忽略：拿不到注册表只影响"内核是否在注册表内"这条校验 */ }

const ALLOWED = new Set(['carrier', 'rig', 'carrier_nbt', 'rig_args', 'rig_root_tag', 'claim_radius', 'on_spawn', 'cat', 'count_with_carrier', 'mount', 'comment']);

export const RIGS = [];
for (const [id, v] of Object.entries(raw)) {
  if (id.startsWith('_')) continue;                    // `_note` 之类：给人看的注释
  if (!ID_RE.test(id)) { problems.push('rigs.json 的 id 只能用 [a-z0-9_.-]（函数 id/标签要用）：' + id); continue; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) { problems.push('rigs.json[' + id + '] 必须是对象'); continue; }
  for (const k of Object.keys(v)) {
    if (k.startsWith('_')) continue;
    if (!ALLOWED.has(k)) problems.push('rigs.json[' + id + ']：未知字段 ' + k + '（可用：' + [...ALLOWED].join('/') + '）');
  }
  if (!TYPE_RE.test(String(v.carrier ?? ''))) problems.push('rigs.json[' + id + '].carrier 缺失或不是实体 id（如 minecraft:glow_squid）');
  if (!FN_RE.test(String(v.rig ?? ''))) problems.push('rigs.json[' + id + '].rig 缺失或不是函数 id（如 calamar:summon）');
  if (v.on_spawn != null && !FN_RE.test(String(v.on_spawn))) problems.push('rigs.json[' + id + '].on_spawn 不是函数 id：' + v.on_spawn);
  if (v.rig_root_tag != null && !TAG_RE.test(String(v.rig_root_tag))) problems.push('rigs.json[' + id + '].rig_root_tag 非法（只允许 [a-z0-9_.-]）：' + v.rig_root_tag);
  if (v.carrier_nbt != null && !snbtOk(v.carrier_nbt)) problems.push('rigs.json[' + id + '].carrier_nbt 必须是 SNBT 复合（以 { 开头、以 } 结尾）');
  if (v.rig_args != null && !snbtOk(v.rig_args)) problems.push('rigs.json[' + id + '].rig_args 必须是 SNBT 复合（默认 {args:{}}）');
  if (v.claim_radius != null && !(Number.isFinite(v.claim_radius) && v.claim_radius > 0 && v.claim_radius <= 16)) problems.push('rigs.json[' + id + '].claim_radius 必须是 (0,16] 的数：' + v.claim_radius);
  for (const b of ['count_with_carrier', 'mount']) {
    if (v[b] != null && typeof v[b] !== 'boolean') problems.push('rigs.json[' + id + '].' + b + ' 必须是布尔：' + v[b]);
  }
  const known = registry[v.carrier];
  if (Object.keys(registry).length && !known) problems.push('rigs.json[' + id + '].carrier 不在生物注册表里（刷怪层永远不会生成它）：' + v.carrier);
  const cat = v.cat ?? known?.category;
  if (v.cat != null && !CATEGORIES.includes(v.cat)) problems.push('rigs.json[' + id + '].cat 非法：' + v.cat);
  if (v.cat != null && known && known.category !== v.cat) problems.push('rigs.json[' + id + '].cat=' + v.cat + ' 与注册表里 ' + v.carrier + ' 的类别 ' + known.category + ' 不一致');
  if (!cat || !CATEGORIES.includes(cat)) problems.push('rigs.json[' + id + ']：拿不到类别（注册表里没有 ' + v.carrier + '，请显式写 cat）');
  if (problems.length) continue;                        // 本条的字段错了，先别进 RIGS（problem 已记录）
  RIGS.push({
    id,
    carrier: v.carrier,
    rig: v.rig,
    carrier_nbt: v.carrier_nbt ?? null,
    rig_args: v.rig_args ?? '{args:{}}',
    rig_root_tag: v.rig_root_tag ?? DEFAULT_ROOT_TAG,
    claim_radius: v.claim_radius ?? 2,
    on_spawn: v.on_spawn ?? null,
    cat,
    count_with_carrier: v.count_with_carrier ?? true,
    mount: v.mount ?? true,
    comment: v.comment ?? '',
  });
}
// 一个内核只能配一个 rig（否则"该物种生成时挂哪个外观"是二义的）
const byCarrierDup = new Map();
for (const r of RIGS) {
  if (byCarrierDup.has(r.carrier)) problems.push('内核 ' + r.carrier + ' 被多个 rig 使用（' + byCarrierDup.get(r.carrier) + ' / ' + r.id + '）⇒ 二义，请合并或换内核');
  byCarrierDup.set(r.carrier, r.id);
}
if (problems.length) throw new Error('实验性 rig 层校验失败（' + RIG_FILE + '）：\n  - ' + problems.join('\n  - '));

RIGS.sort((a, b) => (a.id < b.id ? -1 : 1));
const BY_CARRIER = new Map(RIGS.map((r) => [r.carrier, r]));
const BY_ID = new Map(RIGS.map((r) => [r.id, r]));

/** 是否生成整条链路：必须同时满足「实验性变体」+「rigs.json 非空」 */
export const EXP_RIGS = {
  exp: EXP,
  active: EXP && RIGS.length > 0,
  count: RIGS.length,
  file: RIG_FILE,
  dir: RULES_DIR,
  list: RIGS,
  reason: !EXP ? 'DOOM_EXP 未设置（默认变体不接入实验性能力）'
    : RIGS.length === 0 ? 'rules/rigs.json 为空 ⇒ 整条链路不生成任何东西'
      : '已启用 ' + RIGS.length + ' 条 rig',
};

/** 内核实体 id → rig id（没有配 rig 就 null）。生成器据此把 rig 写进 $sel。 */
export const rigIdOf = (type) => (EXP_RIGS.active ? (BY_CARRIER.get(type)?.id ?? null) : null);
export const rigOf = (id) => BY_ID.get(id) ?? null;

/**
 * 在已知的第三方包目录里找 rig 函数（只是**构建期提示**，找不到不阻止生成：
 * 包可能装在运行期的世界 datapacks 里）。搜索位置：
 *   $DOOM_RIG_DIRS（分号/冒号分隔）· <repo>/_work/aj-ref/**  · <repo>/build/out/aj/**
 */
export function findRigFunction(fnId) {
  const [ns, ...rest] = String(fnId).split(':');
  const rel = path.join('data', ns, 'function', ...rest) + '.mcfunction';
  const roots = [
    ...(process.env.DOOM_RIG_DIRS ? process.env.DOOM_RIG_DIRS.split(path.delimiter).filter(Boolean) : []),
    path.join(REPO, '_work', 'aj-ref'),
    path.join(REPO, 'build', 'out', 'aj'),
  ].map((p) => path.resolve(p));
  const seen = new Set();
  const probe = (dir, depth) => {
    if (depth > 3 || seen.has(dir)) return null;
    seen.add(dir);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    const direct = path.join(dir, rel);
    if (fs.existsSync(direct)) return direct;
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const hit = probe(path.join(dir, e.name), depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    const hit = probe(r, 0);
    if (hit) return hit;
  }
  return null;
}

export const describe = () => (EXP_RIGS.active
  ? '实验性 rig 层：' + RIG_FILE + ' ⇒ ' + RIGS.length + ' 条（' + RIGS.map((r) => r.id + '←' + r.carrier).join(' · ') + '）'
  : '实验性 rig 层：未启用（' + EXP_RIGS.reason + '）');
