// _work/verify_struct_aabb.mjs —— 真机验证 v4.14b/c：AABB 近似（宽体/高体）与下界要塞结构优先
//
//   node _work/verify_struct_aabb.mjs
//
// 断言：
//   A. AABB 近似
//     A1 蜘蛛（width 1.4 ⇒ wide）在"相邻方块被堵"的格子里必须被否决
//     A2 同一格子对普通体型的僵尸不构成否决（原版只查脚/头/下方）
//     A3 蜘蛛在开阔平地必须通过
//     A4 末影人（height 2.9 ⇒ tall）在"第三格被堵"时必须被否决
//   B. 下界要塞结构优先
//     B1 locate 到要塞，并在其内部造一格下界砖地面 ⇒ $spawn.fortress=1，且抽到的物种属于要塞五选一
//     B2 要塞外的下界砖地面 ⇒ $spawn.fortress=0（走群系表）
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
// 读整个 storage 再正则抓 type（"data get <path>" 对字符串值的输出格式不稳定，踩过一次）
const selType = async () => {
  const t = await cmd('data get storage doom.nats:sel');
  const m = /type:\s*"([^"]+)"/.exec(t);
  return m ? m[1] : '(无)';
};
const RULES = JSON.parse(fs.readFileSync('C:/Users/Dell/Downloads/datapack/doom.nats/_work/generated/entity-rules.json', 'utf8'));

console.log('=== AABB 近似 + 下界要塞结构优先 · 真机验证 ===');
// ---- 测试卫生（v4.14e/2）：冻结快照 + 暂停刷怪（加固版）
// 为什么需要循环：改 $snap_period 的那一拍，$snap_phase 是按**旧**周期算的，可能刚好为 0 ⇒ 立刻跑一次快照，
//   快照里的 circ/apply 会把 $eff.period 重新写成 cfg 值（5）⇒ 刷怪循环恢复、把 $sel.* 覆盖掉（本轮实测踩到：
//   $sel.light 被写成 3 = 蝙蝠）。所以设置后要再确认一遍。
const freezeTick = async () => {
  await set('$snap_period', 20000);
  await set('$eff.period', 100000);
};
for (let i = 0; i < 4; i++) {
  await freezeTick();
  await sleep(700);
  if ((await score('$eff.period')) >= 1000) break;
}

const pt = await cmd('data get entity @e[type=player,name=DoomBot,limit=1] Pos');
const m = /\[(-?[\d.]+)d, (-?[\d.]+)d, (-?[\d.]+)d\]/.exec(pt);
if (!m) { console.log('❌ 没有玩家在线'); process.exit(1); }
const P = { x: Math.floor(+m[1]), y: Math.floor(+m[2]), z: Math.floor(+m[3]) };
console.log('玩家位置', JSON.stringify(P));

// ---------------- A. AABB ----------------
{
  const T = { x: P.x + 30, y: P.y, z: P.z };      // 24 格禁区外
  // 基础地形：草地下方 + 脚/头空气
  await cmd(`fill ${T.x - 1} ${T.y - 1} ${T.z - 1} ${T.x + 2} ${T.y - 1} ${T.z + 1} minecraft:grass_block`);
  await cmd(`fill ${T.x - 1} ${T.y} ${T.z - 1} ${T.x + 2} ${T.y + 3} ${T.z + 1} minecraft:air`);
  await sleep(500);
  await cmd('time set noon');

  // 等某个方块变成期望状态（真机里 setblock 与后续判定之间需要一点时间，第一版没等 ⇒ 假失败）
  const waitBlock = async (x, y, z, block, timeoutMs = 4000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const out = await cmd(`execute positioned ${x} ${y} ${z} if block ~ ~ ~ ${block} run scoreboard players set $probe doom.nats 1`);
      void out;
      if ((await score('$probe')) === 1) return true;
      await set('$probe', 0);
      await sleep(200);
    }
    return false;
  };
  const runBlockCheck = async (type, wide, tall, wide2 = 0) => {
    await set('$py', T.y);
    await set('$sel.place', RULES.rules.find((x) => x.id === RULES.byType[type]).place === 'below_tag' ? 4 : 0);
    await set('$sel.tag', 1);
    await set('$sel.wide', wide); await set('$sel.wide2', wide2); await set('$sel.tall', tall);
    await set('$chk.ok', 1); await set('$chk.reason', 0);
    await cmd(`execute positioned ${T.x} ${T.y} ${T.z} run function doom.nats:check/block`);
    return score('$chk.ok');
  };

  // A3 开阔地：蜘蛛应通过
  const spiderOpen = await runBlockCheck('minecraft:spider', 1, 0);
  ok('A3 蜘蛛在开阔平地通过', spiderOpen === 1, '$chk.ok=' + spiderOpen);

  // 堵住 +x 的邻格（脚层）
  await cmd(`setblock ${T.x + 1} ${T.y} ${T.z} minecraft:stone`);
  await sleep(200);
  const spiderBlocked = await runBlockCheck('minecraft:spider', 1, 0);
  const zombieBlocked = await runBlockCheck('minecraft:zombie', 0, 0);
  ok('A1 蜘蛛在"邻格被堵"时被否决（宽体 AABB）', spiderBlocked === 0, '$chk.ok=' + spiderBlocked);
  ok('A2 同格对僵尸不构成否决（普通体型只看脚/头/下方）', zombieBlocked === 1, '$chk.ok=' + zombieBlocked);
  await cmd(`setblock ${T.x + 1} ${T.y} ${T.z} minecraft:air`);

  // A4 末影人（高体）：堵住第三格
  await cmd(`setblock ${T.x} ${T.y + 2} ${T.z} minecraft:stone`);
  const okStone = await waitBlock(T.x, T.y + 2, T.z, 'minecraft:stone');
  const endermanBlocked = await runBlockCheck('minecraft:enderman', 0, 1);
  await cmd(`setblock ${T.x} ${T.y + 2} ${T.z} minecraft:air`);
  const okAir = await waitBlock(T.x, T.y + 2, T.z, 'minecraft:air');
  const endermanOpen = await runBlockCheck('minecraft:enderman', 0, 1);
  ok('A4 前置：第三格 stone→air 已生效', okStone && okAir, 'stone=' + okStone + ' air=' + okAir);
  ok('A4 末影人在"第三格被堵"时被否决（高体）', endermanBlocked === 0, '$chk.ok=' + endermanBlocked);
  ok('A4 末影人第三格清空后通过', endermanOpen === 1, '$chk.ok=' + endermanOpen);

  // 拆台
  await cmd(`fill ${T.x - 1} ${T.y - 1} ${T.z - 1} ${T.x + 2} ${T.y + 3} ${T.z + 1} minecraft:air replace minecraft:stone`);
  await cmd(`fill ${T.x - 1} ${T.y - 1} ${T.z - 1} ${T.x + 2} ${T.y + 3} ${T.z + 1} minecraft:air replace minecraft:grass_block`);
}

// ---------------- B. 要塞结构优先 ----------------
{
  const loc = await cmd('execute in minecraft:the_nether run locate structure minecraft:fortress');
  const lm = /at \[(-?\d+), (~|-?\d+), (-?\d+)\]/.exec(loc);
  if (!lm) { ok('B1 locate fortress', false, loc.slice(0, 120)); }
  else {
    const FX = Number(lm[1]), FZ = Number(lm[3]);
    await cmd(`execute in minecraft:the_nether run forceload add ${FX - 16} ${FZ - 16} ${FX + 16} ${FZ + 16}`);
    await sleep(2500);
    // 在要塞范围内**扫描**一个真正落在 fortress piece 内的点（第一版只在 locate 点上下试，全落在 piece 之外）
    let fy = null, fx = FX, fz = FZ, detail = '';
    outer:
    for (let dx = -24; dx <= 24; dx += 8) {
      for (let dz = -24; dz <= 24; dz += 8) {
        for (const y of [50, 64, 78, 92, 106]) {
          await set('$probe', 0);
          await cmd(`execute in minecraft:the_nether positioned ${FX + dx} ${y} ${FZ + dz} if predicate doom.nats:spawn/in_fortress run scoreboard players set $probe doom.nats 1`);
          if ((await score('$probe')) === 1) { fx = FX + dx; fz = FZ + dz; fy = y; break outer; }
        }
      }
    }
    if (fy === null) {
      ok('B1 要塞内找到可用测试点', false, 'locate=' + lm[0] + ' —— 结构判定在该点不成立（要塞 pieces 覆盖范围有限）');
    } else {
      detail = `fortress @ (${fx},${fy},${fz})`;
      // 造一个受控测试点：下界砖地面 + 空位
      await cmd(`execute in minecraft:the_nether run setblock ${fx} ${fy} ${fz} minecraft:nether_bricks`);
      await cmd(`execute in minecraft:the_nether run fill ${fx} ${fy + 1} ${fz} ${fx} ${fy + 2} ${fz} minecraft:air`);
      await cmd('scoreboard players set $snap.dim doom.nats 1');
      await set('$grp.sel', 0);
      await set('$chk.ok', 1);
      let picks = [];
      for (let i = 0; i < 30; i++) {
        await cmd('data remove storage doom.nats:sel');
        // $rng 必须每轮重掷：mob/fortress 只做 $rng %= #wsum，不会自己抽随机数（真实流程由 spawn/pick_one 之前的取点层掷）
        await cmd('execute store result score $rng doom.nats run random value 0..27');
        await cmd(`execute in minecraft:the_nether positioned ${fx} ${fy + 1} ${fz} run function doom.nats:mob/fortress`);
        picks.push(await selType());
      }
      const uniq = [...new Set(picks)].sort();
      const fortressSet = ['minecraft:blaze', 'minecraft:zombified_piglin', 'minecraft:wither_skeleton', 'minecraft:skeleton', 'minecraft:magma_cube'];
      ok('B1 要塞表只在五选一里抽（30 次）', uniq.every((x) => fortressSet.includes(x)) && uniq.length >= 3,
        uniq.map((x) => x.replace('minecraft:', '')).join(' '));
      // ---- v4.18（P1-6b）：要塞改用「monster 类别表的表头前置」，这里按**原版两条路径**重写断言 ----
      // 走类别通道（不是直接调 mob/fortress），才能真正验证"前置有没有挂对地方、有没有分对类别"
      const CH = (cat, x, y, z) => cmd(`execute in minecraft:the_nether positioned ${x} ${y} ${z} run function doom.nats:mob/biome/nether_wastes/${cat}`);
      const roll = async (cat, x, y, z, n = 30) => {
        const got = [];
        for (let i = 0; i < n; i++) {
          await cmd('data remove storage doom.nats:sel');
          await set('$grp.sel', 0);
          await set('$chk.ok', 1);
          await cmd('execute store result score $rng doom.nats run random value 0..167');
          await CH(cat, x, y, z);
          got.push(await selType());
        }
        return [...new Set(got)].sort();
      };
      const fortressOnly = ['minecraft:blaze', 'minecraft:wither_skeleton'];

      // B1a：要塞内 + 下界砖地面（原版路径①硬编码）
      const inBrick = await roll('monster', fx, fy + 1, fz);
      ok('B1a 要塞内(下界砖地面) ⇒ monster 通道出要塞表（原版硬编码那条）',
        inBrick.every((x) => fortressSet.includes(x)) && inBrick.length >= 3, inBrick.map((x) => x.replace('minecraft:', '')).join(' '));
      // B1b：要塞内 + 地面换成**非**下界砖（原版路径②JSON spawn_overrides / piece）—— 本次新增能力
      await cmd(`execute in minecraft:the_nether run setblock ${fx} ${fy} ${fz} minecraft:stone`);
      const inStone = await roll('monster', fx, fy + 1, fz);
      ok('B1b 要塞内(非下界砖地面) ⇒ 仍出要塞表（原版 JSON 覆盖那条，v4.18 新补齐）',
        inStone.every((x) => fortressSet.includes(x)) && inStone.length >= 3, inStone.map((x) => x.replace('minecraft:', '')).join(' '));
      await cmd(`execute in minecraft:the_nether run setblock ${fx} ${fy} ${fz} minecraft:nether_bricks`);
      // B1c：要塞内但走**非 monster** 类别通道 ⇒ 必须回群系表（修掉旧的"不分类别抢尝试"bug）
      const inCreature = await roll('creature', fx, fy + 1, fz);
      ok('B1c 要塞内 ⇒ 非 monster 类别走群系表（要塞 JSON 只覆盖 monster）',
        inCreature.every((x) => !fortressSet.includes(x)), inCreature.map((x) => x.replace('minecraft:', '')).join(' ') || '(空表)');
      ok('B1d 要塞表抽中过 blaze/wither_skeleton（要塞独占标记）',
        inBrick.some((x) => fortressOnly.includes(x)) || inStone.some((x) => fortressOnly.includes(x)),
        'brick=' + inBrick.length + ' 种 / stone=' + inStone.length + ' 种');
    }
    // B2 要塞外：随便找一处下界砖地面（远离要塞）⇒ monster 通道必须出群系表、不得出现要塞独占物种
    const OX = FX + 512, OZ = FZ + 512;
    await cmd(`execute in minecraft:the_nether run forceload add ${OX} ${OZ}`);
    await sleep(1500);
    await cmd(`execute in minecraft:the_nether run setblock ${OX} 70 ${OZ} minecraft:nether_bricks`);
    await cmd(`execute in minecraft:the_nether run fill ${OX} 71 ${OZ} ${OX} 73 ${OZ} minecraft:air`);
    await sleep(300);
    const outside = [];
    for (let i = 0; i < 30; i++) {
      await cmd('data remove storage doom.nats:sel');
      await set('$grp.sel', 0);
      await set('$chk.ok', 1);
      await cmd('execute store result score $rng doom.nats run random value 0..167');
      await cmd(`execute in minecraft:the_nether positioned ${OX} 71 ${OZ} run function doom.nats:mob/biome/nether_wastes/monster`);
      outside.push(await selType());
    }
    const outUniq = [...new Set(outside)].sort();
    const fortOnly = ['minecraft:blaze', 'minecraft:wither_skeleton'];   // 要塞表独占标记（群系表里不会出现）
    ok('B2 要塞外 ⇒ 群系表，且绝不出现要塞独占物种',
      outUniq.every((x) => !fortOnly.includes(x)) && outUniq.length >= 2, outUniq.map((x) => x.replace('minecraft:', '')).join(' '));
    await cmd(`execute in minecraft:the_nether run forceload remove ${OX} ${OZ}`);
    await cmd(`execute in minecraft:the_nether run forceload remove ${FX - 16} ${FZ - 16} ${FX + 16} ${FZ + 16}`);
  }
}

// ---- 解冻：恢复快照节拍并立刻重算一轮
await set('$snap_period', 20);
await cmd('function doom.nats:cfg/apply');
await cmd('function doom.nats:circ/apply');
await cmd('function doom.nats:circ/snapshot');

await cmd('function doom.nats:circ/detect_dim');
await cmd('function doom.nats:cfg/apply');
r.close();

const fails = results.filter((x) => !x.pass).length;
console.log('');
console.log('汇总: ' + (results.length - fails) + ' PASS / ' + fails + ' FAIL');
fs.writeFileSync('C:/Users/Dell/Downloads/datapack/_work/verify-struct-aabb.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(fails ? 1 : 0);
