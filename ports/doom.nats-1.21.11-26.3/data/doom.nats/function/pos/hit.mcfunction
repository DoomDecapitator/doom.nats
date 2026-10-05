# doom.nats:pos/hit —— 命中区块后取区块内随机 x/z（0..15），再定 y
#
# 注意：坐标最终要被宏替换进 positioned，宏替换出的数字会被当成**绝对坐标**，
# 因此这里必须换算成世界坐标（玩家坐标 + 区块偏移 + 区块内偏移）。
execute store result score $ix doom.nats run random value 0..15
execute store result score $iz doom.nats run random value 0..15
# 原点 = 玩家绝对坐标 + 区块偏移 + 区块内偏移（绝对，供宏使用）
execute store result score $ox doom.nats run data get entity @s Pos[0] 1
execute store result score $oz doom.nats run data get entity @s Pos[2] 1
scoreboard players operation $px doom.nats = $ox doom.nats
scoreboard players operation $px doom.nats += $cx doom.nats
scoreboard players operation $px doom.nats += $ix doom.nats
scoreboard players operation $pz doom.nats = $oz doom.nats
scoreboard players operation $pz doom.nats += $cz doom.nats
scoreboard players operation $pz doom.nats += $iz doom.nats
# 取 y：把 px/pz 交给取 y 层（它需要**在候选点位置上**扫地面）
execute store result storage doom.nats:pt2 px int 1 run scoreboard players get $px doom.nats
execute store result storage doom.nats:pt2 pz int 1 run scoreboard players get $pz doom.nats
function doom.nats:pos/band_at with storage doom.nats:pt2
execute store result storage doom.nats:pos x int 1 run scoreboard players get $px doom.nats
execute store result storage doom.nats:pos z int 1 run scoreboard players get $pz doom.nats
execute store result storage doom.nats:pos y int 1 run scoreboard players get $py doom.nats
data modify storage doom.nats:pos ok set value 1b
# v4.2 修：$pos.ok 是 spawn/try 的闸门，之前只被置 0、从没置 1 ⇒ 整包永不生成（静默空转）。
scoreboard players set $pos.ok doom.nats 1
