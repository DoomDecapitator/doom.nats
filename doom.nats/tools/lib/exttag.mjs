// exttag.mjs — 上游引用了 1.21.6 中不存在的标签时的兜底。
//
// 原因：`execute if block ~ ~4 ~ #minecraft:red_area` 这类**未知标签**引用会让
// 整个函数加载失败（日志：Failed to load function ... 未知的方块标签），
// 该函数的所有分支随之失效。上游 1.20.1 包依赖原作地图数据包提供 red_area，
// 独立移植后该定义缺失。
//
// 兜底策略：按引用上下文补一个**空标签**，使该条件恒为 false，
// 函数其余分支恢复正常；语义待原作确认后往 values 里填真实方块即可。
import fs from 'node:fs';
import path from 'node:path';

const LF = String.fromCharCode(10);
const CTX = [
  ['if block', 'block'], ['unless block', 'block'],
  ['if items', 'item'], ['unless items', 'item'],
  ['type=', 'entity_type'],
];

// 收集 `#minecraft:<id>` 引用中 1.21.6 不存在的部分，并推断其标签类型。
// 返回 Map<id, kind>；kind 为 null（无法判定上下文）时不生成标签，仅记录。
export function scanExternalTags(refDir, dstDir, fixes = []) {
  const vanillaTags = new Map();
  if (fs.existsSync(refDir)) {
    for (const f of fs.readdirSync(refDir)) {
      if (f.startsWith('vanillatags-') && f.endsWith('.txt')) {
        const kind = f.slice('vanillatags-'.length, -'.txt'.length);
        vanillaTags.set(kind, new Set(fs.readFileSync(path.join(refDir, f), 'utf8').split(LF).filter(Boolean)));
      }
    }
  }
  const missing = new Map();
  if (!vanillaTags.size) {
    fixes.push('缺少 _work/ref/vanillatags-*.txt（先跑 node _work/dump-tags.js），已跳过外部标签兜底');
    return missing;
  }
  // vanilla 与包内同时存在同名标签时以 vanilla 为准；worldgen 类带 `biome/` 前缀
  const vanillaHas = (id) => {
    for (const set of vanillaTags.values()) if (set.has(id)) return true;
    for (const set of vanillaTags.values()) for (const v of set) if (v.endsWith('/' + id)) return true;
    return false;
  };
  // 上下文判定：取 `#tag` 之前最近的一个指令关键字（纯字符串比较，避开正则转义）
  const kindOf = (line, full) => {
    const idx = line.indexOf('#' + full);
    if (idx < 0) return null;
    const head = line.slice(0, idx);
    let best = null, bestPos = -1;
    for (const [needle, kind] of CTX) {
      const p = head.lastIndexOf(needle);
      if (p > bestPos) { bestPos = p; best = kind; }
    }
    if (head.trimEnd().endsWith('function')) return 'function';
    if (best === 'entity_type' && idx - (head.lastIndexOf('type=') + 5) > 1) best = null;
    return best;
  };
  const walk = (d, out = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      e.isDirectory() ? walk(p, out) : out.push(p);
    }
    return out;
  };
  for (const p of walk(dstDir)) {
    if (!p.endsWith('.mcfunction')) continue;
    for (const raw of fs.readFileSync(p, 'utf8').split(LF)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      for (const m of line.matchAll(/#minecraft:([a-z0-9_/]+)/g)) {
        const id = m[1];
        if (vanillaHas(id)) continue;
        const kind = kindOf(line, 'minecraft:' + id);
        const where = path.relative(dstDir, p).split(path.sep).join('/');
        if (!kind) { fixes.push('无法判定上下文的外部标签 #minecraft:' + id + ' @ ' + where); continue; }
        missing.set(id, kind);
      }
    }
  }
  return missing;
}

// 扫描 + 写空标签，返回人类可读的修正条目列表。
export function applyExternalTagFallback(refDir, dstDir) {
  const fixes = [];
  const missing = scanExternalTags(refDir, dstDir, fixes);
  for (const [id, kind] of missing) {
    const dir = path.join(dstDir, 'data', 'minecraft', 'tags', kind);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({ values: [] }, null, 4) + LF);
    fixes.push('exttag #minecraft:' + id + ' -> 空 ' + kind + ' 标签（1.21.6 无此标签，补空以免函数加载失败）');
  }
  return fixes;
}
