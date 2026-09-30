# doom.nats:author/cap_7 —— counts.capByY 第 7 段
# 由 cap_scan 逐段调用（顺序即优先级）。
data modify storage doom.nats:author_rt b set value {yMin:-2147483648,yMax:2147483647,max:-1,localMax:-1}
data modify storage doom.nats:author_rt b merge from storage doom.nats:author_rt cap[7]
execute if data storage doom.nats:author_rt cap[7].max run function doom.nats:author/band_cap_max with storage doom.nats:author_rt b
execute if data storage doom.nats:author_rt cap[7].localMax run function doom.nats:author/band_cap_lmax with storage doom.nats:author_rt b
