# doom.nats:exp/export —— 把当前覆盖打成一条可复制的命令
# 输出一条 `/data modify storage doom.nats:exp set value {…}`：粘到任何存档/别的实例都能复现同一套覆盖。
scoreboard players set $exp.f0 doom.nats 0
execute if data storage doom.nats:exp entityRules run scoreboard players set $exp.f0 doom.nats 1
execute if data storage doom.nats:exp entries[0] run scoreboard players set $exp.f0 doom.nats 1
execute if data storage doom.nats:exp counts run scoreboard players set $exp.f0 doom.nats 1
execute if score $exp.f0 doom.nats matches 1 run data modify storage doom.nats:exp_rt export set value {}
execute if score $exp.f0 doom.nats matches 1 run data modify storage doom.nats:exp_rt export.x set from storage doom.nats:exp
execute unless score $exp.f0 doom.nats matches 1 run tellraw @s [{"text":"（本层为空，没有可导出的覆盖）","color":"gray"}]
execute if score $exp.f0 doom.nats matches 1 run tellraw @s [{"text":"/data modify storage doom.nats:exp set value ","color":"gray"},{"nbt":"x","storage":"doom.nats:exp_rt","interpret":false}]
execute if score $exp.f0 doom.nats matches 1 run function doom.nats:exp/export_say with storage doom.nats:exp_rt export

