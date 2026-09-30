// tools/check_static.mjs —— 一条命令跑完"不需要服务器"的全部静态检查，并输出 VS Code 能解析的诊断行。
//
//   node tools/check_static.mjs [--vscode] [--spyglass] [--std|--exp]
//
// 覆盖：① **两个变体**的生成器 --check（产物与生成器是否漂移；--check = 逐字节比对，手改产物必被抓）
//        ② lint_pack（L1–L14，默认产物 + 实验性产物各一遍）③ check_closure（函数/storage/计分板引用闭合）
//        ④（可选）lint_spyglass（把用户装的 Spyglass 当 CLI 跑）
// 变体（v4.24 起两个变体；v4.26 起同放在仓库根的 pack/ 下）：
//   · pack/doom.nats              —— 默认变体：原版复刻 + 本包稳定扩展（pack.mcmeta 不带 features）
//   · pack/doom.nats-experimental —— 实验性变体：多一层 `doom.nats:exp/*`（near/on_spawn/preset），
//                                    pack.mcmeta 带 `features` 引擎门 ⇒ 世界没开该实验性玩法时整包被拒。
// 变体开关：默认两个都查；`--std` 只查默认变体；`--exp` 只查实验性变体（两侧都要求 0 error）。
// 输出：--vscode ⇒ 每条问题一行 `相对路径:行:列: error|warning: 消息`（配 tasks.json 的 $gcc problemMatcher，
//       会直接出现在编辑器"问题"面板里）；否则人类可读。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 必须走 fileURLToPath：`new URL(...).pathname` 在 Linux 下是 `/home/runner/work/…`，
// 掐掉前导斜杠会变成相对路径 ⇒ CI（ubuntu）解析到错误的 TOOL/ROOT，静态门必挂。
const TOOL = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL, '..');
const WS = path.resolve(ROOT, '..');
const argv = process.argv.slice(2);
const VSCODE = argv.includes('--vscode');
const WITH_SPY = argv.includes('--spyglass');
// 变体：产物目录（相对仓库根）/ 环境变量 / 显示名
const VARIANTS = {
  std: { dir: 'pack/doom.nats', env: {}, label: '默认' },
  exp: { dir: 'pack/doom.nats-experimental', env: { DOOM_EXP: '1' }, label: '实验性' },
};
const WANT = argv.includes('--exp') ? ['exp'] : argv.includes('--std') ? ['std'] : ['std', 'exp'];
const rel = (p) => path.relative(WS, p).split(path.sep).join('/');

const GENS = ['gen_pack', 'gen_pos', 'gen_check', 'gen_mobs', 'gen_spawn', 'gen_despawn', 'gen_effects', 'gen_debug', 'gen_group', 'gen_author'];
// 实验性变体比默认变体多两个生成器（实验性层的函数与预设 + 实验性 AJ rig 桥接）。
//   gen_exp_aj 在 rules/rigs.json 为空时是**no-op**（还会清掉陈旧 exp/aj/**）⇒ 默认环境跑它没有任何副作用。
const GENS_EXP = [...GENS, 'gen_exp', 'gen_exp_aj'];
const gensOf = (v) => (v === 'exp' ? GENS_EXP : GENS);
const diags = [];
const run = (cmd, args, cwd = ROOT, env = {}) => {
  try { return { ok: true, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } }) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') + (e.message || '') }; }
};
const lines = (s) => s.split(/\r?\n/);

// ① 生成器漂移（每个被选中的变体都要过）
//   实验性产物先**无条件生成一次**（保证它存在），再逐个 --check。
const driftOf = (v, g, genOnly) => {
  const { dir, env } = VARIANTS[v];
  const args = [path.join(TOOL, g + '.mjs')].concat(genOnly ? [] : ['--check']);
  const r = run(process.execPath, args, ROOT, env);
  if (r.ok) return;
  const miss = lines(r.out).filter((l) => l.trim().startsWith('- ')).map((l) => l.trim().slice(2));
  if (miss.length) {
    for (const m of miss) diags.push({ v, file: rel(path.join(WS, dir, m)), line: 1, col: 1, sev: 'error', msg: g + '（' + dir + '）：产物与生成器不一致（改生成器后重跑，勿手改产物）' });
  } else {
    diags.push({ v, file: rel(path.join(TOOL, g + '.mjs')), line: 1, col: 1, sev: 'error', msg: g + '（' + dir + '）--check 失败：' + lines(r.out).filter(Boolean).slice(-1)[0] });
  }
};
for (const v of WANT) {
  if (v === 'exp') for (const g of GENS_EXP) driftOf(v, g, true); // 先建（不带 --check）
  for (const g of gensOf(v)) driftOf(v, g, false);                // 再逐字节比对
}

// ② lint（每个被选中的变体各一遍）③ closure（与变体无关，跑一遍）
const LINT_RE = /^[❌⚠️\s]*\[(ERROR|WARN )\]\s+([^:]+):\s*(.*)$/;
for (const v of WANT) {
  const packDir = path.join(WS, VARIANTS[v].dir);
  const r = run(process.execPath, [path.join(TOOL, 'lint_pack.mjs'), packDir]);
  const tag = 'lint·' + v;
  let seen = 0;
  for (const line of lines(r.out)) {
    const m = LINT_RE.exec(line.trim());
    if (!m) continue;
    seen++;
    diags.push({ v, file: VARIANTS[v].dir + '/' + m[2].trim(), line: 1, col: 1, sev: m[1].trim() === 'ERROR' ? 'error' : 'warning', msg: '[' + tag + '] ' + m[3].trim() });
  }
  if (!/结论: 0 error/.test(r.out) && !seen) {
    diags.push({ v, file: rel(path.join(TOOL, 'lint_pack.mjs')), line: 1, col: 1, sev: 'error', msg: tag + ' 退出码非 0：' + lines(r.out).filter(Boolean).slice(-1)[0] });
  }
}
for (const [tool, tag] of [['check_closure.mjs', 'closure']]) {
  const r = run(process.execPath, [path.join(TOOL, tool)]);
  for (const line of lines(r.out)) {
    const m = /^[❌⚠️\s]*\[(ERROR|WARN )\]\s+([^:]+):\s*(.*)$/.exec(line.trim());
    if (m) diags.push({ v: null, file: m[2].trim(), line: 1, col: 1, sev: m[1].trim() === 'ERROR' ? 'error' : 'warning', msg: '[' + tag + '] ' + m[3].trim() });
    else if (/^[❌]/.test(line.trim())) diags.push({ v: null, file: 'pack/doom.nats', line: 1, col: 1, sev: 'error', msg: '[closure] ' + line.trim() });
  }
  if (!r.ok && !diags.some((d) => d.msg.startsWith('[' + tag + ']'))) diags.push({ v: null, file: rel(path.join(TOOL, tool)), line: 1, col: 1, sev: 'error', msg: tag + ' 退出码非 0：' + lines(r.out).filter(Boolean).slice(-1)[0] });
}

// ④ Spyglass（可选）
if (WITH_SPY) {
  const r = run(process.execPath, [path.join(TOOL, 'lint_spyglass.mjs'), '--vscode']);
  for (const line of lines(r.out)) {
    const m = /^([^:]+):(\d+):(\d+): (error|warning|info): (.*)$/.exec(line.trim());
    if (m) diags.push({ v: null, file: m[1], line: Number(m[2]), col: Number(m[3]), sev: m[4], msg: m[5] });
  }
}

const errs = diags.filter((d) => d.sev === 'error');
const warns = diags.filter((d) => d.sev !== 'error');
// 逐变体结论行：让"每个变体各自多少 error/warning"一眼可见（变体特有的诊断按 v 归类，公共的按路径前缀归类）
const perVariant = WANT.map((v) => {
  const mine = diags.filter((d) => d.v === v || (!d.v && d.file.startsWith(VARIANTS[v].dir + '/')));
  return VARIANTS[v].label + ' ' + VARIANTS[v].dir + ' ⇒ ' + mine.filter((d) => d.sev === 'error').length + ' error / ' + mine.filter((d) => d.sev !== 'error').length + ' warning';
});
if (VSCODE) for (const d of diags) console.log(d.file + ':' + d.line + ':' + d.col + ': ' + d.sev + ': ' + d.msg);
else {
  console.log('=== doom.nats 静态检查（生成器漂移 / lint / 闭包' + (WITH_SPY ? ' / Spyglass' : '') + '）===');
  for (const d of diags) console.log((d.sev === 'error' ? '❌ ' : '⚠️  ') + d.file + ':' + d.line + ' ' + d.msg);
  if (!diags.length) console.log('✅ 全部通过（' + GENS.length + ' 个生成器 × ' + WANT.length + ' 个变体无漂移 · lint 0 error · 闭包闭合）');
  console.log('变体：' + perVariant.join(' · '));
}
// 结论计数：默认/实验性两个变体里**同一处**告警（同文件同消息）只算一条 —— 它们本来就是同一份内容
const uniqKey = (d) => d.sev + '|' + d.msg.replace(/\[lint·(std|exp)\]/, '[lint]') + '|' + d.file.replace(/^pack\/doom\.nats(-experimental)?\//, '');
const uniqE = new Set(errs.map(uniqKey)).size;
const uniqW = new Set(warns.map(uniqKey)).size;
console.log((VSCODE ? '' : '结论: ') + uniqE + ' error, ' + uniqW + ' warning' + (VSCODE ? '' : '（同一处告警在两个变体里各出现一次 ⇒ 去重后 ' + uniqE + ' error / ' + uniqW + ' warning）'));
process.exit(errs.length ? 1 : 0);
