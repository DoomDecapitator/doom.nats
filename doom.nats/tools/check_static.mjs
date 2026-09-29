// tools/check_static.mjs —— 一条命令跑完"不需要服务器"的全部静态检查，并输出 VS Code 能解析的诊断行。
//
//   node tools/check_static.mjs [--vscode] [--spyglass]
//
// 覆盖：① 9 个生成器 --check（产物与生成器是否漂移）② lint_ctm（L1–L12）
//       ③ check_closure（函数/storage/计分板引用闭合）④（可选）lint_spyglass（把用户装的 Spyglass 当 CLI 跑）
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

const GENS = ['gen_ctm', 'gen_ctm_pos', 'gen_ctm_check', 'gen_ctm_mobs', 'gen_ctm_spawn', 'gen_ctm_despawn', 'gen_ctm_effects', 'gen_ctm_debug', 'gen_ctm_group'];
const diags = [];
const run = (cmd, args, cwd = ROOT) => {
  try { return { ok: true, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') + (e.message || '') }; }
};

// ① 生成器漂移
for (const g of GENS) {
  const r = run(process.execPath, [path.join(TOOL, g + '.mjs'), '--check']);
  if (!r.ok) {
    const miss = r.out.split(/\r?\n/).filter((l) => l.trim().startsWith('- ')).map((l) => l.trim().slice(2));
    if (miss.length) for (const m of miss) diags.push({ file: rel(path.join(WS, 'v4', 'doom.nats', m)), line: 1, col: 1, sev: 'error', msg: g + '：产物与生成器不一致（改生成器后重跑，勿手改产物）' });
    else diags.push({ file: rel(path.join(TOOL, g + '.mjs')), line: 1, col: 1, sev: 'error', msg: g + ' --check 失败：' + r.out.split(/\r?\n/).filter(Boolean).slice(-1)[0] });
  }
}

// ② lint ③ closure（解析它们的人类可读输出 → gcc 行）
for (const [tool, tag] of [['lint_ctm.mjs', 'lint'], ['check_closure.mjs', 'closure']]) {
  const r = run(process.execPath, [path.join(TOOL, tool)]);
  for (const line of r.out.split(/\r?\n/)) {
    const m = /^[❌⚠️\s]*\[(ERROR|WARN )\]\s+([^:]+):\s*(.*)$/.exec(line.trim());
    if (m) diags.push({ file: m[2].trim(), line: 1, col: 1, sev: m[1].trim() === 'ERROR' ? 'error' : 'warning', msg: '[' + tag + '] ' + m[3].trim() });
    else if (tag === 'closure' && /^[❌]/.test(line.trim())) diags.push({ file: 'v4/doom.nats', line: 1, col: 1, sev: 'error', msg: '[closure] ' + line.trim() });
  }
  if (!r.ok && !diags.some((d) => d.msg.startsWith('[' + tag + ']'))) diags.push({ file: rel(path.join(TOOL, tool)), line: 1, col: 1, sev: 'error', msg: tag + ' 退出码非 0：' + r.out.split(/\r?\n/).filter(Boolean).slice(-1)[0] });
}

// ④ Spyglass（可选）
if (WITH_SPY) {
  const r = run(process.execPath, [path.join(TOOL, 'lint_spyglass.mjs'), '--vscode']);
  for (const line of r.out.split(/\r?\n/)) {
    const m = /^([^:]+):(\d+):(\d+): (error|warning|info): (.*)$/.exec(line.trim());
    if (m) diags.push({ file: m[1], line: Number(m[2]), col: Number(m[3]), sev: m[4], msg: m[5] });
  }
}

const errs = diags.filter((d) => d.sev === 'error');
if (VSCODE) for (const d of diags) console.log(d.file + ':' + d.line + ':' + d.col + ': ' + d.sev + ': ' + d.msg);
else {
  console.log('=== doom.nats 静态检查（生成器漂移 / lint / 闭包' + (WITH_SPY ? ' / Spyglass' : '') + '）===');
  for (const d of diags) console.log((d.sev === 'error' ? '❌ ' : '⚠️  ') + d.file + ':' + d.line + ' ' + d.msg);
  if (!diags.length) console.log('✅ 全部通过（9 个生成器无漂移 · lint 0 error · 闭包闭合）');
}
console.log((VSCODE ? '' : '结论: ') + errs.length + ' error, ' + (diags.length - errs.length) + ' warning');
process.exit(errs.length ? 1 : 0);
