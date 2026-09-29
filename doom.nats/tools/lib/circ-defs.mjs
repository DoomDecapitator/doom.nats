// circ-defs.mjs — Circumstance（环境情形）定义的**单一数据源**。
//
// 由 gen_ctm.mjs（展开成 circ/load + circ/eval）与 gen_ctm_effects.mjs（展开成 circ/apply + 光照档谓词）
// 共同 import，确保"注册表内容"与"判定/生效逻辑"永远来自同一份定义。
//
// when  判定维度：weather 0晴/1雨/2雷暴 · time "night"(13000..23000) · dim 0/1/2 · players(>=N) · phase 月相
// effects 覆盖项（都是**覆盖原版语义的参数**，不是凭空加的开关）：
//   period        —— 刷怪节拍（原版每 tick 尝试，这里可调）
//   max_<cat>     —— 该类别的 maxInstancesPerChunk（原版 monster 70 / creature 10 / ambient 15）
//   lightRule     —— 综合亮度上限（原版主世界/末地 uniform(0..7)、下界常量 7）
export const CIRC = [
  {
    id: 'rainy_night',
    when: { weather: 1, time: 'night' },
    effects: { period: 3, max_monster: 90 },
    note: '雨夜：节拍加快、怪物上限提高',
  },
  {
    id: 'thunder',
    when: { weather: 2 },
    effects: { period: 2, max_monster: 100 },
    note: '雷暴：原版靠 skyDarken=10 让刷怪更容易（Monster.isDarkEnoughToSpawn），这里显式化',
  },
  {
    id: 'multiplayer',
    when: { players: 2 },
    effects: { period: 4 },
    note: '多人：per-player cap 各自独立、并集容量随人数放大，故放宽全局节拍',
  },
  {
    id: 'nether',
    when: { dim: 1 },
    effects: { lightRule: 7, max_monster: 70 },
    note: '下界：block_light_limit=15（不限制方块光）、综合亮度 <= 7（对齐 dimension_type）',
  },
];

// 生效参数的默认值（= 原版语义，maxInstancesPerChunk 全部 7 个类别）
// ⚠ 必须**全部**类别都给默认值：群系表里有水下/美西螈等类别，若 $eff.max_<cat> 未定义，
//   check/local_one 的 `if score $cnt.local < $eff.max_$(cat)` 会静默失败 ⇒ 该类别永远 reason=6
//   （v4.3 实测踩到：选了 underground_water_creature ⇒ 一次都刷不出来）。
export const DEFAULTS = {
  period: 5,
  'max_monster': 70,
  'max_creature': 10,
  'max_ambient': 15,
  'max_water_creature': 5,
  'max_water_ambient': 20,
  'max_underground_water_creature': 5,
  'max_axolotls': 5,
  lightRule: 7,
  creatureGate: 400,
};

// 生成 "if score $circ.<id> matches 1 → 条件命令" 的判定串
export const whenToCmd = (w, NS) => {
  const p = [];
  if (w.weather === 1) p.push('if score $snap.weather ' + NS + ' matches 1..');
  if (w.weather === 2) p.push('if score $snap.weather ' + NS + ' matches 2..');
  if (w.time === 'night') p.push('if score $snap.daytime ' + NS + ' matches 13000..23000');
  if (w.dim !== undefined) p.push('if score $snap.dim ' + NS + ' matches ' + w.dim);
  if (w.players) p.push('if score $snap.players ' + NS + ' matches ' + w.players + '..');
  if (w.phase !== undefined) p.push('if score $snap.phase ' + NS + ' matches ' + w.phase);
  return p.join(' ');
};

// 把一条情形的 effects 展开成"置生效参数"的命令行
export const effectLines = (c, NS) => {
  const out = [];
  for (const [k, v] of Object.entries(c.effects)) {
    const key = k === 'lightRule' ? 'light' : k;
    out.push('execute if score $circ.' + c.id + ' ' + NS + ' matches 1 run scoreboard players set $eff.' + key + ' ' + NS + ' ' + v);
  }
  return out;
};
