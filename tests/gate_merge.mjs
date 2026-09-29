#!/usr/bin/env node
// _work/gate_merge.mjs —— 「合并核验四道门」一键跑完（只新增这一个文件；不改数据包本体）
//
//   node _work/gate_merge.mjs            四道门全跑（约 6 分钟）
//   node _work/gate_merge.mjs --quick     只跑前三道（④ 完整回归标"跳过"）
//   node _work/gate_merge.mjs --with-save ② 额外把 v4 装进用户存档（默认**不动**用户存档）
//
// 四道门：
//   ① 静态门      node doom.nats/tools/check_static.mjs   最后一行须含 `0 error`
//   ② 引擎加载门  install.mjs --variant v4 装**测试世界**（用户存档默认跳过，需 --with-save）
//                 → RCON `reload` → 等 2.5s → 读 latest.log **本轮新增行**，
//                 `Failed to load function` 须 0 条（RCON 不通 ⇒ FAIL 并注明"测试服没在跑"）
//   ③ 真机专项    跑 _work/verify_*.mjs（按文件名排序），每个须 `0 FAIL`；
//                 跑之前若 `list` 显示 0 人，自起 bot.mjs 直到有玩家（最多 40s），跑完 kill
//   ④ 完整回归    cd doom.nats && node tools/regress.mjs --reuse --minutes 1 --curve 1
//                 `汇总: X PASS / Y FAIL` 须 0 FAIL，并打印报告文件名
//
// 退出码：全绿 0，否则 1。进程结尾必须显式 process.exit（RCON 不关会挂住）。
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // …/_work
const WS = path.resolve(HERE, '..'); // 工作区根
const RC4 = path.join(WS, 'doom.nats');
const NODE = process.execPath;
const QUICK = process.argv.includes('--quick');
const WITH_SAVE = process.argv.includes('--with-save');   // 用户存档必须由父代理确认版本后统一同步 ⇒ 默认不碰
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LOG = path.join(HERE, 'mcserver', 'logs', 'latest.log');
const TEST_SAVE = path.join(HERE, 'mcserver', 'world');
const USER_SAVE = 'C:/minecraft/Release 2.8.3.zip/.minecraft/versions/1.21.6-Fabric 0.16.14/saves/natnew_9_27_19';
// 汇总行容错：verify_group.mjs 用的是 `结果: … / 合计 …`，别的脚本用 `汇总: …`。
// verify_aabb_cheap.mjs 用 `判定矩阵: N 通过 / M 否决` —— 那是**期望吻合**口径（"通过/否决"都是脚本自己的
// 预期结果，未吻合才该记失败），只当参考、不计 FAIL，并在 ③ 明细里注明；等它补 `汇总:` 行后自动走严格口径。
const SUM_RE = /(?:汇总|合计|结果)[:：]?\s*(\d+)\s*PASS\s*\/\s*(\d+)\s*FAIL/;
const SUM_CN_RE = /(?:判定矩阵)[:：]?\s*(\d+)\s*通过\s*\/\s*(\d+)\s*否决/;
const sumOf = (out) => {
  let hit = null;
  for (const l of out.split(/\r?\n/)) {
    const t = l.replace(/\s*===\s*/g, ' ').trim();
    const m = SUM_RE.exec(t);
    if (m) { hit = { pass: Number(m[1]), fail: Number(m[2]), cn: false, line: l.trim() }; continue; }
    const m2 = SUM_CN_RE.exec(t);
    if (m2) hit = { pass: Number(m2[1]), fail: 0, cn: true, rawFail: Number(m2[2]), line: l.trim() };
  }
  return hit;
};

const rows = [];
const record = (no, name, pass, detail) => {
  rows.push({ no, name, pass, detail });
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + no + ' ' + name + ' —— ' + detail);
  return pass;
};

const run = (file, args, cwd = WS, timeout = 30 * 60 * 1000) => {
  const r = spawnSync(file, args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, windowsHide: true, timeout });
  return { code: r.status, signal: r.signal, err: r.error ? String(r.error.message) : null, out: (r.stdout || '') + (r.stderr || '') };
};
const nonEmpty = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const readLogLines = () => {
  try { return fs.readFileSync(LOG, 'utf8').split(/\r?\n/); } catch { return []; }
};

console.log('=== 合并核验四道门 · ' + new Date().toISOString().slice(0, 19).replace('T', ' ') + (QUICK ? ' · --quick（跳过④）' : '') + ' ===');

// ───────────────────────── ① 静态门 ─────────────────────────
const t1 = Date.now();
const g1 = run(NODE, [path.join(RC4, 'tools', 'check_static.mjs')]);
const l1 = nonEmpty(g1.out);
const last1 = l1.length ? l1[l1.length - 1] : '';
const ok1 = /0 error/.test(last1);
record('①', '静态门', ok1, (ok1 ? '' : '最后一行=' + last1 + ' · ') + 'exit=' + g1.code + ' · ' + ((Date.now() - t1) / 1000).toFixed(1) + 's');

// ───────────────────── ② 引擎加载门 ─────────────────────
const t2 = Date.now();
// 默认只装测试世界：用户存档是玩家资产，必须由父代理确认版本后统一同步（避免每次跑门都无声改动）。
const targets = [TEST_SAVE];
const skipTargets = [];
if (WITH_SAVE) {
  if (fs.existsSync(USER_SAVE)) targets.push(USER_SAVE);
  else skipTargets.push('用户存档不存在（--with-save 已给）：' + USER_SAVE);
} else {
  skipTargets.push('用户存档（默认跳过，需 --with-save）：' + USER_SAVE);
}
console.log('② 安装目标: ' + targets.map((s) => (s.startsWith(WS) ? path.relative(WS, s) : s)).join(' , ')
  + (skipTargets.length ? '\n   ⏭ ' + skipTargets.join('\n   ⏭ ') : ''));
const inst = targets.map((save) => run(NODE, [path.join(RC4, 'tools', 'install.mjs'), '--variant', 'v4', '--save', save]));
const instOk = inst.every((r) => r.code === 0);
const instTail = inst.map((r, i) => {
  const tail = nonEmpty(r.out).slice(-1)[0] || ('exit=' + r.code);
  return '存档' + (i + 1) + ':' + (r.code === 0 ? 'OK' : 'exit=' + r.code) + '(' + tail.slice(0, 60) + ')';
});

let rconNote = '';
let newFailed = -1;
try {
  const r = await openRcon({ timeout: 15000 }); // 不通会 reject ⇒ 落到 catch
  try {
    const before = readLogLines().length;
    await r.send('reload');
    await sleep(2500);
    const all = readLogLines();
    const fresh = all.length >= before ? all.slice(before) : all; // 长度倒退=日志被轮转，退回整读
    newFailed = fresh.filter((l) => l.includes('Failed to load function')).length;
    rconNote = 'reload 新增行 ' + fresh.length + ' 行 · Failed to load function ' + newFailed + ' 条';
  } finally {
    r.close && r.close();
  }
} catch (e) {
  rconNote = 'RCON 不通（测试服没在跑）：' + e.message;
}
const ok2 = instOk && newFailed === 0;
record('②', '引擎加载门', ok2,
  '安装 ' + inst.filter((r) => r.code === 0).length + '/' + targets.length + '（测试世界）'
  + (skipTargets.length ? ' · ⏭ ' + skipTargets.join(' / ') : '')
  + (instOk ? '' : ' · 安装失败 ' + instTail.join(' '))
  + ' · ' + (rconNote || '') + ' · ' + ((Date.now() - t2) / 1000).toFixed(1) + 's');

// ───────────────────── ③ 真机专项 ─────────────────────
// 前置（照抄 regress.mjs 的做法）：verify_animals / nether / persist / rules / struct_aabb
// 的多条用例依赖 @a、距离选择器 ⇒ 场上没人时会以「没有玩家在线」整门假 FAIL。
// 所以先 `list` 探人数；0 人就 spawn 一个 mineflayer 真客户端机器人，轮询到有人（最多 40s），③ 跑完再 kill。
const t3 = Date.now();
const onlineCount = async () => {
  const r = await openRcon({ timeout: 10000 });
  try {
    const m = /There are (\d+) of/i.exec(String(await r.send('list')));
    return m ? Number(m[1]) : -1;
  } finally {
    r.close && r.close();
  }
};
// 设一个 doom.nats 计分板值（跨脚本卫生用；每次独立连接，避免长连接被别的脚本的 reload 打断）
const scoreSet = async (holder, value) => {
  const r = await openRcon({ timeout: 10000 });
  try { await r.send(`scoreboard players set ${holder} doom.nats ${value}`); } finally { r.close && r.close(); }
};
const BOT = path.join(HERE, 'mcserver', 'bot.mjs');
const botChildren = [];           // 本门自起的机器人（退出时统一关）
let startedBots = 0;              // 自起次数（别的 agent 的 bot 可能中途掉线）
let playerNote = '';
// ⚠ v4.19 关键修正：锚定脚本（verify_aabb_cheap / animals / persist / rules / group / struct_aabb）
//   用的是 `execute at @e[type=player,name=DoomBot,limit=1]` ⇒ **"有某个玩家在线"不够**。
//   实测：用户在线时本门判定"已有人"而不再自起机器人 ⇒ 那些脚本的 fill/setblock 全部空转，
//   verify_aabb_cheap 23 条全红（"放置未生效"）。所以改成按**名字**探测 DoomBot / DoomBot2，缺哪个起哪个。
const botPresent = async (name) => {
  const r = await openRcon({ timeout: 10000 });
  try { return /Test passed/.test(String(await r.send('execute if entity @e[type=player,name=' + name + ']'))); } finally { r.close && r.close(); }
};
const startBot = async (why, name = 'DoomBot') => {
  if (!fs.existsSync(BOT)) return false;
  const ch = spawn(NODE, [BOT, '--minutes', '60', '--name', name], { cwd: path.dirname(BOT), stdio: 'ignore', windowsHide: true });
  botChildren.push(ch);
  startedBots += 1;
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < 40000) {
    await sleep(2000);
    try { ok = await botPresent(name); } catch { ok = false; }
    if (ok) break;
  }
  // `list` 显示连上 ≠ 机器人已 spawn 进场/区块已加载（实测：刚连上就跑 verify_animals，
  // 会因"玩家位置/区块还没就绪"出 2 条假 FAIL）⇒ 再等 5s 稳定
  await sleep(5000);
  playerNote += (playerNote ? ' · ' : '') + `自起 ${name}#${startedBots}(${why}) → ${ok ? '在线' : '未上线'}（${((Date.now() - t0) / 1000).toFixed(0)}s）`;
  return ok;
};
// 每个脚本前都确认两个锚定机器人在场（verify_multibot 需要 DoomBot + DoomBot2）。掉了就（重）起。
const ensurePlayer = async (why) => {
  let a = false, b = false;
  try { a = await botPresent('DoomBot'); b = await botPresent('DoomBot2'); }
  catch (e) { playerNote += (playerNote ? ' · ' : '') + 'RCON 不通：' + e.message; return false; }
  if (a && b) return true;
  if (!a) a = await startBot(why, 'DoomBot');
  if (!b) b = await startBot(why, 'DoomBot2');
  return a && b;
};
try {
  playerNote = (await botPresent('DoomBot')) ? 'DoomBot 已在场' : 'DoomBot 不在场';
  await ensurePlayer('开场');
} catch (e) {
  playerNote = '玩家探测失败（RCON 不通）：' + e.message;
}

const scripts = fs.readdirSync(HERE).filter((f) => /^verify_.*\.mjs$/.test(f)).sort();
const bad = [];
const cnNote = [];                 // 用"判定矩阵"口径的脚本（期望吻合，不计 FAIL）
let sumPass = 0;
let sumFail = 0;
// v4.18：把每个脚本的**完整输出**落盘 —— 以前只留汇总行，红了以后无法复盘是哪条断言、当时计分板多少
//   （实测教训：verify_animals 在门里红 / 手动单跑绿，因为没有原文可查，只能靠复现猜）。
const DET = path.join(HERE, 'gate-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '') + '-detail');
fs.mkdirSync(DET, { recursive: true });
try {
  // v4.20：脚本对环境的隐含假设必须由门来保证（实测两处**成片假红**，都不是包的问题）：
  //   ① **锚定机器人的维度**：脚本用 `execute at @e[type=player,name=DoomBot,limit=1]` 取位置，
  //      但 RCON/控制台的执行维度是主世界 ⇒ 若 DoomBot 被上一轮 verify_nether 留在下界，
  //      场地就搭在主世界、判定却按"玩家在下界"的坐标/维度走 ⇒ 全成假红
  //      （实测：verify_persist 5/5、verify_struct_aabb 9/3；把两个机器人拉回主世界后立刻回到 10/0 与 12/0）。
  //   ② **时间**：verify_rules 自己会把时间改成 day/midnight 且**不还原** ⇒ 再跑一次时它的"白天/午夜假设"全错。
  //   对策：每个脚本运行前统一重置锚点维度与时间（自定义脚本若需要别的环境，自己在脚本内 tp/time 即可）。
  //   ③ **竖直位置**（v4.20 新增，实测的最大一片假红）：`tp DoomBot -240 64 -592` 的 y 是**写死**的，
  //      而测试世界在这两处的**地表高于 y=64** ⇒ 机器人被 tp 进实心地形内部 ⇒ 测试点天空光=0、上方两格是石头：
  //        · verify_rules「动物路径 bright 通过」「落位通过」「白天露天必须否决」、5 段"拆盒后白天露天否决" 全红
  //        · verify_animals ③ 端到端 reason=3（光照门）恒红、场上 creature 恒 0
  //      实测：gate-2026-09-28173704 里 rules 12/4、animals 4/2，全部由这一条造成（不是包的问题）。
  //      对策：在锚点 x/z 自上而下扫第一处「可站 + 上方两格可生成 + 站立点能看见天空」的层，把机器人放在它**上面**
  //      （扫不到就退回 64）。最后那条 `can_see_sky` 很关键：没有它，模式 0 的扫描会在**地下洞穴**里命中
  //      （实测 DoomBot2 那列扫出 y=42 的洞穴层，天空光=0 ⇒ 又变回假红）。
  const surfaceY = async (send, x, z) => {
    for (let y = 200; y >= 40; y--) {
      const t = String(await send(`execute in minecraft:overworld positioned ${x} ${y} ${z} if block ~ ~ ~ #doom.nats:standable if block ~ ~1 ~ #doom.nats:spawnable_at if block ~ ~2 ~ #doom.nats:spawnable_at positioned ~ ~1 ~ if predicate doom.nats:spawn/can_see_sky`).catch(() => ''));
      if (/passed/i.test(t)) return y + 1;
    }
    return null;
  };
  let anchorY = null;   // 每次门只扫一次（每个脚本都扫会白花 ~3s × 18）
  const resetEnv = async () => {
    // 先清掉**上一个脚本遗留的机器人**（verify_multibot / verify_nether 会自起机器人且不保证关干净；
    // 它们的 stdio 管道会让 run() 的 spawnSync 一直等下去 ⇒ 每个这样的脚本白等一个超时窗口）。
    try {
      const { execFileSync } = await import('node:child_process');
      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(HERE, '_kill_old_bots.ps1')], { stdio: 'ignore', timeout: 20000 });
    } catch {}
    const r0 = await openRcon({ timeout: 10000 });
    try {
      // ⚠ v4.22i：**每次** resetEnv 都确认机器人在场。清掉遗留机器人之后，门自己的机器人可能：
      //   ① 被怪围攻打死亡（测试世界是午夜 + 地表锚点；v4.22 修了消失层之后怪会长期留在玩家身边）
      //      ② 掉线/被顶号。实测 gate-final2：机器人中途消失 ⇒ 之后 dim_att/fortress/group/multibot
      //      在"无人在场"的世界里跑 ⇒ 场地区块不加载（'That position is not loaded'）、召唤物被丢弃（'No entity was found'）
      //      成片假红（dim_att 5/1、group 15/7、multibot 3/1）。
      //   另外两点配合：③ 锚定机器人改**创造模式**（仍算 non-spectator ⇒ 刷怪语义不变，但不会被打死）；
      //   ④ 每次清掉本包生成物（debug/clear，安全过滤）——否则残留怪物把容量顶满，需要"生成增量>0"的断言全红。
      await ensurePlayer('resetEnv 后');
      if (!anchorY) {
        // ⚠ v4.22h（本轮 29 条假红的根因）：`_kill_old_bots.ps1` 会杀掉**所有** `bot.mjs --port 25565`
        //   ——包括"先 ensurePlayer 确认在场、紧接着就被这里杀掉"的那两个机器人。若此刻机器人已被杀，
        //   `tp DoomBot …` 静默失败 ⇒ 锚点区块不加载 ⇒ `if block` 全 false ⇒ 扫描返回 null ⇒
        //   `|| 64` 兜底把机器人塞进**地表以下**（该列真地表 y=70）⇒ 天空光=0 ⇒
        //   verify_aabb_cheap 0/23、verify_rules 12/4、verify_animals 4/2 成片假红（实测 gate-final）。
        //   对策：① 先保证机器人真的在（kill 之后再确认/补起）② forceload 两个锚点区块
        //        ③ 扫描回读校验，失败就**大声报错并中止门**，不再拿 y=64 兜底。
        let live = await botPresent('DoomBot') && await botPresent('DoomBot2');
        if (!live) { playerNote += (playerNote ? ' · ' : '') + '锚点前补起机器人'; await ensurePlayer('锚点前'); live = await botPresent('DoomBot'); }
        await r0.send('execute in minecraft:overworld run forceload add -16 -38 -14 -36').catch(() => {});
        await r0.send('execute in minecraft:overworld run forceload add -45 -38 -43 -36').catch(() => {});
        await r0.send('execute in minecraft:overworld run tp DoomBot -240 200 -592').catch(() => {});
        await r0.send('execute in minecraft:overworld run tp DoomBot2 -700 200 -592').catch(() => {});
        await sleep(2500);
        anchorY = { b1: await surfaceY((c) => r0.send(c), -240, -592), b2: await surfaceY((c) => r0.send(c), -700, -592) };
        console.log('锚点地表: DoomBot(-240,-592) y=' + anchorY.b1 + ' · DoomBot2(-700,-592) y=' + anchorY.b2 + '（forceload 已就位）');
        if (!anchorY.b1) {
          console.log('❌ 锚点扫描失败（拿不到地表 y）—— 机器人不在场或区块未加载。中止本次门，避免整片假红。');
          for (const c of botChildren) { try { c.kill(); } catch {} }
          process.exit(3);
        }
      }
      for (const c of [`execute in minecraft:overworld run tp DoomBot -240 ${anchorY.b1} -592`,
        // ⚠ DoomBot2 要放**远**（>400 格）：verify_multibot 的前置断言是"两名机器人都在线且相距 >400 格"。
        //   我第一版把它和 DoomBot 摆在 16 格内 ⇒ 那条前置直接红，整脚本 0/4（实测 gate-012432 就是）。
        `execute in minecraft:overworld run tp DoomBot2 -700 ${anchorY.b2 || anchorY.b1} -592`,
        // ⚠ 用 midnight 而不是 day：测试世界的既定约定是 doDaylightCycle=false + time midnight
        //   （starter/regress 都这么设）。设成 day 会把依赖"暗"的脚本整片打红
        //   —— 实测 verify_group 22/0→15/7、verify_dims 13/0→11/2 就是这一行造成的。
        'time set midnight']) {
        await r0.send(c).catch(() => {});
      }
      // ③ 锚定机器人免死（创造：仍是 non-spectator ⇒ 刷怪/距离判定语义不变，但不会被怪打死）
      await r0.send('gamemode creative DoomBot').catch(() => {});
      await r0.send('gamemode creative DoomBot2').catch(() => {});
      // ④ 清掉本包生成物（三界各一次；debug/clear 自带"命名/有主/持久/拴绳"安全过滤）⇒ 容量不被残留顶满
      for (const dim of ['overworld', 'the_nether', 'the_end']) {
        await r0.send(`execute in minecraft:${dim} run function doom.nats:debug/clear`).catch(() => {});
      }
    } finally { r0.close && r0.close(); }
  };
  for (const s of scripts) {
    await ensurePlayer('跑 ' + s + ' 前');
    await resetEnv();
    // ⚠ v4.18 教训：**不要**在这里统一「解冻」快照（曾加过 `scoreSet('$snap_period', 0)`）。
    //   多数 verify_* 是「先冻结再戳分数」的写法，冻结本身就是它们的前提；一解冻，后台刷怪循环立刻恢复、
    //   把 $sel.*/$snap.* 覆盖掉 ⇒ verify_persist / verify_rules / verify_struct_aabb 集体转红（实测 9/1、9/7、6/3）。
    //   正确做法：需要新快照的脚本自己显式跑 `function doom.nats:circ/snapshot`（verify_animals 已经这么做）。
    //   每个脚本的完整输出仍落盘到 <DET>/，红了直接看原文，不用再靠复现猜。
    // ⚠ v4.20：**必须给单脚本加超时**。run() 用 spawnSync，而 spawnSync 会等**stdio 管道关闭**；
    //   某些 verify_* 会自己起 mineflayer 机器人并把它留在后台，孙进程继承了管道 ⇒ 脚本自己早退出了，
    //   spawnSync 却永远等下去（实测：gate-012432 卡在多脚本之后的 9/16 不推进，唯一残留进程正是那两个机器人）。
    //   超时（8 分钟，远大于最慢脚本的 ~100s）后 spawnSync 返回 SIGTERM，门按"未见汇总行"记 FAIL 并继续。
    // 3.5 分钟足够：最慢的脚本约 101s（verify_nether）。超时越短，"被孙进程管道拖住"的惩罚越小。
    const r = run(NODE, [path.join(HERE, s)], WS, 3.5 * 60 * 1000);
    try { fs.writeFileSync(path.join(DET, s.replace(/\.mjs$/, '') + '.log'), String(r.out || '') + '\n[exit ' + r.code + ']' + '\n'); } catch {}
    const sum = sumOf(r.out);
    if (!sum) {
      // 无汇总行 = 脚本中途退出（如「没有玩家在线」）⇒ 记 1 FAIL，别让整门被吞掉
      sumFail += 1;
      const tail = nonEmpty(r.out).slice(-1)[0] || '';
      bad.push(s + '(未见汇总行 exit=' + r.code + (tail ? ' · ' + tail.slice(0, 40) : '') + ')');
      continue;
    }
    sumPass += sum.pass;
    sumFail += sum.fail;
    if (sum.cn) cnNote.push(s + '(' + sum.line + ' —— 期望吻合口径，不计 FAIL)');
    else if (sum.fail !== 0) bad.push(s + '(' + sum.line + ')');
  }
} finally {
  for (const c of botChildren) { try { c.kill(); } catch {} }
  if (botChildren.length) playerNote += ' · 已关闭 ' + botChildren.length + ' 个自起机器人';
}
const ok3 = bad.length === 0;
record(
  '③',
  '真机专项',
  ok3,
  '玩家: ' + playerNote + ' · ' + scripts.length + ' 个脚本 · ' + sumPass + ' PASS / ' + sumFail + ' FAIL'
    + (bad.length ? ' · 失败者: ' + bad.join(' , ') : ' · 全部 0 FAIL')
    + (cnNote.length ? ' · 注: ' + cnNote.join(' , ') : '')
    + ' · ' + ((Date.now() - t3) / 1000).toFixed(1) + 's',
);

// ───────────────────── ④ 完整回归 ─────────────────────
if (QUICK) {
  record('④', '完整回归', true, '跳过（--quick）');
  rows[rows.length - 1].skip = true;
} else {
  const t4 = Date.now();
  const g4 = run(NODE, [path.join(RC4, 'tools', 'regress.mjs'), '--reuse', '--minutes', '1', '--curve', '1'], RC4);
  const sum4 = sumOf(g4.out);
  const rep = (g4.out.split(/\r?\n/).filter((l) => /^\s*报告[:：]/.test(l)).slice(-1)[0] || '').trim();
  const ok4 = !!sum4 && sum4.fail === 0;
  record('④', '完整回归', ok4, (sum4 ? sum4.line + ' · ' : '未见汇总行 · ') + (rep || '未见报告行') + ' · ' + ((Date.now() - t4) / 1000).toFixed(1) + 's');
}

// ───────────────────── 汇总 ─────────────────────
const counted = rows.filter((r) => !r.skip);
const pass = counted.filter((r) => r.pass).length;
const fail = counted.length - pass;
const skipped = rows.length - counted.length;
console.log('');
console.log('门 | 结果 | 关键数字');
console.log('---|---|---');
for (const r of rows) console.log(r.no + ' ' + r.name + ' | ' + (r.skip ? '跳过' : r.pass ? 'PASS' : 'FAIL') + ' | ' + r.detail);
console.log('合计: ' + pass + ' PASS / ' + fail + ' FAIL' + (skipped ? '（跳过 ' + skipped + ' 门）' : ''));
process.exit(fail ? 1 : 0);
