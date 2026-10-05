# doom.nats:core/tick —— 每 tick
scoreboard players add $t doom.nats 1

# 快照节拍：默认 20 tick 一次（$snap_period 可覆盖）
execute unless score $snap_period doom.nats matches 1.. run scoreboard players set $snap_period doom.nats 20
scoreboard players operation $snap_phase doom.nats = $t doom.nats
scoreboard players operation $snap_phase doom.nats %= $snap_period doom.nats
execute if score $snap_phase doom.nats matches 0 run function doom.nats:circ/snapshot

# v4.28 容量计数（P0 性能）：**每个维度只做 1 次整图盒子选择**（3 次/秒），类别计数由 check/cnt_<维度> 逐实体派发
#   （v4.27 是 21 条「类别 × 维度」选择器/秒 —— 峰值虽降、总量没降：avg≈51ms / tps 18.8；
#     v4.26 更糟：21 条挤在同一拍 ⇒ P95≈1.0~1.2s）。总量 ≈1.47s → ≈0.21s / 秒。
#   相位**固定 20 拍、与 $snap_period 解耦**：冻结快照时计数照样 1 Hz 刷新（多个 verify_* 的前提就是冻结节拍）。
#   执行上下文与修前一致（优先玩家所在维度）；盒子不可省 —— 不带位置/体积约束的 @e 会跨维度选实体（v4.14g 实测）。
scoreboard players add $cap_phase doom.nats 1
execute if score $cap_phase doom.nats matches 20.. run scoreboard players set $cap_phase doom.nats 0
execute at @a[gamemode=!spectator,limit=1] run function doom.nats:check/caps_scan
execute unless entity @a[gamemode=!spectator] run function doom.nats:check/caps_scan

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
