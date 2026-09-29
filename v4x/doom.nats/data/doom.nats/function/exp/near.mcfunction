# doom.nats:exp/near [MACRO] —— 关系条件 when.near（**实验性 · 非原版**：原版里没有这种耦合）
# 用法：function doom.nats:exp/near with storage doom.nats:exp_rt:near（{type:"#doom.nats:creature",radius:24,min:1,max:…}）
# 语义：以**候选点**为圆心数一次实体（type 可为实体标签或 id），要求 min ≤ 数量 ≤ max。
$execute store result score $exp.near doom.nats if entity @e[type=$(type),distance=..$(radius)]
$execute if score $exp.ok doom.nats matches 1 unless score $exp.near doom.nats matches $(min).. run scoreboard players set $exp.ok doom.nats 0
$execute if score $exp.ok doom.nats matches 1 unless score $exp.near doom.nats matches ..$(max) run scoreboard players set $exp.ok doom.nats 0
