# doom.nats:exp/cap_3 —— counts.capByY 第 3 段
# 由 cap_scan 逐段调用（顺序即优先级）。
data modify storage doom.nats:exp_rt b set value {yMin:-2147483648,yMax:2147483647,max:-1,localMax:-1}
data modify storage doom.nats:exp_rt b merge from storage doom.nats:exp_rt cap[3]
execute if data storage doom.nats:exp_rt cap[3].max run function doom.nats:exp/band_cap_max with storage doom.nats:exp_rt b
execute if data storage doom.nats:exp_rt cap[3].localMax run function doom.nats:exp/band_cap_lmax with storage doom.nats:exp_rt b
