# doom.nats:exp/summary —— 数一遍当前覆盖
# 结果写 doom.nats:exp_rt:sum（n / rules / gy / cap / on）
# 覆盖摘要（同时供 load 与 show 用）：条目数用固定槽位枚举（上限 8），不做运行期遍历。
scoreboard players set $exp.n doom.nats 0
execute if data storage doom.nats:exp entries[0] run scoreboard players set $exp.n doom.nats 1
execute if data storage doom.nats:exp entries[1] run scoreboard players set $exp.n doom.nats 2
execute if data storage doom.nats:exp entries[2] run scoreboard players set $exp.n doom.nats 3
execute if data storage doom.nats:exp entries[3] run scoreboard players set $exp.n doom.nats 4
execute if data storage doom.nats:exp entries[4] run scoreboard players set $exp.n doom.nats 5
execute if data storage doom.nats:exp entries[5] run scoreboard players set $exp.n doom.nats 6
execute if data storage doom.nats:exp entries[6] run scoreboard players set $exp.n doom.nats 7
execute if data storage doom.nats:exp entries[7] run scoreboard players set $exp.n doom.nats 8
scoreboard players set $exp.f1 doom.nats 0
execute if data storage doom.nats:exp entityRules run scoreboard players set $exp.f1 doom.nats 1
scoreboard players set $exp.f2 doom.nats 0
execute if data storage doom.nats:exp counts.groupByY run scoreboard players set $exp.f2 doom.nats 1
scoreboard players set $exp.f3 doom.nats 0
execute if data storage doom.nats:exp counts.capByY run scoreboard players set $exp.f3 doom.nats 1
scoreboard players set $exp.on doom.nats 0
execute if data storage doom.nats:exp enabled run execute store result score $exp.on doom.nats run data get storage doom.nats:exp enabled
execute store result storage doom.nats:exp_rt sum.n int 1 run scoreboard players get $exp.n doom.nats
execute store result storage doom.nats:exp_rt sum.rules int 1 run scoreboard players get $exp.f1 doom.nats
execute store result storage doom.nats:exp_rt sum.gy int 1 run scoreboard players get $exp.f2 doom.nats
execute store result storage doom.nats:exp_rt sum.cap int 1 run scoreboard players get $exp.f3 doom.nats
execute store result storage doom.nats:exp_rt sum.on int 1 run scoreboard players get $exp.on doom.nats
