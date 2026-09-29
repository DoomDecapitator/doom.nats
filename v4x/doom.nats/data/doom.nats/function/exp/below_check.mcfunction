# doom.nats:exp/below_check —— 规则补丁里的 belowAny：逐条 `if block ~ ~-1 ~ <标签>`
# 调用点：check/block 开头（仅当该物种有补丁且首个槽位存在时）。命中即置 $chk.belowok=1，
# 于是 place 0/4 的"下方必须可站立"判定多一条放行条件（与构建期 belowAny 同语义）。
execute if data storage doom.nats:exp_rt w0 run function doom.nats:exp/below_one with storage doom.nats:exp_rt w0
execute if data storage doom.nats:exp_rt w1 run function doom.nats:exp/below_one with storage doom.nats:exp_rt w1
execute if data storage doom.nats:exp_rt w2 run function doom.nats:exp/below_one with storage doom.nats:exp_rt w2
execute if data storage doom.nats:exp_rt w3 run function doom.nats:exp/below_one with storage doom.nats:exp_rt w3
execute if data storage doom.nats:exp_rt w4 run function doom.nats:exp/below_one with storage doom.nats:exp_rt w4
execute if data storage doom.nats:exp_rt w5 run function doom.nats:exp/below_one with storage doom.nats:exp_rt w5
execute if data storage doom.nats:exp_rt w6 run function doom.nats:exp/below_one with storage doom.nats:exp_rt w6
execute if data storage doom.nats:exp_rt w7 run function doom.nats:exp/below_one with storage doom.nats:exp_rt w7
