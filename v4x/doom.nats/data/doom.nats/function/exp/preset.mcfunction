# doom.nats:exp/preset [MACRO] —— 应用一个预设
# 用法：data merge storage doom.nats:exp_in {name:"blood_moon"}
#       function doom.nats:exp/preset     （内置：blood_moon / storm_season / deep_dark）
# 名字校验的写法：不能写 if data storage <id>{name:…}（storage 的 data 谓词**必须带 path**，真机报 trailing data）
#   ⇒ 改成"先派发、成功才置 $exp.p=1"：名字未知时只有 preset_do 自己中止（嵌套失败不连坐调用者），
#     于是 $exp.p 仍是 0，下面那行就给出可用的名字清单。
scoreboard players set $exp.p doom.nats 0
execute if data storage doom.nats:exp_in name run function doom.nats:exp/preset_do with storage doom.nats:exp_in
execute if score $exp.p doom.nats matches 1 run function doom.nats:exp/say_summary with storage doom.nats:exp_rt sum
execute if score $exp.p doom.nats matches 0 run tellraw @s [{"text":"未知或缺失的预设名。可用：blood_moon / storm_season / deep_dark","color":"red"}]
