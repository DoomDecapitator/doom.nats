// tools/lint_spyglass.mjs —— 把用户已装的 Spyglass（spgoding.datapack-language-server）**当 CLI 用**：
//   直接拉起扩展自带的 dist/server.js（LSP over stdio），把整包文件 didOpen 一遍，收集 publishDiagnostics。
//   用法：
//     node tools/lint_spyglass.mjs [--root <目录>] [--vscode] [--wait 5000]
//   退出码：有 error 级诊断 ⇒ 1（可直接当 CI/任务门槛）
//
// 为什么这么做：VS Code 里的红波浪线来自这个语言服务器；把它 headless 跑起来，
// 就能把"编辑器诊断"变成可自动化的证据（无需人开编辑器、无需图床截图）。
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.resolve(import.meta.dirname, '..', '..', 'pack', 'doom.nats')));
const VSCODE_FMT = argv.includes('--vscode');
const WAIT = Number(arg('--wait', '6000'));

// ---------- 找扩展自带的 server.js
const EXT_HOME = path.join(process.env.USERPROFILE || '', '.vscode', 'extensions');
const cands = (fs.existsSync(EXT_HOME) ? fs.readdirSync(EXT_HOME) : [])
  .filter((d) => d.startsWith('spgoding.datapack-language-server'))
  .map((d) => path.join(EXT_HOME, d, 'dist', 'server.js'))
  .filter((p) => fs.existsSync(p));
if (!cands.length) { console.log('未找到 Spyglass 扩展（spgoding.datapack-language-server）⇒ 跳过'); process.exit(0); }
const SERVER = cands.sort().pop();

// ---------- 收集待检查文件
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'reports' || e.name === '.git') continue; walk(p); }
    else if (/\.(mcfunction|json|mcmeta)$/.test(e.name)) files.push(p);
  }
};
walk(ROOT);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// ---------- LSP over stdio
const srv = spawn(process.execPath, [SERVER, '--stdio'], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
let buf = Buffer.alloc(0);
const diags = new Map();
let nextId = 1;
const send = (msg) => {
  const body = Buffer.from(JSON.stringify(msg), 'utf8');
  srv.stdin.write('Content-Length: ' + body.length + '\r\n\r\n');
  srv.stdin.write(body);
};
const respond = (id, result) => send({ jsonrpc: '2.0', id, result });
srv.stdout.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  for (;;) {
    const sep = buf.indexOf('\r\n\r\n');
    if (sep < 0) return;
    const head = buf.subarray(0, sep).toString('utf8');
    const m = /Content-Length: (\d+)/i.exec(head);
    if (!m) { buf = buf.subarray(sep + 4); continue; }
    const len = Number(m[1]);
    if (buf.length < sep + 4 + len) return;
    const msg = JSON.parse(buf.subarray(sep + 4, sep + 4 + len).toString('utf8'));
    buf = buf.subarray(sep + 4 + len);
    if (msg.method === 'textDocument/publishDiagnostics') {
      const p = decodeURIComponent(String(msg.params.uri).replace(/^file:\/\//, ''));
      diags.set(p, msg.params.diagnostics || []);
    } else if (msg.method === 'workspace/configuration') {
      respond(msg.id, (msg.params.items || []).map(() => ({})));
    } else if (msg.method === 'workspace/workspaceFolders') {
      respond(msg.id, [{ uri: 'file:///' + ROOT.split(path.sep).join('/'), name: 'root' }]);
    } else if (msg.method && msg.id !== undefined) {
      respond(msg.id, null);   // 其它服务端请求一律给空应答，避免挂住
    }
  }
});
srv.stderr.on('data', (d) => { if (process.env.UI_SPY_DEBUG) process.stderr.write(d); });

send({ jsonrpc: '2.0', id: nextId++, method: 'initialize', params: {
  processId: null, rootUri: 'file:///' + ROOT.split(path.sep).join('/'), capabilities: {},
  workspaceFolders: [{ uri: 'file:///' + ROOT.split(path.sep).join('/'), name: 'root' }],
  initializationOptions: {},
} });
await new Promise((r) => setTimeout(r, 2500));
send({ jsonrpc: '2.0', method: 'initialized', params: {} });
for (const f of files) {
  send({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: {
    uri: 'file:///' + f.split(path.sep).join('/'),
    languageId: f.endsWith('.mcfunction') ? 'mcfunction' : (f.endsWith('.mcmeta') ? 'mcmeta' : 'json'),
    version: 1, text: fs.readFileSync(f, 'utf8'),
  } } });
}
await new Promise((r) => setTimeout(r, WAIT));

const SEV = { 1: 'error', 2: 'warning', 3: 'info', 4: 'hint' };
let errs = 0, warns = 0;
const lines = [];
for (const [file, ds] of [...diags.entries()].sort()) {
  for (const d of ds) {
    const s = SEV[d.severity] || 'info';
    if (s === 'error') errs++; else if (s === 'warning') warns++;
    const where = rel(file);
    const lineNo = (d.range?.start?.line ?? 0) + 1;
    const col = (d.range?.start?.character ?? 0) + 1;
    const msg = String(d.message).replace(/\s+/g, ' ').slice(0, 200);
    lines.push(VSCODE_FMT ? where + ':' + lineNo + ':' + col + ': ' + s + ': [Spyglass] ' + msg
                          : (s === 'error' ? '❌ ' : '⚠️  ') + where + ':' + lineNo + ':' + col + ' ' + msg);
  }
}
console.log('=== Spyglass（' + path.basename(SERVER, '.js') + ' @ ' + rel(SERVER).slice(0, 40) + '…）· ' + files.length + ' 文件 ===');
console.log(lines.length ? lines.join('\n') : '（无诊断）');
console.log('结论: ' + errs + ' error, ' + warns + ' warning');
srv.kill();
process.exit(errs ? 1 : 0);
