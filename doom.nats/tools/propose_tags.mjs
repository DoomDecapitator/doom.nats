// tools/propose_tags.mjs —— (b) 按**真实地形**自动补全方块标签
//
//   node tools/propose_tags.mjs --save "<存档目录>" [--step 4] [--out <报告路径>]
//
// 做什么：直接读存档的 region 文件（Anvil），统计地形里**实际出现的方块**，回答两件事：
//   ① standable    —— 「生成点下方的方块」实际是什么（决定能不能落脚）
//   ② spawnable_at —— 「生成点本体/上方的方块」实际是什么（决定能不能站人）
// 然后给出：建议补进 tags/block/*.json 的显式 id 列表（按频次，覆盖到 99.5%）+ 现标签覆盖率 + 分档提示。
//
// 为什么要有这个工具：数据包读不到「某方块能否站立」，只能列 id；地图作者不该手工数地形。
// 地图做完后跑一次即可（地图没成型时它就是空转，所以不着急用）。
//
// 只读存档。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// ---------------- 方块分档（决定「能不能当落位面」）----------------
// 依据：原版要求下方方块上表面**完整可站**（Mob.checkMobSpawnRules → isValidSpawn → isFaceSturdy(UP, FULL)）。
const CLASSIFY = {
  ok: /^minecraft:(grass_block|dirt|coarse_dirt|rooted_dirt|podzol|mycelium|farmland|dirt_path|sand|red_sand|gravel|clay|snow_block|ice|packed_ice|blue_ice|stone|granite|diorite|andesite|deepslate|tuff|calcite|basalt|blackstone|netherrack|end_stone|obsidian|magma_block|soul_sand|soul_soil|mud|moss_block|sandstone|red_sandstone|bricks|terracotta|.*_terracotta|.*_concrete|.*_wool|.*_planks|.*_log|.*_wood|.*_stone_bricks|prismarine|.*_prismarine|nether_bricks|red_nether_bricks|quartz_block|smooth_quartz|.*_ore|.*_block|.*_bricks)$/,
  bad: /^minecraft:(water|lava|.*_water|air|cave_air|void_air|snow|short_grass|tall_grass|fern|large_fern|.*_carpet|.*_sapling|.*_flower|.*_button|.*_pressure_plate|.*_torch|.*_sign|.*_door|.*_trapdoor|.*_fence|.*_wall|.*_slab|.*_stairs|.*_coral|.*_vine|vine|kelp|seagrass|.*_bush|.*_sprouts|.*_leaves)$/,
};
const classify = (id) => CLASSIFY.bad.test(id) ? '不建议（非完整碰撞面/流体）'
  : CLASSIFY.ok.test(id) ? '可当落位面' : '待人工确认';

// ---------------- 极简二进制 NBT ----------------
function readNbt(buf, off = 0) {
  const r = {
    u8: () => buf[off++],
    i16: () => { const v = buf.readInt16BE(off); off += 2; return v; },
    i32: () => { const v = buf.readInt32BE(off); off += 4; return v; },
    i64: () => { const v = buf.readBigInt64BE(off); off += 8; return v; },
    f32: () => { const v = buf.readFloatBE(off); off += 4; return v; },
    f64: () => { const v = buf.readDoubleBE(off); off += 8; return v; },
    str: () => { const n = buf.readUInt16BE(off); off += 2; const s = buf.toString('utf8', off, off + n); off += n; return s; },
  };
  const payload = (t) => {
    switch (t) {
      case 1: return r.u8() << 24 >> 24;
      case 2: return r.i16();
      case 3: return r.i32();
      case 4: return r.i64();
      case 5: return r.f32();
      case 6: return r.f64();
      case 7: { const n = r.i32(); const a = buf.subarray(off, off + n); off += n; return a; }
      case 8: return r.str();
      case 9: { const et = r.u8(); const n = r.i32(); const a = []; for (let i = 0; i < n; i++) a.push(payload(et)); return a; }
      case 10: { const o = {}; for (;;) { const et = r.u8(); if (et === 0) break; const k = r.str(); o[k] = payload(et); } return o; }
      case 11: { const n = r.i32(); const a = []; for (let i = 0; i < n; i++) a.push(r.i32()); return a; }
      case 12: { const n = r.i32(); const a = []; for (let i = 0; i < n; i++) a.push(r.i64()); return a; }
      default: throw new Error('未知 NBT 类型 ' + t);
    }
  };
  const root = r.u8();
  if (root !== 10) throw new Error('根不是 compound');
  r.str();
  return payload(10);
}

// ---------------- 参数与常量 ----------------
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const SAVE = path.resolve(arg('--save', ''));
const STEP = Number(arg('--step', '4'));
const OUT = path.resolve(arg('--out', 'C:/Users/Dell/Downloads/datapack/_work/generated/proposed-tags.json'));
const PACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'v4', 'doom.nats');
const REF = 'C:/Users/Dell/Downloads/datapack/_work/ref/vanillatags-block.txt';
if (!SAVE || !fs.existsSync(path.join(SAVE, 'region'))) { console.error('用法: --save "<存档目录>"（需含 region/）'); process.exit(2); }

const AIR = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air']);

// 原版标签展开表（若 _work/ref 里有清单就用；否则退化为「只认显式 id」）
const VANILLA_TAGS = (() => {
  const m = new Map();
  try {
    for (const line of fs.readFileSync(REF, 'utf8').split(/\r?\n/)) {
      const [k, v] = line.trim().split(/\s+/);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      if (v) m.get(k).push(v);
    }
  } catch {}
  return m;
})();

const curTag = (name) => {
  try {
    const vals = JSON.parse(fs.readFileSync(path.join(PACK, 'data/doom.nats/tags/block', name + '.json'), 'utf8')).values || [];
    const out = new Set();
    for (const v of vals) {
      const sv = String(v);
      if (!sv.startsWith('#')) { out.add(sv); continue; }
      for (const x of (VANILLA_TAGS.get(sv.slice(1)) || [])) out.add(x);
    }
    return out;
  } catch { return new Set(); }
};

// ---------------- 逐列扫描地形 ----------------
const sectionDecoder = (section) => {
  const bs = section.block_states;
  if (!bs) return null;
  const palette = (bs.palette || []).map((p) => p.Name);
  if (!palette.length) return null;
  const baseY = section.Y;
  if (palette.length === 1) return { baseY, palette, get: () => 0 };
  const data = bs.data || [];
  const bits = Math.max(4, Math.ceil(Math.log2(palette.length)));
  const perLong = Math.floor(64 / bits);
  if (!perLong) return null;
  return {
    baseY, palette,
    get(i) {
      const li = Math.floor(i / perLong), o = (i % perLong) * bits;
      const v = (BigInt.asUintN(64, data[li] ?? 0n) >> BigInt(o)) & ((1n << BigInt(bits)) - 1n);
      return Number(v % BigInt(palette.length));
    },
  };
};

const below = new Map(), at = new Map();
let columns = 0, withSurface = 0;

for (const f of fs.readdirSync(path.join(SAVE, 'region'))) {
  if (!f.endsWith('.mca')) continue;
  const buf = fs.readFileSync(path.join(SAVE, 'region', f));
  if (buf.length < 8192) continue;
  for (let ci = 0; ci < 1024; ci++) {
    const off = buf.readUInt32BE(ci * 4) >>> 8, cnt = buf[ci * 4 + 3];
    if (!off || !cnt) continue;
    const start = off * 4096, len = buf.readUInt32BE(start), comp = buf[start + 4];
    if (start + 4 + len > buf.length) continue;
    let raw;
    try {
      const body = buf.subarray(start + 5, start + 4 + len);
      raw = comp === 2 ? zlib.inflateSync(body) : comp === 1 ? zlib.gunzipSync(body) : body;
    } catch { continue; }
    let nbt;
    try { nbt = readNbt(raw); } catch { continue; }
    const secs = new Map();
    for (const s of (nbt.sections || [])) { const d = sectionDecoder(s); if (d) secs.set(d.baseY, d); }
    if (!secs.size) continue;
    const ys = [...secs.keys()].sort((a, b) => a - b);
    for (let dx = 0; dx < 16; dx += STEP) {
      for (let dz = 0; dz < 16; dz += STEP) {
        columns++;
        let hit = null;
        outer: for (let yi = ys.length - 1; yi >= 0; yi--) {
          const s = secs.get(ys[yi]);
          for (let ly = 15; ly >= 0; ly--) {
            const id = s.palette[s.get((ly * 16 + dz) * 16 + dx)];
            if (!AIR.has(id)) { hit = { id, y: ys[yi] * 16 + ly }; break outer; }
          }
        }
        if (!hit) continue;
        withSurface++;
        below.set(hit.id, (below.get(hit.id) || 0) + 1);
        for (const dy of [1, 2]) {
          const y = hit.y + dy;
          const s = secs.get(Math.floor(y / 16));
          const id = s ? s.palette[s.get(((y - s.baseY * 16) * 16 + dz) * 16 + dx)] : 'minecraft:air';
          at.set(id, (at.get(id) || 0) + 1);
        }
      }
    }
  }
}

const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);
const topN = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const cover = (m, set) => { let hit = 0; for (const [id, n] of m) if (set.has(id)) hit += n; return (100 * hit / Math.max(1, total(m))).toFixed(1) + '%'; };
const propose = (m, set) => {
  const out = []; let acc = 0; const t = total(m);
  for (const [id, n] of topN(m, 300)) {
    if (set.has(id)) { acc += n; continue; }
    out.push({ id, count: n, 分类: classify(id) });
    acc += n;
    if (acc / Math.max(1, t) >= 0.995) break;
  }
  return out;
};

const curStand = curTag('standable'), curSpawn = curTag('spawnable_at');
const pB = propose(below, curStand), pA = propose(at, curSpawn);
const report = {
  存档: SAVE, 采样步长: STEP, 列数: columns, 有地表列数: withSurface,
  standable: {
    现标签覆盖: cover(below, curStand),
    地形实际分布: topN(below, 25).map(([id, n]) => ({ id, n, 分类: classify(id) })),
    建议补充_可当落位面: pB.filter((x) => x.分类 === '可当落位面').slice(0, 60),
    不建议采用: pB.filter((x) => x.分类 !== '可当落位面').slice(0, 25),
  },
  spawnable_at: {
    现标签覆盖: cover(at, curSpawn),
    地形实际分布: topN(at, 15).map(([id, n]) => ({ id, n })),
    建议补充: pA.slice(0, 40),
  },
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

console.log('列数 ' + columns + '（有地表 ' + withSurface + '，步长 ' + STEP + '）');
console.log('standable   现标签覆盖 ' + report.standable.现标签覆盖);
console.log('  地形里最多的下方方块: ' + topN(below, 8).map(([k, v]) => k.replace('minecraft:', '') + '×' + v).join(', '));
console.log('  建议补（可当落位面 ' + report.standable.建议补充_可当落位面.length + ' 条）: '
  + report.standable.建议补充_可当落位面.slice(0, 10).map((x) => x.id.replace('minecraft:', '')).join(', '));
console.log('  不建议（' + report.standable.不建议采用.length + '）: '
  + report.standable.不建议采用.slice(0, 6).map((x) => x.id.replace('minecraft:', '')).join(', '));
console.log('spawnable_at 现标签覆盖 ' + report.spawnable_at.现标签覆盖);
console.log('  地形里最多的空位方块: ' + topN(at, 5).map(([k, v]) => k.replace('minecraft:', '') + '×' + v).join(', '));
console.log('报告: ' + OUT);
