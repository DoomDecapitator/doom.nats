# doom.nats:exp/reset —— 清空本层（回到上一层行为）
# 契约：reset 之后与"从来没有这一层"逐条一致（回到稳定层 = 原版语义）。
# 注意：data remove storage <id> 必须带 path ⇒ 按本层的三个键逐个删（作者额外塞的键不在契约内）
data remove storage doom.nats:exp entityRules
data remove storage doom.nats:exp entries
data remove storage doom.nats:exp counts
function doom.nats:exp/load
say [nats.exp] reset：实验性层（非原版）已清空
tellraw @s [{"text":"实验性层（非原版）已清空：storage doom.nats:exp 删除。","color":"green"}]

