// _work/_restore_fid.mjs —— 把 fid 还原成"原世界 + 默认变体 v4"，并清掉我加过的 server.properties 行
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { R } from './_root.mjs';
const SRV = R('_work/mcserver-fid');
const WORLD = path.join(SRV, 'world');
const KEEP = path.join(SRV, 'world-keep-rt');
const PROPS = path.join(SRV, 'server.properties');
const LOG = path.join(SRV, 'rt-gate.log');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pidOf = () => { try { const o = execFileSync('powershell', ['-NoProfile', '-Command', '$p = Get-NetTCPConnection -State Listen -LocalPort 25571 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess; if ($p) { $p }; exit 0'], { encoding: 'utf8' }); return Number(o.trim().split(/\s+/)[0]) || 0; } catch { return 0; } };

const pid = pidOf();
if (pid) { execFileSync('powershell', ['-NoProfile', '-Command', `Stop-Process -Id ${pid} -Force`], { encoding: 'utf8' }); console.log('停服 pid=' + pid); }
for (let i = 0; i < 30 && pidOf(); i++) await sleep(1000);

if (fs.existsSync(KEEP)) {
  fs.rmSync(WORLD, { recursive: true, force: true });
  fs.renameSync(KEEP, WORLD);
  console.log('原世界已还原');
} else console.log('⚠ 没有 world-keep-rt（原世界可能已被覆盖）');
let s = fs.readFileSync(PROPS, 'utf8');
s = s.replace(/^initial-enabled-packs=.*\r?\n/m, '');
fs.writeFileSync(PROPS, s);
console.log('server.properties 已清掉 initial-enabled-packs');

// 默认变体装机
const DP = path.join(WORLD, 'datapacks', 'doom.nats');
fs.rmSync(DP, { recursive: true, force: true });
fs.cpSync(R('v4/doom.nats'), DP, { recursive: true });
console.log('已装回默认变体 v4');

fs.rmSync(LOG, { force: true });
execFileSync('powershell', ['-NoProfile', '-Command',
  `& '${R('_work/run_bg.ps1')}' -Cmd '${path.join(SRV, '_start_fid.cmd').replace(/'/g, "''")}' -Log '${LOG.replace(/'/g, "''")}' -WorkDir '${SRV.replace(/'/g, "''")}'`], { encoding: 'utf8' });
let ready = false;
for (let i = 0; i < 90; i++) { await sleep(2000); const l = (() => { try { return fs.readFileSync(LOG, 'utf8'); } catch { return ''; } })(); if (/Done \(/.test(l)) { ready = true; break; } }
console.log('服务就绪=' + ready);
await sleep(3000);
const { openRcon } = await import('../doom.nats/tools/mcrcon.mjs');
const r = await openRcon();
console.log('list: ' + String(await r.send('list')).trim());
console.log('datapack list: ' + String(await r.send('datapack list')).slice(0, 220));
r.close();
