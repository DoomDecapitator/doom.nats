# doom.nats:exp/post_chain [MACRO] —— 香草生成路径的收尾包装（post/<slug> + on_spawn 钩子）
# 用法：function doom.nats:exp/post_chain with storage doom.nats:sel（由 spawn/emit_vanilla 的 execute summon 调用，@s=新实体）
# 为什么要这一层：on_spawn 必须跑在"@s = 新实体"的上下文里，而 spawn/emit 的 @s 是玩家。
$function doom.nats:post/$(slug) with storage doom.nats:sel
execute if score $exp.hook doom.nats matches 1 run function doom.nats:exp/on_spawn_go with storage doom.nats:exp_rt hit
