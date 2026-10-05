# doom.nats:circ/load —— 装载 Circumstance 注册表
#
# 条目结构：{ when: {...}, effects: {...} }
#   when  判定维度：weather(clear|rain|thunder) · time(day|night) · phase(月相 0..7) · dim(0|1|2)
#                  · players(1|many) · yBand(min..max) · biome(标签)
#   effects 覆盖项：period · cap_<category> · lightRule · allow/deny · chargeScale
#
# 注册方式：加一条 data modify + 一行 function doom.nats:circ/eval（见 eval 的遍历表）
data modify storage doom.nats:circ reg set value {}
data modify storage doom.nats:circ active set value {}

# 示例条目（可删）：雨夜提高怪物节拍与上限
data modify storage doom.nats:circ reg.rainy_night set value {when:{weather:1,time:1},effects:{period:3,cap_monster:90}}
# 示例条目：雷暴（原版 skyDarken=10 让刷怪更容易，这里显式化）
data modify storage doom.nats:circ reg.thunder set value {when:{weather:2},effects:{period:2,cap_monster:100}}
# 示例条目：多人（per-player cap 各自独立，这里放宽全局节拍）
data modify storage doom.nats:circ reg.multiplayer set value {when:{players:2},effects:{period:4}}

scoreboard players set $circ_loaded doom.nats 1
