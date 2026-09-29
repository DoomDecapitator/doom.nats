// 1.20.1 -> 1.21.6 NBT rewrite rules, driven by the jar forensics in ../../_work/ref/nbt-verdict.json
// Legacy (DataFixer-only, dead at command time): ActiveEffects Amplifier ShowParticles
//   HandItems ArmorItems HandDropChances ArmorDropChances Attributes AttributeModifiers
//   AttributeName Amount Operation CustomModelData Enchantments lvl Trim SkullOwner
import { Num, num, has, serialize } from '../lib/snbt.mjs';

// ---- legacy numeric mob-effect ids (1-based, pre-1.20.5) ----
export const EFFECT_IDS = {
  1: 'speed', 2: 'slowness', 3: 'haste', 4: 'mining_fatigue', 5: 'strength',
  6: 'instant_health', 7: 'instant_damage', 8: 'jump_boost', 9: 'nausea',
  10: 'regeneration', 11: 'resistance', 12: 'fire_resistance', 13: 'water_breathing',
  14: 'invisibility', 15: 'blindness', 16: 'night_vision', 17: 'hunger', 18: 'weakness',
  19: 'poison', 20: 'wither', 21: 'health_boost', 22: 'absorption', 23: 'saturation',
  24: 'glowing', 25: 'levitation', 26: 'luck', 27: 'unluck', 28: 'slow_falling',
  29: 'conduit_power', 30: 'dolphins_grace', 31: 'bad_omen', 32: 'hero_of_the_village',
  33: 'darkness', 34: 'trial_omen', 35: 'raid_omen', 36: 'wind_charged',
  37: 'weaving', 38: 'oozing', 39: 'infested',
};
export const OP_MAP = { 0: 'add_value', 1: 'add_multiplied_base', 2: 'add_multiplied_total' };
const SKIP_SLOTS = new Set(['', 'minecraft:air']);

const int = (x) => (x instanceof Num ? Math.trunc(x.v) : typeof x === 'number' ? Math.trunc(x) : x);
const flt = (x) => (x instanceof Num ? x.v : typeof x === 'number' ? x : x);
const dbl = (x) => num(flt(x), 'd');

// ---------- item stack: {id,Count,tag} -> {id,count,components} ----------
export function rewriteItemStack(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const id = item.id;
  if (typeof id !== 'string' || SKIP_SLOTS.has(id)) return null;      // {} or air => empty slot
  const out = { id };
  out.count = int(has(item, 'Count') ? item.Count : 1);

  const tag = item.tag;
  const comp = {};
  if (tag && typeof tag === 'object') {
    // Enchantments:[{id,lvl}] -> enchantments:{"<id>":lvl}
    if (has(tag, 'Enchantments')) {
      const ench = {};
      for (const e of tag.Enchantments || []) {
        if (!e || !e.id) continue;
        const key = String(e.id).startsWith('minecraft:') ? e.id : 'minecraft:' + e.id;
        ench[key] = int(has(e, 'lvl') ? e.lvl : 1);
      }
      if (Object.keys(ench).length) comp.enchantments = ench;
    }
    // StoredEnchantments (enchanted books) - same shape
    if (has(tag, 'StoredEnchantments')) {
      const ench = {};
      for (const e of tag.StoredEnchantments || []) {
        if (!e || !e.id) continue;
        ench[String(e.id).startsWith('minecraft:') ? e.id : 'minecraft:' + e.id] = int(has(e, 'lvl') ? e.lvl : 1);
      }
      if (Object.keys(ench).length) comp.stored_enchantments = ench;
    }
    // display:{color} -> dyed_color ; display:{Name} -> custom_name (SNBT component)
    if (tag.display && typeof tag.display === 'object') {
      if (has(tag.display, 'color')) comp.dyed_color = int(tag.display.color);
      if (has(tag.display, 'Name')) comp.custom_name = toComponent(tag.display.Name);
      if (has(tag.display, 'Lore')) comp.lore = (tag.display.Lore || []).map(toComponent);
    }
    if (has(tag, 'CustomModelData')) comp.custom_model_data = int(tag.CustomModelData);
    if (has(tag, 'Unbreakable')) comp.unbreakable = {};
    if (has(tag, 'Damage')) comp.damage = int(tag.Damage);
    if (has(tag, 'RepairCost')) comp.repair_cost = int(tag.RepairCost);
    if (has(tag, 'AttributeModifiers')) {
      comp.attribute_modifiers = (tag.AttributeModifiers || []).map(rewriteModifier).filter(Boolean);
      if (!comp.attribute_modifiers.length) delete comp.attribute_modifiers;
    }
    // Trim may be a sibling of display (correct) or wrongly nested inside it
    const trimSrc = has(tag, 'Trim') ? tag.Trim
      : (tag.display && typeof tag.display === 'object' && has(tag.display, 'Trim')) ? tag.display.Trim : null;
    if (trimSrc && typeof trimSrc === 'object') {
      comp.trim = { material: rl(trimSrc.material), pattern: rl(trimSrc.pattern) };
    }
    // SkullOwner -> profile
    if (has(tag, 'SkullOwner')) {
      const so = tag.SkullOwner;
      const prof = {};
      if (so && typeof so === 'object') {
        if (has(so, 'Id')) prof.id = so.Id;
        if (so.Properties && so.Properties.textures) {
          prof.properties = (so.Properties.textures || []).map((t) => ({
            name: 'textures', value: String(t.Value ?? t.value ?? ''),
          }));
        }
      }
      comp.profile = prof;
    }
    // anything we did not map: keep as custom_data so no data is silently lost
    const KNOWN = new Set(['Enchantments', 'StoredEnchantments', 'display', 'CustomModelData',
      'Unbreakable', 'Damage', 'RepairCost', 'AttributeModifiers', 'Trim', 'SkullOwner']);
    const leftovers = Object.fromEntries(Object.entries(tag).filter(([k]) => !KNOWN.has(k)));
    if (Object.keys(leftovers).length) comp.custom_data = { 'suso.nats:legacy_tag': leftovers };
  }
  if (Object.keys(comp).length) out.components = comp;
  return out;
}

function rewriteModifier(m) {
  if (!m || typeof m !== 'object') return null;
  const raw = m.AttributeName ?? m.Name ?? m.type;
  if (typeof raw !== 'string') return null;
  const type = 'minecraft:' + raw.replace(/^minecraft:/, '').replace(/^generic\./, '');
  const opRaw = has(m, 'Operation') ? int(m.Operation) : 0;
  const o = {
    type,
    id: 'minecraft:' + type.slice('minecraft:'.length),
    amount: dbl(has(m, 'Amount') ? m.Amount : 0),
    operation: OP_MAP[opRaw] ?? 'add_value',
  };
  if (has(m, 'Slot')) o.slot = String(m.Slot);
  return o;
}

const rl = (v) => {
  const s = String(v ?? '');
  return s.includes(':') ? s : 'minecraft:' + s;
};

// JSON text component string (1.20 style) -> SNBT text component (1.21.5+ style)
export function toComponent(v) {
  if (typeof v !== 'string') {
    if (v && typeof v === 'object') return v;
    return String(v ?? '');
  }
  const t = v.trim();
  if (!t.startsWith('{') && !t.startsWith('[') && !t.startsWith('"')) return t;   // already plain text
  try {
    const j = JSON.parse(t);
    return jsonToSnbt(j);
  } catch { return t; }
}
function jsonToSnbt(j) {
  if (j === null || typeof j !== 'object') return j;
  if (Array.isArray(j)) return j.map(jsonToSnbt);
  const o = {};
  for (const [k, v] of Object.entries(j)) {
    if (k === 'text' || k === 'translate' || k === 'keybind' || k === 'selector' || k === 'score' || k === 'color' || k === 'font') o[k] = typeof v === 'object' ? jsonToSnbt(v) : v;
    else if (k === 'extra' || k === 'with') o[k] = jsonToSnbt(v);
    else o[k] = jsonToSnbt(v);
  }
  return o;
}

// ---------- entity root ----------
export function rewriteEntityNbt(root) {
  if (!root || typeof root !== 'object' || Array.isArray(root)) return root;
  const out = {};

  // 1) HandItems + ArmorItems -> equipment
  const eq = {};
  const hi = root.HandItems || [];
  const ai = root.ArmorItems || [];
  const slotMap = [
    ['mainhand', hi[0]], ['offhand', hi[1]],
    ['feet', ai[0]], ['legs', ai[1]], ['chest', ai[2]], ['head', ai[3]],
  ];
  for (const [slot, it] of slotMap) {
    const r = rewriteItemStack(it);
    if (r) eq[slot] = r;
  }

  // 2) HandDropChances + ArmorDropChances -> drop_chances
  const dc = {};
  const hd = root.HandDropChances || [];
  const ad = root.ArmorDropChances || [];
  const dcMap = [
    ['mainhand', hd[0]], ['offhand', hd[1]],
    ['feet', ad[0]], ['legs', ad[1]], ['chest', ad[2]], ['head', ad[3]],
  ];
  for (const [slot, v] of dcMap) if (v !== undefined) dc[slot] = num(flt(v), 'f');

  for (const [k, v] of Object.entries(root)) {
    if (k === 'HandItems' || k === 'ArmorItems' || k === 'HandDropChances' || k === 'ArmorDropChances') continue;

    if (k === 'Attributes') {
      const arr = (v || []).map((a) => {
        if (!a || typeof a !== 'object') return null;
        const raw = String(a.Name ?? a.id ?? '');
        const id = 'minecraft:' + raw.replace(/^minecraft:/, '').replace(/^generic\./, '');
        const o = { id, base: dbl(has(a, 'Base') ? a.Base : a.base ?? 0) };
        if (a.Modifiers) o.modifiers = a.Modifiers;
        return o;
      }).filter(Boolean);
      if (arr.length) out.attributes = arr;
      continue;
    }

    if (k === 'ActiveEffects') {
      const arr = (v || []).map((e) => {
        if (!e || typeof e !== 'object') return null;
        const idNum = has(e, 'Id') ? int(e.Id) : null;
        const name = typeof e.id === 'string' ? e.id
          : (idNum != null && EFFECT_IDS[idNum]) ? 'minecraft:' + EFFECT_IDS[idNum] : null;
        if (!name) return null;
        const o = {
          id: name.startsWith('minecraft:') ? name : 'minecraft:' + name,
          amplifier: int(has(e, 'Amplifier') ? e.Amplifier : 0),
          duration: int(has(e, 'Duration') ? e.Duration : 0),
        };
        if (has(e, 'ShowParticles')) o.show_particles = !!(e.ShowParticles && e.ShowParticles.v !== 0);
        if (has(e, 'ShowIcon')) o.show_icon = !!(e.ShowIcon && e.ShowIcon.v !== 0);
        if (has(e, 'Ambient')) o.ambient = !!(e.Ambient && e.Ambient.v !== 0);
        if (has(e, 'HiddenEffect')) o.hidden_effect = e.HiddenEffect;
        return o;
      }).filter(Boolean);
      if (arr.length) out.active_effects = arr;
      continue;
    }

    if (k === 'CustomName') { out.CustomName = toComponent(v); continue; }
    if (k === 'DeathLootTable' && (v === 'none' || v === 'minecraft:none')) { out.DeathLootTable = 'suso.nats:none'; continue; }
    out[k] = v;
  }

  if (Object.keys(eq).length) out.equipment = eq;
  if (Object.keys(dc).length) out.drop_chances = dc;
  return out;
}

export const stats = { items: 0, entities: 0, effects: 0, attrs: 0, comps: 0 };
