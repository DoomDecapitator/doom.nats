# doom.nats:author/emit_rt [MACRO] —— 运行时刻条目的生成（由 spawn/emit 在 $auth.hit=1 时调用）
# 用法：function doom.nats:author/emit_rt with storage doom.nats:sel
# 与香草路径的差别：不走 post/<slug> 的"组数据层"包装（条目自带 slug 时才走组数据）。
$execute summon $(type) run function doom.nats:author/post_rt with storage doom.nats:sel
