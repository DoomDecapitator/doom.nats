# doom.nats:author/summary —— 数一遍当前覆盖
# 结果写 doom.nats:author_rt:sum（n / rules / gy / cap）
# 覆盖摘要（同时供 load 与 show 用）：条目数用固定槽位枚举（上限 8），不做运行期遍历。
scoreboard players set $auth.n doom.nats 0
execute if data storage doom.nats:author entries[0] run scoreboard players set $auth.n doom.nats 1
execute if data storage doom.nats:author entries[1] run scoreboard players set $auth.n doom.nats 2
execute if data storage doom.nats:author entries[2] run scoreboard players set $auth.n doom.nats 3
execute if data storage doom.nats:author entries[3] run scoreboard players set $auth.n doom.nats 4
execute if data storage doom.nats:author entries[4] run scoreboard players set $auth.n doom.nats 5
execute if data storage doom.nats:author entries[5] run scoreboard players set $auth.n doom.nats 6
execute if data storage doom.nats:author entries[6] run scoreboard players set $auth.n doom.nats 7
execute if data storage doom.nats:author entries[7] run scoreboard players set $auth.n doom.nats 8
scoreboard players set $auth.f1 doom.nats 0
execute if data storage doom.nats:author entityRules run scoreboard players set $auth.f1 doom.nats 1
scoreboard players set $auth.f2 doom.nats 0
execute if data storage doom.nats:author counts.groupByY run scoreboard players set $auth.f2 doom.nats 1
scoreboard players set $auth.f3 doom.nats 0
execute if data storage doom.nats:author counts.capByY run scoreboard players set $auth.f3 doom.nats 1
execute store result storage doom.nats:author_rt sum.n int 1 run scoreboard players get $auth.n doom.nats
execute store result storage doom.nats:author_rt sum.rules int 1 run scoreboard players get $auth.f1 doom.nats
execute store result storage doom.nats:author_rt sum.gy int 1 run scoreboard players get $auth.f2 doom.nats
execute store result storage doom.nats:author_rt sum.cap int 1 run scoreboard players get $auth.f3 doom.nats
