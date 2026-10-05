# doom.nats:despawn/tick —— 消失检查（由 core/tick 按 $despawn_period 调用）
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
tag @e[tag=doom.nats.spawned,tag=doom.nats.near64] remove doom.nats.near64
tag @e[tag=doom.nats.spawned,tag=doom.nats.near128] remove doom.nats.near128
execute as @a[gamemode=!spectator] at @s as @e[tag=doom.nats.spawned,distance=..64] run tag @s add doom.nats.near64
execute as @a[gamemode=!spectator] at @s as @e[tag=doom.nats.spawned,distance=..128] run tag @s add doom.nats.near128
execute if entity @a[gamemode=!spectator] as @e[tag=doom.nats.spawned,tag=!doom.nats.near64,tag=!doom.nats.persistent,nbt=!{PersistenceRequired:true},type=#doom.nats:water_ambient] unless data entity @s Passengers run function doom.nats:util/void_kill
execute if entity @a[gamemode=!spectator] as @e[tag=doom.nats.spawned,tag=!doom.nats.near128,tag=!doom.nats.persistent,nbt=!{PersistenceRequired:true},type=!#doom.nats:water_ambient] unless data entity @s Passengers run function doom.nats:util/void_kill

# 概率消失：离开 32 格后掷骰（每实体一次）；$despawn_dice = 0 ⇒ 整段跳过（默认，交给原版）
# 同样按"最近玩家"语义：先标记"任一玩家 32 格内"，只对**没有**标记的掷骰（旧写法会把玩家身边的生物也掷掉）。
tag @e[tag=doom.nats.spawned,tag=doom.nats.near32] remove doom.nats.near32
execute as @a[gamemode=!spectator] at @s as @e[tag=doom.nats.spawned,distance=..32] run tag @s add doom.nats.near32
execute if score $despawn_dice doom.nats matches 1.. if entity @a[gamemode=!spectator] as @e[tag=doom.nats.spawned,tag=!doom.nats.near32,tag=!doom.nats.persistent,nbt=!{PersistenceRequired:true}] at @s unless data entity @s Passengers run function doom.nats:despawn/one
