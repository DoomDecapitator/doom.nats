# doom.nats:exp/disable —— 关掉实验性总开关（= 行为回滚到稳定层/原版）
# 条目与规则都留着不动，只是整层不再参与判定 ⇒ 一个命令即可回滚。
data modify storage doom.nats:exp enabled set value 0b
function doom.nats:exp/load
tellraw @s [{"text":"实验性层：已关闭（行为回到稳定层/原版）","color":"gold"}]

