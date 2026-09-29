# doom.nats:spawn/pick_one —— 单只生成的全流程（顺序严格对齐源码）
#
# 源码顺序：距离检查 →（首次）getRandomSpawnMobAt 选物种 → isValidSpawnPostitionForType → 生成
scoreboard players set $chk.ok doom.nats 1
scoreboard players set $chk.reason doom.nats 0

# ① 24 格内有玩家则拒（distSq <= 576）
execute if entity @a[gamemode=!spectator,distance=..24] run function doom.nats:check/fail {reason:1}

# ② 选物种（写 doom.nats:sel，含 type/cat/min/max/nbt；未命中设 $sel.ok=0）
# 物种：**每组只抽一次**（源码在组内第一次通过距离检查时抽，之后整组沿用）
scoreboard players set $sel.ok doom.nats 0
# 结构优先（原版 NaturalSpawner.mobsAt）：按**类别**在群系表层面替换 —— 见 mob/biome/&lt;群系&gt;/&lt;类别&gt; 的表头前置
#   （v4.18 起要塞也走这条，不再在这里做"下界 ∧ 下界砖 ∧ 要塞内"的专用分支）
# v4.16：物种**每组只抽一次**，且原版是在"首个通过距离检查的候选点"用**那个点的群系**读物种表
#   （源码：getRandomSpawnMobAt(..., pos) -> chunkGenerator.getMobsAt(level.getBiome(pos), ...)）。
#   旧实现用快照里"玩家脚下"的 $snap.biome => 群系边界/远距离候选点会选错表；这里改成候选点探测。
#   if loaded 守卫：if biome 对**未加载区块**会把它抬到 BIOME 阶段（可能触发世界生成/卡顿）；
#   而原版 NaturalSpawner 只在已加载区块里走候选点 => 跳过未加载点既省成本又与原版同义。
execute if score $chk.ok doom.nats matches 1 if score $grp.sel doom.nats matches 0 if loaded ~ ~ ~ run function doom.nats:biome/detect_at
# v4.18（P1-6b，保真度修复）：要塞的**两条**路径都挪进 monster 类别表的结构前置（mob/biome/&lt;群系&gt;/monster），
#   这里不再有"要塞专用分支"。原因：原版 NaturalSpawner.mobsAt 是**按类别**调用的（cat==MONSTER 才走要塞硬编码表），
#   而旧实现在这一层按"下界 ∧ 下方下界砖 ∧ 要塞内"**不分类别**地抢走整次尝试 ⇒ 要塞内连 creature/ambient 的尝试
#   也被换成了 monster 表（多刷怪、少掉群系该有的物种）。挪进表里后条件天然带上"本次抽中的类别是 monster"，
#   同时顺带补上了要塞 JSON 覆盖那条（脚下不是下界砖时原版也会用要塞表）。
execute if score $chk.ok doom.nats matches 1 if score $grp.sel doom.nats matches 0 run function doom.nats:biome/dispatch
execute if score $chk.ok doom.nats matches 1 if score $grp.sel doom.nats matches 0 if score $sel.ok doom.nats matches 1 run scoreboard players set $grp.sel doom.nats 1
# v4.15 组数据层：本组首次抽中物种 ⇒ 初始化 SpawnGroupData（整组共享的婴儿决定/变体/效果）
execute if score $grp.sel doom.nats matches 1 if score $grp.inited doom.nats matches 0 if data storage doom.nats:sel slug run function doom.nats:grp/init with storage doom.nats:sel
execute if score $grp.sel doom.nats matches 1 run scoreboard players set $grp.inited doom.nats 1
# 抽不中物种 ⇒ 结束**本组**（源码：species.isEmpty() ⇒ break 组循环），并记一次 reason=8
execute if score $chk.ok doom.nats matches 1 if score $grp.sel doom.nats matches 0 run function doom.nats:debug/reject {reason:8}
execute if score $chk.ok doom.nats matches 1 if score $grp.sel doom.nats matches 0 run scoreboard players set $grp.stop doom.nats 1
execute if score $chk.ok doom.nats matches 1 if score $grp.sel doom.nats matches 0 run scoreboard players set $chk.ok doom.nats 0
# 抽中后按该物种 min/max 重算组大小（源码：groupSize = minCount + rand(1 + max - min)）
execute if score $grp.sel doom.nats matches 1 if score $grp.sized doom.nats matches 0 run execute store result score $sel.min doom.nats run data get storage doom.nats:sel min
execute if score $grp.sel doom.nats matches 1 if score $grp.sized doom.nats matches 0 run execute store result score $sel.max doom.nats run data get storage doom.nats:sel max
execute if score $chk.ok doom.nats matches 1 if score $grp.sel doom.nats matches 1 if score $grp.sized doom.nats matches 0 if score $sel.min doom.nats >= $sel.max doom.nats run scoreboard players operation $cnt doom.nats = $sel.min doom.nats
execute if score $chk.ok doom.nats matches 1 if score $grp.sel doom.nats matches 1 if score $grp.sized doom.nats matches 0 if score $sel.min doom.nats < $sel.max doom.nats run function doom.nats:spawn/regroup with storage doom.nats:sel
# 把该物种的 min/max 从 storage 取成计分板（退化区间守卫要用；每组只做一次）
execute if score $grp.sel doom.nats matches 1 run scoreboard players set $grp.sized doom.nats 1

# ③ 其余合法性（light / block / cap，cap 按 <cat> 取容量）
execute if score $chk.ok doom.nats matches 1 run function doom.nats:check/all

# ④ 生成（朝向随机，对齐 snapTo 的 random*360）
execute if score $chk.ok doom.nats matches 1 run function doom.nats:spawn/emit with storage doom.nats:sel

# ④b 热带鱼：Mob.isMaxGroupSizeReached 对"非群游变体"恒真 ⇒ 组内生成第一只后就 break（结束本组）
#    源码：TropicalFish.isMaxGroupSizeReached(size) = !this.isSchool；本包 summon 的是默认变体（非群游）⇒ 恒等价于生 1 只
execute if score $chk.ok doom.nats matches 1 if score $sel.grp1 doom.nats matches 1 run scoreboard players set $grp.stop doom.nats 1

# ⑤ 归因：成功计数 + 失败时把 reason 交给 debug 层
execute if score $chk.ok doom.nats matches 1 run scoreboard players add $spawned doom.nats 1
# 累积量：密度控制的测量源（$spawned 会被 reject_report 清零）
execute if score $chk.ok doom.nats matches 1 run scoreboard players add $spawned.total doom.nats 1
# 跨组簇上限：本次尝试已生成数达到该物种的 getMaxSpawnClusterSize() ⇒ 结束整个尝试（源码 return）
execute if score $chk.ok doom.nats matches 1 run scoreboard players add $att.spawned doom.nats 1
execute if score $chk.ok doom.nats matches 1 if score $att.spawned doom.nats > $dbg.clusterMax doom.nats run scoreboard players operation $dbg.clusterMax doom.nats = $att.spawned doom.nats
execute if score $chk.ok doom.nats matches 1 if score $att.spawned doom.nats >= $sel.cluster doom.nats run scoreboard players set $att.stop doom.nats 1
execute store result storage doom.nats:rej reason int 1 run scoreboard players get $chk.reason doom.nats
execute if score $chk.ok doom.nats matches 0 run function doom.nats:debug/reject with storage doom.nats:rej
