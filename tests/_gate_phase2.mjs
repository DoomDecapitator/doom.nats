// _work/_gate_phase2.mjs —— 全新世界 + 打开实验性玩法（initial-enabled-packs 带 minecart_improvements）+ v4x
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { R } from './_root.mjs';
const SRV = R('_work/mcserver-fid');
const WORLD = path.join(SRV, 'world');
const DP = path.join(WORLD, 'datapacks', 'doom.nats');
const PROPS = path.join(SRV, 'server.properties');
const LOG = path.join(SRV, 'rt-gate.log');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pidOf = () => { try { const o = execFileSync('powershell', ['-NoProfile', '-Command', '$p = Get-NetTCPConnection -State Listen -LocalPort 25571 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess; if ($p) { $p }; exit 0'], { encoding: 'utf8' }); return Number(o.trim().split(/\s+/)[0]) || 0; } catch { return 0; } };

let pid = pidOf();
if (pid) { execFileSync('powershell', ['-NoProfile', '-Command', `Stop-Process -Id ${pid} -Force`], { encoding: 'utf8' }); console.log('停服 pid=' + pid); }
for (let i = 0; i < 30 && pidOf(); i++) await sleep(1000);
fs.rmSync(WORLD, { recursive: true, force: true });
fs.mkdirSync(path.dirname(DP), { recursive: true });
fs.cpSync(R('v4x/doom.nats'), DP, { recursive: true });
fs.cpSync(R('_work/mcserver-fid/world-keep-rt/datapacks/doom.log'), path.join(path.dirname(DP), 'doom.log'), { recursive: true });
let s = fs.readFileSync(PROPS, 'utf8');
s = /^initial-enabled-packs=/m.test(s) ? s.replace(/^initial-enabled-packs=.*$/m, 'initial-enabled-packs=vanilla,minecart_improvements') : s.trimEnd() + '\ninitial-enabled-packs=vanilla,minecart_improvements\n';
fs.writeFileSync(PROPS, s);
console.log('全新世界 + initial-enabled-packs=vanilla,minecart_improvements + v4x');
fs.rmSync(LOG, { force: true });
execFileSync('powershell', ['-NoProfile', '-Command',
  `& '${R('_work/run_bg.ps1')}' -Cmd '${path.join(SRV, '_start_fid.cmd').replace(/'/g, "''")}' -Log '${LOG.replace(/'/g, "''")}' -WorkDir '${SRV.replace(/'/g, "''")}'`], { encoding: 'utf8' });
let ready = false;
for (let i = 0; i < 90; i++) { await sleep(2000); const l = (() => { try { return fs.readFileSync(LOG, 'utf8'); } catch { return ''; } })(); if (/Done \(/.test(l)) { ready = true; break; } }
console.log('服务就绪=' + ready);
const { openRcon } = await import('../doom.nats/tools/mcrcon.mjs');
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const core = await cmd('function doom.nats:author/load');
const exp = await cmd('function doom.nats:exp/usage');
const log = fs.readFileSync(LOG, 'utf8');
console.log('【世界装载态 · 已开实验性玩法】author/load ⇒ ' + (/Running function/.test(core) ? '✅ 已加载' : '❌ 未加载'));
console.log('【世界装载态 · 已开实验性玩法】exp/usage   ⇒ ' + (/Running function/.test(exp) ? '✅ 已加载' : '❌ 未加载'));
console.log('启动日志 Failed to load function: ' + (log.match(/Failed to load function/g) || []).length);
console.log('启动日志 feature 相关: ' + (log.split(/\r?\n/).filter((l) => /feature|flag|Incompatible/i.test(l)).slice(0, 3).join(' | ') || '(无)'));
console.log('datapack list: ' + (await cmd('datapack list')).slice(0, 220));
r.close();
