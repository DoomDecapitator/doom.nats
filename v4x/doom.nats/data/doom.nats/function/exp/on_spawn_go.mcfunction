# doom.nats:exp/on_spawn_go [MACRO] —— on_spawn 演出钩子派发（@s = 刚生成的实体）
# 用法：function doom.nats:exp/on_spawn_go with storage doom.nats:exp_rt:hit（hit.id = 条目 id）
# 契约：没有 doom.nats:exp/on_spawn/<id> 这个函数时，**只有本函数中止**（真机验过：嵌套失败不会中止调用者），
#   实体的生成与收尾照常完成 ⇒ 空钩子 = 与上一层一致的生成行为。
$function doom.nats:exp/on_spawn/$(id)
