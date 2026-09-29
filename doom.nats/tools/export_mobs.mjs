// export_mobs.mjs — 从群系刷怪表反推「生物条目表」（CTM 复刻的 mobs 注册表数据源）。
//
//   node tools/export_mobs.mjs
//
// 职责分离（重要）：
//   mobs.json    实体 → 生成载荷与元数据（category / NBT / charge / 生成簇上限 / 放置类型）
//   rosters.json 群系 → 类别 → 加权区间（含 minCount..maxCount，**每个群系可以不同**）
//   ⇒ 同一实体在不同群系的 min/max 差异留在 roster 里，mob 条目只描述"这类生物是什么"。
//
// 产物：_work/generated/mobs.json
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const GEN = path.join(ROOT, '_work', 'generated');
const biomes = JSON.parse(fs.readFileSync(path.join(GEN, 'biomes.json'), 'utf8')).biomes;

// getMaxSpawnClusterSize 的逐生物覆盖值。
// 默认 4；下表来自第三方源码级文档（tree-hole），**待用源码逐条复核**（见 docs/10 的检视）。
const CLUSTER_OVERRIDE = {
  'minecraft:cod': 8, 'minecraft:tropical_fish': 8, 'minecraft:salmon': 8, 'minecraft:pufferfish': 8,
  'minecraft:tadpole': 8, 'minecraft:wolf': 8,
  'minecraft:horse': 6, 'minecraft:donkey': 6, 'minecraft:mule': 6, 'minecraft:skeleton_horse': 6, 'minecraft:zombie_horse': 6,
  'minecraft:pillager': 1, 'minecraft:ghast': 1, 'minecraft:happy_ghast': 1,
  'minecraft:drowned': 1, 'minecraft:witch': 1, 'minecraft:zombie_villager': 1,
};
const DEFAULT_CLUSTER = 4;

const mobs = new Map();     // type -> entry
const conflicts = [];

for (const [biome, data] of Object.entries(biomes)) {
  for (const [cat, list] of Object.entries(data.spawners)) {
    for (const it of list) {
      const t = it.type;
      let e = mobs.get(t);
      if (!e) {
        e = { type: t, category: cat, nbt: {}, biomes: [], seenMinMax: new Set(), hasSpawnCost: false };
        mobs.set(t, e);
      } else if (e.category !== cat) {
        conflicts.push(t + ': ' + e.category + ' vs ' + cat + ' (biome ' + biome + ')');
      }
      e.biomes.push(biome);
      e.seenMinMax.add(it.min + '..' + it.max);
      // charge/budget 是「群系 × 实体」的属性（同一实体在不同群系取值不同），因此只在这里做标记，
      // 真实取值随群系存在 rosters 层。
      if (data.spawnCosts?.[t]) e.hasSpawnCost = true;
    }
  }
}

const out = {};
for (const [t, e] of [...mobs.entries()].sort()) {
  const short = t.replace('minecraft:', '');
  out[t] = {
    type: t,
    category: e.category,
    nbt: e.nbt,
    maxCluster: CLUSTER_OVERRIDE[t] ?? DEFAULT_CLUSTER,
    ...(e.hasSpawnCost ? { spawnCost: true } : {}),
    biomeCount: e.biomes.length,
    minMaxVariants: [...e.seenMinMax].sort(),
  };
}

fs.writeFileSync(path.join(GEN, 'mobs.json'), JSON.stringify({
  note: 'CTM 复刻用生物条目；minCount/maxCount 不在此表（按群系存于 rosters），maxCluster 的特例值待源码复核',
  defaults: { maxCluster: DEFAULT_CLUSTER },
  count: Object.keys(out).length,
  mobs: out,
}, null, 1));

console.log('=== 生物条目导出 ===');
console.log('实体数:', Object.keys(out).length);
console.log('类别冲突:', conflicts.length ? conflicts.join(' | ') : '无 ✅');
const byCat = new Map();
for (const v of Object.values(out)) byCat.set(v.category, (byCat.get(v.category) || 0) + 1);
console.log('按类别:', [...byCat].map(([k, v]) => k + '×' + v).join(' '));
const withCost = Object.values(out).filter((v) => v.spawnCost);
console.log('涉及 spawn cost 的实体:', withCost.map((v) => v.type).join(' ') || '无');
const multi = Object.values(out).filter((v) => v.minMaxVariants.length > 1);
console.log('min/max 随群系变化的实体 (' + multi.length + '):');
for (const v of multi.slice(0, 6)) console.log('   ' + v.type + ' → ' + v.minMaxVariants.join(' , '));
console.log();
console.log('样例:', JSON.stringify(out['minecraft:zombie']));
console.log('产物:', path.join(GEN, 'mobs.json'), '(' + (fs.statSync(path.join(GEN, 'mobs.json')).size / 1024).toFixed(0) + ' KB)');
