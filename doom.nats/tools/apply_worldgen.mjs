// tools/apply_worldgen.mjs —— Q7：把**地图自带 worldgen** 的 biome 覆盖合并进 roster 数据源
//   node tools/apply_worldgen.mjs --worldgen <地图数据包目录（含 data/）或其 data 目录> [--worldgen …]
//   node tools/apply_worldgen.mjs --reset                      # 还原为原版 biomes.json
//   node tools/apply_worldgen.mjs --status                     # 只看当前是原版还是已合并（列出与原版不同的群系）
//
// 原理：roster 链是 _work/generated/biomes.json → export_rosters.mjs → biome-rosters.json → gen_ctm_mobs.mjs。
//   地图若覆盖 data/<ns>/worldgen/biome/<name>.json，注册表条目是**整体替换**（不是逐字段合并），
//   所以我们只取 spawners / spawn_costs / creature_spawn_probability 三个字段替换对应群系（新群系则整条新增）。
//   合并后必须重跑：export_rosters.mjs → gen_ctm_mobs.mjs（→ 全量生成器），包体才会用上新表。
//
// ⚠ 字段名映射（2026-09-28 修；本文件曾因此**静默失效**两次）：
//   ① 源 JSON 是 snake_case（spawn_costs / creature_spawn_probability），biomes.json 是 camelCase
//      （spawnCosts / creatureSpawnProbability）⇒ 旧版原样写入 ⇒ export_rosters 读不到 ⇒ 地图的 spawn_costs 被丢弃；
//   ② 源 spawners 用 minCount/maxCount，biomes.json 用 min/max ⇒ 旧版原样写入 ⇒ 生成器产出 `min:undefined` 的坏行。
//   现在统一走 tools/lib/biome-json.mjs（与 tools/export_biomes.mjs 同一份转换）。
// ⚠ 缺省语义同原版 codec（整体替换，不能用 Object.assign 保留旧值）：
//   spawn_costs 缺省 = 空表；creature_spawn_probability 缺省 = 0.1（MobSpawnSettings.CODEC）。
import fs from 'node:fs'; import path from 'node:path';
import { entryFromWorldgen } from './lib/biome-json.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, '_work', 'generated', 'biomes.json');
const BAK = path.join(ROOT, '_work', 'generated', 'biomes.vanilla.json');
const argv = process.argv.slice(2);
if (!fs.existsSync(SRC)) { console.log('缺 ' + SRC); process.exit(2); }

// 地图包目录：既接受 <pack>/data，也接受 <pack>（含 data/）
const dataRootOf = (p) => (fs.existsSync(path.join(p, 'data')) ? path.join(p, 'data') : p);
const scanWorldgen = (dir) => {
  const out = [];
  const base = dataRootOf(path.resolve(dir));
  if (!fs.existsSync(base)) return out;
  for (const ns of fs.readdirSync(base)) {
    const wg = path.join(base, ns, 'worldgen', 'biome');
    if (!fs.existsSync(wg)) continue;
    for (const f of fs.readdirSync(wg)) if (f.endsWith('.json')) out.push({ ns, file: f, path: path.join(wg, f) });
  }
  return out;
};

if (argv.includes('--reset')) {
  if (!fs.existsSync(BAK)) { console.log('没有备份可还原（' + BAK + '）'); process.exit(2); }
  fs.copyFileSync(BAK, SRC); console.log('已还原原版 biomes.json（来自 ' + path.relative(ROOT, BAK) + '）');
  process.exit(0);
}
if (argv.includes('--status')) {
  const cur = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const vanilla = fs.existsSync(BAK) ? JSON.parse(fs.readFileSync(BAK, 'utf8')) : null;
  const cb = cur.biomes || cur, vb = vanilla ? (vanilla.biomes || vanilla) : null;
  console.log('数据源: ' + path.relative(ROOT, SRC) + '（' + Object.keys(cb).length + ' 群系）');
  if (!vb) { console.log('⚠ 无原版备份 ⇒ 无法判定是否已合并（' + path.relative(ROOT, BAK) + ' 不存在）'); process.exit(0); }
  const diff = Object.keys(cb).filter((k) => JSON.stringify(cb[k]) !== JSON.stringify(vb[k]))
    .concat(Object.keys(vb).filter((k) => !(k in cb)));
  console.log('原版备份: ' + path.relative(ROOT, BAK) + '（' + Object.keys(vb).length + ' 群系）');
  console.log(diff.length ? '与原版不同的群系 ' + diff.length + ' 个：' + diff.slice(0, 12).join(' ') + (diff.length > 12 ? ' …' : '')
    : '与原版一致 ✅（未合并任何地图 worldgen）');
  process.exit(0);
}

const dirs = []; for (let i = 0; i < argv.length; i++) if (argv[i] === '--worldgen' && argv[i + 1]) dirs.push(argv[i + 1]);
if (!dirs.length) { console.log('用法：--worldgen <目录> [--worldgen <目录> …] | --reset | --status'); process.exit(2); }

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const wrapKey = raw.biomes ? 'biomes' : null;
const data = wrapKey ? raw[wrapKey] : raw;
if (!fs.existsSync(BAK)) { fs.copyFileSync(SRC, BAK); console.log('已备份原版 → ' + path.relative(ROOT, BAK)); }

let add = 0, over = 0; const log = [];
for (const dir of dirs) {
  const base = path.resolve(dir);
  if (!fs.existsSync(base)) { console.log('跳过不存在的目录 ' + base); continue; }
  const files = scanWorldgen(base);
  if (!files.length) { console.log('跳过（未发现 <ns>/worldgen/biome/*.json）：' + base); continue; }
  for (const { ns, file, path: fp } of files) {
    const id = ns + ':' + file.slice(0, -5);
    let j; try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) { console.log('解析失败 ' + file + ': ' + e.message); continue; }
    if (j.spawners === undefined) { log.push('  ' + id + '：无 spawners 字段（不是群系覆盖？），忽略'); continue; }
    // 1.21.6 格式体检（不阻断 roster 合并，但必须喊出来：结构过期的文件装进游戏会让**整包**加载失败）
    //   证据：1.20.1 的地图包（RC4）里 carvers:{} 与 effects.music:{…} 在 1.21.6 直接解析失败 ⇒
    //   `Failed to load datapacks, can't proceed with server load`（mcserver-wg/run.log 15:33:29）
    const fmt = [];
    if (j.carvers !== undefined && typeof j.carvers !== 'string' && !Array.isArray(j.carvers) && !(j.carvers && j.carvers.type)) {
      fmt.push('carvers 不是 字符串/数组/带 type 的对象（1.20.1 的 {} 在 1.21.6 非法）');
    }
    if (j.effects && j.effects.music && !Array.isArray(j.effects.music)) {
      fmt.push('effects.music 不是加权列表（1.21.6 要求 [{"data":{…},"weight":n}]）');
    }
    if (fmt.length) log.push('  ⚠ ' + id + '：1.21.6 格式体检不合格 —— ' + fmt.join('；') + '（roster 合并照做，但该文件必须先迁移格式才能装）');
    // 整体替换语义：三个字段一律以地图条目为准，缺省按 codec 默认值填（fillDefaults=true）
    const patch = entryFromWorldgen(j, { fillDefaults: true });
    const desc = '（spawners ' + Object.keys(patch.spawners).length + ' 类 / spawn_costs ' + Object.keys(patch.spawnCosts).length
      + ' 条 / creature ' + patch.creatureSpawnProbability + '）';
    if (data[id]) { data[id] = patch; over++; log.push('  ' + id + '：覆盖 ' + desc); }
    else { data[id] = patch; add++; log.push('  ' + id + '：新增 ' + desc); }
  }
}
fs.writeFileSync(SRC, JSON.stringify(raw, null, 1));
console.log(log.join(String.fromCharCode(10)));
console.log('合并完成：覆盖 ' + over + ' 个、新增 ' + add + ' 个群系 → ' + path.relative(ROOT, SRC));
console.log('接下来必须重跑：node tools/export_rosters.mjs && node tools/gen_ctm_mobs.mjs（再跑其余生成器）');
