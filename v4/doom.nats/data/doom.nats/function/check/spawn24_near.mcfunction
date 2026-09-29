# doom.nats:check/spawn24_near —— 出生点距离的整数精确判定（由 check/spawn24 预筛后调用）
#
# 4d² = 4dx² + (2dy+1)² + 4dz²：y 轴的半格偏移照抄 vanilla 的 BlockPos.distToCenterSqr（+0.5）。
# |dx|,|dy|,|dz| ≤ 24 ⇒ 4d² ≤ 4·576 + 4·576 + 49² = 7009（int 不溢出）。
scoreboard players operation $s24.y doom.nats *= #2 doom.nats
scoreboard players add $s24.y doom.nats 1
scoreboard players operation $s24.x doom.nats *= $s24.x doom.nats
scoreboard players operation $s24.x doom.nats *= #4 doom.nats
scoreboard players operation $s24.z doom.nats *= $s24.z doom.nats
scoreboard players operation $s24.z doom.nats *= #4 doom.nats
scoreboard players operation $s24.y doom.nats *= $s24.y doom.nats
scoreboard players operation $s24.x doom.nats += $s24.y doom.nats
scoreboard players operation $s24.x doom.nats += $s24.z doom.nats
# vanilla：distSq < 576 才拒 ⇒ 4d² < 2304（= 正好 24 格不拒）
execute if score $s24.x doom.nats matches ..2303 run function doom.nats:check/fail {reason:10}
