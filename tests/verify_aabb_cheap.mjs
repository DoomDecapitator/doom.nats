// _work/verify_aabb_cheap.mjs —— 真机验证 v4.17（P1-7）「AABB 便宜版」：
//   · 可站立（下方支撑）：#standable ∪ #full_collision（原版 isFaceSturdy(UP) ≡ 满立方）
//   · 可生成空位（本体/上方）：#spawnable_at（v4.17 移除了 fluid `water` 与有碰撞盒的 `snow`）
//   · 邻格 AABB：默认仍按 #spawnable_at 严格判定，但 #narrow_partial（栅栏/栅栏门/墙/铁栏杆/玻璃板/锁链/火把/灯笼/
//     花盆/蜡烛/按钮/拉杆…）放行 —— 宽体/高体生物的 AABB 只伸进邻格一条窄缝，几何上够不到这些"居中窄条"的碰撞盒。
//
//   node _work/verify_aabb_cheap.mjs            # 输出 verdict 表 + 写 _work/aabb-cheap.json
//   RCON_PORT=25581 node _work/verify_aabb_cheap.mjs
//
// 「前后对比」用法：改动前跑一次（存 aabb-cheap-before.json），改动后跑一次（after），第 3 个参数给 --diff <before> 即可打印差异。
import fs from 'node:fs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const set = (h, v) => cmd(`scoreboard players set ${h} doom.nats ${v}`);
const score = async (h) => { const t = await cmd('scoreboard players get ' + h + ' doom.nats'); const m = /has (-?\d+)/.exec(t); return m ? Number(m[1]) : NaN; };
const ATP = 'execute at @e[type=player,name=DoomBot,limit=1] run ';
const O = '~30 ~ ~';

console.log('=== AABB 便宜版 · 真机判定矩阵 ===');
// ① 守门：0 人也算"没人"。⚠ 服务器在 0 人时同样打印 `There are 0 of a max of 4 players online:`，
//   旧写法 `/There are/` 会放行 ⇒ `execute at @e[type=player,name=DoomBot,limit=1]` 全部空转、`$chk.ok` 保持初值 1
//   ⇒ **23 条全部"通过"**（门脚本 16:12 那轮假绿的成因）。这里必须要求 ≥1 人。
if (!/There are [1-9]/.test(await cmd('list'))) { console.log('❌ 没有玩家在线（本脚本需要一个真客户端；0 人时全部用例都会空转"通过"）'); process.exit(1); }

// 测试卫生：冻结快照 + 暂停刷怪。⚠ 必须在**每个场景前**重做：快照节拍（默认 20 tick）到点会把
//   $eff.period 写回 cfg 值 ⇒ 后台刷怪恢复 ⇒ $sel.* 被覆盖 ⇒ 判定结果随机漂移（本轮实测踩到：
//   A3/A4 无故变红、B2/B3 无故变绿）。所以每个场景都"冻结→写 sel→**回读断言**→再跑 check"。
const freeze = async () => { await set('$snap_period', 20000); await set('$eff.period', 100000); };
for (let i = 0; i < 4; i++) { await freeze(); await sleep(700); if ((await score('$eff.period')) >= 1000) break; }
console.log('刷怪冻结: $eff.period =', await score('$eff.period'), '（≥1000 = 已冻结；每个场景前会重新冻结+回读）');

// 场景脚手架：先把 ~30 格外的测试位清成"石头地板 + 空气"，再按场景摆件
const clear = () => cmd(ATP + `fill ~29 ~-1 ~-1 ~31 ~3 ~1 air`).then(() => cmd(ATP + `fill ~29 ~-1 ~-1 ~31 ~-1 ~1 minecraft:stone`));
// put 同时**记账**：每个场景结束后要逐条回读"这块方块真的在"（② 场景自证），否则本场判无效
let placed = [];
const put = (dx, dy, dz, block) => { placed.push({ dx, dy, dz, block }); return cmd(ATP + `setblock ~${30 + dx} ~${dy} ~${dz} ${block}`); };
const relOf = (n) => (n === 0 ? '~' : '~' + n);           // 0 ⇒ `~`；其余 ⇒ `~N` / `~-N`（~+N 非法）

const results = [];
const runScene = async (name, build, selFlags) => {
  const want = { place: 0, tag: 0, rule: 0, light: 0, grp1: 0, wide: 0, wide2: 0, tall: 0, ...selFlags };
  let selOK = false, sceneOK = false, sceneWhy = '';
  for (let attempt = 0; attempt < 4 && !(selOK && sceneOK); attempt++) {
    await freeze();
    placed = [];
    await clear();
    await build();
    // ② 场景自证 A：本场景摆放的每一处方块都必须真的在位（空转/未加载时 setblock 会静默失败）
    sceneOK = true; sceneWhy = '';
    for (const q of placed) {
      const pos = `${relOf(q.dx)} ${relOf(q.dy)} ${relOf(q.dz)}`;
      const t = await cmd(ATP + `execute positioned ${O} run execute if block ${pos} ${q.block}`);
      if (!/Test passed/.test(t)) { sceneOK = false; sceneWhy = `放置未生效：${q.block} @(${q.dx},${q.dy},${q.dz})`; break; }
    }
    // ② 场景自证 B：本体没被本场景占用 ⇒ 必须是空气（clear() 脚手架确实到位）
    if (sceneOK && !placed.some((q) => q.dx === 0 && q.dy === 0 && q.dz === 0)) {
      const t = await cmd(ATP + `execute positioned ${O} run execute if block ~ ~ ~ minecraft:air`);
      if (!/Test passed/.test(t)) { sceneOK = false; sceneWhy = '本体不是空气（clear() 未生效）'; }
    }
    // ⚠ 坑（本轮踩到）：`$sel.place/$sel.tag/...` 是**计分板**（不是 storage 字段）—— 只 merge storage 不写分数，
    //   check/block 会拿上一次刷怪留下的值（实测读到 place=4/tag=12），判定就完全跑偏。
    for (const [k, v] of Object.entries(want)) await set('$sel.' + k, v);
    const got = {};
    for (const k of ['place', 'tag', 'wide', 'wide2', 'tall']) got[k] = await score('$sel.' + k);
    selOK = ['place', 'tag', 'wide', 'wide2', 'tall'].every((k) => got[k] === want[k]);
    if (!selOK) { console.log('  ⚠ ' + name + '：sel 回读不符（' + JSON.stringify(got) + '）⇒ 重试'); await sleep(400); }
    if (!sceneOK) { console.log('  ⚠ ' + name + '：' + sceneWhy + ' ⇒ 重试'); await sleep(400); }
  }
  await set('$chk.ok', 1);
  await set('$chk.reason', 0);
  await cmd(ATP + `execute positioned ${O} run function doom.nats:check/block`);
  const ok = await score('$chk.ok');
  const reason = await score('$chk.reason');
  // 期望值从**用例名**里读（`⇒ xxx通过` / `⇒ xxx否决`，取最后一个 ⇒ 之后的文字）——门脚本解析器只认 `汇总:` 行
  const tail = name.slice(name.lastIndexOf('⇒') + 1);
  const expect = /通过/.test(tail) ? 'pass' : /否决/.test(tail) ? 'reject' : null;
  const hit = !!selOK && !!sceneOK && (expect === 'pass' ? ok === 1 : expect === 'reject' ? ok === 0 : false);
  results.push({ name, pass: ok === 1, reason: ok === 1 ? 0 : reason, selOK, sceneOK, sceneWhy, expect, hit });
  console.log(`${ok === 1 ? '通过' : '否决(reason=' + reason + ')'}  ${name}${selOK ? '' : '   ⚠ sel 回读未通过（结果不可信）'}${sceneOK ? '' : '   ⚠ 场景自证失败：' + sceneWhy}${expect === null ? '   ⚠ 用例名没有 ⇒通过/⇒否决 期望' : ''}`);
};

// ---- A. 可站立（下方方块；place 0）----
await runScene('A1 下方 = 石头（满碰撞）⇒ 通过', async () => { await put(0, -1, 0, 'minecraft:stone'); }, {});
await runScene('A2 下方 = 玻璃（满碰撞，旧白名单漏收）⇒ v4.17 起通过', async () => { await put(0, -1, 0, 'minecraft:glass'); }, {});
await runScene('A3 下方 = 下界岩（满碰撞）⇒ 通过', async () => { await put(0, -1, 0, 'minecraft:netherrack'); }, {});
await runScene('A4 下方 = 铁块（满碰撞）⇒ 通过', async () => { await put(0, -1, 0, 'minecraft:iron_block'); }, {});
await runScene('A5 下方 = 下半砖（UP 面不满格）⇒ 否决', async () => { await put(0, -1, 0, 'minecraft:oak_slab[type=bottom]'); }, {});
await runScene('A6 下方 = 栅栏（UP 面不满格）⇒ 否决', async () => { await put(0, -1, 0, 'minecraft:oak_fence'); }, {});
await runScene('A7 下方 = 玻璃板（UP 面不满格）⇒ 否决', async () => { await put(0, -1, 0, 'minecraft:glass_pane'); }, {});
await runScene('A8 下方 = 雪层（UP 面不满格）⇒ 否决', async () => { await put(0, -1, 0, 'minecraft:snow[layers=1]'); }, {});

// ---- B. 可生成空位（本体/上方；place 0）----
await runScene('B1 本体 = 空气 ⇒ 通过', async () => {}, {});
await runScene('B2 本体 = 水（流体，原版 isValidEmptySpawnBlock 直接否决）⇒ 否决', async () => { await put(0, 0, 0, 'minecraft:water'); }, {});
await runScene('B3 本体 = 雪层（有碰撞盒 2/16）⇒ 否决', async () => { await put(0, 0, 0, 'minecraft:snow[layers=1]'); }, {});
await runScene('B4 本体 = 火把（无碰撞盒）⇒ 否决（白名单外，保持原行为）', async () => { await put(0, 0, 0, 'minecraft:torch'); }, {});

// ---- C. 邻格 AABB（宽体：$sel.wide=1；本体/下方正常）----
await runScene('C1 wide：邻格栅栏 ⇒ v4.17 起通过（原版几何够不到）', async () => { await put(1, 0, 0, 'minecraft:oak_fence'); }, { wide: 1 });
await runScene('C2 wide：邻格玻璃板 ⇒ v4.17 起通过', async () => { await put(1, 0, 0, 'minecraft:glass_pane'); }, { wide: 1 });
await runScene('C3 wide：邻格铁栏杆 ⇒ v4.17 起通过', async () => { await put(1, 0, 0, 'minecraft:iron_bars'); }, { wide: 1 });
await runScene('C4 wide：邻格墙（cobblestone_wall）⇒ v4.17 起通过', async () => { await put(-1, 0, 0, 'minecraft:cobblestone_wall'); }, { wide: 1 });
await runScene('C5 wide：邻格火把 ⇒ v4.17 起通过', async () => { await put(0, 0, 1, 'minecraft:torch'); }, { wide: 1 });
await runScene('C6 wide：邻格下半砖（占满 1×1 ⇒ 边条会撞上）⇒ 仍否决', async () => { await put(1, 0, 0, 'minecraft:oak_slab[type=bottom]'); }, { wide: 1 });
await runScene('C7 wide：邻格石头（满碰撞）⇒ 仍否决', async () => { await put(1, 0, 0, 'minecraft:stone'); }, { wide: 1 });
await runScene('C8 wide：邻格树叶（完整碰撞立方，白名单外）⇒ 否决', async () => { await put(1, 0, 0, 'minecraft:oak_leaves'); }, { wide: 1 });

// ---- D. 第三格 AABB（高体：$sel.tall=1）----
await runScene('D1 tall：第三格栅栏（本列）⇒ 否决（本列任何非空位都挡头）', async () => { await put(0, 2, 0, 'minecraft:oak_fence'); }, { tall: 1 });
await runScene('D2 tall：第三格石头 ⇒ 否决', async () => { await put(0, 2, 0, 'minecraft:stone'); }, { tall: 1 });
await runScene('D3 tall：第三格玻璃板（本列）⇒ 否决（非空位）', async () => { await put(0, 2, 0, 'minecraft:glass_pane'); }, { tall: 1 });

await clear();
// v4.18：收尾**解冻**（以前只冻不解 ⇒ 下一个脚本/下一个门的前置全被冻住）。
//   后果实测：verify_animals 在四道门 ③ 里红（$cap.creature 停在冻结那一刻的 0 ⇒ 40 次尝试全 reason=5），
//   而单独跑/在 regress 里绿。恢复办法：$snap_period 置 0（core/tick 会写回默认 20），再等一拍让 circ/apply 写回 $eff.period。
await set('$snap_period', 0);
for (let i = 0; i < 20; i++) { await sleep(300); if ((await score('$eff.period')) < 1000) break; }
console.log('收尾已解冻：$snap_period=' + (await score('$snap_period')) + ' · $eff.period=' + (await score('$eff.period')));
const pass = results.filter((x) => x.pass).length;
console.log('\n=== 判定矩阵: ' + pass + ' 通过 / ' + (results.length - pass) + ' 否决 ===');
const out = { at: new Date().toISOString(), effPeriod: await score('$eff.period'), results };
const file = process.argv.includes('--before') ? '_work/aabb-cheap-before.json' : '_work/aabb-cheap.json';
fs.writeFileSync('C:/Users/Dell/Downloads/datapack/' + file, JSON.stringify(out, null, 2));
console.log('写入 ' + file);

// ---- 可选：与基线对比 ----
const di = process.argv.indexOf('--diff');
if (di !== -1 && process.argv[di + 1]) {
  const before = JSON.parse(fs.readFileSync(process.argv[di + 1], 'utf8'));
  const map = new Map(before.results.map((x) => [x.name, x.pass]));
  console.log('\n=== 前后对比（基线 ' + before.at + '）===');
  for (const x of results) {
    const was = map.get(x.name);
    if (was === undefined) { console.log('  ✚ 新增场景 ' + x.name); continue; }
    if (was !== x.pass) console.log('  🔄 ' + x.name + ' : ' + (was ? '通过' : '否决') + ' → ' + (x.pass ? '通过' : '否决'));
  }
}

// ---- 标准汇总（门脚本解析器只认这一行）：PASS = 用例结果与期望吻合（⇒通过 的确实通过、⇒否决 的确实否决）----
// ③ 整场有效性：本矩阵里**必须有**被否决的用例（13 条期望否决 ⇒ `$chk.reason` 至少要出现一次 4）。
//    若一次否决都没有 ⇒ 说明 `check/block` 根本没跑到（无人空转/未加载/未 reload）⇒ **整场判无效**，
//    而不是"全通过"（门脚本曾据此被假绿误导）。
const rejected = results.filter((x) => !x.pass).length;
const reason4 = results.filter((x) => x.reason === 4).length;
let good = results.filter((x) => x.hit).length;
let bad = results.length - good;
if (rejected === 0 || reason4 === 0) {
  console.log('\n⚠ 整场判无效：否决数=' + rejected + '、观测到 reason=4 的次数=' + reason4
    + ' ⇒ `check/block` 没有真正生效（场上没人 / 未加载 / 未 reload）——13 条"期望否决"的用例全"通过"就是这种假绿。');
  good = 0; bad = results.length;
}
for (const x of results.filter((y) => !y.hit)) console.log('  ❌ ' + x.name + ' ⇒ 实测 ' + (x.pass ? '通过' : '否决(reason=' + x.reason + ')') + '，期望 ' + (x.expect || '?') + (x.selOK ? '' : '（sel 回读未通过）') + (x.sceneOK ? '' : '（场景自证失败）'));
console.log('\n汇总: ' + good + ' PASS / ' + bad + ' FAIL');
r.close?.();
process.exit(bad ? 1 : 0);
