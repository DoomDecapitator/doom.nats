// _work/_gate_exp2.mjs —— 引擎门实验（真机）：
//   A) 把 v4x 包移出去 → reload（包消失）
//   B) 移回来 → reload（**新发现的包**，世界没开实验性玩法）
//   C) 期望：引擎拒绝/不加载它 —— 调用 doom.nats:exp/usage 应当报"函数不存在"
//   D) datapack enable minecart_improvements（打开原生实验性玩法）→ reload → 再试
import fs from 'node:fs';
import path from 'node:path';
import { R } from './_root.mjs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';
const LOG = process.env.MC_LOG || R('_work/mcserver-fid/logs/latest.log');
const DP = R('_work/mcserver-fid/world/datapacks');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const mark = () => { try { return fs.statSync(LOG).size; } catch { return 0; } };
const probe = async (label) => {
  const m = mark();
  await cmd('reload');
  await sleep(2200);
  const t = fs.readFileSync(LOG).subarray(m).toString('utf8');
  const out = await cmd('function doom.nats:exp/usage');
  const list = await cmd('datapack list');
  const dz = (list.match(/doom\.nats[^\]]*/) || [''])[0];
  const exists = /Running function doom\.nats:exp\/usage/.test(out) || /Running function/.test(out);
  console.log('--- ' + label + ' ---');
  console.log('  doom.nats:exp/usage ⇒ ' + (exists ? '存在（包已加载）' : '不存在（包未加载）') + ' | ' + out.split('\n')[0].slice(0, 90));
  console.log('  datapack list 里的 doom.nats：' + dz);
  const bad = (t.match(/Failed to load function/g) || []).length;
  if (bad) console.log('  ⚠ 本轮 Failed to load function: ' + bad);
  return exists;
};

const PK = path.join(DP, 'doom.nats');
const HOLD = path.join(DP, '_hold_doom.nats');

console.log('=== A) 移出包 → reload ===');
fs.renameSync(PK, HOLD);
await probe('A · 包已移出');

console.log('=== B) 移回包 → reload（世界**没有**开 minecraft:minecart_improvements）===');
fs.renameSync(HOLD, PK);
const loadedWithoutFlag = await probe('B · 新发现的带 features 包');

console.log('=== C) 打开原生实验性玩法（datapack enable minecart_improvements）===');
console.log('  ' + (await cmd('datapack enable minecart_improvements')).slice(0, 200));
await sleep(300);
const loadedWithFlag = await probe('C · 已开实验性玩法');

console.log('\n结论：无旗标加载=' + loadedWithoutFlag + ' · 有旗标加载=' + loadedWithFlag);
r.close();
