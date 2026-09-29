# doom.nats:core/tick —— 每 tick
scoreboard players add $t doom.nats 1

# 快照节拍：默认 20 tick 一次（$snap_period 可覆盖）
execute unless score $snap_period doom.nats matches 1.. run scoreboard players set $snap_period doom.nats 20
scoreboard players operation $snap_phase doom.nats = $t doom.nats
scoreboard players operation $snap_phase doom.nats %= $snap_period doom.nats
execute if score $snap_phase doom.nats matches 0 run function doom.nats:circ/snapshot

# 刷怪节拍：与情形生效参数联动（$eff.period 由 circ/apply 在快照里写入）
# 密度控制（每分钟结算一次；$density=0 时只是空转）
function doom.nats:ctrl/tick

scoreboard players add $spawn_t doom.nats 1
scoreboard players operation $spawn_t doom.nats %= $eff.period doom.nats
execute if score $spawn_t doom.nats matches 0 run function doom.nats:spawn/batch

# 消失节拍：每 $despawn_period tick 遍历一次（参数在 despawn/setup 里）
scoreboard players add $despawn_t doom.nats 1
scoreboard players operation $despawn_t doom.nats %= $despawn_period doom.nats
execute if score $despawn_t doom.nats matches 0 run function doom.nats:despawn/tick
