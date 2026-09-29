# doom.nats:exp/row [MACRO] —— 选中物种后的运行时刻装载（每组一次）
# 用法：function doom.nats:exp/row with storage doom.nats:sel
# ① 规则补丁：先铺默认值（保证宏占位符齐全），再合并该物种的补丁
data modify storage doom.nats:exp_rt cur set value {yMin:-2147483648,yMax:2147483647,lightMax:15,lightMin:0,weather:"any",place:"",light:"",persist:0}
scoreboard players set $exp.loaded doom.nats 0
$execute if data storage doom.nats:exp entityRules."$(type)" run data modify storage doom.nats:exp_rt cur merge from storage doom.nats:exp entityRules."$(type)"
$execute if data storage doom.nats:exp entityRules."$(type)" run function doom.nats:exp/rule_on
execute if score $exp.loaded doom.nats matches 1 run function doom.nats:exp/rule_place
# ② 组大小随 Y（counts.groupByY.<实体>）
data remove storage doom.nats:exp_rt gy
$execute if data storage doom.nats:exp counts.groupByY."$(type)" run data modify storage doom.nats:exp_rt gy set from storage doom.nats:exp counts.groupByY."$(type)"
execute if data storage doom.nats:exp_rt gy[0] run function doom.nats:exp/gy_0
execute if data storage doom.nats:exp_rt gy[1] run function doom.nats:exp/gy_1
execute if data storage doom.nats:exp_rt gy[2] run function doom.nats:exp/gy_2
execute if data storage doom.nats:exp_rt gy[3] run function doom.nats:exp/gy_3
execute if data storage doom.nats:exp_rt gy[4] run function doom.nats:exp/gy_4
execute if data storage doom.nats:exp_rt gy[5] run function doom.nats:exp/gy_5
execute if data storage doom.nats:exp_rt gy[6] run function doom.nats:exp/gy_6
execute if data storage doom.nats:exp_rt gy[7] run function doom.nats:exp/gy_7

