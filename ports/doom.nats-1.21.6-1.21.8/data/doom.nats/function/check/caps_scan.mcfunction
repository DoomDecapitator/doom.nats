# doom.nats:check/caps_scan —— 容量计数（每维度 1 次整图盒子 + 逐实体派发，拆到 3 个相位）
#
# v4.28（P0 性能）：盒子扫描从 21 次/秒降到 **3 次/秒**（每维度 1 次），类别计数改由
#   check/cnt_<维度> 逐实体按类别 tag 派发（命中几个类别就加几个，各封顶 500）。
#   真机实测：单条整图盒子选择 ≈82~86ms 往返（− floor ≈71~75ms），与场上实体数无关 ⇒
#   修前 21 条/秒 ≈ 1.47s/秒（avg≈51ms / tps 18.8）→ 修后 3 条/秒 ≈ 0.21s/秒。
# 由 core/tick **每 tick** 调用（不是 1 Hz 整扫）；相位 $cap_phase 由 core/tick 每拍自增回绕（固定 20 拍）。
#   与 $snap_period **解耦**：冻结快照（$snap_period=20000，多个 verify_* 的前提）时计数照样 1 Hz 刷新
#   （若跟着 $snap_period 走，冻结后相位只走到 0..19 的一小段，部分类别会**永不刷新**）。
# 每维度的清零与它自己那次盒子查询必须同一拍（否则计数会漏）；盒子不可省、也不可收窄 ——
#   不带位置/体积约束的 @e 会**跨维度**选实体（v4.14g 实测：execute in <维度> 也拦不住）。
# 维度 minecraft:overworld（相位 1）：清零本维度的 7 个键 → 1 次整图盒子选择 → 逐实体按类别 tag 派发
execute if score $cap_phase doom.nats matches 1 run scoreboard players set $cnt.monster doom.nats 0
execute if score $cap_phase doom.nats matches 1 run scoreboard players set $cnt.creature doom.nats 0
execute if score $cap_phase doom.nats matches 1 run scoreboard players set $cnt.ambient doom.nats 0
execute if score $cap_phase doom.nats matches 1 run scoreboard players set $cnt.water_creature doom.nats 0
execute if score $cap_phase doom.nats matches 1 run scoreboard players set $cnt.water_ambient doom.nats 0
execute if score $cap_phase doom.nats matches 1 run scoreboard players set $cnt.underground_water_creature doom.nats 0
execute if score $cap_phase doom.nats matches 1 run scoreboard players set $cnt.axolotls doom.nats 0
execute if score $cap_phase doom.nats matches 1 run execute in minecraft:overworld as @e[nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000] run function doom.nats:check/cnt_overworld
# 维度 minecraft:the_nether（相位 8）：清零本维度的 7 个键 → 1 次整图盒子选择 → 逐实体按类别 tag 派发
execute if score $cap_phase doom.nats matches 8 run scoreboard players set $cnt.monster.nether doom.nats 0
execute if score $cap_phase doom.nats matches 8 run scoreboard players set $cnt.creature.nether doom.nats 0
execute if score $cap_phase doom.nats matches 8 run scoreboard players set $cnt.ambient.nether doom.nats 0
execute if score $cap_phase doom.nats matches 8 run scoreboard players set $cnt.water_creature.nether doom.nats 0
execute if score $cap_phase doom.nats matches 8 run scoreboard players set $cnt.water_ambient.nether doom.nats 0
execute if score $cap_phase doom.nats matches 8 run scoreboard players set $cnt.underground_water_creature.nether doom.nats 0
execute if score $cap_phase doom.nats matches 8 run scoreboard players set $cnt.axolotls.nether doom.nats 0
execute if score $cap_phase doom.nats matches 8 run execute in minecraft:the_nether as @e[nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000] run function doom.nats:check/cnt_the_nether
# 维度 minecraft:the_end（相位 14）：清零本维度的 7 个键 → 1 次整图盒子选择 → 逐实体按类别 tag 派发
execute if score $cap_phase doom.nats matches 14 run scoreboard players set $cnt.monster.end doom.nats 0
execute if score $cap_phase doom.nats matches 14 run scoreboard players set $cnt.creature.end doom.nats 0
execute if score $cap_phase doom.nats matches 14 run scoreboard players set $cnt.ambient.end doom.nats 0
execute if score $cap_phase doom.nats matches 14 run scoreboard players set $cnt.water_creature.end doom.nats 0
execute if score $cap_phase doom.nats matches 14 run scoreboard players set $cnt.water_ambient.end doom.nats 0
execute if score $cap_phase doom.nats matches 14 run scoreboard players set $cnt.underground_water_creature.end doom.nats 0
execute if score $cap_phase doom.nats matches 14 run scoreboard players set $cnt.axolotls.end doom.nats 0
execute if score $cap_phase doom.nats matches 14 run execute in minecraft:the_end as @e[nbt=!{PersistenceRequired:true},x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000] run function doom.nats:check/cnt_the_end
