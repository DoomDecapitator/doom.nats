# doom.nats:check/border —— 世界边界（reason=11）
#
# 原版出处：SpawnPlacementTypes.ON_GROUND / IN_WATER / IN_LAVA 都要求 level.getWorldBorder().isWithinBounds(pos)；
#   WorldBorder.isWithinBounds(x,z) = x >= centerX - size/2 && x < centerX + size/2（半开区间）。
# 命令侧只能读 worldborder get 的尺寸、读不到中心 ⇒ centerX/centerZ/size 由作者在 doom.nats:config 里声明；
#   size=0（默认）= 不启用（老世界行为不变）。
scoreboard players set $bd.dx doom.nats 0
scoreboard players set $bd.dz doom.nats 0
execute if score $cfg.border_size doom.nats matches 1.. run scoreboard players operation $bd.dx doom.nats = $wx doom.nats
execute if score $cfg.border_size doom.nats matches 1.. run scoreboard players operation $bd.dx doom.nats -= $cfg.border_cx doom.nats
execute if score $cfg.border_size doom.nats matches 1.. run scoreboard players operation $bd.dx doom.nats *= #2 doom.nats
execute if score $cfg.border_size doom.nats matches 1.. run scoreboard players operation $bd.dz doom.nats = $wz doom.nats
execute if score $cfg.border_size doom.nats matches 1.. run scoreboard players operation $bd.dz doom.nats -= $cfg.border_cz doom.nats
execute if score $cfg.border_size doom.nats matches 1.. run scoreboard players operation $bd.dz doom.nats *= #2 doom.nats
# 左边界用"dx + size < 0"表达（避免引入 -1 常量）：合法区间是 -size <= dx < size
scoreboard players operation $bd.tx doom.nats = $bd.dx doom.nats
scoreboard players operation $bd.tx doom.nats += $cfg.border_size doom.nats
scoreboard players operation $bd.tz doom.nats = $bd.dz doom.nats
scoreboard players operation $bd.tz doom.nats += $cfg.border_size doom.nats
execute if score $cfg.border_size doom.nats matches 1.. if score $bd.dx doom.nats >= $cfg.border_size doom.nats run function doom.nats:check/fail {reason:11}
execute if score $cfg.border_size doom.nats matches 1.. if score $bd.tx doom.nats matches ..-1 run function doom.nats:check/fail {reason:11}
execute if score $cfg.border_size doom.nats matches 1.. if score $bd.dz doom.nats >= $cfg.border_size doom.nats run function doom.nats:check/fail {reason:11}
execute if score $cfg.border_size doom.nats matches 1.. if score $bd.tz doom.nats matches ..-1 run function doom.nats:check/fail {reason:11}
