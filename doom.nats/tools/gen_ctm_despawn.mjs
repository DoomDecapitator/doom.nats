// gen_ctm_despawn.mjs — 生成 CTM 版 doom.nats 的「消失层」。
//
//   node tools/gen_ctm_despawn.mjs [--check]
//
// 对齐源码（研究员 A 报告 §3，公式原样）：
//   概率消失：noActionTime > 600 && random.nextInt(800) == 0 && d² > 32² && removeWhenFarAway(d²)
//   硬消失  ：d² > despawnDistance²（128²；WATER_AMBIENT 为 64²）
//   近玩家（d² < 32²）会把 noActionTime 清零；d² ≥ 32² 时不再清零
//
// v4.13 结论（源码确证）：**本层默认关闭（$despawn_dice = 0）**。
//   ServerLevel.tick 会对场景里每个实体调用 Entity.checkDespawn()（lambda$tick$2 → Entity.checkDespawn），
//   而 Mob.checkDespawn 对"非 persistenceRequired、非 requiresCustomPersistence"的生物执行：
//     ① d² > despawnDistance² 且 removeWhenFarAway ⇒ 立即 discard（逐字等于本层的硬消失）
//     ② noActionTime > 600 ∧ random.nextInt(800) == 0 ∧ d² > 32² ⇒ discard
//   本包召出的都是**普通生物**（没有 PersistenceRequired），所以原版这套消失逻辑本来就已经在跑。
//   我们额外再掷一次骰 ⇒ 消失比原版更快，属"多说一句"的失真；因此默认关掉，交给原版。
//
//   保留本层的原因：① 硬消失做成可调（地图作者可以改距离）；② 需要更激进的清理时可以打开；
//   ③ 与原作 recovered/doom.nats 的语义保持一致（那个包有自己的消失层）。
//   打开方式：scoreboard players set $despawn_dice doom.nats 40（每 $despawn_period tick 掷 1/40 ≈ 每 tick 1/800）
//
//   已知不可复刻：noActionTime 读不到 ⇒ 即使打开本层，也无法复刻"距玩家 32 格外满 600 tick 才开始"的前置条件。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACK = path.join(ROOT, '..', 'v4', 'doom.nats');
const LF = String.fromCharCode(10);
const NS = 'doom.nats';

const PERIOD = 20;                       // 遍历节拍
const BASE = 800;                        // 原版每 tick 的掷骰分母
const DICE = Math.max(1, Math.round(BASE / PERIOD));   // 放大后的分母
const F = {};

F['data/' + NS + '/function/despawn/setup.mcfunction'] = `# ${NS}:despawn/setup —— 消失层参数
#
# v4.13：$despawn_dice 默认 **0 = 关闭**。理由：本包召出的是普通生物，原版 Mob.checkDespawn()
# 本来就会对它们执行"128 格硬消失 + noActionTime>600 后每 tick 1/800 掷骰"，
# 我们再掷一次骰只会让消失比原版更快（失真）。想开就设成 ${DICE}（= 每 ${PERIOD} tick 掷 1/${DICE}，等效每 tick 1/800）。
scoreboard players set $despawn_period ${NS} ${PERIOD}
# v4.14：掷骰分母来自配置层（默认 0 = 关闭，交给原版 Mob.checkDespawn）
scoreboard players operation $despawn_dice ${NS} = $cfg.dice ${NS}
`;

F['data/' + NS + '/function/despawn/tick.mcfunction'] = `# ${NS}:despawn/tick —— 消失检查（由 core/tick 按 $despawn_period 调用）
#
# 只处理本包生成、且未标记为持久存在的实体（doom.nats.spawned 且非 doom.nats.persistent）。
# 硬消失：出 despawnDistance —— 128 格统一；WATER_AMBIENT 按原版是 64 格。
# v4.11：移除一律走 util/void_kill（discard 语义，无掉落）—— 原版消失不是"击杀"。
#
# ⚠ v4.17 修一个真机级静默 bug（verify_persist ① 就是它红的）：
#   **距离必须以玩家为准**。原版 Mob.checkDespawn() 是
#     Entity p = level.getNearestPlayer(this, -1.0); d² = p.distanceToSqr(this); d² > despawnDistance² ⇒ discard()
#   —— 参考点永远是**最近的玩家**。而数据包里的裸 @e[...,distance=N..] 的参考点是**函数执行位置**：
#   本函数由 core/tick 调用，执行位置 = minecraft:tick 的上下文 = **世界出生点**（实测本机 (-592,66,-272)）。
#   ⇒ 只要玩家离世界出生点 >128 格（正常玩法里几乎总是），本包生成的所有非持久生物都会在**一个消失节拍内**
#     被静默 void_kill（= "刷出来的怪立刻没了"）。修法：逐玩家判定 —— 生物只要在**任一**玩家 128 格内就跳过，
#     对**所有**玩家都超距才移除。语义与原版"最近玩家"等价（对每个玩家各判一次，取交集）。
#   注：无玩家在线时这里不做判定（原版此时也只对仍有票据的区块判定），保持"不冤枉"。
# ⚠⚠ v4.22 修**第二个同族 bug**（verify_multibot ②③ 一直在报的就是它）：
#   上一版写的是「as @a at @s as @e[..., distance=129..] run void_kill」—— 那是"对**每个**玩家各判一次、
#   超距就杀"，等价于"只要存在**某个**玩家离它 >128 就杀"；而原版要的是"**最近**玩家 >128 才杀"。
#   实证（3 人：用户 + 两个测试机器人，机器人相距 460 格）：机器人身边的生成物对另一名玩家而言 >128
#   ⇒ 被逐个杀掉。75 秒窗口实测 $spawned.total +692、场上只剩 0-9 只，A/B 两处 128 格内均为 0
#   ⇒ 表现就是"**多玩家时刷出来的怪立刻没**"（正是 verify_multibot ②③ 的红）。
#   修法：**标记-清扫**（两遍）——
#     ① 清掉本包生成物身上的 near 标记 ② 任一玩家 128 格内（WATER_AMBIENT 按原版 64 格内）打 near 标记
#     ③ 只有**没有任何** near 标记的（= 到所有玩家都超距 = 最近玩家超距）才硬消失
#   语义与原版"最近玩家"严格等价，代价是每拍多 3 条标记命令（遍历玩家×近处实体，很便宜）。
#   ⚠ v4.22b：③ 与掷骰段还要加「有玩家在线」守卫 —— 无玩家时打标记的 「」as @a「」 是空集（一条不执行），
#     而③ 的 @e 是全图扫 ⇒ 会把"没有任何 near 标记"错解成"全都超距" ⇒ 一拍清空；
#     原版此时 getNearestPlayer 返回 null ⇒ 根本不判定。加 if entity @a[…] 守卫与之一致。
tag @e[tag=${NS}.spawned,tag=${NS}.near64] remove ${NS}.near64
tag @e[tag=${NS}.spawned,tag=${NS}.near128] remove ${NS}.near128
execute as @a[gamemode=!spectator] at @s as @e[tag=${NS}.spawned,distance=..64] run tag @s add ${NS}.near64
execute as @a[gamemode=!spectator] at @s as @e[tag=${NS}.spawned,distance=..128] run tag @s add ${NS}.near128
execute if entity @a[gamemode=!spectator] as @e[tag=${NS}.spawned,tag=!${NS}.near64,tag=!${NS}.persistent,nbt=!{PersistenceRequired:true},type=#${NS}:water_ambient] unless data entity @s Passengers run function ${NS}:util/void_kill
execute if entity @a[gamemode=!spectator] as @e[tag=${NS}.spawned,tag=!${NS}.near128,tag=!${NS}.persistent,nbt=!{PersistenceRequired:true},type=!#${NS}:water_ambient] unless data entity @s Passengers run function ${NS}:util/void_kill

# 概率消失：离开 32 格后掷骰（每实体一次）；$despawn_dice = 0 ⇒ 整段跳过（默认，交给原版）
# 同样按"最近玩家"语义：先标记"任一玩家 32 格内"，只对**没有**标记的掷骰（旧写法会把玩家身边的生物也掷掉）。
tag @e[tag=${NS}.spawned,tag=${NS}.near32] remove ${NS}.near32
execute as @a[gamemode=!spectator] at @s as @e[tag=${NS}.spawned,distance=..32] run tag @s add ${NS}.near32
execute if score $despawn_dice ${NS} matches 1.. if entity @a[gamemode=!spectator] as @e[tag=${NS}.spawned,tag=!${NS}.near32,tag=!${NS}.persistent,nbt=!{PersistenceRequired:true}] at @s unless data entity @s Passengers run function ${NS}:despawn/one
`;

// ---------------------------------------------------------------- 移除方式（v4.11：void_kill）
F['data/' + NS + '/function/util/void_kill.mcfunction'] = `# ${NS}:util/void_kill —— 静默移除（对齐原版 discard()）
#
# 为什么不用 kill：kill 会掉战利品、给经验、触发死亡逻辑；而原版的**消失/超距移除**调用的是 discard()，
# 什么都不掉、也没有死亡动画/音效。做法与原作 recovered/doom.nats 的 void_kill 完全一致：
# 把实体丢到世界下方（y-500）⇒ 下一 tick 因超出世界被静默 discard。
#
# 用法：execute as <实体> run function ${NS}:util/void_kill
tp @s ~ ~-500 ~
`;

F['data/' + NS + '/function/despawn/one.mcfunction'] = `# ${NS}:despawn/one —— 对单个实体掷骰（1/$despawn_dice；0 = 关闭）
execute if score $despawn_dice ${NS} matches ..0 run return 1
execute store result score $dice ${NS} run random value 1..${DICE}
execute if score $dice ${NS} matches 1 run function ${NS}:despawn/kill
`;

F['data/' + NS + '/function/despawn/kill.mcfunction'] = `# ${NS}:despawn/kill —— 真正移除（单独成函数，方便在日志里归因）
# v4.11：走 void_kill（discard 语义）而不是 kill @s —— 消失的生物不该掉战利品。
execute if score $despawn_log ${NS} matches 1 run tellraw @a [{"text":"[nats.despawn] ","color":"dark_gray"},{"text":"概率消失（静默移除）","color":"gray"}]
function ${NS}:util/void_kill
`;

F['data/' + NS + '/function/debug/despawn_report.mcfunction'] = `# ${NS}:debug/despawn_report —— 消失统计（接 doom.log）
function doom.log:info {message:"${NS} 消失层：硬消失 128 格（WATER_AMBIENT 64 格）· 概率 1/${DICE} 每 ${PERIOD} tick"}
function doom.log:dump {key:"despawn.dice", message:"掷骰分母（等效每 tick 1/800）"}
tellraw @a [{"text":"[nats] 场上本包生成实体：","color":"gray"},{"selector":"@e[tag=${NS}.spawned]"},{"text":"  持久：","color":"gray"},{"selector":"@e[tag=${NS}.persistent]"}]
`;

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
  console.log('=== gen_ctm_despawn 完成 ===');
  console.log('输出:', PACK, '| 文件:', Object.keys(F).length);
  console.log('参数: 遍历', PERIOD, 'tick | 掷骰 1/' + DICE, '（等效原版每 tick 1/800）');
}
