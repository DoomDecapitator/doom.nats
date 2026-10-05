# doom.nats:author/export —— 把当前覆盖打成一条可复制的命令
# 输出一条 `/data modify storage doom.nats:author set value {…}`：粘到任何存档/别的实例都能复现同一套覆盖。
scoreboard players set $auth.f0 doom.nats 0
execute if data storage doom.nats:author entityRules run scoreboard players set $auth.f0 doom.nats 1
execute if data storage doom.nats:author entries[0] run scoreboard players set $auth.f0 doom.nats 1
execute if data storage doom.nats:author counts run scoreboard players set $auth.f0 doom.nats 1
execute if score $auth.f0 doom.nats matches 1 run data modify storage doom.nats:author_rt export set value {}
execute if score $auth.f0 doom.nats matches 1 run data modify storage doom.nats:author_rt export.x set from storage doom.nats:author
execute unless score $auth.f0 doom.nats matches 1 run tellraw @s [{"text":"（本层为空，没有可导出的覆盖）","color":"gray"}]
execute if score $auth.f0 doom.nats matches 1 run tellraw @s [{"text":"/data modify storage doom.nats:author set value ","color":"gray"},{"nbt":"x","storage":"doom.nats:author_rt","interpret":false}]
execute if score $auth.f0 doom.nats matches 1 run function doom.nats:author/export_say with storage doom.nats:author_rt export

