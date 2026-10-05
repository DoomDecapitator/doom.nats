# doom.nats:debug/clear —— 清掉本包生成的全部生物（静默移除，无掉落/经验）
#
# 与 /kill @e[tag=…] 的区别：kill 会掉战利品并触发死亡逻辑（僵尸烧掉、掉落物进世界），
# 而清理/消失应当用 discard 语义 —— 这里统一走 doom.nats:util/void_kill（丢出世界）。
# 保留 doom.nats.persistent（被标记持久的生物不会被清）。
scoreboard players set $clear.n doom.nats 0
execute as @e[tag=doom.nats.spawned,tag=!doom.nats.persistent,nbt=!{PersistenceRequired:true},limit=2000] run scoreboard players add $clear.n doom.nats 1
execute as @e[tag=doom.nats.spawned,tag=!doom.nats.persistent,nbt=!{PersistenceRequired:true},limit=2000] unless data entity @s Passengers at @s unless data entity @s Passengers run function doom.nats:util/void_kill
# 掉落物：只清本包生物掉的东西（用标签区分不了，默认不动 —— 需要时用 parameter）
execute store result storage doom.nats:rep n int 1 run scoreboard players get $clear.n doom.nats
function doom.nats:debug/say_clear with storage doom.nats:rep
tellraw @a [{"text":"[nats] 已静默清理本包生物：","color":"gray"},{"score":{"name":"$clear.n","objective":"doom.nats"},"color":"white"},{"text":" 只（无掉落）","color":"gray"}]
