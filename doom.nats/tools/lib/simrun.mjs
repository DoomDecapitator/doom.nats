// simrun.mjs — 从 sim.mjs 抽出的「包定义 + 场景 + 单场景执行」，供 sim.mjs 与 viz.mjs 共用。
// 抽出的原因：viz 需要同一套场景与同一条执行路径，才能保证"可视化看到的点"与 sim 验证的点完全一致。
import path from 'node:path';
import { World } from './mcworld.mjs';
import { Interp } from './interp.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

export const PACKS = {
  ported: { dir: path.join(ROOT, '..', 'ported', 'suso.nats'), ns: 'suso.nats' },
  optimized: { dir: path.join(ROOT, '..', 'optimized', 'suso.nats'), ns: 'suso.nats' },
  // v3：命名空间 doom.nats + 生物注册表 + 宏驱动刷怪（应与 optimized 逐事件一致）
  doom: { dir: path.join(ROOT, '..', 'v3', 'doom.nats'), ns: 'doom.nats' },
};

export const SCENARIOS = [
  { name: 'flat/forest/dark', biome: 'minecraft:forest', light: 0 },
  { name: 'flat/desert/dark', biome: 'minecraft:desert', light: 0 },
  { name: 'flat/lush_caves/light', biome: 'minecraft:lush_caves', light: 15 },
  // the only "light" roster (light_lush_caves) is gated to the map's real lush-caves box
  // x 236..606, y 108..253, z 161..518 — move the player inside it so the branch is exercised
  { name: 'region/lush_caves/light', biome: 'minecraft:lush_caves', light: 15, groundY: 150, player: { x: 400.5, y: 151, z: 300.5 } },
  { name: 'flat/snowy_taiga/dark', biome: 'minecraft:snowy_taiga', light: 0 },
  { name: 'flat/jungle/dark', biome: 'minecraft:jungle', light: 0 },
  { name: 'flat/basalt_deltas/dark', biome: 'minecraft:basalt_deltas', light: 0 },
  { name: 'flat/end_barrens/dark', biome: 'minecraft:end_barrens', light: 0 },
];

export function run(pack, scen, ticks, opts = {}) {
  const packDir = pack.dir;
  const tags = World.loadTags(packDir, pack.ns);
  const world = new World({ groundY: scen.groundY ?? 63, biome: scen.biome, light: scen.light, ...tags });
  const it = new Interp({ packDir, world, seed: opts.seed ?? 0xC0FFEE, budget: 12_000_000 });

  // one survival player facing +Z (position overridable per scenario)
  const pp = scen.player ?? { x: 0.5, y: 64, z: 0.5 };
  world.entities.push({
    uuid: 'player0', type: 'player', tags: [], nbt: {}, gamemode: 'survival',
    pos: { ...pp }, rot: { yaw: 0, pitch: 0 },
  });

  const attempts = [];
  const origRun = it.run.bind(it);
  it.run = (id, ctx, depth = 0, macroArgs = null) => {
    if (id.endsWith(':try')) attempts.push({ x: +ctx.pos.x.toFixed(3), y: +ctx.pos.y.toFixed(3), z: +ctx.pos.z.toFixed(3), yaw: +ctx.rot.yaw.toFixed(3), pitch: +ctx.rot.pitch.toFixed(3) });
    return origRun(id, ctx, depth, macroArgs);
  };

  // load hook
  it.run(pack.ns + ':setup', it.ctx());

  // Sync the LCG state and the run gate so both builds start from the identical stream.
  //  * the two seeding mechanisms (AEC UUID[0] vs /random) are single-draw and reported separately
  //  * the upstream pack never writes $enable anywhere, so it can never run; we force it here
  //    purely to make the two builds comparable (that defect is reported as O3)
  const SYNC = 987654321;
  it.setScore(pack.ns, '#rng', SYNC);
  it.setScore(pack.ns, '$rng', SYNC);
  it.setScore(pack.ns, '$enable', 1);
  const seedInfo = { portedSeed: world.entities.find((e) => e.type === 'area_effect_cloud')?.seededFrom };

  let crashed = null;
  try {
    for (let t = 0; t < ticks; t++) it.run(pack.ns + ':main', it.ctx());
  } catch (e) { crashed = e.message; }

  return { it, world, attempts, spawns: it.spawns, seedInfo, crashed };
}
