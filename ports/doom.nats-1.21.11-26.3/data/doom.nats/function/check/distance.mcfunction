# doom.nats:check/distance —— 距离判定（reason=1 / 2 / 10）
# 24 格球内不得有玩家（源码：distSq <= 576 拒）；24 格之外、despawnDistance 之内才可生成
execute if entity @a[gamemode=!spectator,distance=..24] run function doom.nats:check/fail {reason:1}
execute unless entity @a[gamemode=!spectator,distance=..128] run function doom.nats:check/fail {reason:2}
# 世界出生点 24 格内同样不得生成（源码同一条 if 的第二个分支；$cfg.spawn24≥1 且作者声明了坐标才生效）
execute if score $chk.ok doom.nats matches 1 if score $cfg.spawn24 doom.nats matches 1.. run function doom.nats:check/spawn24
