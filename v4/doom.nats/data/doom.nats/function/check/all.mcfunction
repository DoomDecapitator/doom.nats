# doom.nats:check/all —— 按源码顺序串联判定；任一步失败即短路并记下原因
scoreboard players set $chk.ok doom.nats 1
scoreboard players set $chk.reason doom.nats 0
execute if score $chk.ok doom.nats matches 1 run function doom.nats:check/distance
execute if score $chk.ok doom.nats matches 1 run function doom.nats:check/border
execute if score $chk.ok doom.nats matches 1 run function doom.nats:check/light
execute if score $chk.ok doom.nats matches 1 run function doom.nats:check/block
execute if score $chk.ok doom.nats matches 1 run function doom.nats:check/entity
execute if score $chk.ok doom.nats matches 1 run function doom.nats:check/cap with storage doom.nats:sel
execute if score $chk.ok doom.nats matches 1 run function doom.nats:check/cost
