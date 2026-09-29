# doom.nats:exp/show —— 打印当前覆盖（聊天栏 + 日志）
# 完整 SNBT 用 `data get storage` 打给执行者（可直接复制去别处）；摘要打给聊天栏与日志。
function doom.nats:exp/summary
tellraw @s [{"text":"=== doom.nats 实验性层（非原版） ===","color":"aqua"},{"text":"  条目 ","color":"gray"},{"score":{"name":"$exp.n","objective":"doom.nats"}},{"text":" 条 · entityRules ","color":"gray"},{"score":{"name":"$exp.f1","objective":"doom.nats"}},{"text":" · groupByY ","color":"gray"},{"score":{"name":"$exp.f2","objective":"doom.nats"}},{"text":" · capByY ","color":"gray"},{"score":{"name":"$exp.f3","objective":"doom.nats"}},{"text":" · 实验性开关 ","color":"gold"},{"score":{"name":"$exp.on","objective":"doom.nats"}}]
data get storage doom.nats:exp
# SPEC 追加 #4 第 3 条：show 里要能看到"实验性开关 + 最近一次命中的条目"（开关已在上面的 tellraw 里）
execute if data storage doom.nats:exp_rt hit.id run tellraw @s [{"text":"  最近一次命中的条目：","color":"gold"},{"nbt":"hit.id","storage":"doom.nats:exp_rt","interpret":false}]
execute unless data storage doom.nats:exp_rt hit.id run tellraw @s [{"text":"  最近一次命中的条目：（还没有命中过）","color":"dark_gray"}]
function doom.nats:exp/say_summary with storage doom.nats:exp_rt sum

