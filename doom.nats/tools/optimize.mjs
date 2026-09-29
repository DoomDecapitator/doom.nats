// optimize.mjs — build the v2 pack: 1.20.2+/1.21.6 features, zero auxiliary entities.
//   ported/suso.nats -> optimized/suso.nats
//
// O1  kill all fake entities: sentinel marker, area_effect_cloud, ns_ground dispatch markers
//     + delete forceload + collapse pos_search (63 files) into a single macro function
// O2  biome predicates: entity_properties -> location_check (positional, needs no entity)
// O3  fix RNG bucket overlap, enable the pack by default, datapack-provided empty loot table
import fs from 'node:fs';
import path from 'node:path';
import { applyExternalTagFallback } from './lib/exttag.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, '..', 'ported', 'suso.nats');
const DST = path.join(ROOT, '..', 'optimized', 'suso.nats');
const R = (...p) => path.join(DST, ...p);

fs.rmSync(DST, { recursive: true, force: true });
const put = (rel, text) => { const p = R(rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text.replace(/\r\n/g, '\n')); };
const read = (...p) => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const log = [];

// ---------------------------------------------------------------- metadata
put('pack.mcmeta', JSON.stringify({
  pack: {
    pack_format: 80,
    description: '§bSuso\'s utility datapack for fake natural spawns §7[v2 · 1.21.6 · entity-free]',
  },
}, null, 4) + '\n');

put('data/minecraft/tags/function/load.json', JSON.stringify({ values: ['suso.nats:setup'] }));
put('data/minecraft/tags/function/tick.json', JSON.stringify({ values: ['suso.nats:main'] }));

// ---------------------------------------------------------------- L1 dispatch
put('data/suso.nats/function/main.mcfunction', read('data/suso.nats/function/main.mcfunction'));
put('data/suso.nats/function/check.mcfunction', read('data/suso.nats/function/check.mcfunction'));
put('data/suso.nats/function/repeat.mcfunction', read('data/suso.nats/function/repeat.mcfunction'));

// O1: no forceload, no sentinel marker, no seeder entity; LCG seeded from /random
put('data/suso.nats/function/setup.mcfunction', `# v2 setup — no forceload, no sentinel entities (1.20.2+ /random + macros)
scoreboard objectives add suso.nats dummy

scoreboard players set #3 suso.nats 3
scoreboard players set #0 suso.nats 0
scoreboard players set #32 suso.nats 32
scoreboard players set #135 suso.nats 135
scoreboard players set #1000 suso.nats 1000
scoreboard players set #36000 suso.nats 36000

execute unless score $period suso.nats matches 1.. run scoreboard players set $period suso.nats 5
execute unless score $repeat suso.nats matches 1.. run scoreboard players set $repeat suso.nats 10
execute unless score $cap suso.nats matches 1.. run scoreboard players set $cap suso.nats 70
# O3: original never wrote $enable anywhere, so the pack could never run
execute unless score $enable suso.nats matches 1.. run scoreboard players set $enable suso.nats 1

function suso.nats:rng/seed
`);
log.push('O1 setup: removed forceload + marker + area_effect_cloud');
log.push('O3 setup: $enable now defaults to 1');

put('data/suso.nats/function/rng/lcg.mcfunction', read('data/suso.nats/function/rng/lcg.mcfunction'));

// O1: seed without an entity
put('data/suso.nats/function/rng/seed.mcfunction', `# v2 seed — /random value (1.20.2) replaces the area_effect_cloud UUID trick
scoreboard players set #rng.mult suso.nats 1103515245
execute store result score #rng suso.nats run random value 0..2147483647
scoreboard players operation $rng suso.nats = #rng suso.nats
`);
log.push('O1 rng/seed: area_effect_cloud -> /random value');

// ---------------------------------------------------------------- L4 placement
// O1: 63-file binary tree -> 1 macro function. Leaves were exactly 27 + 3*s (s in 0..31).
put('data/suso.nats/function/do.mcfunction', `# v2 do — rotation + distance via storage-backed macro
#Rotation
function suso.nats:rng/lcg
scoreboard players operation $rng suso.nats %= #36000 suso.nats
execute store result storage suso.nats:place yaw float 0.01 run scoreboard players get $rng suso.nats

#Pitch distribution makes values closest to 0 more likely
function suso.nats:rng/lcg
scoreboard players operation $rng suso.nats %= #135 suso.nats
scoreboard players remove $rng suso.nats 67
scoreboard players operation $temp suso.nats = $rng suso.nats
function suso.nats:rng/lcg
scoreboard players operation $rng suso.nats %= #135 suso.nats
scoreboard players operation $temp suso.nats *= $rng suso.nats
execute store result storage suso.nats:place pitch float 0.01 run scoreboard players get $temp suso.nats

#Distance — the original binary search tree covered exactly {27,30,...,120} == 27 + 3*s.
# NOTE: Java % keeps the sign, so $rng % 32 can be NEGATIVE. The original tree branches on
# 'matches ..N', which also matches negatives, so every negative $s falls through to the
# lowest leaf (27). Clamp with '>' (max) to reproduce that exactly.
function suso.nats:rng/lcg
scoreboard players operation $rng suso.nats %= #32 suso.nats
scoreboard players operation $dist suso.nats = $rng suso.nats
scoreboard players set #0 suso.nats 0
scoreboard players operation $dist suso.nats > #0 suso.nats
scoreboard players operation $dist suso.nats *= #3 suso.nats
scoreboard players add $dist suso.nats 27
execute store result storage suso.nats:place dist int 1 run scoreboard players get $dist suso.nats

function suso.nats:place with storage suso.nats:place
`);

put('data/suso.nats/function/place.mcfunction',
  `$execute rotated $(yaw) $(pitch) positioned ^ ^ ^$(dist) align xyz positioned ~.5 ~ ~.5 run function suso.nats:try\n`);
log.push('O1 pos_search: 63 functions -> place.mcfunction (1 macro line)');

put('data/suso.nats/function/try.mcfunction', read('data/suso.nats/function/try.mcfunction'));
put('data/suso.nats/function/fall.mcfunction', read('data/suso.nats/function/fall.mcfunction'));
put('data/suso.nats/function/spawn/float/check.mcfunction', read('data/suso.nats/function/spawn/float/check.mcfunction'));
put('data/suso.nats/function/spawn/float/water/do.mcfunction', read('data/suso.nats/function/spawn/float/water/do.mcfunction'));
// upstream spawn/float/do.mcfunction is entirely commented out; keep an empty stub so the
// reference in spawn/float/check.mcfunction still resolves (1.20.2+ parses functions at load)
put('data/suso.nats/function/spawn/float/do.mcfunction', '# upstream: all lines commented out (floating ground spawns disabled)\n');

// ground/check must call the renamed entity-free dispatcher
{
  const src = read('data/suso.nats/function/spawn/ground/check.mcfunction');
  const dst = src.replace(/suso\.nats:spawn\/ground\/do\b/g, 'suso.nats:spawn/ground/dispatch');
  if (dst === src) throw new Error('ground/check: expected a spawn/ground/do reference to rewrite');
  put('data/suso.nats/function/spawn/ground/check.mcfunction', dst);
  log.push('O1 ground/check: spawn/ground/do -> spawn/ground/dispatch');
}

// ---------------------------------------------------------------- L5/L6 dispatch, entity-free
put('data/suso.nats/function/spawn/ground/dispatch.mcfunction', `# v2 dispatch — positional predicates, no ns_ground marker entity
execute if predicate suso.nats:dark run function suso.nats:mob/dark
execute unless predicate suso.nats:dark run function suso.nats:mob/light
`);

const AREA = { predicate: 'suso.nats:warped_arena', box: [600, 60, -835, 80, 50, 50] };

function convertDispatch(srcName, dstId) {
  const src = read('data/suso.nats/function/spawn/ground', srcName);
  const out = [];
  for (const line of src.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = /^execute at @s\[predicate=(suso\.nats:[a-z_]+)\](.*?) run function suso\.nats:spawn\/ground\/([a-z_]+)$/.exec(t);
    if (!m) { out.push(line); continue; }
    const [, pred, mid, fn] = m;
    let extra = '';
    if (mid && mid.includes('unless entity @s[')) {
      extra = ` unless predicate ${AREA.predicate}`;
      log.push(`O2 ${srcName}: bounding-box test -> positional predicate ${AREA.predicate}`);
    }
    out.push(`execute if predicate ${pred}${extra} run function suso.nats:mob/${fn}`);
  }
  put(`data/suso.nats/function/${dstId}.mcfunction`, out.join('\n') + '\n');
  return out.length;
}
const nDark = convertDispatch('ns_ground_dark.mcfunction', 'mob/dark');
const nLight = convertDispatch('ns_ground_light.mcfunction', 'mob/light');
log.push(`O2 dispatch: ns_ground_dark -> mob/dark (${nDark} branches), ns_ground_light -> mob/light (${nLight})`);

// rosters: copy 1:1, but rewrite entity-anchored region tests into positional predicates,
// and fix the O3 RNG bucket overlap
const { makePositional } = await import('./rules/positional.mjs');
const pos = makePositional({
  externalPredicateDir: path.join(ROOT, '_work', 'packs', 'rc4', 'data', 'general', 'predicates'),
});
const groundDir = path.join(SRC, 'data/suso.nats/function/spawn/ground');
let boxLines = 0;
for (const f of fs.readdirSync(groundDir)) {
  const m = /^(dark_[a-z_]+|light_[a-z_]+)\.mcfunction$/.exec(f);
  if (!m) continue;
  let src = fs.readFileSync(path.join(groundDir, f), 'utf8');
  if (f === 'dark_lush_caves.mcfunction') {
    const before = src;
    src = src.replace(/matches 1\.\.250 /g, 'matches 1..249 ');
    if (src !== before) log.push('O3 dark_lush_caves: RNG bucket overlap 250 fixed (1..250 -> 1..249)');
  }
  const out = src.split(/\r?\n/).map((line) => {
    const r = pos.convertLine(line);
    if (r.changed) boxLines++;
    return r.text;
  }).join('\n');
  put(`data/suso.nats/function/mob/${f}`, out);
}
log.push(`O2 rosters: ${boxLines} entity-anchored region tests -> positional predicates`);
for (const slug of pos.order) {
  put(`data/suso.nats/predicate/${slug}.json`, JSON.stringify(pos.boxes.get(slug), null, 2) + '\n');
}
log.push(`O2 generated ${pos.order.length} box predicate(s): ${pos.order.join(', ')}`);

// ---------------------------------------------------------------- predicates
const predSrc = path.join(SRC, 'data/suso.nats/predicate');
let converted = 0;
for (const f of fs.readdirSync(predSrc)) {
  const j = JSON.parse(fs.readFileSync(path.join(predSrc, f), 'utf8'));
  if (f === 'dark.json') { put('data/suso.nats/predicate/dark.json', JSON.stringify(j, null, 2) + '\n'); continue; }
  const biome = j?.predicate?.location?.biome;
  if (!biome) { put(`data/suso.nats/predicate/${f}`, JSON.stringify(j, null, 2) + '\n'); continue; }
  // O2: entity_properties{location.biome} -> location_check{biomes}  (positional, entity-free)
  put(`data/suso.nats/predicate/${f}`, JSON.stringify({
    condition: 'minecraft:location_check',
    predicate: { biomes: biome },
  }, null, 2) + '\n');
  converted++;
}
log.push(`O2 predicates: ${converted} biome predicates entity_properties -> location_check (also biome -> biomes)`);

const [ax, ay, az, adx, ady, adz] = AREA.box;
put('data/suso.nats/predicate/warped_arena.json', JSON.stringify({
  condition: 'minecraft:location_check',
  predicate: {
    position: {
      x: { min: ax, max: ax + adx },
      y: { min: ay, max: ay + ady },
      z: { min: az, max: az + adz },
    },
  },
}, null, 2) + '\n');
log.push('O2 new predicate suso.nats:warped_arena (positional box, replaces the @s[dx..] test)');

// ---------------------------------------------------------------- data
for (const f of ['solid.json', 'free.json']) {
  put(`data/suso.nats/tags/block/${f}`, JSON.stringify(JSON.parse(read('data/suso.nats/tags/block', f)), null, 2) + '\n');
}
put('data/suso.nats/loot_table/none.json', JSON.stringify({ type: 'minecraft:generic', pools: [] }, null, 4) + '\n');

// 上游遗留的外部标签兜底（与 port.mjs 同一规则，见 lib/exttag.mjs）
for (const x of applyExternalTagFallback(path.join(ROOT, '_work', 'ref'), DST)) log.push(x);

// ---------------------------------------------------------------- report
let files = 0, lines = 0;
(function count(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) count(p); else { files++; lines += fs.readFileSync(p, 'utf8').split('\n').length; } } })(DST);
console.log('=== optimize 完成 ===');
console.log('输出:', DST);
console.log('文件:', files, '| 行:', lines);
for (const l of log) console.log('  *', l);
