# doom.nats:author/row [MACRO] —— 选中物种后的运行时刻装载（每组一次）
# 用法：function doom.nats:author/row with storage doom.nats:sel
# ① 规则补丁：先铺默认值（保证宏占位符齐全），再合并该物种的补丁
data modify storage doom.nats:author_rt cur set value {yMin:-2147483648,yMax:2147483647,lightMax:15,lightMin:0,weather:"any",place:"",light:"",persist:0}
scoreboard players set $auth.loaded doom.nats 0
$execute if data storage doom.nats:author entityRules."$(type)" run data modify storage doom.nats:author_rt cur merge from storage doom.nats:author entityRules."$(type)"
$execute if data storage doom.nats:author entityRules."$(type)" run function doom.nats:author/rule_on
execute if score $auth.loaded doom.nats matches 1 run function doom.nats:author/rule_place
# ② 组大小随 Y（counts.groupByY.<实体>）
data remove storage doom.nats:author_rt gy
$execute if data storage doom.nats:author counts.groupByY."$(type)" run data modify storage doom.nats:author_rt gy set from storage doom.nats:author counts.groupByY."$(type)"
execute if data storage doom.nats:author_rt gy[0] run function doom.nats:author/gy_0
execute if data storage doom.nats:author_rt gy[1] run function doom.nats:author/gy_1
execute if data storage doom.nats:author_rt gy[2] run function doom.nats:author/gy_2
execute if data storage doom.nats:author_rt gy[3] run function doom.nats:author/gy_3
execute if data storage doom.nats:author_rt gy[4] run function doom.nats:author/gy_4
execute if data storage doom.nats:author_rt gy[5] run function doom.nats:author/gy_5
execute if data storage doom.nats:author_rt gy[6] run function doom.nats:author/gy_6
execute if data storage doom.nats:author_rt gy[7] run function doom.nats:author/gy_7

