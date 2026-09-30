#!/usr/bin/env node
/**
 * doom.nats/tools/collect.mjs —— 从游戏日志里抽结果，生成一份实测回报
 *
 *   node tools/collect.mjs [--save "<存档目录>"] [--out <报告路径>]
 *
 * 数据流：游戏内 `/function nats.debug:p0` 等命令 → 聊天栏 → `logs/latest.log`
 *         → 本工具按**机器可读前缀**抽取 → `doom.nats/reports/实测-<时间戳>.md`
 *
 * 抽取的前缀（由 harness/doom.log 与 nats.debug 产出）：
 *   [test] begin <id>         一轮测试开始（也用作「本轮起点」的锚）
 *   [check] <id> PASS|FAIL :: <msg>    断言
 *   [test] end pass=<n> fail=<n> calls=<n>
 *   [dump] <key> = <value>    数值/状态
 *   [nats] …                  调试命令的说明行
 *   [doom.log] …              夹具与日志
 * 另外扫**加载期错误**：1.20.2 起悬空引用会让整个函数失效，且不一定进聊天栏 ⇒ 必须查日志。
 *
 * 只读 latest.log（不写游戏目录）；报告写到 `doom.nats/reports/`。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, '..');          // doom.nats/
const WORKSPACE = path.resolve(ROOT, '..');          // 工作区根
const DEFAULT_SAVE =
  'C:/minecraft/Release 2.8.3.zip/.minecraft/versions/1.21.6-Fabric 0.16.14/saves/natspawns 9_27';

const argv = process.argv.slice(2);
const getArg = (n, d) => {
  const i = argv.indexOf(n);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};
const save = path.resolve(getArg('--save', DEFAULT_SAVE));
// 日志位置随启动方式而变：本机是 per-version game dir ⇒ 日志在**版本目录**下、不在存档里
const LOG_CANDIDATES = [
  getArg('--log', ''),
  process.env.NATS_LOG || '',
  path.join(save, 'logs', 'latest.log'),
  path.resolve(save, '..', '..', 'logs', 'latest.log'),
  path.resolve(save, '..', '..', '..', 'logs', 'latest.log'),
].filter(Boolean);
const logPath = LOG_CANDIDATES.find((p) => fs.existsSync(p));

/** 加载期/运行期错误特征（1.20.2+ 的悬空引用是最要命的一类）。
 *  用**字符串关键词**而非正则：可同时覆盖英文与中文客户端的本地化报错文本（实测本机为中文）。 */
const ERROR_KEYS = [
  'Unknown function', 'Unknown predicate', 'Unknown tag', 'Unknown item',
  'Failed to load function', 'Failed to load tag', 'Failed to load datapack',
  'Whilst parsing', 'Cannot load', "Couldn't load", 'Incorrect argument for command',
  'Unknown or incomplete command', 'Duplicated function',
  '未知的', '未知或不完整的命令', '加载失败', '无法加载', '解析', '预期的',
];

if (!logPath) {
  console.error('找不到日志。已尝试：');
  for (const p of LOG_CANDIDATES) console.error('  ·', p);
  console.error('用 --log "<latest.log 路径>" 手动指定。');
  process.exit(1);
}

const raw = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
const text = (l) => {
  // 只取 [CHAT] 之后的正文；非聊天行原样返回
  const i = l.indexOf('[CHAT] ');
  return i === -1 ? l : l.slice(i + 7);
};

const marks = [];   // 抽取到的标记行（按出现顺序）
const errors = [];  // 可疑错误行
const isLoadEvent = (t) => t.includes('Found new data pack file/') || t.includes('Reloading ResourceManager:');
const isRoundStart = (t) => t.includes('harness ready') || t.includes('[test] begin');
raw.forEach((line, idx) => {
  const t = text(line);
  // v4.1 修：旧正则只认 `[nats]` 这类整词，`[nats.env]` / `[nats.reject]` / `[nats.light]` / `[dryrun]`
  //           全都没被采集 ⇒ 归因小节永远是空的。这里允许标签后带后缀。
  if (/\[(test|check|dump|nats|dryrun|doom\.log)[^\]]*\]/.test(t)) marks.push({ idx, t });
  if (/ERROR|WARN/.test(line) && ERROR_KEYS.some((k) => t.includes(k))) errors.push({ idx, t });
});

// 「本轮起点」：截图式地锚在**最近一次数据包加载之前**——
// 加载错误（Failed to load function）出现在加载过程中，必须在起点之后才抓得到，
// 而 `harness ready` / `[test] begin` 是加载**完成后**才打印的，只能当上界。
const loadEvents = raw.map((l, i) => (isLoadEvent(text(l)) ? i : -1)).filter((i) => i >= 0);
const roundStarts = raw.map((l, i) => (isRoundStart(text(l)) ? i : -1)).filter((i) => i >= 0);
const upper = roundStarts.length ? roundStarts[roundStarts.length - 1] : Number.MAX_SAFE_INTEGER;
const priorLoads = loadEvents.filter((i) => i < upper);
let start = priorLoads.length ? priorLoads[priorLoads.length - 1] : (roundStarts.length ? roundStarts[roundStarts.length - 1] : 0);
// --since <行号>（1 基）：由调用方（mcauto --reuse）显式锚定本轮起点。
// 为什么需要：复用模式下服务器不重启，日志里还留着**上一轮**的 harness ready / 加载事件，
// 自动锚点会退回到旧位置，把历史错误算进本轮（本轮实测踩到：报告里 6 条全是上一轮的错）。
const sinceIdx = process.argv.indexOf('--since');
if (sinceIdx >= 0 && process.argv[sinceIdx + 1]) {
  const sinceLine = Number(process.argv[sinceIdx + 1]);
  if (Number.isFinite(sinceLine) && sinceLine > 0) start = Math.max(0, sinceLine - 1);
}
const relevant = marks.filter((m) => m.idx >= start);
const relErrors = errors.filter((e) => e.idx >= start);

const checks = relevant
  .filter((m) => /\[check\]/.test(m.t))
  .map((m) => {
    const mm = /\[check\]\s*(\S+)\s+(PASS|FAIL)\s*::\s*(.*)$/.exec(m.t);
    return mm ? { id: mm[1], ok: mm[2] === 'PASS', msg: mm[3] } : null;
  })
  .filter(Boolean);
const dumps = relevant
  .filter((m) => /\[dump\]/.test(m.t))
  .map((m) => m.t.replace(/^.*\[dump\]\s*/, '').trim());
const summaries = relevant.filter((m) => /\[test\] end/.test(m.t)).map((m) => m.t.trim());
const uniq = (a) => [...new Set(a)];

const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
const outPath = path.resolve(getArg('--out', path.join(ROOT, 'reports', `实测-${stamp}.md`)));

const pass = checks.filter((c) => c.ok).length;
const fail = checks.filter((c) => !c.ok).length;

const L = [];
L.push(`# nats 实测回报 · ${stamp}`);
L.push('');
L.push(`- 存档：\`${save}\``);
L.push(`- 日志：\`${logPath}\`（${raw.length} 行；本轮起点第 ${start + 1} 行）`);
L.push(`- 断言：**${pass} 通过 / ${fail} 失败**（共 ${checks.length}）`);
L.push('');
L.push('## P0 · 加载期断言（自动）');
L.push('');
if (!checks.length) {
  L.push('> 本轮没抓到 `[check]` 行 —— 还没进游戏跑 `/function nats.debug:p0`？');
} else {
  L.push('| id | 结果 | 说明 |');
  L.push('|---|---|---|');
  for (const c of checks) L.push(`| ${c.id} | ${c.ok ? '✅ PASS' : '❌ FAIL'} | ${c.msg} |`);
}
L.push('');
L.push('## P0 · 加载期报错（自动扫日志）');
L.push('');
if (!relErrors.length) {
  L.push('> 本轮起点之后**未发现**可疑错误行 ✅');
} else {
  L.push('| 行号 | 内容 |');
  L.push('|---|---|');
  for (const e of relErrors.slice(0, 40)) L.push(`| ${e.idx + 1} | \`${e.t.slice(0, 200).replace(/\|/g, '\\|')}\` |`);
  if (relErrors.length > 40) L.push(`| … | 另有 ${relErrors.length - 40} 条 |`);
}
L.push('');
// ---- v4 版（v4）新增：生成失败归因与环境快照 ----
// 两种来源：
//   ① 事件流：debug/reject 在 $rej_log=1 时逐条打 `[nats.reject] reason=N`
//   ② 快照：debug/reject_report 打 `[nats.reject] rej: 0=.. 7=.. spawned=..`（+ `[nats.light] tier: ..`）
// v4.1 修：旧版这里写的是 /reason=(d+)/（转义被吃掉），导致直方图恒为空。
// 客户端把 tellraw 打进日志时会插入 § 颜色码（如 `0=§f12`），解析数值前必须剥掉，
// 否则 [nats.reject] 的 KV 永远匹配不上。
const stripSec = (s) => s.replace(/\u00a7./g, '');
const KV = /([0-9]+)\s*=\s*(-?[0-9]+)/g;
const evRej = relevant.filter((m) => m.t.includes('[nats.reject]') && m.t.includes('reason=')).map((m) => {
  const mm = /reason=([0-9]+)/.exec(stripSec(m.t));
  return mm ? Number(mm[1]) : null;
}).filter((x) => x !== null);
const snapRej = [];
for (const m of relevant) {
  const t = stripSec(m.t);
  if (!t.includes('[nats.reject]') || !t.includes('rej:')) continue;
  const seg = t.slice(t.indexOf('rej:'));
  let g2;
  KV.lastIndex = 0;
  while ((g2 = KV.exec(seg))) snapRej.push([Number(g2[1]), Number(g2[2])]);
}
const snapLit = [];
for (const m of relevant) {
  const t = stripSec(m.t);
  if (!t.includes('[nats.light]') || !t.includes('tier:')) continue;
  const seg = t.slice(t.indexOf('tier:'));
  let g2;
  KV.lastIndex = 0;
  while ((g2 = KV.exec(seg))) snapLit.push([Number(g2[1]), Number(g2[2])]);
}
const spawned = (() => {
  for (const m of relevant) {
    if (!m.t.includes('[nats.reject]')) continue;
    const mm = /spawned=(-?[0-9]+)/.exec(stripSec(m.t));
    if (mm) return Number(mm[1]);
  }
  return null;
})();
const envMarks = relevant.filter((m) => m.t.includes('[nats.env]')).map((m) => m.t.trim());
const REJ_NAME = ['抽不到合格区块', '24 格内有玩家', '出 128 格', '光照档不足', '落位方块不允许', '全局容量已满', '附近玩家本地容量全满', '刷怪密度（spawn cost）超限', '选不到物种（该群系该类别无可用条目）', '该生物自身的规则不满足（逐实体规则）', '世界出生点 24 格内（v4.17：作者声明坐标后才可能）'];
if (evRej.length || snapRej.length || envMarks.length) {
  const hist = new Map();
  for (const r of evRej) hist.set(r, (hist.get(r) || 0) + 1);
  for (const [k, v] of snapRej) hist.set(k, v);   // 快照优先（是累计值）
  const total = [...hist.values()].reduce((a, b) => a + b, 0);
  L.push('## v4 · 生成失败归因（直方图）');
  L.push('');
  if (!hist.size) L.push('> 本轮没有归因数据（未触发 spawn/try，或全部成功）');
  else {
    L.push('| reason | 含义 | 次数 | 占比 |');
    L.push('|---|---|---|---|');
    for (const [k, v] of [...hist].sort((x, y) => y[1] - x[1])) {
      L.push('| ' + k + ' | ' + (REJ_NAME[k] || '?') + ' | ' + v + ' | ' + (total ? ((v / total) * 100).toFixed(1) : '0') + '% |');
    }
    L.push('');
    if (spawned !== null) L.push('- 成功生成（spawned）= ' + spawned + (total ? '　拒绝合计 = ' + total : ''));
    else L.push('> 没有 spawned（跑 /function doom.nats:debug/reject_report 打快照行）');
  }
  if (snapLit.length) {
    L.push('');
    L.push('### 光照失败档位（$lit.<tier>）');
    L.push('');
    L.push('| tier（允许的最大亮度） | 次数 |');
    L.push('|---|---|');
    for (const [k, v] of snapLit) L.push('| ' + k + ' | ' + v + ' |');
    L.push('');
    L.push('> 失败集中在 7 档 ⇒ 候选点亮度 > 7，属正常（原版 uniform(0..7) 也会常常不过）；集中在 0 档 ⇒ $eff.light 被情形规则压到了 0。');
  }
  L.push('');
  L.push('## v4 · 环境快照（[nats.env]）');
  L.push('');
  L.push(envMarks.length ? envMarks.map((e) => '- `' + e + '`').join(String.fromCharCode(10)) : '> 没有 [nats.env] 行（跑 /function doom.nats:debug/env）');
  L.push('');
}
L.push('## P2 · 运行状态 / 数值（自动）');
L.push('');
L.push(dumps.length ? dumps.map((d) => `- \`${d}\``).join('\n') : '> 没有 `[dump]` 行（未跑 `nats.debug:state` / `count`？）');
L.push('');
if (summaries.length) {
  L.push('汇总行：');
  L.push('');
  L.push('```');
  L.push(...uniq(summaries));
  L.push('```');
  L.push('');
}
L.push('## P1 · NBT 语义抽查（**需人工填写**）');
L.push('');
L.push('跑 `/function nats.debug:sample` 后，逐条观察并在此打勾（清单见 `docs/06-进游戏实测清单.md`）：');
L.push('');
L.push('| 项 | 观察点 | 结果 |');
L.push('|---|---|---|');
L.push('| ① | 僵尸身上是**永久力量 I** | ⬜ 符合 / ⬜ 不符 |');
L.push('| ② | 骷髅**手持力量 I 的弓**；`drop_chances.mainhand` 生效 | ⬜ 符合 / ⬜ 不符 |');
L.push('| ③ | 僵尸**戴着自定义皮肤头颅**；`attributes` 有 base 值 | ⬜ 符合 / ⬜ 不符 |');
L.push('');
L.push('## 原始标记行（本轮，最多 60 条）');
L.push('');
L.push('```');
L.push(...relevant.slice(0, 60).map((m) => `${m.idx + 1}: ${m.t}`));
L.push('```');
L.push('');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, L.join('\n'));

console.log(`存档：${save}`);
console.log(`日志：${raw.length} 行（本轮起点：第 ${start + 1} 行）`);
console.log(`断言：${pass} 通过 / ${fail} 失败；可疑错误行：${relErrors.length}；dump：${dumps.length}`);
console.log(`报告：${outPath}`);
if (!checks.length && !dumps.length) {
  console.log('提示：本轮还没抓到任何标记 —— 先按 docs/07 进游戏跑 P0（/function nats.debug:p0）');
}
process.exit(fail > 0 || relErrors.length > 0 ? 1 : 0);
