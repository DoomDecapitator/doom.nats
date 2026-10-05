# doom.nats:check/spawn24 —— 世界出生点 24 格排除（reason=10）
#
# 由 check/distance 在 $chk.ok=1 且 $cfg.spawn24=1 时调用（顺序与原版一致：先玩家距离，再出生点）。
scoreboard players operation $s24.x doom.nats = $cfg.spawn_x doom.nats
scoreboard players operation $s24.x doom.nats -= $wx doom.nats
scoreboard players operation $s24.y doom.nats = $cfg.spawn_y doom.nats
scoreboard players operation $s24.y doom.nats -= $py doom.nats
scoreboard players operation $s24.z doom.nats = $cfg.spawn_z doom.nats
scoreboard players operation $s24.z doom.nats -= $wz doom.nats
# 预筛：任一轴 |Δ| > 24 ⇒ 该轴单独就 ≥ 25² > 576，不可能命中；同时把下面的平方限在 7009 以内（不溢出）
execute if score $s24.x doom.nats matches -24..24 if score $s24.y doom.nats matches -24..24 if score $s24.z doom.nats matches -24..24 run function doom.nats:check/spawn24_near
