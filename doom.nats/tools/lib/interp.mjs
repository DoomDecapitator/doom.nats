// 函数标签（data/<ns>/tags/function/*.json）—— setup 用 '#ns:tag' 一次性装载注册表分片
const loadFnTags = (packDir) => {
  const out = new Map();
  const root = path.join(packDir, 'data');
  let namespaces = [];
  try { namespaces = fs.readdirSync(root); } catch (err) { return out; }
  for (const ns of namespaces) {
    const dir = path.join(root, ns, 'tags', 'function');
    if (!fs.existsSync(dir)) continue;
    const walkTag = (d, prefix) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const q = path.join(d, e.name);
        if (e.isDirectory()) { walkTag(q, prefix + e.name + '/'); continue; }
        if (!q.endsWith('.json')) continue;
        try {
          const j = JSON.parse(fs.readFileSync(q, 'utf8'));
          out.set(ns + ':' + prefix + e.name.replace('.json', ''), (j.values || []).map((v) => String(v).replace('#', '')));
        } catch (err) { /* 忽略坏标签 */ }
      }
    };
    walkTag(dir, '');
  }
  return out;
};

const detectNs = (packDir) => {
  const dataDir = path.join(packDir, 'data');
  try {
    for (const e of fs.readdirSync(dataDir, { withFileTypes: true })) {
      if (e.isDirectory() && fs.existsSync(path.join(dataDir, e.name, 'tags', 'block', 'free.json'))) return e.name;
    }
  } catch (err) { /* fall through */ }
  return 'suso.nats';
};

// Headless Minecraft command interpreter — enough of 1.21.6 to execute suso.nats faithfully.
// Supports: scoreboard, execute (as/at/positioned/rotated/align/in/if/unless/store/run),
//           function (incl. `with storage` macros), summon, data, kill, forceload, fill,
//           random value, return, tag, team, particle/say/tellraw (no-op).
import fs from 'node:fs';
import path from 'node:path';
import { parse, serialize, tokenize, Num, num } from './snbt.mjs';

const range = (spec) => {
  // "5", "1..", "..3", "1..5", "0..31"
  const m = /^(-?\d+)?(\.\.)?(-?\d+)?$/.exec(String(spec).trim());
  if (!m) return null;
  if (!m[2]) { const v = Number(m[1]); return (x) => x === v; }
  const lo = m[1] === undefined || m[1] === '' ? -Infinity : Number(m[1]);
  const hi = m[3] === undefined || m[3] === '' ? Infinity : Number(m[3]);
  return (x) => x >= lo && x <= hi;
};
const inNumRange = (spec, x) => { const f = range(spec); return f ? f(x) : false; };
const inDoubleRange = (obj, x) => {
  if (obj === undefined || obj === null) return true;
  const lo = obj.min !== undefined ? Number(obj.min) : -Infinity;
  const hi = obj.max !== undefined ? Number(obj.max) : Infinity;
  return x >= lo && x <= hi;
};
const parseCoord = (s, base) => {
  if (typeof s === 'string' && s.startsWith('^')) return { local: true, v: Number(s.slice(1) || 0) };
  if (typeof s === 'string' && s.startsWith('~')) return { local: false, v: base + Number(s.slice(1) || 0) };
  return { local: false, v: Number(s) };
};
const parseFloatArg = (s) => { const m = /^(-?[\d.]+)([bslfdBSLFD])?$/.exec(String(s)); return m ? Number(m[1]) : NaN; };

export class Interp {
  constructor({ packDir, world, seed = 12345, budget = 4000000, extraDirs = [], messages = null }) {
    // 在测包的命名空间：从包结构探测（v3 的 doom.nats 也适用）
    this.ns = detectNs(packDir);
    this.tagSolid = '#' + this.ns + ':solid';
    this.tagFree = '#' + this.ns + ':free';
    this.fnTags = loadFnTags(packDir);
    this.packDir = packDir;
    this.extraDirs = extraDirs;              // 额外的包目录（如 doom.log 调试基建），只共享函数表
    this.world = world;
    this.scores = new Map();                 // objective -> Map(name -> int)
    this.storage = {};                       // "ns:id" -> value
    this.functions = new Map();              // id -> {lines, macros:boolean}
    this.objectives = new Set();
    this.rngState = seed >>> 0;
    this.budget = budget; this.steps = 0;
    this.errors = []; this.warnings = [];
    this.spawns = [];                        // product summon events
    this.auxSummons = 0; this.auxKills = 0;   // auxiliary carrier entities (marker / AEC)
    this.messages = messages || [];          // tellraw 渲染出来的文本行（供采集，等价于聊天栏/日志）
    this.trace = [];
    this.maxDepth = 0;
    this.seq = 0;
    this.loadFunctions();
  }

  loadFunctions() {
    const scan = (base, self, tagBase) => {
      for (const ns of fs.readdirSync(base)) {
        const fdir = path.join(base, ns, 'function');
        if (!fs.existsSync(fdir)) continue;
        (function walk(d) {
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) { walk(p); continue; }
            if (!e.name.endsWith('.mcfunction')) continue;
            const id = `${ns}:${path.relative(fdir, p).split(path.sep).join('/').replace(/\.mcfunction$/, '')}`;
            const raw = fs.readFileSync(p, 'utf8').split(/\r?\n/);
            // 主包优先：extraDirs 只补主包没有的 id（doom.log 等外部基建）
            if (!self.functions.has(id)) self.functions.set(id, { lines: raw, macros: raw.some((l) => l.startsWith('$')) });
          }
        })(fdir);
        const pdir = path.join(base, ns, 'predicate');
        if (fs.existsSync(pdir)) {
          this.predicates = this.predicates || new Map();
          (function walkP(d) {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
              const p = path.join(d, e.name);
              if (e.isDirectory()) { walkP(p); continue; }
              if (!e.name.endsWith('.json')) continue;
              const id = `${ns}:${path.relative(pdir, p).split(path.sep).join('/').replace(/\.json$/, '')}`;
              self.predicates.set(id, JSON.parse(fs.readFileSync(p, 'utf8')));
            }
          })(pdir);
        }
        if (tagBase) {
          for (const kind of ['block', 'entity_type', 'function']) {
            const tdir = path.join(base, ns, 'tags', kind);
            if (!fs.existsSync(tdir)) continue;
            const bag = kind === 'function' ? this.fnTags : (kind === 'block' ? (this.blockTags = this.blockTags || new Map()) : (this.entityTypeTags = this.entityTypeTags || new Map()));
            for (const f of fs.readdirSync(tdir)) {
              if (!f.endsWith('.json')) continue;
              const id = `${ns}:${f.replace(/\.json$/, '')}`;
              if (bag.has ? bag.has(id) : bag[id]) continue;
              const vals = JSON.parse(fs.readFileSync(path.join(tdir, f), 'utf8')).values.map((v) => String(v));
              if (kind === 'function') bag.set(id, vals); else bag.set(id, new Set(vals));
            }
          }
        }
      }
    };
    scan(path.join(this.packDir, 'data'), this, false);
    for (const d of this.extraDirs) { try { scan(path.join(d, 'data'), this, false); } catch (e) { this.warnings.push('extraDir 不可读: ' + d); } }
    this.loadTagsFrom(path.join(this.packDir, 'data'));
  }

  // 读主包的方块 / 实体类型标签（v4 用 standable / spawnable_at，v1-v3 用 solid / free）
  loadTagsFrom(dataDir) {
    this.blockTags = this.blockTags || new Map();
    this.entityTypeTags = this.entityTypeTags || new Map();
    for (const ns of fs.readdirSync(dataDir)) {
      for (const [kind, bag] of [['block', this.blockTags], ['entity_type', this.entityTypeTags]]) {
        const tdir = path.join(dataDir, ns, 'tags', kind);
        if (!fs.existsSync(tdir)) continue;
        for (const f of fs.readdirSync(tdir)) {
          if (!f.endsWith('.json')) continue;
          const id = `${ns}:${f.replace(/\.json$/, '')}`;
          if (bag.has(id)) continue;
          const vals = JSON.parse(fs.readFileSync(path.join(tdir, f), 'utf8')).values || [];
          bag.set(id, new Set(vals.map((v) => String(v))));
        }
      }
    }
  }

  // ---- deterministic PRNG (mulberry32); used for /random and for seeded entity UUIDs ----
  rnd() {
    this.rngState = (this.rngState + 0x6D2B79F5) >>> 0;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }

  score(obj, name) { return (this.scores.get(obj)?.get(name)) ?? undefined; }
  setScore(obj, name, v) {
    if (!this.scores.has(obj)) this.scores.set(obj, new Map());
    if (v === undefined || v === null) this.scores.get(obj).delete(name);
    else this.scores.get(obj).set(name, Math.trunc(v));
  }

  ctx(over = {}) {
    return Object.assign({
      pos: { x: 0, y: 0, z: 0 }, rot: { yaw: 0, pitch: 0 }, entity: null, dimension: 'minecraft:overworld',
    }, over);
  }

  // ---------------- function execution ----------------
  run(id, ctx, depth = 0, macroArgs = null) {
    if (id.startsWith('#')) {                    // 函数标签：依次执行全部成员
      const members = this.fnTags.get(id.slice(1)) ?? [];
      let r = { result: 0, success: members.length > 0 };
      for (const m of members) r = this.run(m, ctx, depth, null);
      return r;
    }
    if (depth > this.maxDepth) this.maxDepth = depth;
    if (depth > 64) { this.errors.push(`recursion depth > 64 at ${id}`); return { result: 0, success: false }; }
    const fn = this.functions.get(id);
    if (!fn) { this.errors.push(`unknown function ${id}`); return { result: 0, success: false }; }
    let last = { result: 0, success: true };
    for (let raw of fn.lines) {
      if (this.steps++ > this.budget) throw new Error(`command budget exceeded at ${id}`);
      if (raw.startsWith('$')) {
        // A `$`-prefixed line is a macro line: the marker itself is consumed and the
        // $(...) placeholders are substituted from the `with` argument.
        if (!macroArgs) continue;                 // macro line in a function called without `with`
        raw = substitute(raw.slice(1), macroArgs);
      }
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      last = this.exec(line, ctx, depth);
    }
    return last;
  }

  call(id, ctx, depth, macroArgs) {
    // function ids in this pack may or may not carry the namespace
    return this.run(id, ctx, depth, macroArgs);
  }

  // ---------------- command execution ----------------
  exec(line, ctx, depth = 0) {
    const tok = tokenize(line);
    return this.dispatch(tok, ctx, depth);
  }

  dispatch(tok, ctx, depth) {
    const cmd = tok[0];
    switch (cmd) {
      case 'execute': return this.execExecute(tok.slice(1), ctx, depth);
      case 'function': return this.execFunction(tok.slice(1), ctx, depth);
      case 'scoreboard': return this.execScoreboard(tok.slice(1), ctx);
      case 'summon': return this.execSummon(tok.slice(1), ctx);
      case 'data': return this.execData(tok.slice(1), ctx);
      case 'kill': { const es = this.select(tok[1] || '@s', ctx); for (const e of es) { if (['marker', 'area_effect_cloud'].includes(e.type)) this.auxKills++; this.removeEntity(e); } return { result: es.length, success: true }; }
      case 'forceload': return { result: 0, success: true };
      case 'fill': return { result: 0, success: true };
      case 'random': return this.execRandom(tok.slice(1), ctx);
      case 'return': return { result: tok[1] === 'run' ? this.dispatch(tokenize(tok.slice(2).join(' ')), ctx, depth).result : Number(tok[1] ?? 0), success: true };
      case 'tellraw': return this.execTellraw(tok.slice(1), ctx);
      case 'particle': case 'say': case 'tag': case 'team': case 'bossbar':
      case 'gamerule': case 'setblock': case 'playsound': case 'effect':
        return { result: 0, success: true };
      case 'time': return { result: this.world.daytime ?? 0, success: true };
      default:
        this.warnings.push(`unhandled command: ${cmd}`);
        return { result: 0, success: false };
    }
  }

  execRandom(a, ctx) {
    if (a[0] !== 'value') { this.warnings.push(`random ${a[0]} unsupported`); return { result: 0, success: false }; }
    const m = /^(-?\d+)\.\.(-?\d+)$/.exec(a[1]);
    if (!m) { this.errors.push(`bad random range ${a[1]}`); return { result: 0, success: false }; }
    const lo = Number(m[1]), hi = Number(m[2]);
    const v = lo + (this.rnd() % (hi - lo + 1));
    return { result: v, success: true };
  }

  execFunction(a, ctx, depth) {
    const id = a[0];
    let macroArgs = null;
    if (a[1] === 'with') {
      const src = a[2];
      if (src === 'storage') {
        const val = this.getPath(this.storage[a[3]] ?? {}, a[4] ?? '');
        if (val === undefined || val === null || typeof val !== 'object') { this.errors.push(`macro source missing: ${a[3]} ${a[4]}`); return { result: 0, success: false }; }
        macroArgs = val;
      } else { this.warnings.push(`macro source ${src} unsupported`); return { result: 0, success: false }; }
    } else if (typeof a[1] === 'string' && a[1].startsWith('{')) {
      // 内联宏参数：`function ns:f {reason:3}` —— v4 大量使用（check/fail、debug/reject、doom.log:dump…）
      try { macroArgs = parse(a.slice(1).join(' ')); } catch (e) { this.errors.push(`inline macro args parse: ${e.message}`); return { result: 0, success: false }; }
    } else if (a[1] !== undefined) {
      this.warnings.push(`function call form unsupported: ${a.slice(0, 4).join(' ')}`);
    }
    return this.run(id, ctx, depth + 1, macroArgs);
  }

  execScoreboard(a, ctx) {
    if (a[0] === 'objectives' && a[1] === 'add') { this.objectives.add(a[2]); if (!this.scores.has(a[2])) this.scores.set(a[2], new Map()); return { result: 1, success: true }; }
    if (a[0] !== 'players') return { result: 0, success: true };
    const sub = a[1], target = a[2], obj = a[3];
    if (sub === 'get') { const v = this.score(obj, target); return { result: v ?? 0, success: v !== undefined }; }
    if (sub === 'set') { this.setScore(obj, target, Number(a[4])); return { result: 1, success: true }; }
    if (sub === 'add') { this.setScore(obj, target, (this.score(obj, target) ?? 0) + Number(a[4])); return { result: 1, success: true }; }
    if (sub === 'remove') { this.setScore(obj, target, (this.score(obj, target) ?? 0) - Number(a[4])); return { result: 1, success: true }; }
    if (sub === 'reset') { this.setScore(obj, target, undefined); return { result: 1, success: true }; }
    if (sub === 'operation') {
      const [, , tgt, tObj, op, src, sObj] = a;
      const x = this.score(tObj, tgt) ?? 0, y = this.score(sObj, src) ?? 0;
      let r;
      switch (op) {
        case '=': r = y; break; case '+=': r = x + y; break; case '-=': r = x - y; break;
        case '*=': r = Math.imul(x, y); break;
        case '/=': r = y === 0 ? 0 : Math.trunc(x / y); break;
        case '%=': r = y === 0 ? 0 : x % y; break;
        case '<': r = Math.min(x, y); break; case '>': r = Math.max(x, y); break;
        default: this.warnings.push(`op ${op}`); r = x;
      }
      if (op === '><') { this.setScore(tObj, tgt, y); this.setScore(sObj, src, x); return { result: 1, success: true }; }
      this.setScore(tObj, tgt, r | 0);
      return { result: 1, success: true };
    }
    return { result: 0, success: true };
  }

  execSummon(a, ctx) {
    let i = 0;
    const type = a[i++].replace(/^minecraft:/, '');
    const pos = { x: ctx.pos.x, y: ctx.pos.y, z: ctx.pos.z };
    if (a[i] !== undefined && !a[i].startsWith('{')) {
      pos.x = parseCoord(a[i], ctx.pos.x).v; pos.y = parseCoord(a[i + 1], ctx.pos.y).v; pos.z = parseCoord(a[i + 2], ctx.pos.z).v; i += 3;
    }
    let nbt = {};
    if (a[i] && a[i].startsWith('{')) { try { nbt = parse(a[i]); } catch (e) { this.errors.push(`summon NBT parse: ${e.message}`); } }
    const ent = {
      uuid: `e${this.seq++}`, type, tags: (nbt.Tags || []).slice(), nbt, pos,
      rot: { yaw: ctx.rot.yaw, pitch: ctx.rot.pitch },
    };
    if (nbt.UUID) ent.uuidArr = nbt.UUID.v ?? nbt.UUID;
    // vanilla assigns every entity a fresh random UUID; model it for the seeder AEC so the
    // `data get entity @s UUID[0]` seeding path is exercised (deterministic, one draw)
    if (type === 'area_effect_cloud' && !nbt.UUID) {
      const seed = this.rnd() % 2147483648;
      ent.nbt.UUID = [num(seed), num(0), num(0), num(0)];
      ent.seededFrom = seed;
    }
    this.world.entities.push(ent);
    // "product" = anything that is not an auxiliary carrier entity
    if (['marker', 'area_effect_cloud'].includes(type)) this.auxSummons++;
    if (!['marker', 'area_effect_cloud'].includes(type)) {
      this.spawns.push({ type, x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2), nbt });
    }
    return { result: 1, success: true };
  }

  removeEntity(e) { const i = this.world.entities.indexOf(e); if (i >= 0) this.world.entities.splice(i, 1); }

  // ---------------- data ----------------
  splitPath(p) { return String(p).split(/(?=[.\[])/).filter(Boolean).map((s) => s.replace(/^\./, '').replace(/^\[|\]$/g, '')); }
  // ---------------- tellraw 渲染（把聊天输出变成可采集的文本行）----------------
  // 真机里这些行会进 latest.log，collect.mjs 靠前缀抽数；模拟器里同样渲染一份，
  // 于是「离线 sim」与「真机实测」走同一套采集脚本（objective ⑤ 的 sim 腿）。
  execTellraw(a, ctx) {
    const json = a.slice(1).join(' ');
    let parts;
    try { parts = parse(json); } catch (e) { this.warnings.push('tellraw parse: ' + e.message); return { result: 0, success: true }; }
    const arr = Array.isArray(parts) ? parts : [parts];
    const text = arr.map((c) => this.renderComponent(c, ctx)).join('');
    this.messages.push(text);
    return { result: 1, success: true };
  }

  renderComponent(c, ctx) {
    if (c === null || c === undefined) return '';
    if (typeof c === 'string' || typeof c === 'number') return String(c);
    if (Array.isArray(c)) return c.map((x) => this.renderComponent(x, ctx)).join('');
    let out = '';
    if (c.text !== undefined) out += String(c.text);
    if (c.score) out += String(this.score(c.score.objective, c.score.name) ?? 0);
    if (c.nbt) {
      let v;
      if (c.nbt.storage) v = this.getPath(this.storage[c.nbt.storage] ?? {}, c.nbt.path ?? '');
      else if (c.nbt.entity) v = this.getPath(this.select(c.nbt.entity, ctx)[0]?.nbt ?? {}, c.nbt.path ?? '');
      out += v === undefined ? '' : (v instanceof Num ? serialize(v) : (typeof v === 'object' ? JSON.stringify(v) : String(v)));
    }
    if (c.selector) out += String(this.select(c.selector, ctx).length);
    if (c.extra !== undefined) out += this.renderComponent(c.extra, ctx);
    return out;
  }

  getPath(root, p) { if (!p) return root; let cur = root; for (const k of this.splitPath(p)) { if (cur == null) return undefined; cur = cur[k]; } return cur; }  setPath(root, p, v) {
    const ks = this.splitPath(p); let cur = root;
    for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; cur = cur[k]; }
    cur[ks[ks.length - 1]] = v;
  }
  execData(a, ctx) {
    if (a[0] !== 'modify' && a[0] !== 'get') return { result: 0, success: true };
    if (a[0] === 'get') {
      const [, src, tgt, p] = a;
      if (src === 'entity') {
        const es = this.select(tgt, ctx); const e = es[0]; if (!e) return { result: 0, success: false };
        // 位置的权威来源是实体的 pos：v4 的 pos/hit 用 `data get entity @s Pos[0] 1` 拿绝对坐标
        if (/^Pos\[\d\]$/.test(p)) return { result: e.pos ? [e.pos.x, e.pos.y, e.pos.z][Number(p[4])] ?? 0 : 0, success: true };
        const v = this.getPath(e.nbt, p);
        return { result: (v instanceof Num ? v.v : v) ?? 0, success: v !== undefined };
      }
      if (src === 'storage') {
        const v = this.getPath(this.storage[tgt] ?? {}, p);
        return { result: (v instanceof Num ? v.v : v) ?? 0, success: v !== undefined };
      }
      return { result: 0, success: false };
    }
    const [, src, tgt, p, op] = a;
    let value;
    if (op === 'set') {
      const rest = a.slice(5).join(' ');
      const sub = tokenize(rest);
      if (sub[0] === 'value') value = parse(rest.slice('value'.length).trim());
      else if (sub[0] === 'from') {
        if (sub[1] === 'storage') value = this.getPath(this.storage[sub[2]] ?? {}, sub[3] ?? '');
        else { this.warnings.push(`data from ${sub[1]}`); return { result: 0, success: false }; }
      } else { this.warnings.push(`data op ${sub[0]}`); return { result: 0, success: false }; }
    } else { this.warnings.push(`data ${op}`); return { result: 0, success: false }; }

    if (src === 'storage') {
      const id = tgt; if (!this.storage[id]) this.storage[id] = {};
      if (!p) this.storage[id] = value; else this.setPath(this.storage[id], p, value);
      return { result: 1, success: true };
    }
    if (src === 'entity') {
      const es = this.select(tgt, ctx); const e = es[0]; if (!e) return { result: 0, success: false };
      if (!p) e.nbt = value; else this.setPath(e.nbt, p, value);
      if (p === 'Rotation' && Array.isArray(value)) { e.rot.yaw = value[0]?.v ?? 0; e.rot.pitch = value[1]?.v ?? 0; }
      return { result: 1, success: true };
    }
    this.warnings.push(`data target ${src}`); return { result: 0, success: false };
  }

  // ---------------- execute ----------------
  execExecute(a, ctx, depth) {
    let cur = ctx;
    let i = 0;
    let storeSpec = null;
    for (;;) {
      if (i >= a.length) { this.errors.push('execute without run'); return { result: 0, success: false }; }
      const sub = a[i];
      if (sub === 'run') return this.dispatch(a.slice(i + 1), cur, depth);
      switch (sub) {
        case 'as': { const es = this.select(a[i + 1], cur); if (!es.length) return { result: 0, success: false }; cur = { ...cur, entity: es[0] }; i += 2; break; }
        case 'at': {
          const es = this.select(a[i + 1], cur); if (!es.length) return { result: 0, success: false };
          const e = es[0];
          cur = { ...cur, pos: { ...e.pos }, rot: { ...e.rot } };
          i += 2; break;
        }
        case 'positioned': {
          if (a[i + 1] === 'as') {
            const es = this.select(a[i + 2], cur); if (!es.length) return { result: 0, success: false };
            cur = { ...cur, pos: { ...es[0].pos } }; i += 3; break;
          }
          const base = [cur.pos.x, cur.pos.y, cur.pos.z];
          const q = [a[i + 1], a[i + 2], a[i + 3]].map((s, k) => parseCoord(s, base[k]));
          if (q.some((p) => p.local)) {
            // local (^) components are offsets along the facing basis; other components override
            const f = forward(cur.rot), u = upVec(cur.rot), l = leftVec(cur.rot);
            const lx = q[0].local ? q[0].v : 0, ly = q[1].local ? q[1].v : 0, lz = q[2].local ? q[2].v : 0;
            const dx = f.x * lz + u.x * ly + l.x * lx;
            const dy = f.y * lz + u.y * ly + l.y * lx;
            const dz = f.z * lz + u.z * ly + l.z * lx;
            cur = {
              ...cur,
              pos: {
                x: q[0].local ? cur.pos.x + dx : q[0].v,
                y: q[1].local ? cur.pos.y + dy : q[1].v,
                z: q[2].local ? cur.pos.z + dz : q[2].v,
              },
            };
          } else {
            cur = { ...cur, pos: { x: q[0].v, y: q[1].v, z: q[2].v } };
          }
          i += 4; break;
        }
        case 'rotated': {
          if (a[i + 1] === 'as') { const es = this.select(a[i + 2], cur); if (!es.length) return { result: 0, success: false }; cur = { ...cur, rot: { ...es[0].rot } }; i += 3; break; }
          cur = { ...cur, rot: { yaw: parseFloatArg(a[i + 1]), pitch: parseFloatArg(a[i + 2]) } }; i += 3; break;
        }
        case 'align': {
          if (a[i + 1] === 'xyz') cur = { ...cur, pos: { x: Math.floor(cur.pos.x), y: Math.floor(cur.pos.y), z: Math.floor(cur.pos.z) } };
          i += 2; break;
        }
        case 'in': { cur = { ...cur, dimension: a[i + 1] }; i += 2; break; }
        case 'facing': i += a[i + 2] === 'entity' ? 3 : 4; break;
        case 'anchored': i += 2; break;
        case 'store': {
          const kind = a[i + 1];                         // result | success
          const target = a[i + 2];                       // score | storage | entity | block | bossbar
          let consumed, spec;
          if (target === 'score') { spec = { target, name: a[i + 3], obj: a[i + 4], type: 'int', scale: 1 }; consumed = 5; }
          else if (target === 'storage') { spec = { target, id: a[i + 3], path: a[i + 4], type: a[i + 5], scale: Number(a[i + 6]) }; consumed = 7; }
          else { this.warnings.push(`store ${target}`); return { result: 0, success: false }; }
          spec.kind = kind;
          storeSpec = spec; i += consumed; break;
        }
        case 'if': case 'unless': {
          const neg = sub === 'unless';
          const r = this.evalCondition(a.slice(i + 1), cur);
          const ok = neg ? !r.ok : r.ok;
          const used = 1 + r.used;
          // A condition is "terminal" only when nothing at all follows it, e.g.
          // `execute store result score X if entity @e[...]`. Intermediate conditions in a
          // chain (`execute if a if b at @r run X`) are followed by more subcommands.
          const isTerminal = (i + used >= a.length);
          if (isTerminal) {
            // `execute store result score X if entity @e[...]` -> X = match count
            const val = ok ? (r.count ?? 1) : 0;
            if (storeSpec) {
              const v = storeSpec.kind === 'result' ? val : (ok ? 1 : 0);
              this.applyStore(storeSpec, v);
            }
            return { result: val, success: ok };
          }
          if (!ok) return { result: 0, success: false };
          i += used; break;
        }
        default: this.errors.push(`execute subcommand ${sub}`); return { result: 0, success: false };
      }
      if (storeSpec && i < a.length && a[i] === 'run') {
        const r = this.dispatch(a.slice(i + 1), cur, depth);
        const v = storeSpec.kind === 'result' ? r.result : (r.success ? 1 : 0);
        this.applyStore(storeSpec, v);
        return { result: v, success: true };
      }
    }
  }

  applyStore(spec, v) {
    if (spec.target === 'score') { this.setScore(spec.obj, spec.name, Math.floor(v * (spec.scale ?? 1))); return; }
    const id = spec.id; if (!this.storage[id]) this.storage[id] = {};
    const scaled = spec.type === 'int' ? Math.trunc(v * spec.scale) : v * spec.scale;
    this.setPath(this.storage[id], spec.path, new Num(scaled, spec.type === 'float' ? 'f' : spec.type === 'double' ? 'd' : 'i'));
  }

  evalCondition(a, ctx) {
    const k = a[0];
    if (k === 'score') {
      // `if score <target> <objective> matches <range>`
      if (a[3] === 'matches') {
        const v = this.score(a[2], a[1]);
        const ok = v !== undefined && inNumRange(a[4], v);
        return { ok, used: 5 };
      }
      // `if score <target> <objective> <op> <source> <sourceObjective>`
      const ops = { '<': (x, y) => x < y, '<=': (x, y) => x <= y, '=': (x, y) => x === y, '>=': (x, y) => x >= y, '>': (x, y) => x > y };
      const f = ops[a[3]];
      if (f) {
        const x = this.score(a[2], a[1]);
        const y = this.score(a[5], a[4]);
        // vanilla requires both sides to exist unless the operator tolerates it
        const ok = x !== undefined && y !== undefined && f(x, y);
        return { ok, used: 6 };
      }
      this.errors.push(`bad score condition: ${a.slice(0, 6).join(' ')}`);
      return { ok: false, used: 5 };
    }
    if (k === 'block') {
      const p = { x: parseCoord(a[1], ctx.pos.x).v, y: parseCoord(a[2], ctx.pos.y).v, z: parseCoord(a[3], ctx.pos.z).v };
      const spec = a[4];
      const b = this.world.blockAt(p.x, p.y, p.z);
      const tagSet = spec.startsWith('#') ? this.blockTags?.get(spec.slice(1)) : null;
      const ok = spec.startsWith('#') ? (tagSet ? tagSet.has(b) : (spec === this.tagSolid ? this.world.solidTag.has(b) : spec === this.tagFree ? this.world.freeTag.has(b) : false))
        : b === (spec.includes(':') ? spec : 'minecraft:' + spec);
      return { ok, used: 5 };
    }
    if (k === 'biome') {
      // 两种写法：`if biome <id>`（v4 的 biome/detect）与 `if biome <x> <y> <z> <id>`
      const hasPos = /^[~^]/.test(String(a[1])) || /^-?\d/.test(String(a[1]));
      const spec = hasPos ? a[4] : a[1];
      const used = hasPos ? 5 : 2;
      const have = this.world.biomeAt(ctx.pos.x, ctx.pos.y, ctx.pos.z);
      return { ok: String(spec) === String(have), used };
    }
    if (k === 'entity') { const es = this.select(a[1], ctx); return { ok: es.length > 0, used: 2, count: es.length }; }
    if (k === 'predicate') {
      const ok = this.evalPredicate(a[1], ctx, null);
      return { ok, used: 2 };
    }
    if (k === 'loaded') { return { ok: true, used: 4 }; }
    if (k === 'dimension') { return { ok: String(a[1]) === ctx.dimension, used: 2 }; }
    if (k === 'function') { const r = this.run(a[1], ctx, 1); return { ok: r.success, used: 2 }; }
    this.warnings.push(`condition ${k}`);
    return { ok: false, used: 1 };
  }

  // ---------------- predicates ----------------
  evalPredicate(id, ctx, thisEntity) {
    const p = this.predicates?.get(id);
    if (!p) { this.errors.push(`unknown predicate ${id}`); return false; }
    return this.evalConditionTree(p, ctx, thisEntity);
  }
  evalConditionTree(c, ctx, thisEntity) {
    switch (c.condition) {
      case 'minecraft:weather_check': {
        // 世界的天气：0=晴 1=雨 2=雷暴（雷暴同时满足 raining 与 thundering）
        const w = this.world.weather ?? 0;
        if (c.raining === true && w < 1) return false;
        if (c.raining === false && w >= 1) return false;
        if (c.thundering === true && w < 2) return false;
        if (c.thundering === false && w >= 2) return false;
        return true;
      }
      case 'minecraft:location_check': {
        const src = c.predicate || {};
        return this.evalLocation(src, ctx.pos, ctx, null);
      }
      case 'minecraft:entity_properties': {
        const ent = c.entity === 'this' ? thisEntity : null;
        const pos = ent ? ent.pos : ctx.pos;
        const loc = c.predicate?.location;
        if (!loc) return true;
        return this.evalLocation(loc, pos, ctx, ent);
      }
      default: this.warnings.push(`predicate condition ${c.condition}`); return false;
    }
  }
  evalLocation(loc, pos, ctx, ent) {
    this.world.queries.predicate++;
    // v4.17（P1-6）：模拟世界**没有结构** ⇒ "是否位于结构内"（location_check.structures，如本包的
    //   spawn/in_fortress 与 spawn/in_pillager_outpost…）一律为假。旧实现忽略该字段（= 恒真），
    //   于是结构覆盖分支在 sim 里会无条件命中 —— 与真机不符（真实世界多数位置不在那些结构里）。
    if (loc.structures !== undefined) return false;
    const biome = loc.biomes ?? loc.biome;
    if (biome !== undefined) {
      const want = Array.isArray(biome) ? biome : [biome];
      const have = this.world.biomeAt(pos.x, pos.y, pos.z);
      if (!want.some((w) => String(w).replace(/^#/, '') === have || String(w) === have)) return false;
    }
    if (loc.dimension !== undefined && String(loc.dimension) !== ctx.dimension) return false;
    if (loc.light !== undefined && loc.light.light !== undefined) {
      const l = this.world.lightAt(pos.x, pos.y, pos.z);
      if (!inDoubleRange(loc.light.light, l)) return false;
    }
    if (loc.position !== undefined) {
      const q = loc.position;
      if (!inDoubleRange(q.x, pos.x) || !inDoubleRange(q.y, pos.y) || !inDoubleRange(q.z, pos.z)) return false;
    }
    return true;
  }

  // ---------------- selectors ----------------
  parseSelectorText(sel) {
    const m = /^(@[a-z])(?:\[(.*)\])?$/.exec(sel.trim());
    if (!m) return null;
    const args = {};
    if (m[2]) {
      let depth = 0, cur = '', parts = [];
      for (const ch of m[2]) {
        if (ch === '{' || ch === '[') depth++;
        if (ch === '}' || ch === ']') depth--;
        if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
        cur += ch;
      }
      if (cur) parts.push(cur);
      // 同一个键可以出现多次（如 `tag=doom.nats.spawned,tag=!doom.nats.persistent`）：
      // 旧写法用对象直接把后者覆盖前者 ⇒ 过滤条件被吃掉（实测会把玩家当成 mob 选中并 kill @s）。
      for (const p of parts) {
        const i = p.indexOf('=');
        if (i < 0) continue;
        const k = p.slice(0, i).trim(), v = p.slice(i + 1).trim();
        if (args[k] === undefined) args[k] = v;
        else { let n = 2; while (args[k + '_' + n] !== undefined) n++; args[k + '_' + n] = v; }
      }
    }
    return { kind: m[1], args };
  }

  select(sel, ctx, forThis = null) {
    const uuidLike = /^[0-9a-fA-F-]{8,}$/.test(sel) && !sel.startsWith('@');
    if (uuidLike) {
      const norm = normUuid(sel);
      const e = this.world.entities.find((x) => normUuid(uuidOf(x)) === norm);
      return e ? [e] : [];
    }
    const s = this.parseSelectorText(sel);
    if (!s) return [];
    const { kind, args } = s;
    let list;
    if (kind === '@s') list = ctx.entity ? [ctx.entity] : [];
    else if (kind === '@a') list = this.world.entities.filter((e) => e.type === 'player');
    else if (kind === '@r') list = this.world.entities.filter((e) => e.type === 'player');
    else list = this.world.entities.slice();
    if (kind === '@r') {
      if (!list.length) return [];
      list = [list[this.rnd() % list.length]];
    }
    list = list.filter((e) => this.matchArgs(e, args, ctx, kind === '@r' || kind === '@a'));
    const limit = args.limit ? Number(args.limit) : undefined;
    if (limit !== undefined) list = list.slice(0, limit);
    this.world.queries.entity++;
    return list;
  }

  matchArgs(e, args, ctx, playersOnly) {
    if (args.type) {
      const t = args.type.replace(/^minecraft:/, '');
      const neg = t.startsWith('!');
      const ok = (neg ? e.type !== t.slice(1) : e.type === t);
      if (!ok) return false;
    }
    if (args.tag !== undefined) {
      for (const key of Object.keys(args)) {
        if (!key.startsWith('tag')) continue;
        const v = args[key];
        if (v.startsWith('!')) { if (e.tags.includes(v.slice(1))) return false; }
        else if (!e.tags.includes(v)) return false;
      }
    }
    if (args.gamemode) {
      const g = args.gamemode; const cur = e.gamemode ?? 'survival';
      if (g.startsWith('!')) { if (cur === g.slice(1)) return false; } else if (cur !== g) return false;
    }
    if (args.distance) {
      const d = Math.hypot(e.pos.x - ctx.pos.x, e.pos.y - ctx.pos.y, e.pos.z - ctx.pos.z);
      const spec = args.distance;
      const m = /^(-?[\d.]+)?\.\.(-?[\d.]+)?$/.exec(spec);
      if (m) { const lo = m[1] ? Number(m[1]) : 0, hi = m[2] ? Number(m[2]) : Infinity; if (!(d >= lo && d <= hi)) return false; }
      else if (Math.abs(d - Number(spec)) > 1e-9) return false;
    }
    if (args.x !== undefined || args.dx !== undefined) {
      const x = Number(args.x ?? 0), y = Number(args.y ?? 0), z = Number(args.z ?? 0);
      const dx = args.dx !== undefined ? Number(args.dx) : 0;
      const dy = args.dy !== undefined ? Number(args.dy) : 0;
      const dz = args.dz !== undefined ? Number(args.dz) : 0;
      const bx = e.pos.x, by = e.pos.y, bz = e.pos.z;
      if (!(bx <= x + dx && bx >= x && by <= y + dy && by >= y && bz <= z + dz && bz >= z)) return false;
    }
    if (args.predicate) {
      const p = this.predicates?.get(args.predicate);
      if (!p) { this.errors.push(`unknown predicate ${args.predicate}`); return false; }
      if (!this.evalConditionTree(p, ctx, e)) return false;
    }
    if (args.nbt) { /* not used by this pack */ }
    return true;
  }
}

// ---- helpers ----
function forward(rot) {
  const y = rot.yaw * Math.PI / 180, p = rot.pitch * Math.PI / 180;
  return { x: -Math.sin(y) * Math.cos(p), y: -Math.sin(p), z: Math.cos(y) * Math.cos(p) };
}
function upVec(rot) {
  const y = rot.yaw * Math.PI / 180, p = rot.pitch * Math.PI / 180;
  return { x: Math.sin(y) * Math.sin(p), y: Math.cos(p), z: -Math.cos(y) * Math.sin(p) };
}
function leftVec(rot) {
  const y = rot.yaw * Math.PI / 180;
  return { x: Math.cos(y), y: 0, z: Math.sin(y) };
}
function substitute(line, args) {
  return line.replace(/\$\(([A-Za-z0-9_]+)\)/g, (_, k) => {
    const v = args[k];
    if (v === undefined) return '';
    if (v instanceof Num) return serialize(v);
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return String(v);
    return serialize(v);
  });
}
const uuidOf = (e) => (e.uuidArr ? '[' + e.uuidArr.join(',') + ']' : e.uuid);
function normUuid(s) {
  if (s.startsWith('[')) return s;
  const parts = s.split('-');
  if (parts.length !== 5) return s;
  const hex = (parts[0].padStart(8, '0') + parts[1].padStart(4, '0') + parts[2].padStart(4, '0')
    + parts[3].padStart(4, '0') + parts[4].padStart(12, '0'));
  const a = parseInt(hex.slice(0, 8), 16) | 0, b = parseInt(hex.slice(8, 16), 16) | 0;
  const c = parseInt(hex.slice(16, 24), 16) | 0, d = parseInt(hex.slice(24, 32), 16) | 0;
  return `[${a},${b},${c},${d}]`;
}
