# doom.nats:author/load —— 装载/刷新运行时刻作者层（默认空 ⇒ 完全静默）
# 由 core/setup 在每次装载时调用；玩家改完 storage 也可以手动跑一次（不跑也生效：判定当场读 storage）。
# "装载"做的事：清掉上一次的运行缓存 + 重算覆盖摘要 + 打一行日志。
# 注意：data remove storage <id> 必须带 path（真机实测：不带 path 报 Unknown or incomplete command）
data remove storage doom.nats:author_rt cur
data remove storage doom.nats:author_rt hit
data remove storage doom.nats:author_rt gy
data remove storage doom.nats:author_rt cap
scoreboard players set $auth.loaded doom.nats 0
scoreboard players set $auth.hit doom.nats 0
scoreboard players set $auth.hook doom.nats 0
scoreboard players set $auth.cap doom.nats -1
scoreboard players set $auth.lmax doom.nats -1
scoreboard players set $chk.belowok doom.nats 0
function doom.nats:author/summary
execute if score $auth.n doom.nats matches 1.. run function doom.nats:author/say_summary with storage doom.nats:author_rt sum
execute if score $auth.f1 doom.nats matches 1 run function doom.nats:author/say_summary with storage doom.nats:author_rt sum
execute if score $auth.f2 doom.nats matches 1 run function doom.nats:author/say_summary with storage doom.nats:author_rt sum
execute if score $auth.f3 doom.nats matches 1 run function doom.nats:author/say_summary with storage doom.nats:author_rt sum

