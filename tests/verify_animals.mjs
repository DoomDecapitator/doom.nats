import { R, W } from './_root.mjs';   // 可移植路径解析（见 tests/README.md）
// _work/verify_animals.mjs —— 被动生物（creature）端到端验证 v3
//
//   node _work/verify_animals.mjs
//
// v2 的两个教训（都写进断言里，避免下次再踩）：
//   ① 试验台不能建在玩家脚下：原版 24 格玩家禁区会让每次尝试都 reason=1
//      ⇒ v3 把草台建在离玩家 30 格外（仍在加载区块内）。
//   ② 类别抽签在 dispatch 内部自己掷 $catid ⇒ 想验证"creature 门"，必须统计**多次抽签的分布**，
//      并先把 $snap_period 调大，免得快照把 $gt 重置掉。
import fs from 'node:fs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail: String(detail) }); console.log((pass ? '✅ ' : '❌ ') + name + '  ' + detail); };

const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const set = (h, v) => cmd(`scoreboard players set ${h} doom.nats ${v}`);
const score = async (h) => {
  const t = await cmd('scoreboard players get ' + h + ' doom.nats');
  const m = /has (-?\d+)/.exec(t);
  return m ? Number(m[1]) : NaN;
};
const player = async () => {
  const t = await cmd('data get entity @e[type=player,name=DoomBot,limit=1] Pos');
  const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(t);
  return m ? { x: Math.floor(+m[1]), y: Math.floor(+m[2]), z: Math.floor(+m[3]) } : null;
};

console.log('=== 被动生物端到端 · 真机验证 v3 ===');
// 直接刷新一次容量计数。
// ⚠ v4.21：**不要**再包 `execute at @e[type=player,name=DoomBot,limit=1] run ...` —— 机器人不在场时
//   这条 execute 会**静默失败**（"没有选中实体"），check/caps 根本不跑 ⇒ $cnt.* 停在旧值，
//   于是"$cnt.creature 与类别标签计数一致"变成假红（实测 5 PASS / 1 FAIL：$cnt.creature=1 而手动计数 15）。
//   check/caps 的计数全是 `execute in <维度> as @e[盒子]` 的，本身**与执行位置无关**，直接调用即可。
const table_caps = async (n = 1) => {
  for (let i = 0; i < n; i++) { await cmd('function doom.nats:check/caps'); await sleep(200); }
};
// ---- 测试卫生（v4.14e/2）：冻结快照 + 暂停刷怪（加固版）
// 为什么需要循环：改 $snap_period 的那一拍，$snap_phase 是按**旧**周期算的，可能刚好为 0 ⇒ 立刻跑一次快照，
//   快照里的 circ/apply 会把 $eff.period 重新写成 cfg 值（5）⇒ 刷怪循环恢复、把 $sel.* 覆盖掉（本轮实测踩到：
//   $sel.light 被写成 3 = 蝙蝠）。所以设置后要再确认一遍。
// ⚠ v4.18 追加前置：**冻结之前必须先让快照至少跑过一拍（带上当前玩家）**。
//   容量 $cap.<cat> = maxInstancesPerChunk × spawnableChunkCount / 289，而 spawnableChunkCount 来自**快照**；
//   快照一旦冻住就不会再刷新 ⇒ 若冻结那一刻玩家刚进场/区块还没算进来，$cap.creature 会**永久停在 0**，
//   于是 ③ 的 40 次尝试全被判 reason=5（全局容量已满，0>=0）。实测：四道门 ③ 里就是这样红的
//   （明细日志：`⚠ creature 额度始终未释放: $cnt.creature=0 / $cap.creature=0`），而手动单跑时快照已刷新过 ⇒ 绿。
const P = await player();
if (!P) { console.log('❌ 没有玩家在线'); process.exit(1); }
console.log('玩家位置', JSON.stringify(P));
{
  let capv = 0;
  for (let i = 0; i < 40; i++) {
    // 直接手跑一拍快照（忽略 $snap_period）——上一个脚本可能把节拍冻住了（verify_aabb_cheap 就只冻不解），
    //   那样 $cap.* 会一直停在冻结那一刻的值（玩家刚进场时算出来就是 0）。
    if (i % 4 === 0) await cmd('function doom.nats:circ/snapshot');
    await table_caps(1);
    capv = await score('$cap.creature');
    if (capv > 0) { console.log('前置：容量已就绪（快照含当前玩家） $cap.creature=' + capv + '（等了 ' + (i * 0.4).toFixed(1) + 's）'); break; }
    await sleep(200);
    if (i === 39) console.log('⚠ 前置：$cap.creature 始终为 0（快照没把玩家算进 spawnableChunkCount，后面的 ③ 必红）');
  }
}
const freezeTick = async () => {
  await set('$snap_period', 20000);
  await set('$eff.period', 100000);
};
for (let i = 0; i < 4; i++) {
  await freezeTick();
  await sleep(700);
  if ((await score('$eff.period')) >= 1000) break;
}

// v4.18 加固（前置卫生）：本脚本的 ③ 会**直接喂一次生成**，只要场上已有动物把 creature 额度占满，
//   40 次尝试就会全被 reason=5/6 挡掉 —— 而这是**测试前置**问题，不是包的问题。
// v4.22 强化三条（门内实测 5 PASS / 1 FAIL，`$cnt.creature=117 / $cap.creature=10`）：
//   ① 必须在**冻结之后**再清一次类别：冻结前清场，循环仍在往里塞新动物（实测等待期间 117 → 134）；
//   ② `check/caps` **直接调**：包 `execute at @e[type=player,name=DoomBot]` 时机器人不在场会静默不执行，
//      计数停在旧值（这正是它第一次报"额度始终未释放"的原因之一）；
//   ③ 只清 `#doom.nats:creature` 类别，并沿用全局安全过滤（命名/有主/持久/拴绳不动）—— 不再无差别清全图。
for (let i = 0; i < 4; i++) {
  await cmd('execute as @e[type=#doom.nats:creature] unless data entity @s CustomName unless data entity @s Owner unless data entity @s PersistenceRequired unless data entity @s Leash run kill @s');
  await sleep(600);
  await cmd('function doom.nats:check/caps');
  await sleep(200);
  const c = await score('$cnt.creature'), capv = await score('$cap.creature');
  if (c < capv) { console.log('前置：creature 额度已腾出 $cnt.creature=' + c + ' < $cap.creature=' + capv + '（第 ' + (i + 1) + ' 轮）'); break; }
  if (i === 3) console.log('⚠ 前置：清场后 creature 额度仍满 $cnt.creature=' + c + ' / $cap.creature=' + capv + '（后面的 ③ 大概率红，请先查这个）');
}

const detect = fs.readFileSync(R('v4/doom.nats/data/doom.nats/function/biome/detect.mcfunction'), 'utf8');
const biomeById = {};
for (const line of detect.split('\n')) {
  const m = /if biome ~ ~ ~ minecraft:([a-z_]+) run scoreboard players set \$snap\.biome doom\.nats (\d+)/.exec(line);
  if (m) biomeById[m[2]] = 'minecraft:' + m[1];
}
const here = biomeById[await score('$snap.biome')] || '(未收录)';
const rosters = JSON.parse(fs.readFileSync(R('doom.nats/_work/generated/biome-rosters.json'), 'utf8')).rosters;
console.log('当前群系: ' + here + ' | 类别: ' + (rosters[here] ? Object.keys(rosters[here].categories).join(',') : '(无)'));

// 试验台：离玩家 30 格（**必须 > 24**，否则原版玩家禁区直接否决）
const G = { x: P.x + 30, y: P.y, z: P.z };
await cmd(`fill ${G.x - 7} ${G.y - 1} ${G.z - 7} ${G.x + 8} ${G.y - 1} ${G.z + 8} minecraft:grass_block`);   // 不加 replace 过滤：整片强制成草地
await cmd(`fill ${G.x - 7} ${G.y} ${G.z - 7} ${G.x + 8} ${G.y + 3} ${G.z + 8} minecraft:air`);   // 上方的雪层也一并清掉
await cmd('gamerule doDaylightCycle false');
await cmd('time set noon');
await cmd('weather clear');
for (let i = 0; i < 20; i++) { if ((await score('$eff.period')) >= 1) break; await sleep(500); }
await sleep(800);
await set('$probe', 0);
await cmd(`execute positioned ${G.x} ${G.y} ${G.z} if block ~ ~-1 ~ #minecraft:animals_spawnable_on run scoreboard players set $probe doom.nats 1`);
ok('① 试验草台就位（离玩家 30 格 ⇒ 不在 24 格禁区内）', (await score('$probe')) === 1, '16×16 草地 @ (' + G.x + ',' + (G.y - 1) + ',' + G.z + ')');

// ---------- ② 类别门：$gt==0 / $gt!=0 两种情况下 "creature 被抽中" 的分布
{
  await set('$snap_period', 20000);          // 冻结快照，免得 $gt 被重置
  const target = 'minecraft:badlands';
  const idxScore = Number(Object.entries(biomeById).find(([, v]) => v === target)[0]);
  const catList = Object.keys(rosters[target].categories);
  const catIdx = catList.indexOf('creature');
  const sample = async (gt, n) => {
    await set('$snap.biome', idxScore);
    await set('$gt', gt);
    let creatureHits = 0;
    for (let i = 0; i < n; i++) {
      // 必须整块清掉：只重置 cat 会留下上一轮的 nbt（里面含 doom.nats.cat.creature 标签）⇒ 误判
      await cmd('data remove storage doom.nats:sel');
      await cmd('function doom.nats:mob/biome/' + target.replace('minecraft:', ''));
      const t = await cmd('data get storage doom.nats:sel cat');
      if (/"creature"/.test(t)) creatureHits++;
    }
    return creatureHits;
  };
  const N = 120;
  const hitsOff = await sample(7, N);     // $gt != 0 ⇒ creature 必须一次都不出现
  const hitsOn = await sample(0, N);      // $gt == 0 ⇒ 约 1/类别数
  // ⚠ 这里不要解冻：解冻后快照立刻把 $eff.period 写回 cfg 值 ⇒ 包的刷怪循环恢复、覆盖 $sel.*
  //   （本轮实测：③ 端到端 0 生成就是这个原因）⇒ 重新冻结一次再进 ③
  for (let i = 0; i < 4; i++) { await freezeTick(); await sleep(700); if ((await score('$eff.period')) >= 1000) break; }
  ok('② 类别门：$gt≠0 时 creature 从不进候选（原版 isPersistent）', hitsOff === 0, hitsOff + '/' + N + ' 次抽中');
  ok('② 类别门：$gt=0 时可正常抽中 creature', hitsOn > 0.5 * N / catList.length && hitsOn < 2 * N / catList.length, hitsOn + '/' + N + ' 次抽中（期望≈' + Math.round(N / catList.length) + '）');
}

// ---------- ③ 链路端到端：喂一只羊，跑 N 次 pick_one（离玩家 30 格，>24 禁区）
{
  // ⚠ v4.22：本段**直调** spawn/pick_one（不走 spawn/try_at）⇒ 没人刷新 $att.dim，
  //   而 check/cap 的 per-dim 取数读的正是它 ⇒ 上一个脚本若把它留在下界/末地，容量门就会拿**别的维度**的
  //   creature 计数去比（实测 regress 里 5/1：r5=69 r6=22，源头就是它）。这里显式刷新成本世界。
  await cmd('execute in minecraft:overworld run function doom.nats:circ/detect_dim_att');
  // 逐段自检（诊断用：失败时一眼看出是哪一步）
  const RULES_JSON = JSON.parse(fs.readFileSync(R('doom.nats/_work/generated/entity-rules.json'), 'utf8'));
  const sheepRuleId = RULES_JSON.byType['minecraft:sheep'];
  for (const [seg, fn] of [['distance', 'check/distance'], ['light', 'check/light'], ['block', 'check/block'], ['entity', 'check/entity']]) {
    await set('$chk.ok', 1); await set('$chk.reason', 0);
    await set('$sel.place', 4); await set('$sel.light', 2); await set('$sel.tag', 1); await set('$sel.rule', sheepRuleId);
    await set('$sel.wide', 0); await set('$sel.wide2', 0); await set('$sel.tall', 0);
    await cmd(`execute positioned ${G.x} ${G.y} ${G.z} run function doom.nats:${fn}`);
    console.log('   自检 ' + seg + ': ok=' + (await score('$chk.ok')) + ' reason=' + (await score('$chk.reason')));
  }
  // 清空**所有** creature 类别实体（不只是本包标签的）：v4.14d 起 mobcap 按类别标签统计，
  //   场上若已有一堆动物（前几轮测试留下的），额度就满了 ⇒ 新生成必然被 reason=5 挡掉。
  // v4.18 加固：原来只是 tp 到 y-500（等自然消失），长寿命测试世界里动物会攒到几十只 ⇒
  //   $cnt.creature 要好几拍才降下来，40 次尝试全被 reason=5 挡掉（实测红）。改成 kill + **轮询等计数真的降下来**。
  await cmd('execute as @e[type=#doom.nats:creature] unless data entity @s CustomName unless data entity @s Owner unless data entity @s PersistenceRequired unless data entity @s Leash run kill @s');
  await table_caps(2);
  for (let i = 0; i < 24; i++) {
    await cmd('execute at @e[type=player,name=DoomBot,limit=1] run function doom.nats:check/caps');
    const c = await score('$cnt.creature'), capv = await score('$cap.creature');
    if (c < capv) { console.log('   creature 额度已释放: $cnt.creature=' + c + ' < $cap.creature=' + capv + '（等了 ' + (i * 0.5).toFixed(1) + 's）'); break; }
    if (i === 23) console.log('   ⚠ creature 额度始终未释放: $cnt.creature=' + c + ' / $cap.creature=' + capv);
    await sleep(500);
  }

  const N = 40;
  const before = await score('$spawned.total');
  await cmd('data merge storage doom.nats:sel {type:"minecraft:sheep",slug:"sheep",cat:"creature",min:1,max:2,nbt:{Tags:["doom.nats.spawned","doom.nats.cat.creature"]}}');
  const sheepRule = JSON.parse(fs.readFileSync(R('doom.nats/_work/generated/entity-rules.json'), 'utf8')).byType['minecraft:sheep'];
  for (let i = 0; i < N; i++) {
    await set('$grp.sel', 1);       // 跳过群系抽签，直接用喂进去的物种
    await set('$grp.sized', 1);
    await set('$sel.rule', sheepRule);
    await set('$sel.place', 4);
    await set('$sel.light', 2);
    await set('$sel.tag', 1);
    await set('$sel.cluster', 4);
    // 尺寸标记也必须显式清零：AABB 检查会读它们，残留的 wide/tall（其它脚本留下的）会让这次尝试被判失败
    await set('$sel.wide', 0); await set('$sel.wide2', 0); await set('$sel.tall', 0);
    await set('$chk.ok', 1);
    await set('$att.stop', 0);
    await cmd(`execute positioned ${G.x} ${G.y} ${G.z} run function doom.nats:spawn/pick_one`);
  }
  await set('$sel.rule', sheepRule);
  await sleep(600);
  const aliveRaw = await cmd('execute if entity @e[type=#doom.nats:creature,limit=1000]');
  const aliveM = /count: (\d+)/.exec(aliveRaw);
  const alive = aliveM || null;
  const after = await score('$spawned.total');
  await table_caps(2);
  // v4.21：加"重试 + 现场打印"。$cnt.* 只在 check/caps 跑过之后才是当前值，而 check/caps 之前若被
  //   冻结/静默失败挡住，读到的就是旧值 ⇒ 这条断言最容易变成"活体世界里计数是移动靶"的假红。
  let cnt = await score('$cnt.creature');
  // ⚠ v4.22k：手动计数必须带**全图盒** —— 不带体积约束的 @e 会跨维度选实体（包自己的 check/caps 也为此加了盒子），
  //   否则会把下界/末地的同类算进来（实测 40 vs 43 ⇒ 差 3 被判 FAIL）。
  const manualRaw = await cmd('execute if entity @e[type=#doom.nats:creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=1000]');
  const manualM3 = /count: (\d+)/.exec(manualRaw);
  let manual = manualM3 ? Number(manualM3[1]) : 0;
  let tries = 1;
  for (; tries < 4 && Math.abs(cnt - manual) > 2; tries++) {
    await table_caps(1);
    await sleep(300);
    cnt = await score('$cnt.creature');
    const r2 = await cmd('execute if entity @e[type=#doom.nats:creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=1000]');
    const m2 = /count: (\d+)/.exec(r2);
    manual = m2 ? Number(m2[1]) : 0;
  }
  ok('③ 端到端：喂入的羊被真的生成（修正前恒 0）', after - before > 0, '本次新增 ' + (after - before) + '（' + N + ' 次尝试；末次 reason=' + (await score('$chk.reason')) + ' ok=' + (await score('$chk.ok')) + '）');
  ok('③ 场上确有 creature 类别实体', !!alive && Number(alive[1]) > 0, '实体计数 ' + (alive ? alive[1] : '0'));
  ok('③ $cnt.creature 与类别标签计数一致（±2 容差：活体世界里计数是移动靶）', Math.abs(cnt - manual) <= 2,
    '$cnt.creature=' + cnt + ' / 手动 ' + manual + '（刷新 ' + tries + ' 次 · $cap.creature=' + (await score('$cap.creature')) + '）');
  const rej = [];
  for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9]) rej.push(i + '=' + (await score('$rej.' + i)));
  console.log('   归因: ' + rej.join(' '));
  await cmd('execute as @e[type=#doom.nats:creature] run tp @s ~ ~-500 ~');
}

// 收尾
await cmd('function doom.nats:cfg/apply');
await cmd('function doom.nats:circ/apply');
await cmd('function doom.nats:circ/snapshot');
await cmd(`fill ${G.x - 7} ${G.y - 1} ${G.z - 7} ${G.x + 8} ${G.y + 3} ${G.z + 8} minecraft:air replace minecraft:grass_block`);
await cmd('gamerule doDaylightCycle true');
// ---- 解冻
await set('$snap_period', 20);
await cmd('function doom.nats:cfg/apply');
await cmd('function doom.nats:circ/apply');
await cmd('function doom.nats:circ/snapshot');

r.close();

const fails = results.filter((x) => !x.pass).length;
console.log('');
console.log('汇总: ' + (results.length - fails) + ' PASS / ' + fails + ' FAIL');
fs.writeFileSync(W('_work/verify-animals.json'), JSON.stringify({ at: new Date().toISOString(), biome: here, results }, null, 2));
process.exit(fails ? 1 : 0);
