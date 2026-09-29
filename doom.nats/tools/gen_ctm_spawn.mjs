// gen_ctm_spawn.mjs — 生成 CTM 版 doom.nats 的「生成端」：把取点 → 选物种 → 校验 → pack → 生成串起来。
//
//   node tools/gen_ctm_spawn.mjs [--check]
//
// 对齐源码（docs/09 第九节）：
//   spawnForChunk → spawnCategoryForChunk → spawnCategoryForPosition：
//     ① 每类别一次 pack 尝试，最多 3 组
//     ② 每组 count = Mth.ceil(random.nextFloat()*4)
//     ③ 组内逐只：x/z 各自累加 (nextInt(6) - nextInt(6))，**y 不变**
//     ④ 每只：距离检查 →（首次）按群系抽物种 → 合法性 → 生成
//     ⑤ 生成时朝向随机（原版 snapTo(..., random*360, 0)）
//
// 数据包的两个实现约束（已在 docs/11 记录）：
//   - 分数坐标必须经宏才能变成执行位置（`$execute positioned ${x} ${y} ${z}`）
//   - pack 的 y 不变，因此游走宏只用 ${x} 与 ${z}，y 用 `~` 保持
import fs from 'node:fs';
import path from 'node:path';
import * as PKG from './lib/packdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
// v4.24：产物根目录由 lib/packdir.mjs 统一解析（DOOM_EXP=1 ⇒ v4x/doom.nats 实验性变体）
const PACK = PKG.PACK;
const LF = String.fromCharCode(10);
const NS = 'doom.nats';
const F = {};

// ---------------------------------------------------------------- 入口
F['data/' + NS + '/function/spawn/try.mcfunction'] = `# ${NS}:spawn/try —— 一次完整尝试（对齐"每类别每区块一次 pack"的结构）
#
# 容量(caps)、情形(eval)、群系(detect) 都在 ${NS}:circ/snapshot 的节拍里刷新，这里只管生成本身。
scoreboard players add $dbg.tries ${NS} 1
# 本次尝试的簇计数与停止位（vanilla：spawned >= getMaxSpawnClusterSize() 时 return 整个尝试）
scoreboard players set $att.spawned ${NS} 0
scoreboard players set $att.stop ${NS} 0
# $spawned 是**累计**成功数：清零只发生在 debug/reject_report（每 try 清零会让测量失去意义）
# v4.14h：整次尝试都在**某个玩家的上下文**里跑（取点、定位、合法性、生成）
#   否则 core/tick 的世界出生点上下文会让绝对坐标落到主世界上（下界/末地 0 生成）。
execute as @a[gamemode=!spectator,sort=random,limit=1] at @s run function ${NS}:spawn/try_at
`;

// ---------------------------------------------------------------- 批量尝试（把「每区块每 tick」的量级拉近）
F['data/' + NS + '/function/spawn/try_at.mcfunction'] = `# ${NS}:spawn/try_at —— 在**玩家上下文**里跑完一次尝试（由 spawn/try 调用）
#
# 顺序与源码一致：取点（区块内随机 x/z + y）→ 跳到 pack 原点 → 三组尝试。
# ⚠ v4.20 关键修复（P0，跨维度泄漏）：**必须**先跑 pos/ctx 刷新"本次尝试的维度与海平面窗口"。
#   以前只有 debug 路径（pos/pick）会调 pos/ctx，生产路径（spawn/try → try_at）从不调 ⇒
#   $att.dim（修复前是 $snap.dim）一直停留在"快照那条路径"写下的维度（通常是主世界）⇒
#   末地/下界的尝试被拿**主世界的计数与容量、主世界的海平面窗口**判定：
#     实测：末地怪物堆到 500 只、快照 $cap.monster=40、$rej.5 恒为 0（容量门形同不存在）；
#     冻结节拍下直接戳 check/cap 却正确拒 r5 ⇒ 差异只可能来自"尝试链里维度没被刷新"。
#   代价：每次尝试多 2 条函数调用（detect_dim_att + check/sealevel），可忽略。
function ${NS}:pos/ctx
function ${NS}:pos/pick_local
execute if score $pos.ok ${NS} matches 1 run function ${NS}:spawn/at with storage ${NS}:pos
execute if score $pos.ok ${NS} matches 0 run function ${NS}:debug/reject {reason:0}
`;

F['data/' + NS + '/function/spawn/batch.mcfunction'] = `# ${NS}:spawn/batch —— 一拍内跑 $eff.batch 次完整尝试
#
# 原版对**每个合格区块每个 tick**都调用一次 spawnCategoryForChunk（本包一次尝试 ≈ 一个区块的一次 pack），
# 数据包做不到同量级：这里用批量把每拍的尝试数抬到 $eff.batch（默认 6），量级仍低于原版，
# 因此**单位时间的刷怪数会低于原版**——按设计如此，需要更高密度就调大 $eff.batch / 调小 $eff.period。
scoreboard players set $batch ${NS} 0
execute unless score $eff.batch ${NS} matches 1.. run scoreboard players set $eff.batch ${NS} 1
function ${NS}:spawn/batch_step
`;

F['data/' + NS + '/function/spawn/batch_step.mcfunction'] = `# ${NS}:spawn/batch_step —— 批量循环体
scoreboard players add $batch ${NS} 1
function ${NS}:spawn/try
execute if score $batch ${NS} < $eff.batch ${NS} run function ${NS}:spawn/batch_step
`;
// ---------------------------------------------------------------- 组大小重算（v4.10）
F['data/' + NS + '/function/spawn/regroup.mcfunction'] = `# ${NS}:spawn/regroup [MACRO] —— 按物种 min/max 重算组大小
# 用法：function ${NS}:spawn/regroup with storage ${NS}:sel
# ⚠ 退化区间保护：min==max 时不能写 random value N..N（会被拒且 store result 会把目标写成 0）
$execute store result score $cnt ${NS} run random value $(min)..$(max)
`;
// ---------------------------------------------------------------- 跳点到原点
F['data/' + NS + '/function/spawn/at.mcfunction'] = `# ${NS}:spawn/at [MACRO] —— 跳到 pack 原点（坐标由 pos/pick 给的世界坐标）
$execute positioned $(x) $(y) $(z) run function ${NS}:spawn/begin
`;

// ---------------------------------------------------------------- 3 组循环
F['data/' + NS + '/function/spawn/begin.mcfunction'] = `# ${NS}:spawn/begin —— 记下游走的世界坐标基准，开始三组
execute store result score $wx ${NS} run data get storage ${NS}:pos x
execute store result score $wz ${NS} run data get storage ${NS}:pos z
execute store result score $wx0 ${NS} run data get storage ${NS}:pos x
execute store result score $wz0 ${NS} run data get storage ${NS}:pos z
scoreboard players set $grp ${NS} 3
function ${NS}:spawn/group
`;

// v4.24：实验性变体多清一套实验性层的标记（默认变体没有那些函数，插进去会变成悬空引用）
const EXP_RESET = PKG.EXP
  ? 'scoreboard players set $exp.hit ' + NS + ' 0' + LF + 'scoreboard players set $exp.hook ' + NS + ' 0' + LF + 'scoreboard players set $exp.loaded ' + NS + ' 0'
  : '';
F['data/' + NS + '/function/spawn/group.mcfunction'] = `# ${NS}:spawn/group —— 一组：count = ceil(rand*4)（此处用 1..4 近似，0 的概率可忽略）
scoreboard players remove $grp ${NS} 1
# 每组从原点重新起算（源码：x/z 是组内局部变量）+ 本组物种只抽一次
scoreboard players operation $wx ${NS} = $wx0 ${NS}
scoreboard players operation $wz ${NS} = $wz0 ${NS}
scoreboard players set $grp.sel ${NS} 0
scoreboard players set $grp.sized ${NS} 0
scoreboard players set $grp.stop ${NS} 0
scoreboard players set $grp.inited ${NS} 0
# v4.24 运行时刻作者层：每组开始清一次"本条目的命中/钩子/补丁"标记
#   （条目命中是在**选物种**那一刻定的，整组沿用；所以只能在组边界清，不能每只清）
scoreboard players set $auth.hit ${NS} 0
scoreboard players set $auth.hook ${NS} 0
scoreboard players set $auth.loaded ${NS} 0
${EXP_RESET}
# v4.3：源码里 x/z 是**组内局部变量**，每组都从 pack 原点重新起算；跨组累加会让点位漂到 128 格外
execute store result score $cnt ${NS} run random value 1..4
function ${NS}:spawn/walk
execute if score $grp ${NS} matches 1.. if score $att.stop ${NS} matches 0 if score $grp.stop ${NS} matches 0 run function ${NS}:spawn/group
`;

// ---------------------------------------------------------------- 组内逐只游走
F['data/' + NS + '/function/spawn/walk.mcfunction'] = `# ${NS}:spawn/walk —— 组内逐只：累加偏移后跳到新点（y 不变，与源码一致）
# 组内累加：由 group 负责重置原点（v4.10 修：以前每只都重置 ⇒ 簇太紧，不像原版的随机游走）
scoreboard players remove $cnt ${NS} 1
# x += nextInt(6) - nextInt(6)   ≡ (0..5) - (0..5)
execute store result score $ax ${NS} run random value 0..5
execute store result score $bx ${NS} run random value 0..5
scoreboard players operation $ax ${NS} -= $bx ${NS}
scoreboard players operation $wx ${NS} += $ax ${NS}
# z += nextInt(6) - nextInt(6)
execute store result score $az ${NS} run random value 0..5
execute store result score $bz ${NS} run random value 0..5
scoreboard players operation $az ${NS} -= $bz ${NS}
scoreboard players operation $wz ${NS} += $az ${NS}
# 跳到新点（y 用 ~ 保持：pack 内 y 不变）
execute store result storage ${NS}:pt x int 1 run scoreboard players get $wx ${NS}
execute store result storage ${NS}:pt z int 1 run scoreboard players get $wz ${NS}
function ${NS}:spawn/point with storage ${NS}:pt
execute if score $cnt ${NS} matches 1.. if score $att.stop ${NS} matches 0 if score $grp.stop ${NS} matches 0 run function ${NS}:spawn/walk
`;

F['data/' + NS + '/function/spawn/point.mcfunction'] = `# ${NS}:spawn/point [MACRO] —— 跳到游走点（只改 x/z，y 保持在 pack 原点，对齐源码）
# —— 临时：所有候选点的距离分桶（判定 reason 2 占比是几何问题还是判定问题）
scoreboard players add $dbg.points ${NS} 1
$execute positioned $(x) ~ $(z) run function ${NS}:spawn/pick_one
`;

// ---------------------------------------------------------------- 单只：距离 → 选物种 → 校验 → 生成
F['data/' + NS + '/function/spawn/pick_one.mcfunction'] = `# ${NS}:spawn/pick_one —— 单只生成的全流程（顺序严格对齐源码）
#
# 源码顺序：距离检查 →（首次）getRandomSpawnMobAt 选物种 → isValidSpawnPostitionForType → 生成
scoreboard players set $chk.ok ${NS} 1
scoreboard players set $chk.reason ${NS} 0

# ① 24 格内有玩家则拒（distSq <= 576）
execute if entity @a[gamemode=!spectator,distance=..24] run function ${NS}:check/fail {reason:1}

# ② 选物种（写 ${NS}:sel，含 type/cat/min/max/nbt；未命中设 $sel.ok=0）
# 物种：**每组只抽一次**（源码在组内第一次通过距离检查时抽，之后整组沿用）
scoreboard players set $sel.ok ${NS} 0
# 结构优先（原版 NaturalSpawner.mobsAt）：按**类别**在群系表层面替换 —— 见 mob/biome/&lt;群系&gt;/&lt;类别&gt; 的表头前置
#   （v4.18 起要塞也走这条，不再在这里做"下界 ∧ 下界砖 ∧ 要塞内"的专用分支）
# v4.16：物种**每组只抽一次**，且原版是在"首个通过距离检查的候选点"用**那个点的群系**读物种表
#   （源码：getRandomSpawnMobAt(..., pos) -> chunkGenerator.getMobsAt(level.getBiome(pos), ...)）。
#   旧实现用快照里"玩家脚下"的 $snap.biome => 群系边界/远距离候选点会选错表；这里改成候选点探测。
#   if loaded 守卫：if biome 对**未加载区块**会把它抬到 BIOME 阶段（可能触发世界生成/卡顿）；
#   而原版 NaturalSpawner 只在已加载区块里走候选点 => 跳过未加载点既省成本又与原版同义。
execute if score $chk.ok ${NS} matches 1 if score $grp.sel ${NS} matches 0 if loaded ~ ~ ~ run function ${NS}:biome/detect_at
# v4.18（P1-6b，保真度修复）：要塞的**两条**路径都挪进 monster 类别表的结构前置（mob/biome/&lt;群系&gt;/monster），
#   这里不再有"要塞专用分支"。原因：原版 NaturalSpawner.mobsAt 是**按类别**调用的（cat==MONSTER 才走要塞硬编码表），
#   而旧实现在这一层按"下界 ∧ 下方下界砖 ∧ 要塞内"**不分类别**地抢走整次尝试 ⇒ 要塞内连 creature/ambient 的尝试
#   也被换成了 monster 表（多刷怪、少掉群系该有的物种）。挪进表里后条件天然带上"本次抽中的类别是 monster"，
#   同时顺带补上了要塞 JSON 覆盖那条（脚下不是下界砖时原版也会用要塞表）。
execute if score $chk.ok ${NS} matches 1 if score $grp.sel ${NS} matches 0 run function ${NS}:biome/dispatch
execute if score $chk.ok ${NS} matches 1 if score $grp.sel ${NS} matches 0 if score $sel.ok ${NS} matches 1 run scoreboard players set $grp.sel ${NS} 1
# v4.15 组数据层：本组首次抽中物种 ⇒ 初始化 SpawnGroupData（整组共享的婴儿决定/变体/效果）
execute if score $grp.sel ${NS} matches 1 if score $grp.inited ${NS} matches 0 if data storage ${NS}:sel slug run function ${NS}:grp/init with storage ${NS}:sel
execute if score $grp.sel ${NS} matches 1 run scoreboard players set $grp.inited ${NS} 1
# 抽不中物种 ⇒ 结束**本组**（源码：species.isEmpty() ⇒ break 组循环），并记一次 reason=8
execute if score $chk.ok ${NS} matches 1 if score $grp.sel ${NS} matches 0 run function ${NS}:debug/reject {reason:8}
execute if score $chk.ok ${NS} matches 1 if score $grp.sel ${NS} matches 0 run scoreboard players set $grp.stop ${NS} 1
execute if score $chk.ok ${NS} matches 1 if score $grp.sel ${NS} matches 0 run scoreboard players set $chk.ok ${NS} 0
# 抽中后按该物种 min/max 重算组大小（源码：groupSize = minCount + rand(1 + max - min)）
execute if score $grp.sel ${NS} matches 1 if score $grp.sized ${NS} matches 0 run execute store result score $sel.min ${NS} run data get storage ${NS}:sel min
execute if score $grp.sel ${NS} matches 1 if score $grp.sized ${NS} matches 0 run execute store result score $sel.max ${NS} run data get storage ${NS}:sel max
execute if score $chk.ok ${NS} matches 1 if score $grp.sel ${NS} matches 1 if score $grp.sized ${NS} matches 0 if score $sel.min ${NS} >= $sel.max ${NS} run scoreboard players operation $cnt ${NS} = $sel.min ${NS}
execute if score $chk.ok ${NS} matches 1 if score $grp.sel ${NS} matches 1 if score $grp.sized ${NS} matches 0 if score $sel.min ${NS} < $sel.max ${NS} run function ${NS}:spawn/regroup with storage ${NS}:sel
# 把该物种的 min/max 从 storage 取成计分板（退化区间守卫要用；每组只做一次）
execute if score $grp.sel ${NS} matches 1 run scoreboard players set $grp.sized ${NS} 1

# ③ 其余合法性（light / block / cap，cap 按 <cat> 取容量）
execute if score $chk.ok ${NS} matches 1 run function ${NS}:check/all

# ④ 生成（朝向随机，对齐 snapTo 的 random*360）
execute if score $chk.ok ${NS} matches 1 run function ${NS}:spawn/emit with storage ${NS}:sel

# ④b 热带鱼：Mob.isMaxGroupSizeReached 对"非群游变体"恒真 ⇒ 组内生成第一只后就 break（结束本组）
#    源码：TropicalFish.isMaxGroupSizeReached(size) = !this.isSchool；本包 summon 的是默认变体（非群游）⇒ 恒等价于生 1 只
execute if score $chk.ok ${NS} matches 1 if score $sel.grp1 ${NS} matches 1 run scoreboard players set $grp.stop ${NS} 1

# ⑤ 归因：成功计数 + 失败时把 reason 交给 debug 层
execute if score $chk.ok ${NS} matches 1 run scoreboard players add $spawned ${NS} 1
# 累积量：密度控制的测量源（$spawned 会被 reject_report 清零）
execute if score $chk.ok ${NS} matches 1 run scoreboard players add $spawned.total ${NS} 1
# 跨组簇上限：本次尝试已生成数达到该物种的 getMaxSpawnClusterSize() ⇒ 结束整个尝试（源码 return）
execute if score $chk.ok ${NS} matches 1 run scoreboard players add $att.spawned ${NS} 1
execute if score $chk.ok ${NS} matches 1 if score $att.spawned ${NS} > $dbg.clusterMax ${NS} run scoreboard players operation $dbg.clusterMax ${NS} = $att.spawned ${NS}
execute if score $chk.ok ${NS} matches 1 if score $att.spawned ${NS} >= $sel.cluster ${NS} run scoreboard players set $att.stop ${NS} 1
execute store result storage ${NS}:rej reason int 1 run scoreboard players get $chk.reason ${NS}
execute if score $chk.ok ${NS} matches 0 run function ${NS}:debug/reject with storage ${NS}:rej
`;

// ---------------------------------------------------------------- 生物节拍（v4.14 修正：必须用 gameTime）
// 原版源码：`if (level.getGameTime() % 400 == 0) spawnCategoryForChunk(CREATURE, ...)`。
// 早期版本错用了 `time query daytime`（= 一天内的时刻），在 doDaylightCycle=false 或 /time set 之后
// 会与 gameTime 脱钩 ⇒ 被动生物节拍卡死。这里改用 `time query gametime`。
F['data/' + NS + '/function/core/creature_tick.mcfunction'] = `# ${NS}:core/creature_tick —— 被动生物的 400 tick 节拍（原版 getGameTime() % 400）
execute store result score $gt ${NS} run time query gametime
scoreboard players operation $gt ${NS} %= $cfg.creature_gate ${NS}
`;

// ---------------------------------------------------------------- 归因输出（接 doom.log）
F['data/' + NS + '/function/debug/reject.mcfunction'] = `# ${NS}:debug/reject [MACRO] —— 生成失败归因（供 [nats.reject] 直方图）
#
# reason 编码（对齐 docs/11 的合法性链）：
#   0=抽不到合格区块 · 1=24 格内有玩家 · 2=出 128 格 · 3=光照 · 4=落位方块 · 5=容量已满 · 10=世界出生点 24 格内
$scoreboard players add $rej.$(reason) ${NS} 1
$execute if score $rej_log ${NS} matches 1 run tellraw @a [{"text":"[nats.reject] ","color":"dark_gray"},{"text":"reason=$(reason)","color":"red"}]
`;

// 直方图输出：先**打印数值**再清零（v4.1 修：旧版只打标签不打值，实测采不到任何数）
const T = (t, color) => ({ text: t, color });
const S = (n) => ({ score: { name: n, objective: NS } });
const REJ_N = 12;   // v4.17：+10（世界出生点 24 格内）；v4.20：+11（世界边界外）
const LIT_TIERS = [0, 3, 7, 8, 9, 11, 15];   // v4.13：补 8（掠夺者档）与 9（动物亮档）
const rejLine = 'tellraw @a ' + JSON.stringify([
  T('[nats.reject] ', 'dark_gray'), T('rej: ', 'gray'),
  ...[...Array(REJ_N).keys()].flatMap((i) => [T((i ? ' ' : '') + i + '=', 'gray'), S('$rej.' + i)]),
  T(' spawned=', 'gray'), S('$spawned'),
]);
const litLine = 'tellraw @a ' + JSON.stringify([
  T('[nats.light] ', 'dark_gray'), T('tier: ', 'gray'),
  ...LIT_TIERS.flatMap((t, i) => [T((i ? ' ' : '') + t + '=', 'gray'), S('$lit.' + t)]),
]);

// 控制台/日志通道：tellraw 只发给玩家，**专用服务器上没有真人时不会落日志** ⇒ 自动化采不到数。
// `say` 会进服务器日志，配合宏替换把数值展开成文本（collect.mjs 认同一批前缀）。
const sayPairs = [...Array(REJ_N).keys()].map((i) => i + '=$(r' + i + ')').join(' ');
const sayLitPairs = LIT_TIERS.map((t) => t + '=$(t' + t + ')').join(' ');
F['data/' + NS + '/function/debug/say_report.mcfunction'] = `# ${NS}:debug/say_report [MACRO] —— 把归因数字打到服务器日志（无人也能采）
#
# 用法：function ${NS}:debug/say_report with storage ${NS}:rep
$say [nats.reject] rej: ${sayPairs} spawned=$(spawned)
$say [nats.light] tier: ${sayLitPairs}
`;
const sayPrep = [
  '# —— 日志通道 ——',
  ...([...Array(REJ_N).keys()].map((i) =>
    `execute store result storage ${NS}:rep r${i} int 1 run scoreboard players get $rej.${i} ${NS}`)),
  ...LIT_TIERS.map((t) =>
    `execute store result storage ${NS}:rep t${t} int 1 run scoreboard players get $lit.${t} ${NS}`),
  `execute store result storage ${NS}:rep spawned int 1 run scoreboard players get $spawned ${NS}`,
  `function ${NS}:debug/say_report with storage ${NS}:rep`,
].join(LF);

F['data/' + NS + '/function/debug/reject_report.mcfunction'] = `# ${NS}:debug/reject_report —— 归因直方图：先把数值打进日志，再清零
#
# 输出（机器可读，collect.mjs 抽 [nats.reject] / [nats.light] 前缀）：
#   [nats.reject] rej: 0=<n> 1=<n> … 8=<n> spawned=<n>
#   [nats.light] tier: 0=<n> 3=<n> 7=<n> 11=<n> 15=<n>   ← 光照失败时命中的档位
# reason 编码（对齐 docs/11 的合法性链）：
#   0=抽不到合格区块 · 1=24 格内有玩家 · 2=出 128 格 · 3=光照档不足 · 4=落位方块不允许
#   5=全局容量已满 · 6=附近玩家本地容量全满 · 7=刷怪密度（spawn cost）超限 · 8=选不到物种 · 9=该生物自身的规则不满足
#   10=世界出生点 24 格内（v4.17：$cfg.spawn24=1 且作者声明了 spawnX/Y/Z 时才可能出现）
#   11=世界边界外（v4.20：$cfg.border_size>0 且候选点在声明边界外时才可能出现，见 check/border）
function doom.log:info {message:"${NS} 生成失败归因（自上次清零；打印后清零）"}
# 先把计数器建出来（add 0 不改变已有值）：从未出现过的分数在 tellraw 里会渲染成空字符串
scoreboard players add $spawned ${NS} 0
scoreboard players add $rej.0 ${NS} 0
scoreboard players add $rej.1 ${NS} 0
scoreboard players add $rej.2 ${NS} 0
scoreboard players add $rej.3 ${NS} 0
scoreboard players add $rej.4 ${NS} 0
scoreboard players add $rej.5 ${NS} 0
scoreboard players add $rej.6 ${NS} 0
scoreboard players add $rej.7 ${NS} 0
scoreboard players add $rej.8 ${NS} 0
scoreboard players add $rej.9 ${NS} 0
scoreboard players add $rej.10 ${NS} 0
scoreboard players add $rej.11 ${NS} 0
# ⚠ 已知偏差（v4.17 记录，未改）：$rej.8 / $rej.9 只 add 不 set ⇒ 这两个计数器**从不归零**，
#   快照行里它们是"世界生命期累计"。reason=10 按语义照常清零（见下）。
${LIT_TIERS.map((t) => 'scoreboard players add $lit.' + t + ' ' + NS + ' 0').join(LF)}
${sayPrep}
${rejLine}
${litLine}
scoreboard players set $spawned ${NS} 0
scoreboard players set $rej.0 ${NS} 0
scoreboard players set $rej.1 ${NS} 0
scoreboard players set $rej.2 ${NS} 0
scoreboard players set $rej.3 ${NS} 0
scoreboard players set $rej.4 ${NS} 0
scoreboard players set $rej.5 ${NS} 0
scoreboard players set $rej.6 ${NS} 0
scoreboard players set $rej.7 ${NS} 0
scoreboard players set $rej.10 ${NS} 0
scoreboard players set $rej.11 ${NS} 0
${LIT_TIERS.map((t) => 'scoreboard players set $lit.' + t + ' ' + NS + ' 0').join(LF)}
`;

// ---------------------------------------------------------------- 写出
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
  console.log('=== gen_ctm_spawn 完成 ===');
  console.log('输出:', PACK, '| 文件:', Object.keys(F).length);
  console.log('链路: pos/pick → spawn/at → begin → group(×3) → walk(×count) → point → pick_one → emit');
}
