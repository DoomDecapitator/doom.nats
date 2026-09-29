// _work/_gate_startup.mjs —— "世界装载态"探针：重启 fid 服务后（不做 /reload）看两个变体是否被引擎放行
//   node _work/_gate_startup.mjs v4|v4x
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { R } from './_root.mjs';
const SRV = R('_work/mcserver-fid');
const DP = path.join(SRV, 'world', 'datapacks', 'doom.nats');
const which = process.argv[2] || 'v4';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(DP, { recursive: true, force: true });
fs.cpSync(R(which + '/doom.nats'), DP, { recursive: true });
console.log('已装机：' + which);

const pid = (() => {
  try {
    const o = execFileSync('powershell', ['-NoProfile', '-Command',
      '$p = Get-NetTCPConnection -State Listen -LocalPort 25571 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess; if ($p) { $p }; exit 0'], { encoding: 'utf8' });
    return Number(o.trim().split(/\s+/)[0]) || 0;
  } catch { return 0; }
})();
if (pid) { execFileSync('powershell', ['-NoProfile', '-Command', `Stop-Process -Id ${pid} -Force`], { encoding: 'utf8' }); console.log('停服 pid=' + pid); }
for (let i = 0; i < 30; i++) { await sleep(1000); const l = (() => { try { return fs.readFileSync(path.join(SRV, 'rt-gate.log'), 'utf8'); } catch { return ''; } })(); if (/Stopping server/.test(l)) break; }
fs.rmSync(path.join(SRV, 'rt-gate.log'), { force: true });
execFileSync('powershell', ['-NoProfile', '-Command',
  `& '${R('_work/run_bg.ps1')}' -Cmd '${path.join(SRV, '_start_fid.cmd').replace(/'/g, "''")}' -Log '${path.join(SRV, 'rt-gate.log').replace(/'/g, "''")}' -WorkDir '${SRV.replace(/'/g, "''")}'`], { encoding: 'utf8' });
let ready = false;
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  const log = (() => { try { return fs.readFileSync(path.join(SRV, 'rt-gate.log'), 'utf8'); } catch { return ''; } })();
  if (/Done \(/.test(log)) { ready = true; break; }
}
console.log('服务就绪=' + ready);
const { openRcon } = await import('../doom.nats/tools/mcrcon.mjs');
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const core = await cmd('function doom.nats:author/load');
const exp = await cmd('function doom.nats:exp/usage');
const log = fs.readFileSync(path.join(SRV, 'rt-gate.log'), 'utf8');
console.log('【' + which + ' · 世界装载态】doom.nats:author/load ⇒ ' + (/Running function/.test(core) ? '✅ 已加载' : '❌ 未加载'));
console.log('【' + which + ' · 世界装载态】doom.nats:exp/usage  ⇒ ' + (/Running function/.test(exp) ? '✅ 已加载' : '❌ 未加载'));
console.log('启动日志 Failed to load function: ' + (log.match(/Failed to load function/g) || []).length);
console.log('启动日志 features 相关: ' + (log.split(/\r?\n/).filter((l) => /feature|flag|Incompatible/i.test(l)).slice(0, 3).join(' | ') || '(无)'));
console.log('datapack list: ' + (await cmd('datapack list')).slice(0, 200));
r.close();
