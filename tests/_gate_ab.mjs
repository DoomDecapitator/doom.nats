// _work/_gate_ab.mjs —— 同世界 A/B：默认变体（无 features）vs 实验性变体（有 features，世界未开该实验性玩法）
import fs from 'node:fs';
import path from 'node:path';
import { R } from './_root.mjs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';
const SRV = R('_work/mcserver-fid');
const DP = path.join(SRV, 'world', 'datapacks', 'doom.nats');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const mark = () => { try { return fs.statSync(path.join(SRV, 'rt-gate.log')).size; } catch { return 0; } };

const probe = async (label) => {
  const m = mark();
  await cmd('reload');
  await sleep(2500);
  const log = fs.readFileSync(path.join(SRV, 'rt-gate.log')).subarray(m).toString('utf8');
  const core = await cmd('function doom.nats:author/load');
  const exp = await cmd('function doom.nats:exp/usage');
  const loaded = /Running function doom\.nats:author\/load/.test(core);
  const expOk = /Running function doom\.nats:exp\/usage/.test(exp);
  console.log('--- ' + label + ' ---');
  console.log('  doom.nats:author/load（两个变体都有）⇒ ' + (loaded ? '✅ 已加载' : '❌ 未加载（Unknown function）'));
  console.log('  doom.nats:exp/usage（只有实验性变体有）⇒ ' + (expOk ? '已加载' : '未加载'));
  console.log('  本轮 Failed to load function: ' + (log.match(/Failed to load function/g) || []).length);
  return { loaded, expOk };
};

console.log('=== A) 默认变体 v4（pack.mcmeta 无 features）===');
fs.rmSync(DP, { recursive: true, force: true }); fs.cpSync(R('v4/doom.nats'), DP, { recursive: true });
const A = await probe('A · v4');
console.log('=== B) 实验性变体 v4x（pack.mcmeta 带 features；世界**没有**开 minecraft:minecart_improvements）===');
fs.rmSync(DP, { recursive: true, force: true }); fs.cpSync(R('v4x/doom.nats'), DP, { recursive: true });
const B = await probe('B · v4x');
console.log('\nA/B 结论：默认变体加载=' + A.loaded + ' · 实验性变体加载=' + B.loaded + '（期望 true / false）');
r.close();
