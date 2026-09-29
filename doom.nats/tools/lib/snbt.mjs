// SNBT (stringified NBT) parser + canonical serializer.
// Type-aware numbers so b/s/l/f/d suffixes survive a round-trip.

export class Num {
  constructor(v, t) { this.v = v; this.t = t || 'i'; }   // t: b|s|i|l|f|d
  toString() { return String(this.v); }
}
export const num = (v, t = 'i') => new Num(v, t);
export const isNum = (x) => x instanceof Num;

class IntArr { constructor(v) { this.v = v; } }   // [I;..]
class LongArr { constructor(v) { this.v = v; } }  // [L;..]
class ByteArr { constructor(v) { this.v = v; } }  // [B;..]

export class Parser {
  constructor(s) { this.s = s; this.i = 0; }
  ws() { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++; }
  peek() { return this.s[this.i]; }
  err(m) { throw new Error(`SNBT@${this.i}: ${m} :: ${JSON.stringify(this.s.slice(Math.max(0, this.i - 30), this.i + 30))}`); }

  parse() { this.ws(); const v = this.value(); this.ws(); return v; }

  value() {
    this.ws();
    const c = this.peek();
    if (c === '{') return this.compound();
    if (c === '[') return this.listOrArray();
    if (c === '"' || c === "'") return this.quoted();
    return this.scalar();
  }

  compound() {
    this.i++;                                   // {
    const o = {};
    this.ws();
    if (this.peek() === '}') { this.i++; return o; }
    for (;;) {
      this.ws();
      const k = (this.peek() === '"' || this.peek() === "'") ? this.quoted() : this.bareKey();
      this.ws();
      if (this.peek() !== ':') this.err('expected :');
      this.i++;
      o[k] = this.value();
      this.ws();
      const ch = this.peek();
      if (ch === ',') { this.i++; continue; }
      if (ch === '}') { this.i++; return o; }
      this.err('expected , or }');
    }
  }

  bareKey() {
    const st = this.i;
    while (this.i < this.s.length && /[A-Za-z0-9._+-]/.test(this.s[this.i])) this.i++;
    if (this.i === st) this.err('empty key');
    return this.s.slice(st, this.i);
  }

  quoted() {
    const q = this.s[this.i++];
    let out = '';
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (c === '\\') {
        const n = this.s[this.i + 1];
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n;
        this.i += 2; continue;
      }
      if (c === q) { this.i++; return out; }
      out += c; this.i++;
    }
    this.err('unterminated string');
  }

  listOrArray() {
    this.i++;                                   // [
    this.ws();
    const c = this.peek();
    if ((c === 'I' || c === 'L' || c === 'B') && this.s[this.i + 1] === ';') {
      const kind = c; this.i += 2;
      const vals = [];
      for (;;) {
        this.ws();
        if (this.peek() === ']') { this.i++; break; }
        const sv = this.scalar();
        vals.push(typeof sv === 'number' ? sv : sv.v);
        this.ws();
        if (this.peek() === ',') { this.i++; continue; }
        if (this.peek() === ']') { this.i++; break; }
        this.err('expected , or ] in array');
      }
      return kind === 'I' ? new IntArr(vals) : kind === 'L' ? new LongArr(vals) : new ByteArr(vals);
    }
    const vals = [];
    for (;;) {
      this.ws();
      if (this.peek() === ']') { this.i++; break; }
      vals.push(this.value());
      this.ws();
      if (this.peek() === ',') { this.i++; continue; }
      if (this.peek() === ']') { this.i++; break; }
      this.err('expected , or ] in list');
    }
    return vals;
  }

  scalar() {
    const st = this.i;
    while (this.i < this.s.length && !/[\s,\]\}]/.test(this.s[this.i])) this.i++;
    let tok = this.s.slice(st, this.i);
    if (!tok) this.err('empty scalar');
    if (tok === 'true') return true;
    if (tok === 'false') return false;
    let t = 'i';
    const last = tok[tok.length - 1];
    if (/[bslfdBSLFD]/.test(last) && /^[-+0-9.eE]/.test(tok)) { t = last.toLowerCase(); tok = tok.slice(0, -1); }
    const v = Number(tok);
    if (Number.isNaN(v)) return tok;             // bare word => string
    return new Num(v, t);
  }
}

export const parse = (s) => new Parser(s).parse();

// ---------- serialize ----------
const BARE = /^[A-Za-z0-9._+-]+$/;
function quoteStr(s) {
  if (s !== '' && BARE.test(s)) return s;
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}
function fmtNum(n) {
  const { v, t } = n;
  if (t === 'f' || t === 'd') {
    let s = Number.isInteger(v) ? v.toFixed(1) : String(v);
    return s + t;                              // 0.0f / 0.085f
  }
  const iv = Math.trunc(v);
  return t === 'i' ? String(iv) : String(iv) + t;
}
export function serialize(v) {
  if (v === null || v === undefined) return 'null';
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (v instanceof Num) return fmtNum(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return quoteStr(v);
  if (v instanceof IntArr) return '[I;' + v.v.join(',') + ']';
  if (v instanceof LongArr) return '[L;' + v.v.join(',') + ']';
  if (v instanceof ByteArr) return '[B;' + v.v.join(',') + ']';
  if (Array.isArray(v)) return '[' + v.map(serialize).join(',') + ']';
  if (typeof v === 'object') {
    const parts = Object.entries(v).map(([k, x]) => quoteStr(k) + ':' + serialize(x));
    return '{' + parts.join(',') + '}';
  }
  return String(v);
}

// ---------- command-aware tokenizer ----------
// Split a command line on top-level whitespace, respecting {}, [] and quotes.
export function tokenize(line) {
  const out = [];
  let depth = 0, q = null, cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { cur += c; if (c === '\\') { cur += line[++i] ?? ''; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '{' || c === '[') depth++;
    if (c === '}' || c === ']') depth--;
    if (/\s/.test(c) && depth === 0) { if (cur) { out.push(cur); cur = ''; } continue; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

// Find the index of the top-level " run " keyword in a token list (execute chains).
export function lastRunIndex(tokens) {
  let depth = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i] === 'run') return i;
  }
  return -1;
}

export const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
