// check_closure.mjs — v4 的「数据读写闭包」检查：抓静态语义问题，而不只是语法问题。
//
//   node tools/check_closure.mjs [packDir]
//
// lint_pack.mjs 管语法层（引用存在、宏前缀、常量定义）；本工具管**语义闭包**：
//   C1 storage：读过的每个 storage，包里是否写过
//   C2 宏参数：`function X with storage S P` —— S/P 是否被写过
//   C3 计分板虚位玩家：被 if score / operation / matches / get 读到的 $x，是否被写过（或有白名单）
//   C4 实体标签：选择器读的 tag=doom.nats.X，是否被写过
//
// 这些正是"加载期不报错、运行期静默失效"的那类问题（docs/09 的教训）。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACK = path.resolve(process.argv[2] || path.join(ROOT, '..', 'pack', 'doom.nats'));
const LF = String.fromCharCode(10);
const NS = 'doom.nats';

// 白名单：由地图作者或其他系统写入的
const EXTERNAL_HOLDERS = new Set(['$chunks_mode', '$snap_period', '$despawn_log', '$rej_log']);
const EXTERNAL_TAGS = new Set([NS + '.persistent', NS + '.cat.*']);
// 作者提供的配置 storage（v4.14）：本包只读、由地图/作者写 ⇒ 不算未闭合
const EXTERNAL_STORES = new Set([NS + ':config']);

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};
const files = walk(PACK).filter((p) => p.endsWith('.mcfunction'));
const rel = (p) => path.relative(PACK, p).split(path.sep).join('/');

const norm = (t) => t.replace(/\$\([^)]*\)/g, '*');           // 宏占位 → 通配
const storeWrites = new Set();
const storeReads = [];
const macroCalls = [];
const holderWrites = new Set();
const holderReads = [];
const tagWrites = new Set();
const tagReads = [];

// 正则（宽松：允许 : . / - _ $ 与方括号路径）
const RE_STORE_WRITE = /(?:data (?:modify|merge)|execute store (?:result|success)) storage ([a-z0-9_.-]+:[a-z0-9_/.-]+)([a-zA-Z0-9_.:\[\]$]*)/g;
const RE_STORE_READ = /data get storage ([a-z0-9_.-]+:[a-z0-9_/.-]+)([a-zA-Z0-9_.:\[\]$]*)/g;
const RE_MACRO = /with storage ([a-z0-9_.-]+:[a-z0-9_/.-]+) ?([a-zA-Z0-9_.:\[\]$]*)/g;
const RE_NBT_COMPONENT = /"nbt"\s*:\s*"[^"]*"\s*,\s*"storage"\s*:\s*"([a-z0-9_.-]+:[a-z0-9_/.-]+)"/g;
const RE_H_SET = /scoreboard players (?:set|add|remove) ([A-Za-z0-9_.#$+-]+) [a-z0-9_.:-]+/g;
const RE_H_STORE = /execute store (?:result|success) score ([A-Za-z0-9_.#$+-]+) [a-z0-9_.:-]+/g;
const RE_H_OP = /scoreboard players operation ([A-Za-z0-9_.#$+-]+) [a-z0-9_.:-]+ (\S+) ([A-Za-z0-9_.#$+-]+)/g;
const RE_H_IF = /if score ([A-Za-z0-9_.#$+-]+) [a-z0-9_.:-]+/g;
const RE_H_GET = /scoreboard players get ([A-Za-z0-9_.#$+-]+) /g;
const RE_TAG_READ = /tag=!?([a-z0-9_.:$-()]+)/g;
// ⚠ v4.22 修工具自身的一个 bug：原来写的是 /tag ([a-z0-9_.:$-]+) add/ —— 字符类里没有 `@`，
//   而实际写法永远是 `tag @s add <tag>` / `tag @e[…] add <tag>` ⇒ **这条正则永远匹配不到**，
//   tagWrites 只能靠注册表里的 `Tags:[…]` 填充。于是"用 tag 命令动态打的标记"
//   （despawn 的 near64/near128/near32 这类）会被报成"读了从未添加的标签"（C4 假红 6 处）。
//   修法：选择器用 \S+（吃下 @s / @e[tag=…]），标签名放第 1 组（与下面的 tagWrites.add(m[1]) 对应）。
const RE_TAG_ADD = /\btag\s+\S+\s+add\s+([a-z0-9_.:$-]+)/g;
const RE_TAGS_NBT = /Tags:\[([^\]]*)\]/g;

for (const p of files) {
  const r = rel(p);
  for (const raw of fs.readFileSync(p, 'utf8').split(LF)) {
    const line = raw.trim();
    const body = line.startsWith('$') ? line.slice(1).trim() : line;
    if (!body || body.startsWith('#')) continue;

    for (const m of body.matchAll(RE_STORE_WRITE)) storeWrites.add((m[1] + ' ' + (m[2] || '')).trim());
    for (const m of body.matchAll(RE_STORE_READ)) storeReads.push({ store: m[1], file: r });
    for (const m of body.matchAll(RE_MACRO)) macroCalls.push({ store: m[1], path: (m[2] || '').trim(), file: r });
    for (const m of body.matchAll(RE_NBT_COMPONENT)) storeReads.push({ store: m[1], file: r });

    for (const m of body.matchAll(RE_H_SET)) holderWrites.add(m[1]);
    for (const m of body.matchAll(RE_H_STORE)) holderWrites.add(m[1]);
    for (const m of body.matchAll(RE_H_OP)) { holderWrites.add(m[1]); if (m[3].startsWith('$')) holderReads.push({ h: m[3], file: r }); }
    for (const m of body.matchAll(RE_H_IF)) holderReads.push({ h: m[1], file: r });
    for (const m of body.matchAll(RE_H_GET)) holderReads.push({ h: m[1], file: r });

    for (const m of body.matchAll(RE_TAG_READ)) { if (m[1].startsWith(NS + '.')) tagReads.push({ t: norm(m[1]), file: r }); }
    for (const m of body.matchAll(RE_TAG_ADD)) tagWrites.add(norm(m[1]));
    for (const m of body.matchAll(RE_TAGS_NBT)) {
      for (const id of m[1].split(',')) {
        const t = norm(id.trim().replace(/^"|"$/g, ''));
        if (!t.startsWith(NS + '.')) continue;
        tagWrites.add(t);
        // 注册表里写的是 doom.nats.cat.<类别>，而选择器里是 doom.nats.cat.$(cat) ⇒ 都归一到 cat.*
        tagWrites.add(t.replace(/\.(monster|creature|ambient|water_ambient|water_creature|underground_water_creature|axolotls)$/, '.cat.*'));
      }
    }
  }
}

const problems = [];
const storesWritten = new Set([...storeWrites].map((k) => k.split(' ')[0]));
for (const r of storeReads) if (!storesWritten.has(r.store) && !EXTERNAL_STORES.has(r.store)) problems.push(['C1', r.file, '读了从未写过的 storage ' + r.store]);
for (const c of macroCalls) {
  const ok = [...storeWrites].some((k) => {
    const [s, p] = [k.split(' ')[0], k.split(' ').slice(1).join(' ')];
    if (s !== c.store) return false;
    if (!c.path) return true;
    return (p || '') === c.path || (p || '').startsWith(c.path + '.') || c.path === '';
  });
  if (!ok) problems.push(['C2', c.file, '宏调用 with storage ' + c.store + (c.path ? ' ' + c.path : '') + ' —— 该键未见写入']);
}
// 宏展开后的 holder 名（如 $cnt.$(cat).nether）静态看不到完整名 ⇒ 读到的可能是前缀（$cnt.），
// 只要有任何写过的 holder 以该前缀开头就算闭合（v4.14g 的 per-dim 计数就靠这条）。
const holderPrefixOk = (h) => {
  // 形如 $cnt.$(cat).nether 的读，正则只能截到 $cnt.$（'(' 不在 holder 字符类里、'$' 在）
  //   ⇒ 去掉末尾截断出来的 '$'，再按"前缀"匹配任何写过的 holder
  const trimmed = h.replace(/\$+$/, '');
  if (trimmed !== h) return trimmed.length > 0 && [...holderWrites].some((w) => w.startsWith(trimmed));
  if (trimmed.endsWith('.')) return [...holderWrites].some((w) => w.startsWith(trimmed) || w === trimmed.slice(0, -1));
  return false;
};
for (const r of holderReads) if (!holderWrites.has(r.h) && !holderPrefixOk(r.h) && !EXTERNAL_HOLDERS.has(r.h)) problems.push(['C3', r.file, '读了从未写过的虚位玩家 ' + r.h]);
for (const r of tagReads) if (!tagWrites.has(r.t) && !EXTERNAL_TAGS.has(r.t)) problems.push(['C4', r.file, '选择器读了从未添加的标签 ' + r.t]);

const byCode = new Map();
for (const [c] of problems) byCode.set(c, (byCode.get(c) || 0) + 1);
console.log('=== 闭包检查: v4 ===');
console.log('函数 ' + files.length + ' | storage 写入键 ' + storeWrites.size + ' | 虚位玩家写入 ' + holderWrites.size + ' | 标签写入 ' + tagWrites.size);
console.log('检查量: C1 读 ' + storeReads.length + ' | C2 宏 ' + macroCalls.length + ' | C3 读 ' + holderReads.length + ' | C4 读 ' + tagReads.length);
console.log();
if (!problems.length) console.log('✅ 全部闭合');
for (const [code, where, msg] of problems.slice(0, 30)) console.log('[' + code + '] ' + where + ': ' + msg);
if (problems.length > 30) console.log('… 另有 ' + (problems.length - 30) + ' 条');
console.log();
console.log('结论: ' + problems.length + ' 处待确认' + (byCode.size ? '（' + [...byCode].map(([k, v]) => k + '=' + v).join(' ') + '）' : ''));
