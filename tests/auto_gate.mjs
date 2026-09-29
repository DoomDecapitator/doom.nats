// _work/auto_gate.mjs —— 自动跑：作者规则层的一键自检循环（默认产物 + author 变体，A/B 两遍）
//
//   node _work/auto_gate.mjs            # 全量（默认 → author → 默认）
//   node _work/auto_gate.mjs --quick    # 只跑默认产物 + 静态门
//
// 它只碰隔离实例 fid（RCON 25581），**绝不碰用户主服 25565**。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DN = path.join(ROOT, 'doom.nats');
const PUB = path.join(ROOT, 'v4', 'doom.nats');
const FID = path.join(ROOT, '_work', 'mcserver-fid');
const RULES = path.join(DN, 'rules', 'examples', 'full');
const QUICK = process.argv.includes('--quick');
const steps = [];
const run = (label, cmd, args, opts = {}) => {
  const t0 = Date.now();
  try {
    const out = execFileSync(cmd, args, { cwd: opts.cwd || ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...(opts.env || {}) } });
    steps.push({ label, ok: true, ms: Date.now() - t0, tail: out.trim().split('\n').slice(-1)[0] });
  } catch (e) {
    steps.push({ label, ok: false, ms: Date.now() - t0, tail: String(e.stdout || '').trim().split('\n').slice(-2).join(' | ') || e.message });
  }
};
const GENS = ['gen_ctm', 'gen_ctm_pos', 'gen_ctm_check', 'gen_ctm_mobs', 'gen_ctm_spawn', 'gen_ctm_despawn', 'gen_ctm_effects', 'gen_ctm_debug', 'gen_ctm_group', 'gen_ctm_author'];
const generate = (env) => { for (const g of GENS) run('生成 ' + g + (env.DOOM_RULES ? ' [author]' : ''), process.execPath, ['tools/' + g + '.mjs'], { env, cwd: DN }); };
const install = (src = PUB) => {
  fs.rmSync(path.join(FID, 'world', 'datapacks', 'doom.nats'), { recursive: true, force: true });
  fs.cpSync(src, path.join(FID, 'world', 'datapacks', 'doom.nats'), { recursive: true });
};
// v4.24：实验性变体（DOOM_EXP=1 ⇒ v4x/doom.nats）
const PUBX = path.join(ROOT, 'v4x', 'doom.nats');
const verify = (expect) => run('真机验收 ' + expect, process.execPath, ['_work/verify_author_rules.mjs', '--expect', expect],
  { env: { RCON_PORT: '25581', MC_LOG: path.join(FID, 'logs', 'latest.log') } });
// v4.24：运行时刻作者层（改 storage 即刻生效）的确定性探针
const verifyRuntime = (variant) => run('运行时刻层验收 ' + variant, process.execPath,
  ['_work/verify_author_runtime.mjs', '--variant', variant],
  { env: { RCON_PORT: '25581', MC_LOG: path.join(FID, 'logs', 'latest.log') } });

console.log('=== 自动自检：作者规则层（' + new Date().toLocaleString() + '）===');
// ① 默认产物：必须逐字节一致 + 静态门全绿
generate({});
run('静态门（默认产物）', process.execPath, ['tools/check_static.mjs'], { cwd: DN });
install();
verify('default');
if (!QUICK) {
  // ② author 变体
  generate({ DOOM_RULES: RULES });
  run('lint（author 变体）', process.execPath, ['tools/lint_ctm.mjs'], { cwd: DN });
  install();
  verify('author');
  // ③ 还原默认产物（必须回到逐字节一致）
  generate({});
  run('静态门（还原文）', process.execPath, ['tools/check_static.mjs'], { cwd: DN });
  install();
  // ④ 运行时刻层的真机验收：默认变体 + 实验性变体（后者走 v4x/doom.nats）
  verifyRuntime('std');
  if (fs.existsSync(PUBX)) {
    install(PUBX);
    verifyRuntime('exp');
    install();
  } else {
    steps.push({ label: '运行时刻层验收 exp', ok: false, ms: 0, tail: '找不到 ' + PUBX + '（先跑 node tools/check_static.mjs 生成实验性变体）' });
  }
}
const bad = steps.filter((s) => !s.ok);
console.log('\n步骤：' + steps.length + ' · 失败 ' + bad.length);
for (const s of steps) console.log((s.ok ? '✅ ' : '❌ ') + s.label + '  (' + (s.ms / 1000).toFixed(1) + 's)  ' + s.tail);
console.log(bad.length ? '\n结论：' + bad.length + ' 步失败' : '\n结论：全绿（默认产物逐字节一致 · A/B 探针全 PASS）');
process.exit(bad.length ? 1 : 0);
