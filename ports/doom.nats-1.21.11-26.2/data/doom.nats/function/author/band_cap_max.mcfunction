# doom.nats:author/band_cap_max [MACRO] —— 一段里命中 Y 区间就给出全局容量
# 用法：function doom.nats:author/band_cap_max with storage doom.nats:author_rt b
$execute if score $py doom.nats matches $(yMin)..$(yMax) run scoreboard players set $auth.cap doom.nats $(max)
