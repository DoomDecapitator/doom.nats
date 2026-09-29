# doom.nats:exp/enable —— 打开实验性总开关（实验性能力只在这个开关为 1 时生效）
# 引擎级 `features` 决定"能不能装"；这个开关决定"行为回不回滚"，两者配合见 docs/18。
data modify storage doom.nats:exp enabled set value 1b
function doom.nats:exp/load
tellraw @s [{"text":"实验性层：已开启（非原版能力生效）","color":"gold"}]

