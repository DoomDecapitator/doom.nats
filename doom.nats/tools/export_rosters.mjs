// export_rosters.mjs — 把群系刷怪权重表转成「闭区间表」，供数据包按 RNG 直接命中。
//
//   node tools/export_rosters.mjs
//
// 等价性：原版 WeightedRandom.getRandomItem(random, list) 取 random.nextInt(weightSum)，
// 再对权重做线性累加扫描。因此用闭区间 [cumulative, cumulative + weight - 1] 划分 [0, weightSum-1]
// 与原版**逐点等价**（同样的 rng 值命中同样的条目）。
//
// 产物：_work/generated/biome-rosters.json
//
// Q7（地图自带 worldgen，见 docs/19 第六节）：地图可以把某个群系的某个类别**整类删掉**
//   （例如 `spawners:{}` 或只留 creature），所以本文件**不得假定任何群系/类别存在** ——
//   demo 段一律「遍历取样例」；极端覆盖下也要正常退出（旧版靠一句临时短路守卫掩盖，已删）。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, '_work', 'generated', 'biomes.json');
const OUT = path.join(ROOT, '_work', 'generated', 'biome-rosters.json');

const doc = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const rosters = {};
let checked = 0;
const problems = [];

for (const [biome, data] of Object.entries(doc.biomes)) {
  const perCat = {};
  for (const [cat, list] of Object.entries(data.spawners)) {
    let cursor = 0;
    const rows = list.map((it, i) => {
      const from = cursor;
      const to = cursor + it.weight - 1;
      cursor += it.weight;
      const cost = data.spawnCosts?.[it.type];
      return { from, to, i, type: it.type, min: it.min, max: it.max, weight: it.weight, ...(cost ? { charge: cost.charge, budget: cost.budget } : {}) };
    });
    // 自检：区间必须无缝且完整覆盖 [0, weightSum-1]
    const sum = rows.reduce((s, x) => s + x.weight, 0);
    if (cursor !== sum) problems.push(biome + '/' + cat + ': 累计权重 ' + cursor + ' != 权重和 ' + sum);
    for (let k = 1; k < rows.length; k++) {
      if (rows[k].from !== rows[k - 1].to + 1) problems.push(biome + '/' + cat + ': 区间断裂 @' + k);
    }
    if (rows.length && (rows[0].from !== 0 || rows[rows.length - 1].to !== sum - 1)) {
      problems.push(biome + '/' + cat + ': 覆盖范围异常 ' + rows[0].from + '..' + rows[rows.length - 1].to);
    }
    checked++;
    perCat[cat] = { weightSum: sum, rows };
  }
  rosters[biome] = {
    ...(data.creatureSpawnProbability !== undefined ? { creatureSpawnProbability: data.creatureSpawnProbability } : {}),
    ...(data.spawnCosts ? { spawnCosts: data.spawnCosts } : {}),
    categories: perCat,
  };
}

fs.writeFileSync(OUT, JSON.stringify({ note: '闭区间划分，与 MC WeightedRandom 逐点等价', rosters }, null, 1));

// ---------------- demo（遍历式：不假定 plains/monster 存在） ----------------
const biomeIds = Object.keys(rosters).sort();
const catHist = {};
for (const b of biomeIds) for (const c of Object.keys(rosters[b].categories)) catHist[c] = (catHist[c] || 0) + 1;
const noCat = biomeIds.filter((b) => !Object.keys(rosters[b].categories).length);

console.log('=== 区间表导出 ===');
console.log('群系:', biomeIds.length, '| 校验的 (群系×类别) 组合:', checked);
console.log('区间自检:', problems.length ? '❌ ' + problems.length + ' 处问题' : '✅ 全部无缝覆盖');
for (const p of problems.slice(0, 8)) console.log('   !', p);
console.log('类别分布:', Object.entries(catHist).sort().map(([c, n]) => c + '=' + n).join(' ') || '(无)',
  '| 无任何类别的群系:', noCat.length, noCat.length ? '(' + noCat.slice(0, 4).join(', ') + (noCat.length > 4 ? ' …' : '') + ')' : '');
console.log();

// 取样例：优先 plains/monster（原版形态），没有就遍历退化为「第一个含 monster 的群系 → 第一个含任意类别的群系」
const pick = (b) => rosters[b];
const sampleBiome = biomeIds.find((b) => pick(b).categories.monster)
  || biomeIds.find((b) => Object.keys(pick(b).categories).length) || null;
if (sampleBiome) {
  const cat = pick(sampleBiome).categories.monster ? 'monster' : Object.keys(pick(sampleBiome).categories)[0];
  const entry = pick(sampleBiome).categories[cat];
  const fellBack = sampleBiome !== 'minecraft:plains' || cat !== 'monster';
  console.log('样例 ' + sampleBiome + '/' + cat + '（权重和 ' + entry.weightSum + '，' + entry.rows.length + ' 条）'
    + (fellBack ? '   ← plains/monster 不在本次表中，遍历退化取到这一条' : ''));
  for (const row of entry.rows.slice(0, 6)) {
    console.log('   [' + String(row.from).padStart(3) + '..' + String(row.to).padStart(3) + ']  ' + row.type + '  ×' + row.min + '..' + row.max);
  }
} else {
  console.log('样例：无 —— 本次导出的 65 个群系全部没有类别（地图把 spawners 全删了？）');
}
// 样例 spawnCosts：遍历取第一个非空 cost 的群系（原版只有 warped_forest / soul_sand_valley）
const costBiome = biomeIds.find((b) => rosters[b].spawnCosts && Object.keys(rosters[b].spawnCosts).length);
console.log('样例 spawnCosts:', costBiome ? costBiome + ' ' + JSON.stringify(rosters[costBiome].spawnCosts) : '(本次表中无任何非空 spawn_costs)');
console.log('产物:', OUT, '(' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');

// 区间自检失败 ⇒ 非 0 退出（供 check_static / regress 直接当门用）
if (problems.length) process.exit(1);
