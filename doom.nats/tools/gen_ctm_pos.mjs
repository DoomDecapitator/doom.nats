// gen_ctm_pos.mjs — 生成 CTM 版 doom.nats 的「取点层」。
//
//   node tools/gen_ctm_pos.mjs [--check]
//
// 复刻原版 getRandomPosWithin 的语义：
//   原版在【已加载且合格的区块】里随机取 x/z，y 在 [minY, 地表+1] 区间均匀随机。
//   数据包没有"合格区块列表"，改为：随机抽候选区块 → 用 `execute if loaded` 问游戏 → 命中即用；
//   抽不到就放弃本次（与原版"该区块不参与刷怪"同义）。区块偏移只有运行期才知道，故用宏拼位置参数。
//
// 另外，CTM 地图的地形是作者自己设计的，所以 y 优先由**区域高度带**给出（比扫描更快更准），
// 未配置时退回保守默认值。
import fs from 'node:fs';
import path from 'node:path';
import * as PKG from './lib/packdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
// v4.24：产物根目录由 lib/packdir.mjs 统一解析（DOOM_EXP=1 ⇒ v4x/doom.nats 实验性变体）
const PACK = PKG.PACK;
const LF = String.fromCharCode(10);
const NS = 'doom.nats';
const F = {};

// ---- 选点入口：挑玩家 → 抽候选区块 ----
F['data/' + NS + '/function/pos/pick.mcfunction'] = `# ${NS}:pos/pick —— 选一个生成原点（复刻 getRandomPosWithin 的语义）
#
# v4.14h：这里只负责"挑玩家并进入玩家上下文"，真正的取点在 pos/pick_local（在玩家上下文里跑）。
#   为什么要拆：core/tick 的执行上下文在世界出生点（主世界），若在外层用绝对坐标 positioned，
#   玩家在下界/末地时候选点会落到主世界的同名坐标上（真机实测：reason=2 暴涨、下界 0 生成）。
scoreboard players set $pos.ok ${NS} 0
scoreboard players set $pos_tries ${NS} 8
execute as @a[gamemode=!spectator,sort=random,limit=1] at @s run function ${NS}:pos/ctx
execute as @a[gamemode=!spectator,sort=random,limit=1] at @s run function ${NS}:pos/pick_local
`;

F['data/' + NS + '/function/pos/pick_local.mcfunction'] = `# ${NS}:pos/pick_local —— 在当前执行位置（= 某个玩家）所在维度里取一个候选原点
#
# 约定：调用前必须已经 as/at 到玩家。结果写 storage ${NS}:pos = {x,y,z,ok:1b}。
function ${NS}:pos/pick_chunk
`;

// ---- 每次尝试的维度上下文（v4.14f）----
// 多玩家可能分布在**不同维度**：本包每次尝试只围绕一个玩家（pos/pick 随机选一个），
// 因此"这一拍该用哪个维度的参数"必须以**那个玩家**为准，而不是快照里 @a[limit=1] 碰巧选到的那个。
// 成本极低（3 + 13 条命令），所以放在每次尝试的入口。
F['data/' + NS + '/function/pos/ctx.mcfunction'] = `# ${NS}:pos/ctx —— 按执行位置的维度刷新本次尝试的上下文
# 由 pos/pick 在选中玩家（at @s）之后立刻调用
# v4.20：写 $att.dim（**只给尝试链用**）—— 不要再写 $snap.dim，那是快照层的，会在尝试中途被 circ/snapshot 覆盖
function ${NS}:circ/detect_dim_att
function ${NS}:check/sealevel
`;

// ---- 抽候选区块：随机 16 的倍数偏移（对应 ±8 区块）----
F['data/' + NS + '/function/pos/pick_chunk.mcfunction'] = `# ${NS}:pos/pick_chunk —— 抽一个候选区块（最多 8 次），偏移取 16 的倍数即"整区块"
scoreboard players remove $pos_tries ${NS} 1
execute store result score $cx ${NS} run random value -128..128
execute store result score $cz ${NS} run random value -128..128
scoreboard players operation $cx ${NS} /= #16 ${NS}
scoreboard players operation $cz ${NS} /= #16 ${NS}
scoreboard players operation $cx ${NS} *= #16 ${NS}
scoreboard players operation $cz ${NS} *= #16 ${NS}
execute store result storage ${NS}:pos_tmp cx int 1 run scoreboard players get $cx ${NS}
execute store result storage ${NS}:pos_tmp cz int 1 run scoreboard players get $cz ${NS}
function ${NS}:pos/try with storage ${NS}:pos_tmp
`;

// ---- 判定候选区块是否已加载（宏）----
F['data/' + NS + '/function/pos/try.mcfunction'] = `# ${NS}:pos/try [MACRO] —— 用 if loaded 判定候选区块；这是与原版"合格区块"对齐的关键一步
$execute if loaded ~$(cx) ~ ~$(cz) run function ${NS}:pos/hit
$execute unless loaded ~$(cx) ~ ~$(cz) if score $pos_tries ${NS} matches 1.. run function ${NS}:pos/pick_chunk
`;

// ---- 命中：区块内随机 x/z + 定 y ----
F['data/' + NS + '/function/pos/hit.mcfunction'] = `# ${NS}:pos/hit —— 命中区块后取区块内随机 x/z（0..15），再定 y
#
# 注意：坐标最终要被宏替换进 positioned，宏替换出的数字会被当成**绝对坐标**，
# 因此这里必须换算成世界坐标（玩家坐标 + 区块偏移 + 区块内偏移）。
execute store result score $ix ${NS} run random value 0..15
execute store result score $iz ${NS} run random value 0..15
# 原点 = 玩家绝对坐标 + 区块偏移 + 区块内偏移（绝对，供宏使用）
execute store result score $ox ${NS} run data get entity @s Pos[0] 1
execute store result score $oz ${NS} run data get entity @s Pos[2] 1
scoreboard players operation $px ${NS} = $ox ${NS}
scoreboard players operation $px ${NS} += $cx ${NS}
scoreboard players operation $px ${NS} += $ix ${NS}
scoreboard players operation $pz ${NS} = $oz ${NS}
scoreboard players operation $pz ${NS} += $cz ${NS}
scoreboard players operation $pz ${NS} += $iz ${NS}
# 取 y：把 px/pz 交给取 y 层（它需要**在候选点位置上**扫地面）
execute store result storage ${NS}:pt2 px int 1 run scoreboard players get $px ${NS}
execute store result storage ${NS}:pt2 pz int 1 run scoreboard players get $pz ${NS}
function ${NS}:pos/band_at with storage ${NS}:pt2
execute store result storage ${NS}:pos x int 1 run scoreboard players get $px ${NS}
execute store result storage ${NS}:pos z int 1 run scoreboard players get $pz ${NS}
execute store result storage ${NS}:pos y int 1 run scoreboard players get $py ${NS}
data modify storage ${NS}:pos ok set value 1b
# v4.2 修：$pos.ok 是 spawn/try 的闸门，之前只被置 0、从没置 1 ⇒ 整包永不生成（静默空转）。
scoreboard players set $pos.ok ${NS} 1
`;

// ---- 取 y（v4.4：默认自动找地面，不再要求作者声明高度带）----
F['data/' + NS + '/function/pos/band_at.mcfunction'] = `# ${NS}:pos/band_at [MACRO] —— 在候选点 (px,pz) 上取 y
#
# 用法：function ${NS}:pos/band_at with storage ${NS}:pt2  →  结果写 $py
$execute positioned \$(px) ~ \$(pz) run function ${NS}:pos/band
`;

// ---- 区域高度带（CTM 地图地形已知，作者声明）----
// ---- 取 y（v4.4：默认自动扫地面，不需要作者声明高度带）----
// 自动扫地面：在候选点从「玩家层 +2」往下到 -16，取第一处三层都合法的层。
// 展开成常量行（不用宏/递归），每层一条命令；命中即把 dy 记进 $band.dy（9999 = 未命中哨兵）。
const SCAN_TOP = 2, SCAN_BOTTOM = -16, SCAN_MISS = 9999;
const scanLines = [];
for (let dy = SCAN_TOP; dy >= SCAN_BOTTOM; dy--) {
  const d = String(dy);   // ⚠ 相对坐标只能是 ~N / ~-N；~+N 不合法（实测整函数加载失败）
  scanLines.push('execute if score $band.mode ' + NS + ' matches 0 if score $band.dy ' + NS + ' matches ' + SCAN_MISS
    + ' positioned ~ ~' + d + ' ~ if block ~ ~-1 ~ #' + NS + ':standable'
    + ' if block ~ ~ ~ #' + NS + ':spawnable_at if block ~ ~1 ~ #' + NS + ':spawnable_at'
    + ' run scoreboard players set $band.dy ' + NS + ' ' + dy);
}
scanLines.push('');
scanLines.push('# ---- v4.19 回退：扫不到地面时按原版"整列均匀"取 y（[floorY, 玩家层+2]）----');
scanLines.push('# 为什么需要：原版 y 在 [minY, 地表+1] 整列均匀随机，玩家在海面时整列都是候选 ⇒ 水下十几格照样出溺尸/鱼。');
scanLines.push('#   模式 0 只在「玩家层 +2 .. -16」里扫地面：玩家浮在**深水**上方时这一窗口内没有任何可站立方块');
scanLines.push('#   ⇒ 旧行为把 dy 落到 0（贴玩家层）⇒ 候选点被钉在水面那一层：');
scanLines.push('#     · 溺尸的 isDeepEnoughToSpawn（y < seaLevel-5）永远不过');
scanLines.push('#     · 水面窗口 place 3 要求上方也是水 ⇒ 也不成立');
scanLines.push('#   真机实测（深海列 (-4425,-7879)，锚点 y=62）：40/40 次取点全部 dy=0 落在 y=62，0/40 过溺尸深度门 ⇒ 深水零生成。');
scanLines.push('# 回退语义 = 原版那条均匀分布：y = random($band.floorY .. 玩家层+2)（玩家在水面时 ≈ [minY, 地表+1]）。');
scanLines.push('#   只在「模式 0 ∧ 扫不到 ∧ $band.fallback=1」时触发，扫得到地面的陆地图层完全不受影响；');
scanLines.push('#   回退点会有一部分落在石头/空气里被 check/block 拒掉 —— 与原版"抽了才知道"同构。');
scanLines.push('scoreboard players set $band.fb ' + NS + ' 0');
scanLines.push('execute if score $band.mode ' + NS + ' matches 0 if score $band.fallback ' + NS + ' matches 1 if score $band.dy ' + NS + ' matches ' + SCAN_MISS + ' run scoreboard players set $band.fb ' + NS + ' 1');
scanLines.push('execute if score $band.fb ' + NS + ' matches 1 run scoreboard players operation $band.yHi ' + NS + ' = $py ' + NS);
scanLines.push('execute if score $band.fb ' + NS + ' matches 1 run scoreboard players add $band.yHi ' + NS + ' 2');
scanLines.push('execute if score $band.fb ' + NS + ' matches 1 run scoreboard players operation $band.yLo ' + NS + ' = $chk.floorY ' + NS);
scanLines.push('# 退化区间保护（同 min==max 的坑：random value 5..3 会被拒，且 store result 失败会把目标写成 0）');
scanLines.push('execute if score $band.fb ' + NS + ' matches 1 if score $band.yHi ' + NS + ' <= $band.yLo ' + NS + ' run scoreboard players operation $band.yHi ' + NS + ' = $band.yLo ' + NS);
scanLines.push('execute if score $band.fb ' + NS + ' matches 1 if score $band.yHi ' + NS + ' <= $band.yLo ' + NS + ' run scoreboard players add $band.yHi ' + NS + ' 1');
scanLines.push('execute if score $band.fb ' + NS + ' matches 1 run execute store result storage ' + NS + ':band yLo int 1 run scoreboard players get $band.yLo ' + NS);
scanLines.push('execute if score $band.fb ' + NS + ' matches 1 run execute store result storage ' + NS + ':band yHi int 1 run scoreboard players get $band.yHi ' + NS);
scanLines.push('execute if score $band.fb ' + NS + ' matches 1 run function ' + NS + ':pos/band_fallback with storage ' + NS + ':band');
scanLines.push('# 回退关闭时的旧行为：未命中 ⇒ dy=0（贴玩家层；会不会被 check/block 拒掉与原版一样"抽了才知道"）');
scanLines.push('execute if score $band.dy ' + NS + ' matches ' + SCAN_MISS + ' run scoreboard players set $band.dy ' + NS + ' 0');
scanLines.push('execute if score $band.mode ' + NS + ' matches 0 run scoreboard players operation $py ' + NS + ' += $band.dy ' + NS);

F['data/' + NS + '/function/pos/band.mcfunction'] = `# ${NS}:pos/band —— 取生成点的 y（复刻 getRandomPosWithin 的 y 选择）
#
# 原版：y 在 [minY, 地表高度+1] 里**整列**均匀随机，绝大多数点落在石头/空气层里被 check/block 拒掉。
# 数据包读不到 heightmap，于是给三个模式（$band.mode）：
#   0（默认）**自动扫地面**：在候选点从「玩家层 +2」往下扫到 -16，取第一处
#              「下方可站 + 本体可生成 + 上方可生成」的层 ⇒ **不需要作者声明任何高度带**
#              v4.19 起：扫不到（= 浮在深水/空中，窗口里没有可站立层）时**回退**成原版式整列均匀
#              y = random(floorY .. 玩家层+2)（band.fallback=1，默认开）。原因见下面回退段的长注释。
#   1        固定带：y = random($band.yMin .. $band.yMax)（地图地形已知时更贴合作者意图）
#   2        跟随玩家 ± $band.jitter（natspawn 式的简易近似）
# 无论哪种模式，落位是否合法仍由 check/block 判定（reason=4），与原版一样"抽了才知道"。
# v4.14 模式 3：**均匀随机带** —— 最接近原版 getRandomPosWithin 的 uniform(minY, 地表+1)：
#   在 [yMin, yMax] 内均匀取 y，再由合法性链（空位 / 下方可站立 …）自然筛出洞穴与地表。
scoreboard players set $band.hit doom.nats 0
scoreboard players set $band.dy ${NS} 9999
# ⚠ 玩家高度只能从 Pos[1] 取：实体 NBT 里没有 Y 字段（写 data get entity @s Y 会失败并把 $py 落成 0，
#    进而整包 y=0 ⇒ 落位全灭。v4.3 真机实测踩到。）
execute store result score $py ${NS} run data get entity @s Pos[1]
execute store result storage ${NS}:band yMin int 1 run scoreboard players get $band.yMin ${NS}
execute store result storage ${NS}:band yMax int 1 run scoreboard players get $band.yMax ${NS}
execute store result storage ${NS}:band jitter int 1 run scoreboard players get $band.jitter ${NS}
# ① 固定带模式
execute if score $band.mode ${NS} matches 1 if score $band.yMin ${NS} >= $band.yMax ${NS} run scoreboard players operation $py ${NS} = $band.yMin ${NS}
execute if score $band.mode ${NS} matches 1 if score $band.yMin ${NS} < $band.yMax ${NS} run function ${NS}:pos/band_fixed with storage ${NS}:band
# ② 简易抖动模式
execute if score $band.mode ${NS} matches 2 if score $band.jitter ${NS} matches 1.. run function ${NS}:pos/band_jitter with storage ${NS}:band
# 模式 3：均匀随机带（min<max 保护同模式 1）
execute if score $band.mode ${NS} matches 3 if score $band.yMin ${NS} >= $band.yMax ${NS} run scoreboard players operation $py ${NS} = $band.yMin ${NS}
execute if score $band.mode ${NS} matches 3 if score $band.yMin ${NS} < $band.yMax ${NS} run function ${NS}:pos/band_uniform with storage ${NS}:band
# ⚠ 退化区间保护：random value 64..64（退化区间）会被游戏拒绝，而 execute store result 失败时会**把目标写成 0**
#    ⇒ $py=0 ⇒ 整包 y=0 ⇒ 落位全灭（v4.3 真机实测踩到的就是这个）。min==max 时直接取该值、jitter=0 时跳过。
${scanLines.join(LF)}
`;

F['data/' + NS + '/function/pos/band_fallback.mcfunction'] = `# ${NS}:pos/band_fallback [MACRO] —— 模式 0 扫不到地面时的回退取点：y = random(floorY .. 玩家层+2)
#
# v4.19：语义 ≈ 原版 getRandomPosWithin 的「y 在 [minY, 地表+1] 整列均匀随机」。
#   玩家在水面/地表时 [floorY, 玩家层+2] 与 [minY, 地表+1] 几乎重合；深处浮空时至少要覆盖下方整列，
#   否则深水里连一个水下候选点都抽不到（真机实测：深水 0 生成）。
# 触发条件见 pos/band（模式 0 ∧ 扫不到 ∧ \$band.fallback=1）；$band.dy 归 0 使后面的 += dy 成为空操作。
# 用法：function ${NS}:pos/band_fallback with storage ${NS}:band
\$execute store result score \$py ${NS} run random value \$(yLo)..\$(yHi)
scoreboard players set \$band.dy ${NS} 0
`;

F['data/' + NS + '/function/pos/band_uniform.mcfunction'] = `# ${NS}:pos/band_uniform [MACRO] —— 模式 3：在 [yMin, yMax] 内均匀取 y
# 用法：function ${NS}:pos/band_uniform with storage ${NS}:band
$execute store result score $py ${NS} run random value $(yMin)..$(yMax)
`;

F['data/' + NS + '/function/pos/band_jitter.mcfunction'] = `# ${NS}:pos/band_jitter [MACRO] —— 简单近似：y = 玩家层 + random(-$(jitter)..$(jitter))
#
# 用法：function ${NS}:pos/band_jitter with storage ${NS}:band
$execute store result score $dz ${NS} run random value -$(jitter)..$(jitter)
scoreboard players operation $py ${NS} += $dz ${NS}
`;

F['data/' + NS + '/function/pos/band_fixed.mcfunction'] = `# ${NS}:pos/band_fixed [MACRO] —— 固定带模式：y = random($(yMin)..$(yMax))
#
# 用法：function ${NS}:pos/band_fixed with storage ${NS}:band
$execute store result score $py ${NS} run random value $(yMin)..$(yMax)
`;


// ---- 写出 / 校验 ----
const checkOnly = process.argv.slice(2).includes('--check');
const drift = [];
for (const [rel, content] of Object.entries(F)) {
  const p = path.join(PACK, ...rel.split('/'));
  if (checkOnly) {
    const old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (old !== content) drift.push(rel);
    continue;
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
if (checkOnly) {
  if (drift.length) { console.log('与生成器不一致:'); for (const d of drift) console.log('  -', d); process.exit(1); }
  console.log('一致：' + Object.keys(F).length + ' 个文件');
} else {
  console.log('=== gen_ctm_pos 完成 ===');
  console.log('输出:', PACK);
  console.log('文件:', Object.keys(F).length, '|', Object.keys(F).map((k) => k.split('/').pop()).join(', '));
}
