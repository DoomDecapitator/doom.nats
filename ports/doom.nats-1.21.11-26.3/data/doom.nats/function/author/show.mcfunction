# doom.nats:author/show —— 打印当前覆盖（聊天栏 + 日志）
# 完整 SNBT 用 `data get storage` 打给执行者（可直接复制去别处）；摘要打给聊天栏与日志。
function doom.nats:author/summary
tellraw @s [{"text":"=== doom.nats 运行时刻作者层 ===","color":"aqua"},{"text":"  条目 ","color":"gray"},{"score":{"name":"$auth.n","objective":"doom.nats"}},{"text":" 条 · entityRules ","color":"gray"},{"score":{"name":"$auth.f1","objective":"doom.nats"}},{"text":" · groupByY ","color":"gray"},{"score":{"name":"$auth.f2","objective":"doom.nats"}},{"text":" · capByY ","color":"gray"},{"score":{"name":"$auth.f3","objective":"doom.nats"}}]
data get storage doom.nats:author
function doom.nats:author/say_summary with storage doom.nats:author_rt sum

