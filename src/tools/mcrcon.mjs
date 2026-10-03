// tools/mcrcon.mjs —— 极简 RCON 客户端（无依赖，只用 node:net）
//
//   node tools/mcrcon.mjs "cmd1" "cmd2" …
//   环境变量 RCON_HOST / RCON_PORT / RCON_PASS 可覆盖（默认 127.0.0.1:25575 / nats）
//   注：默认密码 `nats` 只是本工具在 127.0.0.1 上自起的**本地测试服**占位值，不是任何真实凭据；
//      连你自己的服务器请用 RCON_PASS 覆盖。
//
// 协议：长度(4,LE) + 请求 id(4) + 类型(4) + 载荷 + 0x00 0x00
//   客户端→服务端：3=登录 2=命令；服务端→客户端：2=登录应答 0=命令应答
//
// 实现取向：**一条命令一次往返**（按请求 id 配对），不做流水线。
// 原因：Minecraft 对大输出会拆包，按「收到包就算一条命令完成」计数会错位（实测卡死）。
import net from 'node:net';

const HOST = process.env.RCON_HOST || '127.0.0.1';
const PORT = Number(process.env.RCON_PORT || 25575);
const PASS = process.env.RCON_PASS || 'nats';   // 本地测试服占位默认值（非真实凭据）

const enc = (id, type, body) => {
  const payload = Buffer.from(body, 'utf8');
  const pkt = Buffer.alloc(14 + payload.length);
  pkt.writeInt32LE(10 + payload.length, 0);
  pkt.writeInt32LE(id, 4);
  pkt.writeInt32LE(type, 8);
  payload.copy(pkt, 12);
  return pkt;
};

export function openRcon({ timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: HOST, port: PORT });
    let buf = Buffer.alloc(0);
    let id = 0;
    const waiters = new Map();          // rid -> {resolve, timer}
    const fail = (e) => { for (const w of waiters.values()) { clearTimeout(w.timer); w.reject(e); } waiters.clear(); };
    const pump = () => {
      while (buf.length >= 4) {
        const len = buf.readInt32LE(0);
        if (buf.length < 4 + len) return;
        const rid = buf.readInt32LE(4);
        const type = buf.readInt32LE(8);
        const body = buf.toString('utf8', 12, 4 + len - 2);
        buf = buf.subarray(4 + len);
        const w = waiters.get(rid);
        if (w) { clearTimeout(w.timer); waiters.delete(rid); w.resolve(body); }
      }
    };
    sock.on('data', (d) => { buf = Buffer.concat([buf, d]); pump(); });
    sock.on('error', (e) => { fail(e); reject(e); });
    sock.on('close', () => fail(new Error('连接已关闭')));
    sock.on('connect', () => {
      const loginId = ++id;
      const t = setTimeout(() => reject(new Error('rcon 登录超时')), timeout);
      waiters.set(loginId, {
        resolve: () => { clearTimeout(t); resolve({ send, close: () => sock.end() }); },
        reject: (e) => { clearTimeout(t); reject(e); },
        timer: t,
      });
      sock.write(enc(loginId, 3, PASS));
    });
    const send = (cmd, ms = timeout) => new Promise((res, rej) => {
      const rid = ++id;
      const timer = setTimeout(() => { waiters.delete(rid); rej(new Error('命令超时: ' + cmd)); }, ms);
      waiters.set(rid, { resolve: res, reject: rej, timer });
      sock.write(enc(rid, 2, cmd));
    });
  });
}

/** 跑一批命令：一条一次往返，出错不中断（收集错误文本） */
export async function rcon(cmds, opts = {}) {
  const c = await openRcon(opts);
  const out = [];
  for (const cmd of cmds) {
    try { out.push(await c.send(cmd)); }
    catch (e) { out.push('ERR: ' + e.message); }
  }
  c.close();
  return out;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('mcrcon.mjs');
if (isMain) {
  const cmds = process.argv.slice(2);
  if (!cmds.length) { console.error('用法: node tools/mcrcon.mjs "<命令>" …'); process.exit(2); }
  rcon(cmds).then((outs) => outs.forEach((o, i) => console.log('> ' + cmds[i] + '\n' + (String(o).trim() || '(无输出)'))))
    .catch((e) => { console.error('RCON 失败:', e.message); process.exit(1); });
}
