// tools/mcauto.mjs —— 全自动真机验证：起本地 Fabric 服务器 → 装包 → 假玩家 → 跑情形 → 采报告
//
//   node tools/mcauto.mjs [--minutes 2] [--seed doomnats] [--keep] [--no-start]
//
// 和「让用户手敲命令」相比，这里把整条链都自动化了：
//   ① 干净世界（正常地形 + 固定种子）+ 装 pack/doom.nats 与 doom.log 夹具
//   ② 起服务器（Java 21，detached），等 Done
//   ③ RCON：关原版刷怪 → 夜 → Carpet 假玩家 → 等 N 分钟
//   ④ RCON：/function doom.nats:debug/all → stop
//   ⑤ 把服务器 latest.log 喂给 collect.mjs，并打印 v4 段落
//
// 假玩家 = Carpet 的 /player（真 ServerPlayer）⇒ @a / distance / gamemode 选择器与真人一致。
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { rcon } from './mcrcon.mjs';

const TOOL = path.resolve(import.meta.dirname);
const ROOT = path.resolve(TOOL, '..');            // doom.nats/
const WS = path.resolve(ROOT, '..');              // 工作区
const SRV = process.env.MC_SRV ? path.resolve(process.env.MC_SRV) : path.join(WS, '_work', 'mcserver');
// v4.17：多实例隔离（不设环境变量时行为与过去完全一致）
//   MC_SRV 服务器目录（默认 _work/mcserver）· MC_PORT server-port（默认 25565）· RCON_PORT RCON 端口（mcrcon.mjs 读，默认 25575）
//   例：MC_SRV=.../_work/mcserver-fid MC_PORT=25571 RCON_PORT=25581 node tools/mcauto.mjs --reuse
const MC_PORT = process.env.MC_PORT || '25565';
const MC_RCON_PORT = process.env.RCON_PORT || '25575';
const KILL_PORTS = MC_PORT + ',' + MC_RCON_PORT;
const WORLD = path.join(SRV, 'world');
const LOG = path.join(SRV, 'logs', 'latest.log');
const RUNLOG = path.join(SRV, 'run.log');
// java 可执行：JAVA_BIN 环境变量 > 微软商店版 java runtime（按 %LOCALAPPDATA% 拼，不写死用户名/盘符）> PATH 里的 java
const JAVA_STORE = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe',
      'LocalCache', 'Local', 'runtime', 'java-runtime-delta', 'windows-x64', 'java-runtime-delta', 'bin', 'java.exe')
  : '';
const JAVA = process.env.JAVA_BIN || (JAVA_STORE && fs.existsSync(JAVA_STORE) ? JAVA_STORE : 'java');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const MINUTES = Number(arg('--minutes', '2'));
const SEED = arg('--seed', 'doomnats');
const KEEP = argv.includes('--keep');
const CURVE = Number(arg('--curve', '1.5'));    // 曲线采样分钟数（0=关闭）
const STRESS = argv.includes('--stress');
const REUSE = argv.includes('--reuse');       // 已在跑就复用（不杀不重启，不打断在场玩家）        // 是否顺带跑一次 batch 阶梯压力测试

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log('[' + new Date().toTimeString().slice(0, 8) + '] ' + m);
const readLog = () => { try { return fs.readFileSync(LOG, 'utf8'); } catch { return ''; } };

// ---------- 复用模式探测：RCON 能通就认为服务器在跑 ----------
// --reuse：服务器已在跑就**不杀不重启**（不打断在场玩家），只热载新包；收尾也不停服。
const RUNNING = await (async () => { try { const r = await rcon(['list']); return /There are/.test(String(r[0])); } catch { return false; } })();
const REUSING = REUSE && RUNNING;
if (REUSING) log('检测到服务器在跑 ⇒ 复用（不重启，不影响在场玩家）');

// 第 0 步：先杀干净任何陈旧服务器，否则它会占着 RCON 端口/世界目录（实测会把新服顶掉）
// 按**端口占用者**杀最可靠：早先用命令行匹配的方式引号被吞掉，没杀掉，新服直接 BindException。
const KILL_STALE = "Get-NetTCPConnection -State Listen -LocalPort " + KILL_PORTS + " -ErrorAction SilentlyContinue"
  + " | Select-Object -Unique OwningProcess"
  + " | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }";
if (!REUSING) for (let i = 0; i < 12; i++) {
  try { execFileSync('powershell', ['-NoProfile', '-Command', KILL_STALE], { stdio: 'ignore' }); } catch {}
  await sleep(1500);
  const busy = (() => { try { return execFileSync('powershell', ['-NoProfile', '-Command', '(Get-NetTCPConnection -State Listen -LocalPort ' + KILL_PORTS + ' -ErrorAction SilentlyContinue | Measure-Object).Count'], { encoding: 'utf8' }).trim(); } catch { return '0'; } })();
  if (busy === '0') break;
  if (i === 11) { log('端口仍被占用，放弃'); process.exit(4); }
}
// ---- ① 干净世界 + 装包 ----
if (!KEEP && !REUSING) {
  log('清空世界（正常地形 / seed=' + SEED + '）');
  fs.rmSync(WORLD, { recursive: true, force: true });
}
fs.mkdirSync(path.join(WORLD, 'datapacks'), { recursive: true });
// 直接用生产用的安装器：它同时就位 doom.nats + zz-test-fixtures（general:dimension_abyss 恒假占位，
// 否则 doom.log 的 nats.debug:p0 会在加载期抛异常）+ doom.log。这样测的就是用户拿到的同一份东西。
log('装包（install.mjs --variant std）');
try {
  const out = execFileSync(process.execPath, [path.join(TOOL, 'install.mjs'), '--variant', 'std', '--save', WORLD], { encoding: 'utf8' });
  console.log(out.split('\n').filter((l) => /已安装|夹具|基建/.test(l)).map((l) => '   ' + l.trim()).join('\n'));
} catch (e) {
  log('装包失败: ' + (e.stdout || e.message));
  process.exit(2);
}

// 本轮日志起点：装包完成、触发 reload 之前记下行数（复用模式下日志里还有历史错误，必须显式锚定）
const LOG_LINES0 = (() => { try { return fs.readFileSync(LOG, 'utf8').split(String.fromCharCode(10)).length; } catch { return 0; } })();
// run.log 的行数锚点：加载错误检查必须只看**本轮**（否则历史失败会永久污染，实测踩过）
const RUNLOG_LINES0 = (() => { try { return fs.readFileSync(RUNLOG, 'utf8').split(/\r?\n/).length; } catch { return 0; } })();

// 覆盖 level-type 为正常地形 + 固定种子
const propPath = path.join(SRV, 'server.properties');
let props = fs.readFileSync(propPath, 'utf8');
const setProp = (k, v) => {
  const re = new RegExp('^' + k + '=.*$', 'm');
  props = re.test(props) ? props.replace(re, k + '=' + v) : props + '\n' + k + '=' + v;
};
setProp('level-type', 'minecraft:normal');
setProp('level-seed', SEED);
setProp('level-name', 'world');
setProp('server-port', MC_PORT);
setProp('rcon.port', MC_RCON_PORT);
setProp('rcon.password', 'nats');   // 只写进本工具自起的本地测试服 server.properties（占位默认值，非真实凭据）
setProp('pause-when-empty-seconds', '0');
setProp('enable-rcon', 'true');
fs.writeFileSync(propPath, props);

// ---- ② 起服务器（复用模式下跳过）----
let ready = REUSING;
if (!REUSING) {
  fs.writeFileSync(RUNLOG, '');
  log('启动服务器 …');
  const child = spawn(JAVA, ['-Xms1G', '-Xmx3G', '-jar', 'fabric-server-launch.jar', 'nogui'],
    { cwd: SRV, detached: true, stdio: ['ignore', fs.openSync(RUNLOG, 'a'), fs.openSync(RUNLOG, 'a')] });
  child.unref();

  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    const t = (() => { try { return fs.readFileSync(RUNLOG, 'utf8'); } catch { return ''; } })();
    if (/Done \(/.test(t)) { ready = true; break; }
    // 只有 JVM 级失败才算致命；数据包/模组的加载异常会照常启动，交给后面的日志分析
    if (/FAILED TO START|You need to agree to the EULA|UnsupportedClassVersionError/.test(t)) { log('JVM 级启动失败，见 ' + RUNLOG); break; }
  }
  if (!ready) { log('服务器未就绪（240s）。run.log 末尾：'); console.log(tail(RUNLOG, 20)); process.exit(3); }
  log('服务器就绪');
} else {
  log('复用现有服务器（不重启）');
  // 复用时要热载刚装进世界的新包
  await rcon(['reload']).catch(() => {});
  await sleep(4000);
}

// 加载期断言：函数加载失败会让整条链静默失效（v4.3 踩过一次），必须当场报出来
const runLogTail = (() => { try { return fs.readFileSync(RUNLOG, 'utf8').split(/\r?\n/).slice(RUNLOG_LINES0).join(String.fromCharCode(10)); } catch { return ''; } })();
const loadErrs = (runLogTail.match(/Failed to load function [^ ]+/g) || []);
if (loadErrs.length) { log('❌ 加载错误 ' + loadErrs.length + ' 条:'); for (const e of [...new Set(loadErrs)].slice(0, 10)) console.log('   ' + e); }
else log('✅ 加载期 0 错误');

function tail(p, n) { try { return fs.readFileSync(p, 'utf8').split(/\r?\n/).slice(-n).join('\n'); } catch { return ''; } }
const run = async (cmds, quiet = false) => {
  const out = await rcon(cmds);
  if (!quiet) out.forEach((o, i) => { const s = (o || '').trim(); if (s) console.log('   > ' + cmds[i] + '  ⇒ ' + s.replace(/\n/g, ' | ').slice(0, 160)); });
  return out;
};

// ---- ③ 场景 ----
const player = 'DoomBot';   // mineflayer 机器人名（真客户端）
// 用一个**真客户端**当玩家（mineflayer）。Carpet 假玩家在部分时序下会 spawn 不出来，
// 真客户端在区块票据 / 玩家列表 / @a·distance 选择器上与真人完全一致，最贴近真机。
log('起机器人客户端（mineflayer，真客户端连接）');
const botLog = fs.openSync(path.join(SRV, 'bot.log'), 'a');
const bot = spawn(process.execPath, [path.join(SRV, 'bot.mjs'), '--port', MC_PORT, '--minutes', String(MINUTES + 8)], {
  cwd: SRV, detached: true, stdio: ['ignore', botLog, botLog],
});
bot.unref();
let joined = false;
for (let i = 0; i < 40; i++) {
  await sleep(2000);
  const r = await rcon(['list'], {}).catch(() => ['']);
  if (/There are [1-9]/.test(String(r[0]))) { joined = true; break; }
}
log(joined ? '机器人已进入世界' : '机器人未能进入（继续，但 @a 可能为空）');

log('配置场景：关原版刷怪 / 午夜晚 / 固定高度带');
await run(['gamerule doMobSpawning false', 'time set midnight', 'weather clear', 'gamerule doDaylightCycle false']);
// 超平世界：把取 y 切到固定带 64（= 地表 +1），隔离地形变量，专门验证刷怪链是否通电
await run(['scoreboard players set $band.mode doom.nats 0',

], true);
// 等区块加载稳定（新建玩家的区块票据是逐步铺开的，cap 随之上升）
let lastChunks = -1;
for (let i = 0; i < 40; i++) {
  await sleep(3000);
  const r = await run(['scoreboard players get $snap.chunks doom.nats'], true);
  const m = /has (-?[0-9]+)/.exec(r[0] || '');
  const c = m ? Number(m[1]) : -1;
  if (c === lastChunks && c > 0) { log('区块稳定: ' + c); break; }
  lastChunks = c;
}
const env = await run(['function doom.nats:debug/env', 'scoreboard players get $snap.chunks doom.nats', 'scoreboard players get $cap.monster doom.nats', 'scoreboard players get $py doom.nats', 'data get storage doom.nats:band'], true);
log('环境探针: ' + env.map((s) => (s.match(/\[nats\.env\][^\n]*/) || [String(s).trim()])[0]).filter(Boolean).join(' | '));
// 光照档实测：谓词用的是 getMaxLocalRawBrightness(位置)（含 skyDarken），
// 在真机上逐档试一遍，才知道「reason 3 占多数」是光照模型的问题还是时间点的问题。
const where = await run(['data get entity DoomBot Pos', `execute as ${player} at @s run say PROBE at-bot`, `execute as ${player} at @s unless predicate doom.nats:light/tier_15 run say PROBE tier15=fail`], true);
log('位置探针: ' + where.map(x=>String(x).trim()).filter(x=>x&&x.length>2).join(' | ').slice(0,300));
const probe = await run([
  'scoreboard players get $eff.light doom.nats',
  'time query daytime',
  ...['tier_0', 'tier_3', 'tier_7', 'tier_11', 'tier_15'].map((t) =>
    `execute as ${player} at @s if predicate doom.nats:light/${t} run say PROBE light/${t}=pass`),
  `execute as ${player} at @s unless predicate doom.nats:light/tier_15 run say PROBE light/tier_15=fail`,
], true);
log('光照探针:\n' + probe.map((s) => '   ' + String(s).trim()).filter((s) => s.length > 3).join('\n'));

log('等待 ' + MINUTES + ' 分钟（让刷怪节拍跑起来）…');
await sleep(MINUTES * 60 * 1000);

// —— 曲线采样（走势图 + json/csv/svg/png，另起进程跑 timeseries.mjs）——
let curvePath = null;
if (CURVE > 0) {
  log('曲线采样 ' + CURVE + ' 分钟…');
  try {
    const out = execFileSync(process.execPath, [path.join(WS, '_work', 'timeseries.mjs'),
      '--minutes', String(CURVE), '--every', '2'], { encoding: 'utf8' });
    const m = /产出: (.+)$/m.exec(out);
    const st = /统计: (.+)$/m.exec(out);
    curvePath = m ? m[1] : null;
    log('曲线统计: ' + (st ? st[1] : '?'));
  } catch (e) { log('曲线采样失败: ' + String(e.message).slice(0, 120)); }
}

// —— 压力测试（可选，逐档 batch 测 mspt 与吞吐）——
if (STRESS) {
  log('压力测试（batch 阶梯）…');
  try {
    const out = execFileSync(process.execPath, [path.join(WS, '_work', 'stress.mjs'),
      '--batches', '6,40,160', '--settle', '10', '--sample', '20'], { encoding: 'utf8' });
    for (const line of out.split(/\r?\n/).filter((l) => l.includes('batch=') || l.includes('建议'))) console.log('   ' + line.trim());
  } catch (e) { log('压力测试失败: ' + String(e.message).slice(0, 120)); }
}

// dryrun 落位探针：直接读分数（tellraw 只发给玩家，假玩家的聊天不进服务器日志）
await run(['function doom.nats:debug/dryrun'], true);
const dr = await run([
  'scoreboard players get $dr.at doom.nats', 'scoreboard players get $dr.above doom.nats',
  'scoreboard players get $dr.below doom.nats', 'scoreboard players get $chk.reason doom.nats',
  'scoreboard players get $pos.ok doom.nats', 'scoreboard players get $band.mode doom.nats',
  'scoreboard players get $py doom.nats', 'scoreboard players get $px doom.nats', 'scoreboard players get $pz doom.nats', 'data get storage doom.nats:pos', 'scoreboard players get $band.hit doom.nats', 'scoreboard players get $dbg.reason2 doom.nats', 'scoreboard players get $eff.period doom.nats', 'scoreboard players get $eff.batch doom.nats', 'scoreboard players get $dbg.points doom.nats', 'scoreboard players get $dbg.tries doom.nats', 'scoreboard players get $dbg.points doom.nats', 'scoreboard players get $dbg.tries doom.nats',
], true);
log('dryrun 探针: ' + dr.map((x) => String(x).trim()).join(' | ').slice(0, 400));

// ---- ④ 收口 ----
log('跑 debug/all');
await run(['function doom.nats:debug/all']);
await sleep(3000);
const snap = (() => {
  const t = readLog();
  const lines = t.split(/\r?\n/).filter((l) => /\[nats\.(env|reject|light)\]|\[dryrun\]/.test(l));
  return lines.slice(-8).map((l) => l.slice(l.indexOf('[CHAT] ') + 7)).join('\n');
})();
log('本轮关键行:\n' + snap);

// 关键数字落盘（必须在**停服之前**读，停服后 RCON 直接断）
const keyNums = await run(['scoreboard players get $dbg.points doom.nats', 'scoreboard players get $dbg.tries doom.nats',
  'scoreboard players get $dbg.in128 doom.nats', 'scoreboard players get $dbg.out128 doom.nats',
  'scoreboard players get $eff.period doom.nats', 'scoreboard players get $eff.batch doom.nats'], true);
const kv = {};
for (const s of keyNums) { const mm = /([^ ]+) has (-?[0-9]+)/.exec(String(s).trim()); if (mm) kv[mm[1]] = Number(mm[2]); }
fs.writeFileSync(path.join(SRV, 'last-run.json'), JSON.stringify({ scenario: { MINUTES, seed: SEED }, kv }, null, 2));
// 场上存活（消失层是否在管）
const alive = await run(['scoreboard players get $cnt.monster doom.nats','scoreboard players get $cnt.creature doom.nats','scoreboard players get $cnt.ambient doom.nats'], true);
log('场上计数: ' + alive.map((x) => String(x).trim()).join(' | ').slice(0, 200));
log('关键数字: ' + JSON.stringify(kv));
if (curvePath) log('曲线: ' + curvePath);
if (REUSING) {
  log('复用模式：不停服（在场玩家不受影响）');
} else {
  log('停服');
  await run(['stop'], true).catch(() => {});
  for (let i = 0; i < 30; i++) { await sleep(1000); if (/ThreadedAnvilChunkStorage: All dimensions are saved|Stopping server/.test(tail(RUNLOG, 40))) break; }
  try { execFileSync('taskkill', ['/F', '/FI', 'WINDOWTITLE eq *fabric-server-launch*'], { stdio: 'ignore' }); } catch {}
}

// ---- ⑤ 采集 ----
log('采集报告');
try {
  const out = execFileSync(process.execPath, [path.join(TOOL, 'collect.mjs'), '--log', LOG, '--save', WORLD, '--since', String(LOG_LINES0 + 1)], { encoding: 'utf8' });
  const m = /报告：(.+)$/m.exec(out);
  console.log(out.split('\n').filter((l) => /断言|可疑|报告/.test(l)).join('\n'));
  if (m) {
    const rep = fs.readFileSync(m[1].trim(), 'utf8');
    const seg = rep.split('## v4 · 生成失败归因')[1];
    console.log('---- 归因 ----');
    console.log(seg ? seg.split('## P2')[0].trim().slice(0, 1400) : '(无 v4 段落)');
  }
} catch (e) {
  console.log('collect 退出码非 0（有可疑错误行），但报告已写：');
  console.log(((e.stdout || '') + '').split('\n').filter((l) => /报告|可疑/.test(l)).join('\n'));
}
