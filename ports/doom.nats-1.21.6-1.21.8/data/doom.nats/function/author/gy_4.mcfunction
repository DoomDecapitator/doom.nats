# doom.nats:author/gy_4 —— counts.groupByY 第 4 段
# 由 row 逐段调用（顺序即优先级：后面的段覆盖前面的段）。
data modify storage doom.nats:author_rt b set value {yMin:-2147483648,yMax:2147483647,min:1,max:1}
data modify storage doom.nats:author_rt b merge from storage doom.nats:author_rt gy[4]
execute if data storage doom.nats:author_rt gy[4].min if data storage doom.nats:author_rt gy[4].max run function doom.nats:author/band_group with storage doom.nats:author_rt b
