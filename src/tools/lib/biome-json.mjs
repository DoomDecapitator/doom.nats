// tools/lib/biome-json.mjs —— 「群系 worldgen JSON → biomes.json 条目」的**唯一**转换（Q7）
//
// 为什么要有这个文件：同一件事有两个来源——原版 jar（tools/export_biomes.mjs）与地图自带 worldgen 覆盖
// （tools/apply_worldgen.mjs）。两边各写一份转换就会出现字段名漂移，实测踩过两次（都是**静默**失效）：
//   ① spawn_costs 原样写进 biomes.json ⇒ export_rosters 读 spawnCosts 读不到 ⇒ 地图的 cost 被丢弃；
//   ② spawners 的 minCount/maxCount 原样写 ⇒ 生成器读 min/max 得到 undefined ⇒ 生成 `min:undefined` 的坏行。
//
// 字段对照（worldgen JSON ↔ biomes.json / biome-rosters.json）：
//   spawners[].minCount / maxCount → min / max        （export_biomes 原逻辑：minCount ?? 1）
//   spawn_costs{}.energy_budget    → spawnCosts{}.budget（charge 同名）
//   creature_spawn_probability     → creatureSpawnProbability（缺省 0.1）
// 证据链见 docs/19 第六节；缺省值取自 _work/decomp/out/net/minecraft/world/level/biome/MobSpawnSettings.java:29
//   `Codec.floatRange(0.0F, 0.9999999F).optionalFieldOf("creature_spawn_probability", 0.1F)`。
export const CREATURE_PROBABILITY_DEFAULT = 0.1;

/** worldgen `spawners` → biomes.json `spawners`（空类别与原版导出一致：**丢弃** ⇒ 该类别不收录） */
export function spawnersOf(j) {
  const out = {};
  for (const [cat, list] of Object.entries(j.spawners || {})) {
    if (!Array.isArray(list) || !list.length) continue;
    out[cat] = list.map((it) => ({
      type: it.type,
      min: it.minCount ?? 1,
      max: it.maxCount ?? 1,
      weight: it.weight,
    }));
  }
  return out;
}

/** worldgen `spawn_costs` → biomes.json `spawnCosts`（空表返回 {}） */
export function costsOf(j) {
  const out = {};
  for (const [t, c] of Object.entries(j.spawn_costs || {})) out[t] = { charge: c.charge, budget: c.energy_budget };
  return out;
}

/**
 * 一个群系 JSON → biomes.json 条目。
 *   fillDefaults=false（原版导出）：省略空字段 —— 与原版 jar 导出的**逐字节**一致（键序也一致）
 *   fillDefaults=true （地图覆盖）：整体替换语义 ⇒ 缺省值显式写出（spawn_costs 缺省=空表、creature 缺省=0.1）
 */
export function entryFromWorldgen(j, { fillDefaults = false } = {}) {
  const spawners = spawnersOf(j);
  const costs = costsOf(j);
  const prob = j.creature_spawn_probability;
  if (!fillDefaults) {
    return {
      ...(prob !== undefined ? { creatureSpawnProbability: prob } : {}),
      ...(Object.keys(costs).length ? { spawnCosts: costs } : {}),
      spawners,
    };
  }
  return {
    creatureSpawnProbability: prob !== undefined ? prob : CREATURE_PROBABILITY_DEFAULT,
    spawnCosts: costs,
    spawners,
  };
}
