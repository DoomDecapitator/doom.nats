# doom.nats:exp/rule_on —— 展开规则补丁里的数组（belowAny / biomeIn / biomeNot）
# 数组元素是**字符串**，不能直接当宏源（宏源必须是复合标签）⇒ 逐个包成 {t:…}/{b:…} 再交给宏。
# 上限：落位面标签 8 条、群系白/黑名单各 4 条。
scoreboard players set $exp.loaded doom.nats 1
scoreboard players set $chk.belowok doom.nats 0
data remove storage doom.nats:exp_rt w0
execute if data storage doom.nats:exp_rt cur.belowAny[0] run data modify storage doom.nats:exp_rt w0.t set from storage doom.nats:exp_rt cur.belowAny[0]
data remove storage doom.nats:exp_rt w1
execute if data storage doom.nats:exp_rt cur.belowAny[1] run data modify storage doom.nats:exp_rt w1.t set from storage doom.nats:exp_rt cur.belowAny[1]
data remove storage doom.nats:exp_rt w2
execute if data storage doom.nats:exp_rt cur.belowAny[2] run data modify storage doom.nats:exp_rt w2.t set from storage doom.nats:exp_rt cur.belowAny[2]
data remove storage doom.nats:exp_rt w3
execute if data storage doom.nats:exp_rt cur.belowAny[3] run data modify storage doom.nats:exp_rt w3.t set from storage doom.nats:exp_rt cur.belowAny[3]
data remove storage doom.nats:exp_rt w4
execute if data storage doom.nats:exp_rt cur.belowAny[4] run data modify storage doom.nats:exp_rt w4.t set from storage doom.nats:exp_rt cur.belowAny[4]
data remove storage doom.nats:exp_rt w5
execute if data storage doom.nats:exp_rt cur.belowAny[5] run data modify storage doom.nats:exp_rt w5.t set from storage doom.nats:exp_rt cur.belowAny[5]
data remove storage doom.nats:exp_rt w6
execute if data storage doom.nats:exp_rt cur.belowAny[6] run data modify storage doom.nats:exp_rt w6.t set from storage doom.nats:exp_rt cur.belowAny[6]
data remove storage doom.nats:exp_rt w7
execute if data storage doom.nats:exp_rt cur.belowAny[7] run data modify storage doom.nats:exp_rt w7.t set from storage doom.nats:exp_rt cur.belowAny[7]
data remove storage doom.nats:exp_rt v
execute if data storage doom.nats:exp_rt cur.biomeIn[0] run data modify storage doom.nats:exp_rt v.m0.b set from storage doom.nats:exp_rt cur.biomeIn[0]
execute if data storage doom.nats:exp_rt cur.biomeIn[1] run data modify storage doom.nats:exp_rt v.m1.b set from storage doom.nats:exp_rt cur.biomeIn[1]
execute if data storage doom.nats:exp_rt cur.biomeIn[2] run data modify storage doom.nats:exp_rt v.m2.b set from storage doom.nats:exp_rt cur.biomeIn[2]
execute if data storage doom.nats:exp_rt cur.biomeIn[3] run data modify storage doom.nats:exp_rt v.m3.b set from storage doom.nats:exp_rt cur.biomeIn[3]
data remove storage doom.nats:exp_rt n
execute if data storage doom.nats:exp_rt cur.biomeNot[0] run data modify storage doom.nats:exp_rt n.m0.b set from storage doom.nats:exp_rt cur.biomeNot[0]
execute if data storage doom.nats:exp_rt cur.biomeNot[1] run data modify storage doom.nats:exp_rt n.m1.b set from storage doom.nats:exp_rt cur.biomeNot[1]
execute if data storage doom.nats:exp_rt cur.biomeNot[2] run data modify storage doom.nats:exp_rt n.m2.b set from storage doom.nats:exp_rt cur.biomeNot[2]
execute if data storage doom.nats:exp_rt cur.biomeNot[3] run data modify storage doom.nats:exp_rt n.m3.b set from storage doom.nats:exp_rt cur.biomeNot[3]

