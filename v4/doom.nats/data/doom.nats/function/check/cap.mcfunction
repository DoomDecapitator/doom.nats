# doom.nats:check/cap [MACRO] —— 容量判定（reason=5 全局 / 6 本地全满）
#
# 全局（SpawnState.canSpawnForCategoryGlobal）：cnt < maxInstancesPerChunk × spawnableChunkCount / 289
# 本地（LocalMobCapCalculator.canSpawn，源码确证）：**任一**附近玩家未满即通过 —— OR 语义
#   MobCounts.canSpawn: counts.getOrDefault(cat, 0) < cat.getMaxInstancesPerChunk()
#   即 per-player 的容量就是 maxInstancesPerChunk 本身，不再乘 chunks/289。
#   "附近" = 区块附近的玩家（chunkMap.getPlayersCloseForSpawning），等价于区块中心距玩家 < 128。
# v4.14g：先按当前尝试的维度把该维度的计数取到 $cnt.dim，再与全局容量比较
# v4.26：下面三条分支分别读 $cnt.$(cat) / $cnt.$(cat).nether / $cnt.$(cat).end —— 三者都必须在 check/caps 里有**写入点**，
#   否则该维度读到的是 0 或陈旧值 ⇒ 容量门形同不存在（v4.25 前 4 个水生类别的主世界分支就是这样静默失效的）。
#   （静态防线：lint_ctm L15 要求「被读到的类别 × 三个维度」都有 set + add 写入点。）
$scoreboard players operation $cnt.dim doom.nats = $cnt.$(cat) doom.nats
$execute if score $att.dim doom.nats matches 1 run scoreboard players operation $cnt.dim doom.nats = $cnt.$(cat).nether doom.nats
$execute if score $att.dim doom.nats matches 2 run scoreboard players operation $cnt.dim doom.nats = $cnt.$(cat).end doom.nats
$scoreboard players operation $cap.now_$(cat) doom.nats = $cap.$(cat) doom.nats
$scoreboard players operation $cap.lmax_$(cat) doom.nats = $eff.max_$(cat) doom.nats
$execute if data storage doom.nats:author counts.capByY."$(cat)" run function doom.nats:author/cap_scan with storage doom.nats:sel
$execute if score $cnt.dim doom.nats >= $cap.now_$(cat) doom.nats run function doom.nats:check/fail {reason:5}

scoreboard players set $local_ok doom.nats 0
execute if score $chk.ok doom.nats matches 1 as @a[gamemode=!spectator] at @s run function doom.nats:check/local_one with storage doom.nats:sel
execute if score $chk.ok doom.nats matches 1 if score $local_ok doom.nats matches 0 run function doom.nats:check/fail {reason:6}
