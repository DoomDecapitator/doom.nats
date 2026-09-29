// verify.mjs — static conformance check for a 1.21.6 suso.nats build.
//   node tools/verify.mjs <packDir>
import fs from 'node:fs';
import path from 'node:path';
import { parse, serialize, tokenize } from './lib/snbt.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const REF = path.join(ROOT, '_work', 'ref');
const PACK = path.resolve(process.argv[2] || path.join(ROOT, '..', 'ported', 'suso.nats'));

const LF_ANY = String.fromCharCode(10);
const readSet = (f) => new Set(fs.readFileSync(path.join(REF, f), 'utf8').split('\n').filter(Boolean));
const BLOCKS = readSet('blocks-1.21.6.txt');
const BIOMES = readSet('biomes-1.21.6.txt');
const ENTITIES = new Set([...readSet('entities-1.21.6.txt')].filter((x) => /^[a-z_]+$/.test(x)));
const ENCHANTS = readSet('enchantments-1.21.6.txt');

const EFFECTS = new Set(['speed', 'slowness', 'haste', 'mining_fatigue', 'strength', 'instant_health',
  'instant_damage', 'jump_boost', 'nausea', 'regeneration', 'resistance', 'fire_resistance',
  'water_breathing', 'invisibility', 'blindness', 'night_vision', 'hunger', 'weakness', 'poison',
  'wither', 'health_boost', 'absorption', 'saturation', 'glowing', 'levitation', 'luck', 'unluck',
  'slow_falling', 'conduit_power', 'dolphins_grace', 'bad_omen', 'hero_of_the_village', 'darkness',
  'trial_omen', 'raid_omen', 'wind_charged', 'weaving', 'oozing', 'infested']);
const OPERATIONS = new Set(['add_value', 'add_multiplied_base', 'add_multiplied_total']);
const SLOTS = new Set(['any', 'mainhand', 'offhand', 'hand', 'feet', 'legs', 'chest', 'head', 'armor', 'body']);
const EQ_SLOTS = new Set(['mainhand', 'offhand', 'head', 'chest', 'legs', 'feet', 'body']);

const LEGACY_KEYS = ['HandItems', 'ArmorItems', 'HandDropChances', 'ArmorDropChances',
  'Attributes', 'AttributeModifiers', 'AttributeName', 'Amount', 'Operation', 'ActiveEffects',
  'Amplifier', 'ShowParticles', 'CustomModelData', 'Enchantments', 'lvl', 'Trim', 'SkullOwner'];

// namespaces provided by sibling datapacks in the same world (rc4 ships general:dimension_abyss)
const EXTERNAL = /^(general|rc4|src4\.[a-z]+):/;
const external = new Set();
const problems = [];
const notes = [];
const add = (sev, where, msg) => problems.push({ sev, where, msg });
const walkFiles = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walkFiles(p, out) : out.push(p); } return out; };

if (!fs.existsSync(PACK)) { console.error('pack not found:', PACK); process.exit(1); }
const all = walkFiles(PACK);
const rel = (p) => path.relative(PACK, p).split(path.sep).join('/');

// ---- 1. pack.mcmeta ----
{
  const mc = JSON.parse(fs.readFileSync(path.join(PACK, 'pack.mcmeta'), 'utf8'));
  if (mc.pack.pack_format !== 80) add('BLOCK', 'pack.mcmeta', `pack_format=${mc.pack.pack_format}, expected 80`);
  else notes.push('pack_format = 80 ✓');
}

// ---- 2. singular directories ----
for (const p of all) {
  const r = rel(p);
  for (const bad of ['/functions/', '/predicates/', '/tags/blocks/', '/tags/functions/', '/advancements/', '/loot_tables/', '/recipes/']) {
    if (r.includes(bad)) add('BLOCK', r, `legacy directory name "${bad}"`);
  }
}

// ---- 3/4. function + predicate reference integrity ----
const fns = new Set(), preds = new Set(), tags = new Set();
for (const p of all) {
  const r = rel(p);
  let m = /^data\/([^/]+)\/function\/(.+)\.mcfunction$/.exec(r);
  if (m) fns.add(`${m[1]}:${m[2]}`);
  m = /^data\/([^/]+)\/predicate\/(.+)\.json$/.exec(r);
  if (m) preds.add(`${m[1]}:${m[2]}`);
  if (r.startsWith('data/') && r.includes('/tags/') && r.endsWith('.json')) {
    // 收集包内**全部类型**的标签定义（含 minecraft 命名空间的兜底标签）
    const rest = r.slice('data/'.length);
    const slash = rest.indexOf('/');
    const ns = rest.slice(0, slash);
    const after = rest.slice(slash + 1);
    if (after.startsWith('tags/')) {
      const tail = after.slice('tags/'.length);
      const cut = tail.indexOf('/');
      if (cut > 0) tags.add(ns + ':' + tail.slice(cut + 1, -'.json'.length));
    }
  }
}
const fnRefs = new Set(), predRefs = new Set(), tagRefs = new Set(), summons = [], macrosUsed = new Set(), macroDefs = new Set();
let macroSummons = 0;
const registry = new Map();
const idOfFile = (p) => { const m = /^data\/([^/]+)\/function\/(.+)\.mcfunction$/.exec(rel(p)); return m ? `${m[1]}:${m[2]}` : null; };
for (const p of all) {
  if (!p.endsWith('.mcfunction')) continue;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('$')) macroDefs.add(idOfFile(p));
    for (const m of line.matchAll(/function\s+([a-z0-9_.-]+:[a-z0-9_/.-]+)(\s+with\s+)?/g)) {
      fnRefs.add(m[1]);
      if (m[2]) macrosUsed.add(m[1]);
    }
    for (const m of line.matchAll(/(?:predicate=|if predicate\s+|unless predicate\s+)([a-z0-9_.-]+:[a-z0-9_/.-]+)/g)) predRefs.add(m[1]);
    for (const m of line.matchAll(/#([a-z0-9_.-]+:[a-z0-9_/.-]+)/g)) tagRefs.add(m[1]);
    const tok = tokenize(line);
    const si = tok.indexOf('summon');
    if (si >= 0 && !line.includes('$(')) summons.push({ file: rel(p), type: tok[si + 1], nbt: tok[tok.length - 1] });
    else if (si >= 0) macroSummons++;
  }
}
for (const r of fnRefs) if (!fns.has(r) && !EXTERNAL.test(r)) add('BLOCK', 'function ref', `unresolved function "${r}"`);
for (const r of predRefs) if (!preds.has(r) && !EXTERNAL.test(r)) add('BLOCK', 'predicate ref', `unresolved predicate "${r}"`);
for (const r of predRefs) if (EXTERNAL.test(r)) external.add(r);
for (const r of fnRefs) if (EXTERNAL.test(r)) external.add(r);
// ---- 3b. tag reference existence (vanilla inventory + pack-local definitions) ----
// `#minecraft:xxx` 在 1.21.6 里不存在时，整个函数会加载失败（Failed to load function），
// 上游 1.20.1 遗留的 `#minecraft:red_area` 就属于这一类 —— 由 _work/dump-tags.js 提供权威清单。
const VANILLA_TAGS = new Map();
for (const f of fs.readdirSync(REF)) {
  const m = /^vanillatags-(.+)\.txt$/.exec(f);
  if (m) VANILLA_TAGS.set(m[1], readSet(f));
}
const vanillaHas = (id) => {
  for (const set of VANILLA_TAGS.values()) if (set.has(id)) return true;
  for (const set of VANILLA_TAGS.values()) for (const v of set) if (v.endsWith('/' + id)) return true; // worldgen/biome/forest
  return false;
};
if (!VANILLA_TAGS.size) notes.push('⚠️ 缺少 _work/ref/vanillatags-*.txt（先跑 node _work/dump-tags.js），已跳过 vanilla 标签校验');
const tagLine = new Map();
for (const p of all) {
  if (!p.endsWith('.mcfunction')) continue;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    for (const m of line.matchAll(/#([a-z0-9_.-]+:[a-z0-9_/.-]+)/g)) if (!tagLine.has(m[1])) tagLine.set(m[1], { file: rel(p), line });
  }
}
for (const r of tagRefs) {
  const where = tagLine.get(r);
  const at = where ? where.file : 'tag ref';
  if (r.startsWith('minecraft:')) {
    const id = r.slice('minecraft:'.length);
    if (VANILLA_TAGS.size && !vanillaHas(id) && !tags.has(r)) add('BLOCK', at, `vanilla tag "#${r}" does not exist in 1.21.6 — function will fail to load`);
  } else if (EXTERNAL.test(r)) {
    external.add(r);
  } else if (!tags.has(r)) {
    add('BLOCK', at, `tag "#${r}" is neither defined by this pack nor vanilla`);
  }
}
for (const f of macroDefs) if (!macrosUsed.has(f)) add('WARN', f, 'contains $ macro lines but is never called with `with`');
if (registry.size || macroSummons) notes.push(`v3 注册表条目 ${registry.size} · 宏行 summon ${macroSummons}（运行期解析，静态不判）`);
notes.push(`functions ${fns.size} (${fnRefs.size} refs) · predicates ${preds.size} (${predRefs.size} refs) · summons ${summons.length}`);

// ---- 4b. v3 生物注册表：data modify storage <store> <id> set value {type:"…",nbt:{…}} ----
// 注册表把实体类型与 NBT 搬出函数体，静态校验必须跟着搬 —— 否则 NBT 规则整套失效。
const REG_STORE_SUFFIX = ":mobs";
const REG_HEAD = "data modify storage ";
const REG_SEP = " set value ";
for (const p of all) {
  if (!p.endsWith(".mcfunction")) continue;
  for (const raw of fs.readFileSync(p, "utf8").split(LF_ANY)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf(REG_HEAD);
    if (i < 0) continue;
    const j = line.indexOf(REG_SEP, i);
    if (j < 0) continue;
    const spec = line.slice(i + REG_HEAD.length, j).trim().split(" ");
    if (!spec[0].endsWith(REG_STORE_SUFFIX)) continue;   // 只认注册表 storage（place 等宏存储不算条目）
    const key = spec[spec.length - 1];
    let v;
    try { v = parse(line.slice(j + REG_SEP.length).trim()); } catch (e) { add("BLOCK", rel(p), "registry entry NBT parse error (" + key + "): " + e.message); continue; }
    if (!v || !v.type || !v.nbt) { add("BLOCK", rel(p), "registry entry missing type/nbt: " + key); continue; }
    registry.set(key, v);
    summons.push({ file: rel(p) + " reg:" + key, type: String(v.type), nbt: serialize(v.nbt) });
  }
}
for (const p of all) {
  if (!p.endsWith(".mcfunction")) continue;
  for (const raw of fs.readFileSync(p, "utf8").split(LF_ANY)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("with storage ");
    if (i < 0) continue;
    const spec = line.slice(i + 13).trim().split(" ");
    if (spec.length < 2) continue;
    if (spec[0].endsWith(REG_STORE_SUFFIX) && registry.size && !registry.has(spec[1])) add("BLOCK", rel(p), "registry entry not found: " + spec[1]);
  }
}
// ---- 5. block ids in tags ----
for (const p of all) {
  const r = rel(p);
  if (!/^data\/[^/]+\/tags\/block\/.+\.json$/.test(r)) continue;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const v of j.values || []) {
    const id = String(typeof v === 'string' ? v : v.id).replace(/^minecraft:/, '');
    if (!BLOCKS.has(id)) add('BLOCK', r, `unknown block "${id}"`);
  }
}

// ---- 6..10. summon NBT ----
let items = 0, effects = 0, attrs = 0;
for (const s of summons) {
  if (!s.nbt || !s.nbt.startsWith('{')) continue;
  const t = s.type.replace(/^minecraft:/, '');
  if (!ENTITIES.has(t)) add('BLOCK', s.file, `unknown entity type "${s.type}"`);
  let nbt; try { nbt = parse(s.nbt); } catch (e) { add('BLOCK', s.file, `NBT parse error: ${e.message}`); continue; }

  const seen = [];
  (function walk(node, inCustomData) {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, inCustomData));
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (!inCustomData && LEGACY_KEYS.includes(k)) seen.push(k);
      walk(v, inCustomData || k === 'custom_data');
    }
  })(nbt, false);
  for (const k of new Set(seen)) add('BLOCK', s.file, `legacy 1.20.1 NBT key "${k}" survives on a summon`);

  for (const [k, v] of Object.entries(nbt.equipment || {})) {
    items++;
    if (!EQ_SLOTS.has(k)) add('BLOCK', s.file, `bad equipment slot "${k}"`);
    if (Object.prototype.hasOwnProperty.call(v, 'Count')) add('BLOCK', s.file, 'equipment item still uses Count');
    if (Object.prototype.hasOwnProperty.call(v, 'tag')) add('BLOCK', s.file, 'equipment item still uses tag');
    if (!Object.prototype.hasOwnProperty.call(v, 'count')) add('WARN', s.file, 'equipment item has no count');
    for (const [ck, cv] of Object.entries(v.components || {})) {
      if (ck === 'enchantments') for (const e of Object.keys(cv)) if (!ENCHANTS.has(e.replace(/^minecraft:/, ''))) add('BLOCK', s.file, `unknown enchantment ${e}`);
      if (ck === 'attribute_modifiers') for (const m of cv) {
        if (!OPERATIONS.has(String(m.operation))) add('BLOCK', s.file, `bad operation "${m.operation}"`);
        if (m.slot && !SLOTS.has(String(m.slot))) add('BLOCK', s.file, `bad attribute slot "${m.slot}"`);
      }
    }
  }
  for (const e of nbt.active_effects || []) {
    effects++;
    const id = String(e.id || '').replace(/^minecraft:/, '');
    if (!EFFECTS.has(id)) add('BLOCK', s.file, `unknown / non-string effect id "${e.id}"`);
  }
  for (const a of nbt.attributes || []) {
    attrs++;
    const id = String(a.id || '');
    if (!id.startsWith('minecraft:')) add('BLOCK', s.file, `attribute id not namespaced: "${id}"`);
    if (/generic\./.test(id)) add('BLOCK', s.file, `attribute id still has the generic. prefix: "${id}"`);
    if (a.Name !== undefined || a.Base !== undefined) add('BLOCK', s.file, 'attribute still uses Name/Base');
  }
  for (const [k, v] of Object.entries(nbt)) {
    if (k === 'attributes') for (const a of v) { if (!['max_health', 'follow_range', 'movement_speed', 'attack_damage', 'knockback_resistance', 'attack_knockback', 'armor', 'step_height', 'scale', 'jump_strength', 'safe_fall_distance', 'fall_damage_multiplier', 'gravity', 'flying_speed', 'luck', 'max_absorption', 'block_break_speed', 'block_interaction_range', 'entity_interaction_range', 'mining_efficiency', 'movement_efficiency', 'sneaking_speed', 'submerged_mining_speed', 'sweeping_damage_ratio', 'water_movement_efficiency', 'burning_time', 'explosion_knockback_resistance', 'oxygen_bonus', 'tempt_range', 'camera_distance', 'waypoint_transmit_range', 'waypoint_receive_range', 'below_name_distance'].includes(String(a.id).replace(/^minecraft:/, ''))) add('WARN', s.file, `unrecognised attribute "${a.id}"`); }
  }
  if (typeof nbt.CustomName === 'string' && nbt.CustomName.trim().startsWith('{')) add('BLOCK', s.file, 'CustomName is still a JSON string');
}

// ---- report ----
notes.push('外部依赖: ' + ([...external].join(', ') || '无'));
const blocking = problems.filter((p) => p.sev === 'BLOCK');
const warns = problems.filter((p) => p.sev === 'WARN');
console.log(`=== verify: ${PACK} ===`);
console.log(`files ${all.length} | summons ${summons.length} | equipment items ${items} | effects ${effects} | attributes ${attrs}`);
for (const n of notes) console.log('  ·', n);
console.log();
if (!blocking.length && !warns.length) console.log('✅ 全部通过');
for (const p of blocking) console.log(`❌ [BLOCK] ${p.where}: ${p.msg}`);
for (const p of warns) console.log(`⚠️  [WARN ] ${p.where}: ${p.msg}`);
console.log(`\n结论: ${blocking.length} blocking, ${warns.length} warning`);
process.exit(blocking.length ? 1 : 0);
