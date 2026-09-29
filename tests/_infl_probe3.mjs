// _work/_infl_probe3.mjs —— in_fortress「抖动」的受控复现（隔离实例 fid · RCON 25581）
//
// 源码依据（1.21.6 反编译，LocationPredicate.java:49-53）：
//     BlockPos p = BlockPos.containing(x,y,z);
//     boolean loaded = level.isLoaded(p);
//     … if (!structures.isPresent() || loaded && structureManager().getStructureWithPieceAt(p, …).isValid())
//   ⇒ **区块未加载 ⇒ 结构谓词恒假**（biomes 同理）。所以"17% 抖动"应当是**加载态**的函数。
//
// ⚠ 本轮踩到的第二个坑：`forceload add <x> <z>` 收的是**方块坐标**（内部再折算区块），
//   我一开始按"区块坐标"传 -41/-44 ⇒ 实际加载了 chunk [-3,-3] ⇒ 要塞位置依旧未加载 ⇒ 0%。
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';
process.env.RCON_PORT = process.env.RCON_PORT || '25581';
const r = await openRcon({ timeout: 10000 });
const send = async (c) => String(await r.send(c).catch((e) => 'ERR ' + e.message)).trim();
const DIM = 'minecraft:the_nether';
const N = Number(process.env.N || 200);
const FX = -648, FY = 58, FZ = -696;      // 要塞部件内（取自 verify_fortress_e2e 日志）

const hitAt = async (x, y, z) => {
  await send('scoreboard players set $infl doom.nats 0');
  await send(`execute in ${DIM} positioned ${x} ${y} ${z} if predicate doom.nats:spawn/in_fortress run scoreboard players add $infl doom.nats 1`);
  const m = /has (-?\d+)/.exec(String(await send('scoreboard players get $infl doom.nats')));
  return m ? Number(m[1]) : -1;
};
const probeAt = async (x, y, z, n) => { let h = 0; for (let i = 0; i < n; i++) h += await hitAt(x, y, z); return { h, n, pct: +(h / n * 100).toFixed(1) }; };
const loaded = async (x, y, z) => !/not loaded/i.test(await send(`execute in ${DIM} positioned ${x} ${y} ${z} run data get block ~ ~ ~`));
const fl = async (cmd) => await send(`execute in ${DIM} run forceload ${cmd}`);
const log = (s) => console.log(s);

log('=== in_fortress 受控复现 · 要塞点 (' + FX + ' ' + FY + ' ' + FZ + ') · 每次 ' + N + ' 次求值 ===');
log(`前置：该点 loaded=${await loaded(FX, FY, FZ)} · 主世界 (0,64,0) 命中 ${(await probeAt(0, 64, 0, 5)).h}/5（应为 0）`);

await fl('remove all');
await new Promise((s) => setTimeout(s, 6000));
log(`A 不加载（无 forceload、无玩家）：loaded=${await loaded(FX, FY, FZ)} · 命中 ${JSON.stringify(await probeAt(FX, FY, FZ, N))}`);

await fl(`add ${FX} ${FZ} ${FX} ${FZ}`);          // ← 方块坐标
await new Promise((s) => setTimeout(s, 2500));
log(`B forceload 该点所在区块：loaded=${await loaded(FX, FY, FZ)} · 命中 ${JSON.stringify(await probeAt(FX, FY, FZ, N))}`);

await fl('remove all');
const xs = [0, 1, 2, 3, 4].map((i) => FX + i * 16);   // 5 个点，间隔 16 格 = 各占一个区块
await fl(`add ${xs[0]} ${FZ} ${xs[0]} ${FZ}`);        // 只加载最左那个
await new Promise((s) => setTimeout(s, 2500));
const per = []; let h = 0, n = 0;
for (const x of xs) {
  const ld = await loaded(x, FY, FZ);
  const rr = await probeAt(x, FY, FZ, 40);
  per.push(`x=${x} loaded=${ld} → ${rr.h}/${rr.n}`);
  h += rr.h; n += rr.n;
}
log(`C 只加载 5 个候选点里的 1 个：命中 ${h}/${n} = ${(h / n * 100).toFixed(1)}%`);
for (const p of per) log('     · ' + p);

await fl('remove all');
const flip = [];
for (let i = 0; i < 12; i++) { await new Promise((s) => setTimeout(s, 500)); flip.push(String(await hitAt(FX, FY, FZ))); }
log(`D 撤掉 forceload 后每 0.5s 采样（1=命中）：${flip.join('')}`);

await fl('remove all');
r.close();
process.exit(0);
