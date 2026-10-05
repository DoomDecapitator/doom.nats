# doom.nats:check/caps_formula —— 容量公式（cap = maxInstancesPerChunk × spawnableChunkCount / 289）
#
# 每快照节拍由 circ/snapshot 调用（21 条纯算术，代价可忽略）。
# v4.27：从 check/caps 拆出来 —— 那条 1 Hz 路径不再携带 21 条整图盒式选择器（真机 ≈820ms 的尖峰）。
# 计数不在这里：由 core/tick 每拍调 check/caps_scan 按相位拆着刷（20 拍一轮 = 1 Hz）。
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
