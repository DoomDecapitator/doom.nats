# doom.nats:exp/load —— 装载/刷新实验性层（非原版）（默认空 ⇒ 完全静默）
# 由 core/setup 在每次装载时调用；玩家改完 storage 也可以手动跑一次（不跑也生效：判定当场读 storage）。
# "装载"做的事：清掉上一次的运行缓存 + 重算覆盖摘要 + 打一行日志。
# 注意：data remove storage <id> 必须带 path（真机实测：不带 path 报 Unknown or incomplete command）
data remove storage doom.nats:exp_rt cur
data remove storage doom.nats:exp_rt hit
data remove storage doom.nats:exp_rt gy
data remove storage doom.nats:exp_rt cap
scoreboard players set $exp.loaded doom.nats 0
scoreboard players set $exp.hit doom.nats 0
scoreboard players set $exp.hook doom.nats 0
scoreboard players set $exp.cap doom.nats -1
scoreboard players set $exp.lmax doom.nats -1
scoreboard players set $chk.belowok doom.nats 0
function doom.nats:exp/summary
execute if score $exp.n doom.nats matches 1.. run function doom.nats:exp/say_summary with storage doom.nats:exp_rt sum
execute if score $exp.f1 doom.nats matches 1 run function doom.nats:exp/say_summary with storage doom.nats:exp_rt sum
execute if score $exp.f2 doom.nats matches 1 run function doom.nats:exp/say_summary with storage doom.nats:exp_rt sum
execute if score $exp.f3 doom.nats matches 1 run function doom.nats:exp/say_summary with storage doom.nats:exp_rt sum
execute if score $exp.on doom.nats matches 1 run function doom.nats:exp/say_summary with storage doom.nats:exp_rt sum

