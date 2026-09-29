# doom.nats:author/cap_2 —— counts.capByY 第 2 段
# 由 cap_scan 逐段调用（顺序即优先级）。
data modify storage doom.nats:author_rt b set value {yMin:-2147483648,yMax:2147483647,max:-1,localMax:-1}
data modify storage doom.nats:author_rt b merge from storage doom.nats:author_rt cap[2]
execute if data storage doom.nats:author_rt cap[2].max run function doom.nats:author/band_cap_max with storage doom.nats:author_rt b
execute if data storage doom.nats:author_rt cap[2].localMax run function doom.nats:author/band_cap_lmax with storage doom.nats:author_rt b
