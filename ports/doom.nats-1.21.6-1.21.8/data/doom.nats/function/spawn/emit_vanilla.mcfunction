# doom.nats:spawn/emit_vanilla [MACRO] —— 香草路径的 summon（包装层 author/post_chain 会补 on_spawn 钩子）
# 用法：function doom.nats:spawn/emit_vanilla with storage doom.nats:sel（在**玩家**上下文里调用）
$execute summon $(type) run function doom.nats:post/$(slug) with storage doom.nats:sel
