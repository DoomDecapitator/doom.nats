# doom.nats:author/band_cap_lmax [MACRO] —— 一段里命中 Y 区间就给出每玩家上限
# 用法：function doom.nats:author/band_cap_lmax with storage doom.nats:author_rt b
$execute if score $py doom.nats matches $(yMin)..$(yMax) run scoreboard players set $auth.lmax doom.nats $(localMax)
