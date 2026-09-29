// tools/check_static.mjs —— 一条命令跑完"不需要服务器"的全部静态检查，并输出 VS Code 能解析的诊断行。
//
//   node tools/check_static.mjs [--vscode] [--spyglass]
//
// 覆盖：① **两个变体**的生成器 --check（产物与生成器是否漂移）
//        ② lint_ctm（L1–L14，默认产物 + 实验性产物各一遍）③ check_closure（函数/storage/计分板引用闭合）
//        ④（可选）lint_spyglass（把用户装的 Spyglass 当 CLI 跑）
// 变体（v4.24 起）：
//   · v4/doom.nats  —— 默认变体：原版复刻 + 本包稳定扩展（pack.mcmeta 不带 features）
//   · v4x/doom.nats —— 实验性变体：多一层 `doom.nats:exp/*`（near/on_spawn/preset），
//                      pack.mcmeta 带 `features` 引擎门 ⇒ 世界没开该实验性玩法时整包被拒。
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
const rel = (p) => path.relative(WS, p).split(path.sep).join('/');

const GENS = ['gen_ctm', 'gen_ctm_pos', 'gen_ctm_check', 'gen_ctm_mobs', 'gen_ctm_spawn', 'gen_ctm_despawn', 'gen_ctm_effects', 'gen_ctm_debug', 'gen_ctm_group', 'gen_ctm_author'];
// 实验性变体比默认变体多一个生成器（实验性层的函数与预设）
// v4.25：实验性变体多两个生成器（运行时刻作者层 + 实验性 AJ rig 桥接）。
//   gen_ctm_exp_aj 在 rules/rigs.json 为空时是**no-op**（还会清掉陈旧 exp/aj/**）⇒ 默认环境跑它没有任何副作用。
const GENS_EXP = [...GENS, 'gen_ctm_exp', 'gen_ctm_exp_aj'];
const diags = [];
const run = (cmd, args, cwd = ROOT, env = {}) => {
  try { return { ok: true, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } }) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') + (e.message || '') }; }
};
const lines = (s) => s.split(/\r?\n/);

// ① 生成器漂移（两个变体都要过）
//   实验性产物先**无条件生成一次**（保证 v4x 存在），再逐个 --check。
const driftOf = (g, outDir, env, genOnly) => {
  const args = [path.join(TOOL, g + '.mjs')].concat(genOnly ? [] : ['--check']);
  const r = run(process.execPath, args, ROOT, env);
  if (r.ok) return;
  const miss = lines(r.out).filter((l) => l.trim().startsWith('- ')).map((l) => l.trim().slice(2));
  if (miss.length) {
    for (const m of miss) diags.push({ file: rel(path.join(WS, outDir, m)), line: 1, col: 1, sev: 'error', msg: g + '（' + outDir + '）：产物与生成器不一致（改生成器后重跑，勿手改产物）' });
  } else {
    diags.push({ file: rel(path.join(TOOL, g + '.mjs')), line: 1, col: 1, sev: 'error', msg: g + '（' + outDir + '）--check 失败：' + lines(r.out).filter(Boolean).slice(-1)[0] });
  }
};
for (const g of GENS) driftOf(g, 'v4/doom.nats', {}, false);
for (const g of GENS_EXP) driftOf(g, 'v4x/doom.nats', { DOOM_EXP: '1' }, true);    // 先建（不带 --check）
for (const g of GENS_EXP) driftOf(g, 'v4x/doom.nats', { DOOM_EXP: '1' }, false);   // 再比对

// ② lint ③ closure（解析它们的人类可读输出 → gcc 行）
//   实验性产物也要过 lint（v4.23 的教训：变体产物同样必须过静态门）
{
  const r = run(process.execPath, [path.join(TOOL, 'lint_ctm.mjs'), path.join(WS, 'v4x', 'doom.nats')]);
  for (const l of lines(r.out).filter((x) => /\[ERROR\]/.test(x))) {
    diags.push({ file: 'v4x/doom.nats', line: 1, col: 1, sev: 'error', msg: '[lint·exp] ' + l.trim() });
  }
  if (!/结论: 0 error/.test(r.out)) {
    diags.push({ file: rel(path.join(TOOL, 'lint_ctm.mjs')), line: 1, col: 1, sev: 'error', msg: '实验性产物 lint 非 0 error：' + lines(r.out).filter(Boolean).slice(-1)[0] });
  }
}
for (const [tool, tag] of [['lint_ctm.mjs', 'lint'], ['check_closure.mjs', 'closure']]) {
  const r = run(process.execPath, [path.join(TOOL, tool)]);
  for (const line of lines(r.out)) {
    const m = /^[❌⚠️\s]*\[(ERROR|WARN )\]\s+([^:]+):\s*(.*)$/.exec(line.trim());
    if (m) diags.push({ file: m[2].trim(), line: 1, col: 1, sev: m[1].trim() === 'ERROR' ? 'error' : 'warning', msg: '[' + tag + '] ' + m[3].trim() });
    else if (tag === 'closure' && /^[❌]/.test(line.trim())) diags.push({ file: 'v4/doom.nats', line: 1, col: 1, sev: 'error', msg: '[closure] ' + line.trim() });
  }
  if (!r.ok && !diags.some((d) => d.msg.startsWith('[' + tag + ']'))) diags.push({ file: rel(path.join(TOOL, tool)), line: 1, col: 1, sev: 'error', msg: tag + ' 退出码非 0：' + lines(r.out).filter(Boolean).slice(-1)[0] });
}

// ④ Spyglass（可选）
if (WITH_SPY) {
  const r = run(process.execPath, [path.join(TOOL, 'lint_spyglass.mjs'), '--vscode']);
  for (const line of lines(r.out)) {
    const m = /^([^:]+):(\d+):(\d+): (error|warning|info): (.*)$/.exec(line.trim());
    if (m) diags.push({ file: m[1], line: Number(m[2]), col: Number(m[3]), sev: m[4], msg: m[5] });
  }
}

const errs = diags.filter((d) => d.sev === 'error');
if (VSCODE) for (const d of diags) console.log(d.file + ':' + d.line + ':' + d.col + ': ' + d.sev + ': ' + d.msg);
else {
  console.log('=== doom.nats 静态检查（生成器漂移 / lint / 闭包' + (WITH_SPY ? ' / Spyglass' : '') + '）===');
  for (const d of diags) console.log((d.sev === 'error' ? '❌ ' : '⚠️  ') + d.file + ':' + d.line + ' ' + d.msg);
  if (!diags.length) console.log('✅ 全部通过（' + GENS.length + ' 个生成器 × 2 个变体无漂移 · lint 0 error · 闭包闭合）');
}
console.log((VSCODE ? '' : '结论: ') + errs.length + ' error, ' + (diags.length - errs.length) + ' warning');
process.exit(errs.length ? 1 : 0);
