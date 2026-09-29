// _work/verify_mode.mjs —— 真机验证「生存直用模式」开关（mode/survival|manual|off|auto）
//
// 前提：常驻测试服在跑（RCON 25575），且 v4 已装进 _work/mcserver/world/datapacks。
// 验证的红→绿链条：
//   1) 先把 gamerule doMobSpawning 手动设回 true（模拟"原版自然生成还开着"）
//   2) /reload  ⇒ 装载 tag 触发 core/setup ⇒ mode/survival ⇒ 期望 false
//   3) function mode/off ⇒ 期望清场 + 变回 true
//   4) function mode/manual 后再 /reload ⇒ 期望**保持 true**（证明 manual 真的挡住了自动接管）
//   5) function mode/auto ⇒ 期望 false
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const LOG = 'C:/Users/Dell/Downloads/datapack/_work/mcserver/logs/latest.log';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log((pass ? '✅ ' : '❌ ') + name + '  ' + detail); };

const logSize = () => { try { return fs.statSync(LOG).size; } catch { return 0; } };
const readFrom = (off) => { try { const b = fs.readFileSync(LOG); return b.subarray(off).toString('utf8'); } catch { return ''; } };

const r = await openRcon();
const cmd = async (c) => { const out = await r.send(c); return String(out).trim(); };
const cnt = async (sel) => {
  const t = await cmd('execute if entity ' + sel);
  const m = /count: (\d+)/.exec(t);
  return m ? Number(m[1]) : (t.includes('Test passed') ? 1 : 0);
};
const gamerule = async () => {
  const t = await cmd('gamerule doMobSpawning');
  const m = /:\s*(true|false)/.exec(t);
  return m ? m[1] : t;
};

console.log('=== 生存直用模式真机验证 ===');
// 需要有玩家：① 人造探针必须落在一块**真正加载**的区块里（0 人在线时出生点区块不加载，
//   summon 会静默失败 ⇒ 上一条"清理 ? 只/人造 0 只"的假红就是这个）；② say 行也要有接收方。
const players = async () => { const m = /There are (\d+)/.exec(await cmd('list')); return m ? Number(m[1]) : 0; };
let botChild = null;
if ((await players()) === 0) {
  const bp = path.join(import.meta.dirname, 'mcserver', 'bot.mjs');
  console.log('场上没有玩家 ⇒ 自起机器人:', bp);
  botChild = spawn(process.execPath, [bp, '--minutes', '6'], { cwd: path.dirname(bp), stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { if ((await players()) > 0) break; await sleep(1000); }
  await sleep(1500);
  console.log('玩家数:', await players());
}
console.log('1) 基线：把 doMobSpawning 设回 true');
await cmd('gamerule doMobSpawning true');
ok('基线 doMobSpawning=true', (await gamerule()) === 'true', await gamerule());

console.log('2) /reload 触发装载链');
// 先复位到 auto：上一轮若停在 manual，装载链会（正确地）跳过 mode/survival ⇒ 状态残留造成的假 FAIL
await cmd('function doom.nats:mode/auto');
await cmd('gamerule doMobSpawning true');
// 锚点必须在 reload **之前**：say 行是装载链在 reload 内部打的，锚点取在 reload 之后就会漏掉这一行
const mark2 = logSize();
await cmd('reload');
let seg = '';
let sawSurvival = false;
for (let i = 0; i < 20; i++) {                 // 轮询最多 10s：日志落盘可能晚于命令返回
  await sleep(500);
  seg = readFrom(mark2);
  if (/mode\/survival/.test(seg)) { sawSurvival = true; break; }
}
const loadedOk = !/Failed to load|无法加载|加载失败/.test(seg);
ok('reload 无加载报错', loadedOk, loadedOk ? '未见 Failed to load' : '出现加载错误');
ok('日志出现 mode/survival（锚点取在 reload 之前）', sawSurvival, sawSurvival ? '已打印接管说明' : '未捕获到 say 行（reload 后新增 ' + seg.length + ' 字节日志）');
const g2 = await gamerule();
ok('reload 后 doMobSpawning=false（自动接管）', g2 === 'false', 'gamerule=' + g2);

console.log('3) mode/off 退场');
// 清场断言要有意义：先人造若干**本包生物**（doom.nats.spawned + 探针标签）并回读计数，再验证清场。
// 位置取玩家上方（有玩家在 = 区块一定加载）；NoGravity 让它们停在原地不掉落、不摔死。
const PROBE = 'pv.mode';
await cmd('kill @e[tag=' + PROBE + ']');
for (let i = 0; i < 4; i++) await cmd(`execute at @a[gamemode=!spectator,limit=1] run summon minecraft:zombie ~ ~5 ~ {NoAI:1b,NoGravity:1b,Tags:["doom.nats.spawned","doom.nats.cat.monster","${PROBE}"]}`);
const probeBefore = await cnt('@e[tag=' + PROBE + ']');
const mark3 = logSize();
await cmd('function doom.nats:mode/off');
await sleep(1500);
seg = readFrom(mark3);
const g3 = await gamerule();
ok('mode/off 后 doMobSpawning=true（还给原版）', g3 === 'true', 'gamerule=' + g3);
const probeAfter = await cnt('@e[tag=' + PROBE + ']');
const cleared = /\[nats\.clear\] 已静默清理/.test(seg);
const nClear = (/已静默清理[^0-9]*(\d+)\s*只/.exec(seg.replace(/§./g, '')) || [, '?'])[1];
ok('mode/off 触发静默清场（人造 ' + probeBefore + ' 只，残留 ' + probeAfter + '）',
  cleared && probeBefore >= 4 && probeAfter === 0,
  '清理 ' + nClear + ' 只（void_kill，无掉落）' + (probeBefore < 4 ? ' ⚠人造失败（区块未加载？）' : ''));
await cmd('kill @e[tag=' + PROBE + ']');

console.log('4) mode/manual 之后再 reload 应保持 true');
await cmd('function doom.nats:mode/manual');
await cmd('gamerule doMobSpawning true');
const mark4 = logSize();
await cmd('reload');
await sleep(3000);
seg = readFrom(mark4);
const g4 = await gamerule();
ok('manual 后 reload 不再自动关（仍 true）', g4 === 'true', 'gamerule=' + g4);
const noAuto = !/mode\/survival —— 已接管/.test(seg);
ok('manual 生效期内 reload 未打印自动接管', noAuto, noAuto ? '装载链跳过了 mode/survival' : '仍出现自动接管行');

console.log('5) mode/auto 恢复默认');
const mark5 = logSize();
await cmd('function doom.nats:mode/auto');
await sleep(800);
seg = readFrom(mark5);
const g5 = await gamerule();
ok('mode/auto 后 doMobSpawning=false', g5 === 'false', 'gamerule=' + g5);

if (botChild) { try { botChild.kill(); } catch {} console.log('（已关闭自起机器人）'); }
r.close();

const pass = results.filter((x) => x.pass).length;
console.log('');
console.log('汇总: ' + pass + ' PASS / ' + (results.length - pass) + ' FAIL');
const out = 'C:/Users/Dell/Downloads/datapack/_work/verify-mode.json';
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
console.log('结果: ' + path.resolve(out));
process.exit(results.every((x) => x.pass) ? 0 : 1);
