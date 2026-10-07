# doom.nats:cfg/qty —— 数量总开关的缩放实现（由 circ/apply 在 $cfg.qty ≠ 100 时调用）
#
# 语义：$cfg.qty = 百分比（100 = 原样，50 = 减半，200 = 翻倍）。有效范围 1..1000。
# 只缩【容量上限】，不动节拍 —— 「最多几只」和「刷多快」是两件事（速度另有 density/batch/period）。
# 调用位置：circ/apply 在「默认值写完、情形覆盖之前」调它 ⇒ 天气/维度照样能往上盖。
# 下限保护：结果至少 1，否则 0 会让该类永远不刷（静默失效）。

scoreboard players operation $eff.max_monster doom.nats *= $cfg.qty doom.nats
scoreboard players operation $eff.max_monster doom.nats /= #100 doom.nats
execute if score $eff.max_monster doom.nats matches ..0 run scoreboard players set $eff.max_monster doom.nats 1
scoreboard players operation $eff.max_creature doom.nats *= $cfg.qty doom.nats
scoreboard players operation $eff.max_creature doom.nats /= #100 doom.nats
execute if score $eff.max_creature doom.nats matches ..0 run scoreboard players set $eff.max_creature doom.nats 1
scoreboard players operation $eff.max_ambient doom.nats *= $cfg.qty doom.nats
scoreboard players operation $eff.max_ambient doom.nats /= #100 doom.nats
execute if score $eff.max_ambient doom.nats matches ..0 run scoreboard players set $eff.max_ambient doom.nats 1
scoreboard players operation $eff.max_water_creature doom.nats *= $cfg.qty doom.nats
scoreboard players operation $eff.max_water_creature doom.nats /= #100 doom.nats
execute if score $eff.max_water_creature doom.nats matches ..0 run scoreboard players set $eff.max_water_creature doom.nats 1
scoreboard players operation $eff.max_water_ambient doom.nats *= $cfg.qty doom.nats
scoreboard players operation $eff.max_water_ambient doom.nats /= #100 doom.nats
execute if score $eff.max_water_ambient doom.nats matches ..0 run scoreboard players set $eff.max_water_ambient doom.nats 1
scoreboard players operation $eff.max_underground_water_creature doom.nats *= $cfg.qty doom.nats
scoreboard players operation $eff.max_underground_water_creature doom.nats /= #100 doom.nats
execute if score $eff.max_underground_water_creature doom.nats matches ..0 run scoreboard players set $eff.max_underground_water_creature doom.nats 1
scoreboard players operation $eff.max_axolotls doom.nats *= $cfg.qty doom.nats
scoreboard players operation $eff.max_axolotls doom.nats /= #100 doom.nats
execute if score $eff.max_axolotls doom.nats matches ..0 run scoreboard players set $eff.max_axolotls doom.nats 1
