# doom.nats:exp/gy_6 —— counts.groupByY 第 6 段
# 由 row 逐段调用（顺序即优先级：后面的段覆盖前面的段）。
data modify storage doom.nats:exp_rt b set value {yMin:-2147483648,yMax:2147483647,min:1,max:1}
data modify storage doom.nats:exp_rt b merge from storage doom.nats:exp_rt gy[6]
execute if data storage doom.nats:exp_rt gy[6].min if data storage doom.nats:exp_rt gy[6].max run function doom.nats:exp/band_group with storage doom.nats:exp_rt b
