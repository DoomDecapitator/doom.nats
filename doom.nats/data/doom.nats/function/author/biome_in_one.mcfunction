# doom.nats:author/biome_in_one [MACRO] —— 白名单单条：命中即置 $auth.bok=1
# 用法：function doom.nats:author/biome_in_one with storage doom.nats:author_rt:v.m<i>（{b:"#minecraft:is_overworld"}）
$execute if biome ~ ~ ~ $(b) run scoreboard players set $auth.bok doom.nats 1
