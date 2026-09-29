# doom.nats:exp/entry_scan_water_creature —— 运行时刻条件条目（类别 water_creature，槽位 0..7）
# 调用点：mob/biome/<群系>/water_creature 的表头（由 gen_ctm_mobs 生成，带 `if data storage doom.nats:exp entries[0]` 守卫）。
# 语义与构建期 entries.json 一致：**条件成立才把权重并入 #wsum**，命中区间紧接香草区间之后，
#   `#off` 只在条件成立时前进 ⇒ 先按条件过滤候选表、再按权重掷，逐点等价（不会出现空档）。
scoreboard players set $exp.hit doom.nats 0
scoreboard players set $exp.hook doom.nats 0
data modify storage doom.nats:exp_rt e set value {cat:"water_creature"}
execute if data storage doom.nats:exp entries[0] run function doom.nats:exp/entry_prep_0
execute if data storage doom.nats:exp entries[0] if data storage doom.nats:exp_rt e.mob if data storage doom.nats:exp_rt e.biome run function doom.nats:exp/entry_hit with storage doom.nats:exp_rt e
execute if data storage doom.nats:exp entries[1] run function doom.nats:exp/entry_prep_1
execute if data storage doom.nats:exp entries[1] if data storage doom.nats:exp_rt e.mob if data storage doom.nats:exp_rt e.biome run function doom.nats:exp/entry_hit with storage doom.nats:exp_rt e
execute if data storage doom.nats:exp entries[2] run function doom.nats:exp/entry_prep_2
execute if data storage doom.nats:exp entries[2] if data storage doom.nats:exp_rt e.mob if data storage doom.nats:exp_rt e.biome run function doom.nats:exp/entry_hit with storage doom.nats:exp_rt e
execute if data storage doom.nats:exp entries[3] run function doom.nats:exp/entry_prep_3
execute if data storage doom.nats:exp entries[3] if data storage doom.nats:exp_rt e.mob if data storage doom.nats:exp_rt e.biome run function doom.nats:exp/entry_hit with storage doom.nats:exp_rt e
execute if data storage doom.nats:exp entries[4] run function doom.nats:exp/entry_prep_4
execute if data storage doom.nats:exp entries[4] if data storage doom.nats:exp_rt e.mob if data storage doom.nats:exp_rt e.biome run function doom.nats:exp/entry_hit with storage doom.nats:exp_rt e
execute if data storage doom.nats:exp entries[5] run function doom.nats:exp/entry_prep_5
execute if data storage doom.nats:exp entries[5] if data storage doom.nats:exp_rt e.mob if data storage doom.nats:exp_rt e.biome run function doom.nats:exp/entry_hit with storage doom.nats:exp_rt e
execute if data storage doom.nats:exp entries[6] run function doom.nats:exp/entry_prep_6
execute if data storage doom.nats:exp entries[6] if data storage doom.nats:exp_rt e.mob if data storage doom.nats:exp_rt e.biome run function doom.nats:exp/entry_hit with storage doom.nats:exp_rt e
execute if data storage doom.nats:exp entries[7] run function doom.nats:exp/entry_prep_7
execute if data storage doom.nats:exp entries[7] if data storage doom.nats:exp_rt e.mob if data storage doom.nats:exp_rt e.biome run function doom.nats:exp/entry_hit with storage doom.nats:exp_rt e
