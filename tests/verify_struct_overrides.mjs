// _work/verify_struct_overrides.mjs —— 真机验证 v4.17（P1-6）「结构 spawn_overrides」。
//
//   用法：RCON_PORT=25581 node _work/verify_struct_overrides.mjs
//
// 源码依据（ChunkGenerator.getMobsAt，1.21.6）：
//   for (StructureStart s : structureManager.getAllStructuresAt(pos))
//      StructureSpawnOverride o = s.getStructure().spawnOverrides().get(category);
//      if (o != null && 位置落在 o.boundingBox() 声明的盒内) return o.spawns();   // ← 整表替换
//   return biome.getMobSettings().getMobs(category);
// 数据：vanilla data/minecraft/worldgen/structure/*.json（带非空 spawn_overrides 的仅 6 个；
//   本脚本验证除 fortress（已有专项 verify_struct_aabb.mjs）之外的 5 个）。
//
// 断言：
//   S0  locate 到结构、forceload、扫描出一个**真正落在结构内**的点（predicate 命中）
//   S1  pillager_outpost 内 monster 表 ⇒ 物种 = pillager（min/max 1/1）
//   S2  swamp_hut 内 creature 表 ⇒ cat；monster 表 ⇒ witch
//   S3  monument 内 monster 表 ⇒ guardian（min 2 / max 4）
//   S4  ancient_city / trial_chambers 内**任意类别** ⇒ 空表（$sel.ok 保持 0 = 原版 getRandom empty ⇒ break 整组）
//   S5  结构外（同一张表、同一点附近的对照点）⇒ 物种来自群系表（不是 pillager）
import fs from 'node:fs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail: String(detail) }); console.log((pass ? '✅ ' : '❌ ') + name + '  ' + detail); };

const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const set = (h, v) => cmd(`scoreboard players set ${h} doom.nats ${v}`);
const score = async (h) => { const t = await cmd('scoreboard players get ' + h + ' doom.nats'); const m = /has (-?\d+)/.exec(t); return m ? Number(m[1]) : NaN; };
const selField = async (k) => { const t = await cmd('data get storage doom.nats:sel ' + k); const m = /: (.*)$/.exec(t); return m ? m[1].trim() : '(无)'; };

console.log('=== 结构 spawn_overrides · 真机验证（P1-6）===');
if (!/There are/.test(await cmd('list'))) { console.log('❌ 没有玩家在线'); process.exit(1); }
for (let i = 0; i < 4; i++) {
  await set('$snap_period', 20000); await set('$eff.period', 100000);
  await sleep(700);
  if ((await score('$eff.period')) >= 1000) break;
}
console.log('刷怪冻结: $eff.period =', await score('$eff.period'));

// 找结构 → forceload → 在候选列上扫 y（locate 的 y 是 `~`，因为结构跨 y 段；predicate 的包围盒判定与 y 有关，
// 所以必须在候选 (x,z) 上把 y 扫出来。候选列取 locate 点 + 四向 ±16/±32：结构 BB 通常覆盖 locate 点）。
const findInside = async (name, dim, yRange = [40, 100]) => {
  const loc = await cmd(`execute in ${dim} run locate structure minecraft:${name}`);
  const m = /at \[(-?\d+), (~|-?\d+), (-?\d+)\]/.exec(loc);
  if (!m) return { err: 'locate 失败: ' + loc.slice(0, 120) };
  const cx = Number(m[1]), cz = Number(m[3]);
  for (let dx = -48; dx <= 48; dx += 16) for (let dz = -48; dz <= 48; dz += 16) await cmd(`execute in ${dim} run forceload add ${cx + dx} ${cz + dz}`);
  await sleep(1800);
  const cols = [[0, 0], [16, 0], [-16, 0], [0, 16], [0, -16], [32, 0], [-32, 0], [0, 32], [0, -32], [32, 32], [-32, -32], [32, -32], [-32, 32], [48, 0], [-48, 0], [0, 48], [0, -48]];
  for (const [dx, dz] of cols) {
    for (let y = yRange[0]; y <= yRange[1]; y += 4) {
      const t = await cmd(`execute in ${dim} positioned ${cx + dx} ${y} ${cz + dz} if predicate doom.nats:spawn/in_${name}`);
      if (/Test passed/.test(t)) return { cx, cz, x: cx + dx, y, z: cz + dz, dim };
    }
  }
  return { err: 'locate @' + cx + ',' + cz + ' 附近 ' + cols.length + ' 列 × y[' + yRange + '] 没扫到结构内的点' };
};

// 直接调某张**群系表**（结构覆盖挂在它的开头）；返回 { ok, type, min, max }
const callTable = async (inside, biome, cat) => {
  await set('$sel.ok', 0);
  await cmd('data remove storage doom.nats:sel type');
  await cmd(`execute in ${inside.dim} positioned ${inside.x} ${inside.y} ${inside.z} run function doom.nats:mob/biome/${biome}/${cat}`);
  const okv = await score('$sel.ok');
  return { ok: okv, type: okv === 1 ? (await selField('type')).replace(/"/g, '') : '(无)', min: await selField('min'), max: await selField('max') };
};
const freeAll = async (names, dims) => {
  for (let i = 0; i < names.length; i++) {
    await cmd(`execute in ${dims[i]} run forceload remove all`);
  }
};

// ---------------- S1 pillager_outpost（overworld，monster 表 ⇒ pillager 1/1）
{
  const p = await findInside('pillager_outpost', 'minecraft:overworld', [40, 130]);
  if (p.err) ok('S1 pillager_outpost 内 monster 表 ⇒ pillager', false, p.err);
  else {
    const t = await callTable(p, 'plains', 'monster');
    ok('S1 pillager_outpost 内 monster 表 ⇒ pillager（min1/max1）', t.ok === 1 && t.type === 'minecraft:pillager' && t.min === '1' && t.max === '1',
      `@${p.x},${p.y},${p.z} ⇒ ok=${t.ok} type=${t.type} min/max=${t.min}/${t.max}（群系表 plains/monster 不会出 pillager）`);
    // S5 对照：同一点 +100 格外（结构外）
    const out = { ...p, x: p.x + 400 };
    const t2 = await callTable(out, 'plains', 'monster');
    ok('S5 结构外对照 ⇒ 走群系表（不是 pillager）', t2.ok === 1 && t2.type !== 'minecraft:pillager', `+400 格处 ⇒ ok=${t2.ok} type=${t2.type}`);
  }
}

// ---------------- S2 swamp_hut（creature ⇒ cat / monster ⇒ witch）
{
  const p = await findInside('swamp_hut', 'minecraft:overworld', [50, 90]);
  if (p.err) ok('S2 swamp_hut 内 creature/monster 表', false, p.err);
  else {
    const tc = await callTable(p, 'swamp', 'creature');
    const tm = await callTable(p, 'swamp', 'monster');
    ok('S2a swamp_hut 内 creature 表 ⇒ cat', tc.ok === 1 && tc.type === 'minecraft:cat', `ok=${tc.ok} type=${tc.type}`);
    ok('S2b swamp_hut 内 monster 表 ⇒ witch', tm.ok === 1 && tm.type === 'minecraft:witch', `ok=${tm.ok} type=${tm.type}`);
  }
}

// ---------------- S3 monument（monster ⇒ guardian 2..4）
{
  const p = await findInside('monument', 'minecraft:overworld', [30, 70]);
  if (p.err) ok('S3 monument 内 monster 表 ⇒ guardian', false, p.err);
  else {
    const t = await callTable(p, 'deep_ocean', 'monster');
    ok('S3 monument 内 monster 表 ⇒ guardian（min2/max4）', t.ok === 1 && t.type === 'minecraft:guardian' && t.min === '2' && t.max === '4',
      `ok=${t.ok} type=${t.type} min/max=${t.min}/${t.max}`);
  }
}

// ---------------- S4 ancient_city / trial_chambers（所有类别空表 ⇒ ok=0）
for (const [name, biome, cat] of [['ancient_city', 'deep_dark', 'monster'], ['ancient_city', 'deep_dark', 'ambient'], ['trial_chambers', 'plains', 'monster']]) {
  const p = await findInside(name, 'minecraft:overworld', name === 'ancient_city' ? [-60, -20] : [-50, 60]);
  if (p.err) { ok('S4 ' + name + ' 内 ' + cat + ' 表为空（ok=0）', false, p.err); continue; }
  await set('$sel.ok', 0);
  await cmd('data remove storage doom.nats:sel type');
  await cmd(`execute in ${p.dim} positioned ${p.x} ${p.y} ${p.z} run function doom.nats:mob/biome/${biome}/${cat}`);
  const okv = await score('$sel.ok');
  ok('S4 ' + name + ' 内 ' + cat + ' 表为空（ok=0）', okv === 0, `ok=${okv}（原版 spawns:[] ⇒ getRandom empty ⇒ break 整组）`);
}

await freeAll(['pillager_outpost', 'swamp_hut', 'monument', 'ancient_city', 'trial_chambers'], Array(5).fill('minecraft:overworld'));
const pass = results.filter((x) => x.pass).length;
console.log('\n汇总: ' + pass + ' PASS / ' + (results.length - pass) + ' FAIL');
fs.writeFileSync('C:/Users/Dell/Downloads/datapack/_work/verify-struct-overrides.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
r.close?.();
process.exit(results.some((x) => !x.pass) ? 1 : 0);
