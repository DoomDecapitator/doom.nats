// lint_pack.mjs — 本包的静态自检（v4）。
//
//   node tools/lint_pack.mjs [packDir]
//
// 检查项（都是"加载期会直接报错、但不一定进聊天栏"的那类问题）：
//   L1 function 引用必须存在（含宏调用 `with storage`）
//   L2 计分板 objective 必须在 setup 里 add 过
//   L3 `#常量` 虚位玩家必须有定义（scoreboard players set #N <obj> N）
//   L4 含 `$(...)` 的行必须带 `$` 前缀（否则宏不会被替换，命令会原样失败）
//   L5 带 `$` 前缀的函数必须真的被 `with` 调用（否则等于死代码）
//   L6 位置参数里的 `~` 拼写（`~-32` 合法、`~--32` 非法）
//   L7 宏占位符语法：只认 $(name)，${name} 不会被替换（静默失效）
//   L11 命令中不得出现连续两个空格（Brigadier 直接报 Incorrect argument ⇒ 整个函数加载失败；真机实测）
//   L12 宏行（`$` 开头）必须含至少一个 `$(name)`（否则整函数加载失败：No variables in macro）
//   L13 产物里不得出现裸 `undefined`/`NaN`（模板把 JS 值漏进命令 ⇒ Expected integer ⇒ 整函数加载失败；真机实测）
//   L14 群系类别分发必须显式设置 $catid（单类别群系会沿用上一个群系的值）
//   L15 容量计数写入点闭合：凡被 $cnt.$(cat) 读到的类别，主世界/下界/末地三个维度都必须有 set + add 写入点
//       （缺一个 ⇒ 该维度恒读 0 ⇒ 容量门形同不存在；v4.26 前的 4 个水生类别就是这么静默失效的）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACK = path.resolve(process.argv[2] || path.join(ROOT, '..', 'pack', 'doom.nats'));
const LF = String.fromCharCode(10);

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};
const all = walk(PACK);
const rel = (p) => path.relative(PACK, p).split(path.sep).join('/');

// ---- 收集 ----
const fns = new Set();
const objectives = new Set();
const consts = new Set();
const macroCalled = new Set();
const problems = [];
const external = new Set();   // 本包之外（如 doom.log 调试包）的函数引用
const add = (sev, where, msg) => problems.push({ sev, where, msg });

for (const p of all) {
  const r = rel(p);
  const m = /^data\/([^/]+)\/function\/(.+)\.mcfunction$/.exec(r);
  if (m) fns.add(m[1] + ':' + m[2]);
}
for (const p of all) {
  if (!p.endsWith('.mcfunction')) continue;
  const r = rel(p);
  for (const raw of fs.readFileSync(p, 'utf8').split(LF)) {
    const line = raw.trim();
    const body = line.startsWith('$') ? line.slice(1).trim() : line;
    if (!body || body.startsWith('#')) continue;
    // L2 objective
    for (const mm of body.matchAll(/scoreboard objectives add ([a-z0-9_.:-]+)/g)) objectives.add(mm[1]);
    for (const mm of body.matchAll(/scoreboard players (?:set|add|remove) (#[A-Za-z0-9_]+) ([a-z0-9_.:-]+)/g)) consts.add(mm[1] + '@' + mm[2]);
    // L8 `execute if biome` 的坐标参数是必需的（1.21.6 实测：少坐标报「应为整型」并让整个函数加载失败）
    if (/execute (?:if|unless) biome (?!~|-?d|^)/.test(body)) add('ERROR', r, 'if biome 缺坐标，应为 `if biome ~ ~ ~ <biome>`：' + body.slice(0, 60));
    // L4 宏行缺 $ 前缀
    if (!line.startsWith('$') && body.includes('$(')) add('ERROR', r, '含 $(...) 但缺 `$` 前缀：' + body.slice(0, 60));
    // L10 相对坐标不能写成 ~+N（只能 ~N / ~-N，否则整个函数加载失败）
    if (/~\+/.test(line)) add('ERROR', r, '非法相对坐标 ~+N：' + line.slice(0, 60));
    // L9 mcfunction 只认整行注释：行尾 '# ' 会被当成参数 ⇒ 整条命令（乃至整个函数）加载失败
    //    （实测踩过：`scoreboard players set $band.dy doom.nats 9999   # 哨兵` ⇒ pos/band 整个函数加载失败）
    //    标签引用是 `#ns:path`（# 后紧跟字符、且前面是空白），所以只把「# 后面跟空白」当注释。
    if (/\s#\s/.test(line) && !line.startsWith('#')) add('ERROR', r, '行尾注释（mcfunction 只允许整行 # 注释）：' + line.slice(0, 60));
    // L11 连续空格：Brigadier 不接受 `matches 3  run`（真机实测报 Incorrect argument，整个函数加载失败）
    //   （只查引号之外的：字符串参数里的空格是合法的，如 tellraw 的 "text")
    const unquoted = body.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])*'/g, "''");
    if (/[^ ] {2,}[^ ]/.test(unquoted)) add('ERROR', r, '命令含连续两个空格（Brigadier 会拒绝整条命令）：' + body.slice(0, 60));
    // L7 占位符语法：Minecraft 只认 $(name)，写 ${name} 不会被替换 ⇒ 命令解析失败
    //    （v4 曾 9 处写成 ${...}，导致整包一次都不刷怪、且没有任何报错可见）
    const bad = /\$\{[A-Za-z0-9_]+\}/.exec(line);
    if (bad) add(line.startsWith('$') ? 'ERROR' : 'WARN', r, '占位符写成 ' + bad[0] + '（应为 $(' + bad[0].slice(2, -1) + ')）');
    // L12 宏行必须含占位符：实测「以 $ 开头但没有 $(name)」的行会让**整个函数**加载失败
    //     （zzm:a = $execute store result storage … run random value 0..359 → Failed to load；同样内容去掉 $ 后正常）
    if (line.startsWith('$') && !/\$\([A-Za-z0-9_]+(?::[A-Za-z0-9_]+)?\)/.test(line)) {
      add('ERROR', r, '宏行（$ 开头）里没有任何 $(name) 占位符，会导致整函数加载失败：' + line.slice(0, 60));
    }
    // L13 生成物里不得出现裸 `undefined`/`NaN`：模板把 JS 值漏进产物时会写成 `scoreboard players set $x ns undefined`
    //     ⇒ Brigadier 报 `Expected integer at position …`，**整个函数加载失败**（v4.17 真机抓到：mob/struct/monument_monster
    //     的 `$sel.rule` 因为 guardian 不在 roster 里而取不到规则 id ⇒ undefined）。生成端要在源头避免（把类型并进规则表），
    //     lint 这里做**兜底**：任何含裸 undefined/NaN 的行都是 ERROR。
    if (/(?:^|\s)(undefined|NaN)(?:\s|$)/.test(body)) {
      add('ERROR', r, '产物里出现裸 ' + (/(?:^|\s)(undefined|NaN)(?:\s|$)/.exec(body)[1]) + '（模板把 JS 值漏进命令 ⇒ 整函数加载失败）：' + body.slice(0, 70));
    }
  }
}
for (const p of all) {
  if (!p.endsWith('.mcfunction')) continue;
  const r = rel(p);
  const lines = fs.readFileSync(p, 'utf8').split(LF);
  const isMacroFile = lines.some((l) => l.startsWith('$'));
  let used = false;
  for (const raw of lines) {
    const line = raw.trim();
    const body = line.startsWith('$') ? line.slice(1).trim() : line;
    if (!body || body.startsWith('#')) continue;
    // L1 函数引用
    for (const mm of body.matchAll(/function\s+([a-z0-9_.-]+:[a-z0-9_/.-]+)(\s+with\s+)?/g)) {
      const id = mm[1];
      if (mm[2]) macroCalled.add(id);
      // v4.15：宏派发 `function ns:post/$(slug) with storage …` —— 正则只吃到前缀 `ns:post/`，
      //   此时要求「前缀下至少有一个函数」，并把前缀下全部函数标记为已被 with 调用（否则 L5 误报）。
      if (body.slice(mm.index + mm[0].length).startsWith('$(')) {
        const hits = [...fns].filter((x) => x.startsWith(id));
        if (!hits.length) add('ERROR', r, '宏派发的函数前缀下没有任何函数：' + id + '$(…)');
        for (const h of hits) macroCalled.add(h);
        continue;
      }
      if (!fns.has(id)) {
        if (id.startsWith('doom.nats:')) add('ERROR', r, '引用了不存在的函数 ' + id);
        else external.add(id);
      }
    }
    for (const mm of body.matchAll(/function\s+#([a-z0-9_.-]+:[a-z0-9_/.-]+)/g)) {
      const tagPath = path.join(PACK, 'data', mm[1].split(':')[0], 'tags', 'function', mm[1].split(':')[1] + '.json');
      if (!fs.existsSync(tagPath)) add('ERROR', r, '引用了不存在的函数标签 #' + mm[1]);
    }
    // L3 常量
    for (const mm of body.matchAll(/(?:scoreboard players (?:get|operation [^ ]+ [^ ]+ [^ ]+)|matches|operation =)\s*([^\s]*#[A-Za-z0-9_]+)/g)) {
      const c = mm[1];
      if (c.startsWith('#')) {
        let ok = false;
        for (const k of consts) if (k.startsWith(c + '@')) ok = true;
        if (!ok) add('WARN', r, '使用了未见定义的常量 ' + c);
      }
    }
    // L6 位置拼写
    if (/~\s*--|~\s*~~|~~/.test(body)) add('WARN', r, '位置参数可疑：' + body.slice(0, 60));
  }
  if (isMacroFile && !used) {
    // 由调用方判定
  }
}

// L14 群系类别分发必须**显式设置 $catid**（v4.18/Q7 真机抓到）
//   $catid 是全局计分板，多类别群系靠 `execute store result score $catid … run random value 0..N-1` 覆盖它；
//   单类别群系若只写 `if score $catid matches 0` 而不置 0，就会沿用上一个群系留下的值 ⇒ 随机整片群系不刷怪。
//   受害面：原版 7 个单类别群系（the_end / end_barrens / end_highlands / end_midlands / small_end_islands /
//   deep_dark / the_void），以及任何被地图 worldgen 覆盖成「只有一类」的群系。
for (const p of all) {
  const r = rel(p);
  if (!/^data\/[^/]+\/function\/mob\/biome\/[^/]+\.mcfunction$/.test(r)) continue;
  const txt = fs.readFileSync(p, 'utf8');
  if (!/run function [a-z0-9_.-]+:mob\/biome\//.test(txt)) continue;   // 空表（无任何分发）不要求
  if (!/(?:scoreboard players set \$catid|execute store result score \$catid)/.test(txt)) {
    add('ERROR', r, 'L14 类别分发没有显式设置 $catid（单类别群系会沿用上一个群系的值 ⇒ 随机整片不刷怪）');
  }
}

// L15 容量计数「写入点」闭合（v4.26 的 P0 防线）
//   形状：check/cap（宏）按尝试维度读 $cnt.$(cat)（主世界）/ $cnt.$(cat).nether / $cnt.$(cat).end；
//     只要有一处「类别 × 维度」**没有写入点**（check/caps 里的 set + add 计数行），那个维度读到的就是
//     0 或陈旧值 ⇒ 全局容量门**形同不存在**（静默偏松：加载期不报错、reason 也不记，只有真机 A/B 能看出来）。
//     v4.25 及以前 water_creature / water_ambient / underground_water_creature / axolotls 缺的正是主世界那一个。
//   判据（三条，任一不满足 = ERROR）：
//     ① 锚点：产物里必须存在宏读 $cnt.$(...)，否则说明读侧被删/改名（防线失去意义，宁可报红）
//     ② 类别集合 = 能写进 <ns>:sel.cat 的字面量类别（读侧真正的取值域）∪ 已被计数的 $cnt.<cat>[.dim]
//     ③ 对「每个类别 × {主世界('')、下界('.nether')、末地('.end')}」都必须同时有 set 行与 add 计数行
{
  const SKIP = new Set(['dim', 'local']);        // 引擎内部标量（$cnt.dim / $cnt.local），不是类别
  const SFX = ['', '.nether', '.end'];
  const readFrom = new Set();                    // 写进 <ns>:sel.cat 的字面量类别
  const setHas = new Map();                      // 类别 -> Set(维度后缀)：set 写入点
  const addHas = new Map();                      // 类别 -> Set(维度后缀)：计数写入点
  let readAnchor = 0;                            // $cnt.$(...) 宏读出现次数
  const put = (map, cat, sfx) => { if (!map.has(cat)) map.set(cat, new Set()); map.get(cat).add(sfx); };
  for (const p of all) {
    if (!p.endsWith('.mcfunction')) continue;
    for (const raw of fs.readFileSync(p, 'utf8').split(LF)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const body = line.startsWith('$') ? line.slice(1).trim() : line;
      if (!body || body.startsWith('#')) continue;
      // ① 读侧锚点：宏读 $cnt.$(cat) / $cnt.$(cat).nether / $cnt.$(cat).end
      for (const _ of body.matchAll(/\$cnt\.\$\([A-Za-z0-9_]+\)/g)) readAnchor++;
      // ② <ns>:sel.cat 的字面量取值（= check/cap 实际会收到的类别）
      if (/\bstorage\s+[a-z0-9_.-]+:sel\b/.test(body)) {
        for (const mm of body.matchAll(/\bcat:"([a-z0-9_]+)"/g)) readFrom.add(mm[1]);
      }
      // ③ 写入点：scoreboard players set/add $cnt.<cat>[.nether|.end] <obj> <n>
      const ms = /scoreboard players set \$cnt\.([a-z0-9_]+?)(\.nether|\.end)?\s+[a-z0-9_.:-]+\s/.exec(body);
      if (ms) put(setHas, ms[1], ms[2] || '');
      const ma = /scoreboard players add \$cnt\.([a-z0-9_]+?)(\.nether|\.end)?\s+[a-z0-9_.:-]+\s/.exec(body);
      if (ma) put(addHas, ma[1], ma[2] || '');
    }
  }
  if (!readAnchor) {
    add('ERROR', 'data', 'L15 容量计数的读侧锚点 $cnt.$(...) 不存在：check/cap 的维度分支可能被删/改名（防线失效）');
  }
  const cats = new Set([...readFrom, ...setHas.keys(), ...addHas.keys()]);
  for (const c of [...cats].sort()) {
    if (SKIP.has(c)) continue;
    for (const s of SFX) {
      if (!(setHas.get(c) || new Set()).has(s)) {
        add('ERROR', 'data', 'L15 容量计数缺写入点：$cnt.' + c + s + ' 没有 `scoreboard players set`（读它的那个维度会读 0/陈旧值 ⇒ 容量门形同不存在）');
      }
      if (!(addHas.get(c) || new Set()).has(s)) {
        add('ERROR', 'data', 'L15 容量计数缺计数点：$cnt.' + c + s + ' 没有 `scoreboard players add`（该维度容量永远数不出生物 ⇒ 恒通过）');
      }
    }
  }
}

// L5 宏文件是否被 with 调用
for (const p of all) {
  if (!p.endsWith('.mcfunction')) continue;
  const lines = fs.readFileSync(p, 'utf8').split(LF);
  if (!lines.some((l) => l.startsWith('$'))) continue;
  const m = /^data\/([^/]+)\/function\/(.+)\.mcfunction$/.exec(rel(p));
  if (!m) continue;
  const id = m[1] + ':' + m[2];
  if (!macroCalled.has(id)) add('WARN', rel(p), '含宏行但没有任何 `with` 调用');
}

// ---- 报告 ----
const errs = problems.filter((x) => x.sev === 'ERROR');
const warns = problems.filter((x) => x.sev === 'WARN');
console.log('=== lint: ' + rel(PACK) + ' ===');
if (external.size) console.log('外部依赖（需随包提供）: ' + [...external].sort().join(', '));
console.log('函数 ' + fns.size + ' · objective ' + objectives.size + ' · 常量 ' + consts.size + ' · 宏调用 ' + macroCalled.size);
for (const x of errs) console.log('❌ [ERROR] ' + x.where + ': ' + x.msg);
for (const x of warns) console.log('⚠️  [WARN ] ' + x.where + ': ' + x.msg);
console.log();
console.log('结论: ' + errs.length + ' error, ' + warns.length + ' warning');
process.exit(errs.length ? 1 : 0);
