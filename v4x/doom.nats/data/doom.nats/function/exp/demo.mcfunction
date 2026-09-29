# doom.nats:exp/demo —— 命令面演示（必须显式开闸，会写入本层覆盖）
# 用法：scoreboard players set $exp.demo doom.nats 1
#       function doom.nats:exp/demo
#       function doom.nats:exp/reset      ← 演示完想还原就跑这个
execute unless score $exp.demo doom.nats matches 1 run tellraw @s [{"text":"演示未开闸：先 scoreboard players set $exp.demo doom.nats 1","color":"yellow"}]
execute if score $exp.demo doom.nats matches 1 run function doom.nats:exp/demo_run
execute if score $exp.demo doom.nats matches 1 run scoreboard players set $exp.demo doom.nats 0

