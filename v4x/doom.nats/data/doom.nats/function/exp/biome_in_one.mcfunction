# doom.nats:exp/biome_in_one [MACRO] —— 白名单单条：命中即置 $exp.bok=1
# 用法：function doom.nats:exp/biome_in_one with storage doom.nats:exp_rt:v.m<i>（{b:"#minecraft:is_overworld"}）
$execute if biome ~ ~ ~ $(b) run scoreboard players set $exp.bok doom.nats 1
