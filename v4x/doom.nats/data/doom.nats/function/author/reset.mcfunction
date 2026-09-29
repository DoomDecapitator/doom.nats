# doom.nats:author/reset —— 清空本层（回到上一层行为）
# 契约：reset 之后与"从来没有这一层"逐条一致（回到原版）。
# 注意：data remove storage <id> 必须带 path ⇒ 按本层的三个键逐个删（作者额外塞的键不在契约内）
data remove storage doom.nats:author entityRules
data remove storage doom.nats:author entries
data remove storage doom.nats:author counts
function doom.nats:author/load
say [nats.author] reset：运行时刻作者层已清空
tellraw @s [{"text":"运行时刻作者层已清空：storage doom.nats:author 删除。","color":"green"}]

