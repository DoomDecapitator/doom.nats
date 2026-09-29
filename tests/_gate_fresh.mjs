// _work/_gate_fresh.mjs —— 引擎门验收（**全新世界**，隔离实例 fid 25571/25581）：
//   phase 1：全新世界（**没有**开 minecraft:minecart_improvements）⇒ 期望引擎不让这个包生效
//   phase 2：全新世界 + server.properties 的 initial-enabled-packs 打开该实验性玩法 ⇒ 期望包正常加载 + 全量验收
//
//   用法：node _work/_gate_fresh.mjs [--phase1|--phase2|--restore]
// 说明：脚本自己起停 fid 服务（隔离实例，绝不碰 25565），跑完把原世界还原回去。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { R } from './_root.mjs';

const SRV = R('_work/mcserver-fid');
const WORLD = path.join(SRV, 'world');
const KEEP = path.join(SRV, 'world-keep-rt');
const DP = path.join(WORLD, 'datapacks');
const PROPS = path.join(SRV, 'server.properties');
const PACKS = ['doom.nats', 'doom.log', 'doom.schedule', 'doom.ui', 'ui_probe', 'zz-test-fixtures'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const findJavaPid = () => {
  let out = '';
  try {
    out = execFileSync('powershell', ['-NoProfile', '-Command',
      '$p = Get-NetTCPConnection -State Listen -LocalPort 25571 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess; if ($p) { $p }; exit 0'],
      { encoding: 'utf8' });
  } catch { out = ''; }
  const pid = out.trim().split(/\s+/)[0];
  return pid ? Number(pid) : 0;
};
const stopServer = async () => {
  const pid = findJavaPid();
  if (!pid) { console.log('（没有在跑的 fid 服务）'); return; }
  console.log('停服 pid=' + pid);
  execFileSync('powershell', ['-NoProfile', '-Command', `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`], { encoding: 'utf8' });
  for (let i = 0; i < 30 && findJavaPid(); i++) await sleep(1000);
  console.log('已停服（端口空闲=' + (findJavaPid() === 0) + '）');
};
const startServer = async () => {
  execFileSync('powershell', ['-NoProfile', '-Command',
    `& '${R('_work/run_bg.ps1')}' -Cmd '${path.join(SRV, '_start_fid.cmd').replace(/'/g, "''")}' -Log '${path.join(SRV, 'rt-gate.log').replace(/'/g, "''")}' -WorkDir '${SRV.replace(/'/g, "''")}'`], { encoding: 'utf8' });
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    const log = (() => { try { return fs.readFileSync(path.join(SRV, 'rt-gate.log'), 'utf8'); } catch { return ''; } })();
    if (/Done \(/.test(log)) { console.log('服务已就绪（' + (i * 2 + 2) + 's）'); return true; }
  }
  console.log('⚠ 服务 180s 内没就绪');
  return false;
};
const installPacks = (src) => {
  fs.mkdirSync(DP, { recursive: true });
  for (const p of PACKS) {
    const s = p === 'doom.nats' ? src : path.join(R('_work/mcserver-fid/world/datapacks'), p);
    if (!fs.existsSync(s)) { console.log('  （跳过不存在的包 ' + p + '）'); continue; }
    fs.rmSync(path.join(DP, p), { recursive: true, force: true });
    fs.cpSync(s, path.join(DP, p), { recursive: true });
  }
};
const setProp = (key, val) => {
  let s = fs.readFileSync(PROPS, 'utf8');
  if (new RegExp('^' + key + '=', 'm').test(s)) s = s.replace(new RegExp('^' + key + '=.*$', 'm'), key + '=' + val);
  else s = s.trimEnd() + '\n' + key + '=' + val + '\n';
  fs.writeFileSync(PROPS, s);
  console.log('server.properties: ' + key + '=' + val);
};

const phase = process.argv[2] || '--phase1';

if (phase === '--restore') {
  await stopServer();
  if (fs.existsSync(KEEP)) { fs.rmSync(WORLD, { recursive: true, force: true }); fs.renameSync(KEEP, WORLD); console.log('已还原原世界'); }
  setProp('initial-enabled-packs', 'vanilla');
  installPacks(path.resolve(R('_work/mcserver-fid/../..'), 'v4', 'doom.nats'));
  await startServer();
  console.log('phase restore 完成（原世界 + 默认变体 v4）');
  process.exit(0);
}

await stopServer();
// 保存原世界 + 造一个全新世界
if (phase === '--phase1') {
  if (!fs.existsSync(KEEP)) { fs.renameSync(WORLD, KEEP); console.log('原世界已另存为 world-keep-rt'); }
  fs.rmSync(WORLD, { recursive: true, force: true });
  setProp('initial-enabled-packs', 'vanilla');
} else {
  fs.rmSync(WORLD, { recursive: true, force: true });
  setProp('initial-enabled-packs', 'vanilla,minecart_improvements');
}
installPacks(path.resolve(R('_work/mcserver-fid/../..'), phase === '--phase1' ? path.join('v4x', 'doom.nats') : path.join('v4x', 'doom.nats')));
await startServer();

const { openRcon } = await import('../doom.nats/tools/mcrcon.mjs');
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
console.log('=== datapack list ===');
console.log((await cmd('datapack list')).slice(0, 900));
const usage = await cmd('function doom.nats:exp/usage');
console.log('function doom.nats:exp/usage ⇒ ' + usage.split('\n')[0]);
const list = await cmd('datapack list');
const enabled = /file\/doom\.nats/.test(list);
console.log('doom.nats 是否在 enabled 列表：' + enabled);
const log = (() => { try { return fs.readFileSync(path.join(SRV, 'rt-gate.log'), 'utf8'); } catch { return ''; } })();
const feat = log.split(/\r?\n/).filter((l) => /feature|Feature|flag|Incompatible|incompatible/i.test(l)).slice(0, 6);
console.log('=== 启动日志里的 features 相关 ===');
console.log(feat.join('\n') || '(无)');
r.close();
console.log('\nphase ' + phase + ' 结论：包在 enabled 列表=' + enabled + ' · exp/usage 可用=' + /Running function/.test(usage));
