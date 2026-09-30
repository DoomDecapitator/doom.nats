# doom.nats:check/caps —— 复刻 SpawnState.canSpawnForCategoryGlobal
#
#   cap = maxInstancesPerChunk × spawnableChunkCount / 289   （整数除法，源码逐字）
# spawnableChunkCount 由 doom.nats:circ/snapshot 实测（execute if loaded 数出来的），不是估算。
scoreboard players operation $cap.monster doom.nats = $snap.chunks doom.nats
scoreboard players operation $cap.monster doom.nats *= $eff.max_monster doom.nats
scoreboard players operation $cap.monster doom.nats /= #289 doom.nats
scoreboard players operation $cap.creature doom.nats = $snap.chunks doom.nats
scoreboard players operation $cap.creature doom.nats *= $eff.max_creature doom.nats
scoreboard players operation $cap.creature doom.nats /= #289 doom.nats
scoreboard players operation $cap.ambient doom.nats = $snap.chunks doom.nats
scoreboard players operation $cap.ambient doom.nats *= $eff.max_ambient doom.nats
scoreboard players operation $cap.ambient doom.nats /= #289 doom.nats
scoreboard players operation $cap.water_creature doom.nats = $snap.chunks doom.nats
scoreboard players operation $cap.water_creature doom.nats *= $eff.max_water_creature doom.nats
scoreboard players operation $cap.water_creature doom.nats /= #289 doom.nats
scoreboard players operation $cap.water_ambient doom.nats = $snap.chunks doom.nats
scoreboard players operation $cap.water_ambient doom.nats *= $eff.max_water_ambient doom.nats
scoreboard players operation $cap.water_ambient doom.nats /= #289 doom.nats
scoreboard players operation $cap.underground_water_creature doom.nats = $snap.chunks doom.nats
scoreboard players operation $cap.underground_water_creature doom.nats *= $eff.max_underground_water_creature doom.nats
scoreboard players operation $cap.underground_water_creature doom.nats /= #289 doom.nats
scoreboard players operation $cap.axolotls doom.nats = $snap.chunks doom.nats
scoreboard players operation $cap.axolotls doom.nats *= $eff.max_axolotls doom.nats
scoreboard players operation $cap.axolotls doom.nats /= #289 doom.nats

# 各类别当前计数（按注册表 tag 记数；每快照节拍刷一次）
# v4.14d：按「类别实体类型标签」计数，并跳过原版持久生物 —— 与 SpawnState.createState 一致：
#   原版遍历 level.getAllEntities()，把 MobCategory 匹配且**非** isPersistenceRequired()/requiresCustomPersistence() 的都计入。
#   早先只数本包自己生成的生物（tag=doom.nats.cat.*）⇒ 刷怪笼/结构/指令生成的同类生物不占额度（偏松）。
# v4.26（P0）：**7 类别 × 3 维度**全量写入（由 MOB_CATS × CAP_DIM_SUFFIX 展开，见本文件上方）。
#   主世界 = 无后缀键 $cnt.<cat>（check/cap 的第一分支就是读它）· 下界 = $cnt.<cat>.nether · 末地 = $cnt.<cat>.end。
#   此前 4 个水生类别缺主世界写入点 ⇒ 主世界分支恒读 0 ⇒ 容量门形同不存在（静默偏松、不报错）。
#   静态防线：lint_pack 的 L15（凡被读到的类别，三个维度都必须有 set + add 写入点；反向测试已验）。
# v4.14g：**每个维度各一份**计数（原版 SpawnState 是 per-level 的）。
#   真机实测的关键坑：**不带位置/体积约束的 @e 会跨维度选实体**（execute in <维度> 也不管用），
#     必须加一个覆盖全图的盒子（x/dx/y/dy/z/dz）才按「执行维度」限定；否则三个维度数出来是同一个全局值。
#   验证：_work/dimtest7.mjs（主世界/下界各放一个带标签的盔甲架，盒子查询各得 1，无约束查询得 2）。
scoreboard players set $cnt.monster doom.nats 0
execute in minecraft:overworld as @e[type=#doom.nats:monster,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.monster doom.nats 1
scoreboard players set $cnt.monster.nether doom.nats 0
execute in minecraft:the_nether as @e[type=#doom.nats:monster,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.monster.nether doom.nats 1
scoreboard players set $cnt.monster.end doom.nats 0
execute in minecraft:the_end as @e[type=#doom.nats:monster,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.monster.end doom.nats 1
scoreboard players set $cnt.creature doom.nats 0
execute in minecraft:overworld as @e[type=#doom.nats:creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.creature doom.nats 1
scoreboard players set $cnt.creature.nether doom.nats 0
execute in minecraft:the_nether as @e[type=#doom.nats:creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.creature.nether doom.nats 1
scoreboard players set $cnt.creature.end doom.nats 0
execute in minecraft:the_end as @e[type=#doom.nats:creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.creature.end doom.nats 1
scoreboard players set $cnt.ambient doom.nats 0
execute in minecraft:overworld as @e[type=#doom.nats:ambient,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.ambient doom.nats 1
scoreboard players set $cnt.ambient.nether doom.nats 0
execute in minecraft:the_nether as @e[type=#doom.nats:ambient,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.ambient.nether doom.nats 1
scoreboard players set $cnt.ambient.end doom.nats 0
execute in minecraft:the_end as @e[type=#doom.nats:ambient,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.ambient.end doom.nats 1
scoreboard players set $cnt.water_creature doom.nats 0
execute in minecraft:overworld as @e[type=#doom.nats:water_creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.water_creature doom.nats 1
scoreboard players set $cnt.water_creature.nether doom.nats 0
execute in minecraft:the_nether as @e[type=#doom.nats:water_creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.water_creature.nether doom.nats 1
scoreboard players set $cnt.water_creature.end doom.nats 0
execute in minecraft:the_end as @e[type=#doom.nats:water_creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.water_creature.end doom.nats 1
scoreboard players set $cnt.water_ambient doom.nats 0
execute in minecraft:overworld as @e[type=#doom.nats:water_ambient,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.water_ambient doom.nats 1
scoreboard players set $cnt.water_ambient.nether doom.nats 0
execute in minecraft:the_nether as @e[type=#doom.nats:water_ambient,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.water_ambient.nether doom.nats 1
scoreboard players set $cnt.water_ambient.end doom.nats 0
execute in minecraft:the_end as @e[type=#doom.nats:water_ambient,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.water_ambient.end doom.nats 1
scoreboard players set $cnt.underground_water_creature doom.nats 0
execute in minecraft:overworld as @e[type=#doom.nats:underground_water_creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.underground_water_creature doom.nats 1
scoreboard players set $cnt.underground_water_creature.nether doom.nats 0
execute in minecraft:the_nether as @e[type=#doom.nats:underground_water_creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.underground_water_creature.nether doom.nats 1
scoreboard players set $cnt.underground_water_creature.end doom.nats 0
execute in minecraft:the_end as @e[type=#doom.nats:underground_water_creature,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.underground_water_creature.end doom.nats 1
scoreboard players set $cnt.axolotls doom.nats 0
execute in minecraft:overworld as @e[type=#doom.nats:axolotls,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.axolotls doom.nats 1
scoreboard players set $cnt.axolotls.nether doom.nats 0
execute in minecraft:the_nether as @e[type=#doom.nats:axolotls,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.axolotls.nether doom.nats 1
scoreboard players set $cnt.axolotls.end doom.nats 0
execute in minecraft:the_end as @e[type=#doom.nats:axolotls,nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500] run scoreboard players add $cnt.axolotls.end doom.nats 1

