// doomify.mjs — v2 `optimized/suso.nats` → v3 `v3/doom.nats`
//
// 三项改造：
//   ① 命名空间全量重命名：suso.nats → doom.nats
//      （目录名、计分板 objective、实体 tag、storage 键、函数/谓词引用、pack.meta 描述）
//   ② 生物注册表：把群系表里的**内联 summon NBT** 提取为 `storage doom.nats:mobs` 条目，
//      同一生物签名只存一份；setup 时装载一次。
//   ③ 宏替代：刷怪改走 `mob/spawn` 宏 —— `$summon $(type) ~ ~ ~ $(nbt)`，
//      群系表每行从「3 KB 内联 NBT」缩成「一条宏调用」。
//
// 为什么这样更快：加载期 Minecraft 要把每个函数解析成命令树，75 处巨型 NBT 参数
// 是主要负担；改成宏调用后命令树只剩轻节点，NBT 只在**命中该分支时**才解析一次。
// 行为不变：宏替换出来的命令与原来逐字等价（由 sim 对照验证）。
import fs from 'node:fs';
import path from 'node:path';
import { parse, serialize } from './lib/snbt.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, '..', 'optimized', 'suso.nats');
const DST = path.join(ROOT, '..', 'v3', 'doom.nats');
const LF = String.fromCharCode(10);

const OLD = 'suso.nats';
const NEW = 'doom.nats';
const MOB_STORAGE = NEW + ':mobs';

const stats = { files: 0, renamed: 0, tables: 0, summons: 0, entries: 0, reused: 0, kept: 0 };

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+/, '').replace(/_+$/, '');

const customNameOf = (nbt) => {
  const cn = nbt && nbt.CustomName;
  if (!cn) return null;
  if (typeof cn === 'string') return cn;
  if (Array.isArray(cn) && cn[0] && cn[0].text) return String(cn[0].text);
  if (cn.text) return String(cn.text);
  return null;
};

// ---- 注册表：签名去重 + 唯一 id ----
const entries = new Map();   // sig -> { id, type, nbt }
const usedIds = new Set();
const uniqueId = (base) => {
  let id = base || 'mob';
  let n = 2;
  while (usedIds.has(id)) id = base + '_' + n++;
  usedIds.add(id);
  return id;
};
const entryFor = (type, nbt) => {
  const sig = type + '|' + serialize(nbt);
  const hit = entries.get(sig);
  if (hit) { stats.reused++; return hit; }
  const name = customNameOf(nbt);
  const base = name ? slug(name) : slug(String(type).replace('minecraft:', ''));
  const e = { id: uniqueId(base), type, nbt };
  entries.set(sig, e);
  return e;
};

// ---- 逐行改写群系表里的 summon ----
const rewriteSummons = (txt) => {
  const out = [];
  for (const line of txt.split(LF)) {
    const t = line.trimStart();
    if (!t || t.startsWith('#')) { out.push(line); continue; }   // 注释行原样保留
    const i = line.indexOf('summon ');
    if (i < 0) { out.push(line); continue; }
    const after = line.slice(i + 7);
    const j = after.indexOf('{');
    const head = (j < 0 ? after : after.slice(0, j)).trim();
    const parts = head.split(' ').filter(Boolean);
    const type = parts[0];
    const pos = parts.slice(1).join(' ');
    const nbtText = j < 0 ? '{}' : after.slice(j).trim();
    if (!type || pos !== '~ ~ ~') { stats.kept++; out.push(line); continue; }  // 位置非 ~ ~ ~ ⇒ 保守不动
    let nbt;
    try { nbt = parse(nbtText); } catch (err) { stats.kept++; out.push(line); continue; }
    const e = entryFor(type, nbt);
    out.push(line.slice(0, i) + 'function ' + NEW + ':mob/spawn with storage ' + MOB_STORAGE + ' ' + e.id);
    stats.summons++;
  }
  return out.join(LF);
};

// ---- 走一遍源包 ----
fs.rmSync(DST, { recursive: true, force: true });

const all = walk(SRC);
for (const p of all) {
  const rel = path.relative(SRC, p).split(path.sep).join('/');
  const relNew = rel.split(OLD).join(NEW);
  if (rel !== relNew) stats.renamed++;
  const dp = path.join(DST, relNew);
  fs.mkdirSync(path.dirname(dp), { recursive: true });

  if (p.endsWith('.mcfunction')) {
    let txt = fs.readFileSync(p, 'utf8').split(OLD).join(NEW);
    const before = txt;
    txt = rewriteSummons(txt);
    if (txt !== before) stats.tables++;
    fs.writeFileSync(dp, txt);
  } else if (p.endsWith('.json') || p.endsWith('.mcmeta')) {
    fs.writeFileSync(dp, fs.readFileSync(p, 'utf8').split(OLD).join(NEW));
  } else {
    fs.copyFileSync(p, dp);
  }
  stats.files++;
}

// ---- 生成注册表与宏函数 ----
// 注册表**按实体类型分片**：单文件过大会让加载期解析集中在一个函数上（实测 21.9 KB 反而劣化），
// 分片后每个文件只解析自己那几种生物，setup 通过函数标签一次性装载。
const byEntity = new Map();
for (const e2 of entries.values()) {
  const ent = String(e2.type).replace('minecraft:', '');
  if (!byEntity.has(ent)) byEntity.set(ent, []);
  byEntity.get(ent).push(e2);
}
const regDir = path.join(DST, 'data', NEW, 'function', 'mob', 'reg');
fs.mkdirSync(regDir, { recursive: true });
const shards = [];
const SHARD_MAX = 6;   // 每片最多 6 个变体：控制单文件峰值，避免加载期把解析压力集中在一个函数上
for (const [ent, list] of byEntity) {
  for (let i = 0; i < list.length; i += SHARD_MAX) {
    const chunk = list.slice(i, i + SHARD_MAX);
    const name = i === 0 ? ent : ent + '_' + (Math.floor(i / SHARD_MAX) + 1);
    const body = [
      '# 生物注册表分片 —— ' + ent + '（' + chunk.length + '/' + list.length + ' 个变体）；由 tools/doomify.mjs 生成，勿手改',
      '',
    ];
    for (const e2 of chunk) body.push('data modify storage ' + MOB_STORAGE + ' ' + e2.id + ' set value {type:' + JSON.stringify(e2.type) + ',nbt:' + serialize(e2.nbt) + '}');
    const rel = 'mob/reg/' + name + '.mcfunction';
    fs.writeFileSync(path.join(DST, 'data', NEW, 'function', rel), body.join(LF) + LF);
    shards.push(NEW + ':' + rel.replace('.mcfunction', ''));
  }
}
const fnTagDir = path.join(DST, 'data', NEW, 'tags', 'function');
fs.mkdirSync(fnTagDir, { recursive: true });
fs.writeFileSync(path.join(fnTagDir, 'mob_registry.json'), JSON.stringify({ values: shards }, null, 4) + LF);
stats.shards = shards.length;

const spawnPath = path.join(DST, 'data', NEW, 'function', 'mob', 'spawn.mcfunction');
fs.writeFileSync(spawnPath, [
  '# ' + NEW + ':mob/spawn —— 生物生成宏（注册表驱动）',
  '#',
  '# 用法：function ' + NEW + ':mob/spawn with storage ' + MOB_STORAGE + ' <id>',
  '#   $(type) 实体 id —— 宏规则里字符串参数**不带引号**插入，正好是 summon 要的形式',
  '#   $(nbt)  实体 NBT —— 复合参数以 SNBT 形式插入',
  '# 位置固定 ~ ~ ~：调用方（群系表）一律在 `positioned` / `at @s` 上下文里执行，与原实现一致。',
  '$summon $(type) ~ ~ ~ $(nbt)',
  '',
].join(LF));

// ---- setup 里挂上注册表装载 ----
const setupPath = path.join(DST, 'data', NEW, 'function', 'setup.mcfunction');
let setup = fs.readFileSync(setupPath, 'utf8');
const hook = 'function #' + NEW + ':mob_registry';   // 函数标签：一次装载全部分片
if (!setup.includes(hook)) {
  const anchor = 'function ' + NEW + ':rng/seed';
  setup = setup.includes(anchor)
    ? setup.replace(anchor, anchor + LF + LF + '# v3：装载生物注册表（' + entries.size + ' 条目 / ' + shards.length + ' 分片）' + LF + hook)
    : setup.replace(/\s*$/, '') + LF + hook + LF;
  fs.writeFileSync(setupPath, setup.replace(/\s*$/, '') + LF);
}

// ---- pack.mcmeta 描述 ----
const mcPath = path.join(DST, 'pack.mcmeta');
const mc = JSON.parse(fs.readFileSync(mcPath, 'utf8'));
mc.pack.pack_format = 80;
mc.pack.description = "§bDoom's Artificial Natspawns §7[v3 · 1.21.6 · 生物注册表 + 宏驱动]";
fs.writeFileSync(mcPath, JSON.stringify(mc, null, 4) + LF);

console.log('=== doomify 完成 ===');
console.log('输出:', DST);
console.log('文件:', stats.files, '| 路径重命名:', stats.renamed, '| 改写过的表:', stats.tables);
console.log('summon → 宏调用:', stats.summons, '| 保留原样:', stats.kept);
console.log('注册表条目:', entries.size, '| 复用命中:', stats.reused);
console.log('条目示例:', [...entries.values()].slice(0, 6).map((e) => e.id).join(', '));


console.log('分片:', stats.shards, '| 最大分片字节:', Math.max(...[...byEntity.values()].map((l) => l.reduce((x, e2) => x + serialize(e2.nbt).length + 40, 120))));