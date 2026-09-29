// tools/regress.mjs —— 一键回归：静态 → 离线 → 真机一轮 → 曲线 → 汇总成一份带图报告
//
//   node tools/regress.mjs [--reuse] [--minutes 1] [--curve 1.5] [--stress] [--quick]
//
// 设计取向：
//   · **一步失败不中断** —— 全部跑完，把每步结论汇总，最后给 PASS/FAIL 与退出码。
//   · 真机那步默认走 mcauto 的 `--reuse`（不重启服务器、不打断在场玩家）。
//   · 报告落到 doom.nats/reports/回归-<时间戳>.md，曲线图与它的路径一起记进去。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOL = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL, '..');
const WS = path.resolve(ROOT, '..');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const REUSE = argv.includes('--reuse');
const MINUTES = Number(arg('--minutes', '1'));
const CURVE = Number(arg('--curve', '1.5'));
const STRESS = argv.includes('--stress');
const QUICK = argv.includes('--quick');

const LF = String.fromCharCode(10);
const results = [];
const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const step = (name, fn, { tail = 4, expect = null } = {}) => {
  const t0 = Date.now();
  let out = '', err = null;
  try { out = fn(); } catch (e) { err = e; out = String(e.stdout || '') + LF + String(e.message || ''); }
  const lines = out.split(/\r?\n/).filter((l) => l.trim());
  const keep = lines.slice(-tail);
  const ok = err === null && (expect ? expect(lines) : true);
  results.push({ name, ok, ms: Date.now() - t0, keep, err: err ? String(err.message).slice(0, 200) : null });
  console.log((ok ? '✅ ' : '❌ ') + name + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  for (const l of keep) console.log('     ' + l.slice(0, 150));
  return out;
};

const node = (script, args = []) => execFileSync(process.execPath, [path.join(TOOL, script), ...args], { encoding: 'utf8', cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });

console.log('=== 一键回归 ' + stamp() + ' ===');

// ① 静态
const GENS = ['gen_ctm', 'gen_ctm_pos', 'gen_ctm_check', 'gen_ctm_mobs', 'gen_ctm_spawn', 'gen_ctm_despawn', 'gen_ctm_effects', 'gen_ctm_debug', 'gen_ctm_group', 'gen_ctm_author'];

// ⓪ Q7：可选「地图自带 worldgen 覆盖」模式（--worldgen <目录，含 data/> 可重复）
//   一条命令验证：地图覆盖了群系（整体替换注册表条目）之后，整套静态/离线/真机/断言是否仍全绿。
//   覆盖态下会**重生成** v4（roster 变了，生成器 `--check` 才有的比），跑完在 ⑤ 之前自动 `--reset` 还原，
//   并按 biomes.json 的 sha1 回读校验，保证 v4/doom.nats 绝不会被留在覆盖状态。
const WG = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === '--worldgen' && argv[i + 1]) WG.push(argv[i + 1]);
const BIOMES = path.join(WS, '_work', 'generated', 'biomes.json');
const shaFile = (p) => (fs.existsSync(p) ? crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 12) : null);
let wgBase = null;
if (WG.length) {
  wgBase = shaFile(BIOMES);
  step('Q7·合并地图 worldgen 覆盖（' + WG.length + ' 份）', () => {
    const a = node('apply_worldgen.mjs', WG.flatMap((d) => ['--worldgen', d]));
    node('export_rosters.mjs');
    const g = GENS.map((x) => node(x + '.mjs').trim()).join(LF);
    return a + LF + g + LF + '[q7] biomes.json ' + wgBase + ' → ' + shaFile(BIOMES);
  }, { tail: 10, expect: (l) => l.some((x) => /已合并/.test(x)) && l.some((x) => /\[q7\] biomes\.json/.test(x)) });
}

step('静态·生成器无漂移（' + GENS.length + ' 个）', () => GENS.map((g) => node(g + '.mjs', ['--check']).trim()).join(LF), { tail: 12, expect: (l) => l.filter((x) => x.includes('一致')).length === GENS.length });
step('静态·lint', () => node('lint_ctm.mjs'), { expect: (l) => l.some((x) => /结论: 0 error/.test(x)) });
step('静态·语义闭包', () => node('check_closure.mjs'), { expect: (l) => l.some((x) => /0 处待确认/.test(x)) });

// ② 对照变体与离线模拟
if (!QUICK) {
  for (const v of ['ported/suso.nats', 'optimized/suso.nats', 'v3/doom.nats']) {
    step('对照·verify ' + v, () => node('verify.mjs', ['../' + v]), { tail: 1, expect: (l) => l.some((x) => /0 blocking, 0 warning/.test(x)) });
  }
  step('离线·sim v1-v3 三方对照', () => node('sim.mjs', ['1500']), { tail: 3, expect: (l) => l.some((x) => /解释器错误总数: 0/.test(x)) });
}
step('离线·sim_v4（情形/容量/归因链）', () => node('sim_v4.mjs', ['900']), { tail: 2, expect: (l) => l.some((x) => /0 FAIL/.test(x)) });

// ③ 真机一轮（默认 reuse：不重启、不踢人）
step('真机·mcauto' + (REUSE ? ' --reuse' : ''), () => node('mcauto.mjs', [
  ...(REUSE ? ['--reuse'] : []), '--minutes', String(MINUTES), '--curve', String(CURVE),
]), { tail: 10, expect: (l) => l.some((x) => /加载期 0 错误|✅ 加载期/.test(x)) });

// ③b 之前先保证场上有玩家：verify_* 里几条用例需要真人在场（@a / 距离选择器），
//   而用户可能没开客户端、mcauto 的机器人也已退出 ⇒ 这里自起一个，跑完关掉。
let botChild = null;
if (REUSE) {
  // v4.17：多实例隔离 —— MC_SRV 指定服务器目录（默认 _work/mcserver），MC_PORT 指定 server-port（默认 25565）
  const srvDir = process.env.MC_SRV ? path.resolve(process.env.MC_SRV) : path.join(WS, '_work', 'mcserver');
  const srvPort = process.env.MC_PORT || '25565';
  botChild = spawn(process.execPath, [path.join(srvDir, 'bot.mjs'), '--port', srvPort, '--minutes', String(MINUTES + 12)], { cwd: srvDir, stdio: 'ignore' });
  console.log('  （已自起机器人 DoomBot 供需要玩家的用例使用：' + srvDir + ' :' + srvPort + '）');
  await new Promise((r) => setTimeout(r, 8000));
}

// ③b 逐实体规则 / 持久化 / 动物 / 维度（都依赖常驻服务器）
if (REUSE) {
  for (const [name, script] of [
    ['逐实体规则与逐实体光照', 'verify_rules.mjs'],
    ['PersistenceRequired 语义', 'verify_persist.mjs'],
    ['被动生物端到端', 'verify_animals.mjs'],
    ['维度参数（主世界/下界/末地）', 'verify_dims.mjs'],
    ['AABB 近似 + 下界要塞结构优先', 'verify_struct_aabb.mjs'],
    ['下界维度端到端刷怪', 'verify_nether.mjs'],
    ['组数据层（finalizeSpawn / SpawnGroupData）', 'verify_group.mjs'],
    ["逐候选点群系探测（v4.16）", "verify_biome_at.mjs"],
    ["Brain 记忆可写性（写后回读）", "verify_brain_nbt.mjs"],
    ["世界出生点 24 格排除（v4.17 / P1-5）", "verify_spawn24.mjs"],
  ]) {
    step('真机·' + name, () => execFileSync(process.execPath, [path.join(WS, '_work', script)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }), { tail: 3, expect: (l) => l.some((x) => /0 FAIL/.test(x)) });
  }
}

if (botChild) { try { botChild.kill(); } catch {} console.log('  （已关闭机器人）'); }

// ③c 生存直用开关（复用上一轮的常驻服务器：改 gamerule → reload → 看是否自动接管 → 退场 → manual → auto）
if (REUSE) step('真机·生存直用开关 mode/*', () => execFileSync(process.execPath, [path.join(WS, '_work', 'verify_mode.mjs')], { encoding: 'utf8' }), { tail: 4, expect: (l) => l.some((x) => /0 FAIL/.test(x)) });

// ④ 可选压力测试
if (STRESS) step('真机·压力测试（batch 阶梯）', () => execFileSync(process.execPath, [path.join(WS, '_work', 'stress.mjs'), '--batches', '6,40,160', '--settle', '10', '--sample', '20'], { encoding: 'utf8' }), { tail: 5 });

// ④b Q7：覆盖模式收尾 —— 还原原版 roster 并回读校验（必须早于 ⑤ 汇总，失败会拉红整轮）
if (WG.length) {
  step('Q7·还原为原版 roster（--reset）', () => {
    const a = node('apply_worldgen.mjs', ['--reset']);
    node('export_rosters.mjs');
    const g = GENS.map((x) => node(x + '.mjs').trim()).join(LF);
    return a + LF + g + LF + '还原校验: ' + shaFile(BIOMES) + ' vs 基线 ' + wgBase
      + (shaFile(BIOMES) === wgBase ? ' ✅ 一致' : ' ❌ 不一致（v4 可能停在覆盖态！）');
  }, { tail: 3, expect: (l) => l.some((x) => /还原校验: .* ✅ 一致/.test(x)) });
}

// ⑤ 汇总
const pass = results.filter((r) => r.ok).length, fail = results.length - pass;
const curves = fs.existsSync(path.join(WS, '_work'))
  ? fs.readdirSync(path.join(WS, '_work')).filter((f) => f.endsWith('.svg')).sort().slice(-3)
  : [];
const REP = path.join(ROOT, 'reports', '回归-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '') + '.md');
const L = [];
L.push('# 一键回归 · ' + stamp());
L.push('');
L.push('- 结果：**' + pass + ' PASS / ' + fail + ' FAIL**（共 ' + results.length + ' 步）');
L.push('- 真机模式：' + (REUSE ? '`--reuse`（复用服务器，不打断在场玩家）' : '清世界重起'));
if (curves.length) L.push('- 走势图：' + curves.map((c) => '`_work/' + c + '`').join(' · '));
L.push('');
L.push('| 步 | 结果 | 耗时(s) | 关键输出 |');
L.push('|---|---|---|---|');
for (const r of results) {
  L.push('| ' + r.name + ' | ' + (r.ok ? '✅' : '❌') + ' | ' + (r.ms / 1000).toFixed(1) + ' | `'
    + r.keep.join(' / ').replace(/\|/g, '\\|').slice(0, 220) + '` |');
}
L.push('');
L.push('## 原始尾部输出');
L.push('');
for (const r of results) {
  L.push('### ' + (r.ok ? '✅ ' : '❌ ') + r.name);
  L.push('```');
  for (const l of r.keep) L.push(l);
  L.push('```');
}
fs.mkdirSync(path.dirname(REP), { recursive: true });
fs.writeFileSync(REP, L.join(LF) + LF);
console.log('');
console.log('汇总: ' + pass + ' PASS / ' + fail + ' FAIL');
console.log('报告: ' + REP);
process.exit(fail ? 1 : 0);
